import transformer from '../components/transformer.js';
import emitter from '../components/emitter.js';
import csvMaker from '../components/csv.js';
import u from 'ak-tools';
import jsforce from 'jsforce';
import sqlParse from 'soql-parser-js';
import dayjs from "dayjs";



export default async function salesforce(config, outStream) {
	// todo lookup tables
	// todo insert_ids ???
	// todo resolving nested field names	
	// todo docs + final refactor
	// todo tests... lots of 'em
	
	const { query, ...dwhAuth } = config.dwhAuth();
	let ast;
	try {
		ast = sqlParse.parseQuery(query);
		config.store({ sqlAnalysis: ast });
	} catch (e) {
		if (config.verbose) u.cLog("\ncould not parse SOQL query to AST...\n\tfield label resolution won't work (but the data can still be sent!)\n");
	}

	// * AUTH
	const { user, password, version, prettyLabels } = dwhAuth; // todo diff types of auth: https://jsforce.github.io/document/#connection
	const connection = new jsforce.Connection({ version });
	const login = await connection.login(user, password);
	config.store({ instance: { ...login } });


	// * LOOKUP TABLES
	if (config.type === 'table') {
		// !! todo 
		// emitter.emit('dwh query start', config);
		// const { recordset, rowsAffected } = await (new mssql.Request(pool)).query(query);
		// emitter.emit('dwh query end', config);
		// config.store({ rows: rowsAffected[0] });
		// config.store({ schema: recordset.columns });
		// const mpModel = transformer(config, []);
		// const transformedRows = recordset.map(mpModel);
		// const csv = csvMaker(transformedRows);
		// return csv;
	}

	// * ROW COUNTS
	emitter.emit('dwh query start', config);
	try {
		const getRowCount = await connection.query(query, { autoFetch: true, maxFetch: 1 });
		config.store({ rows: getRowCount.totalSize });
	}
	catch (e) {
		if (config.verbose) u.cLog('error getting row counts', e.message, 'ERROR');
		config.store({ rows: 0 });
	}

	// * METADATA + SCHEMA RESOLUTION
	const schema = await getSchema(ast, connection, config);
	config.store({ schema });
	const dateFields = u.objFilter(schema, f => f.type.includes('date'));
	const schemaLabels = objectMap(schema, scheme => scheme.label);
	emitter.emit('dwh query end', config);

	// * MODELING
	if (config.type === "event") {
		//events get unix epoch
		config.timeTransform = (time) => { return dayjs(time).valueOf(); };
	}
	else {
		//all others get ISO
		config.timeTransform = (time) => { return dayjs(time).format('YYYY-MM-DDTHH:mm:ss'); };
	}
	const mpModel = transformer(config, prettyLabels ? Object.values(dateFields).map(f => f.label) : Object.keys(dateFields));


	// * STREAMING QUERY
	const sfdcStream = connection.query(query, { autoFetch: true, maxFetch: 100000000 });

	return new Promise((resolve, reject) => {
		sfdcStream
			.once("record", () => {
				emitter.emit('dwh stream start', config);
			})
			
			.on("record", function (record) {
				config.got();
				const flatRecord = u.objFilter(flatten(record), k => !k.includes('attributes.'), 'key');
				
				//labeling
				if (prettyLabels) {
					const row = u.rnKeys(flatRecord, schemaLabels);
					outStream.push(mpModel(row));
				}
				else {
					outStream.push(mpModel(flatRecord));
				}
			})
			
			.on("end", function () {
				emitter.emit('dwh stream end', config);
				outStream.push(null);
				connection.logout();
				resolve(config);
			})
			
			.on("error", function (err) {
				reject(err);
			})
			
			.run();

	});
}


// HELPERS
async function getSchema(ast, connection, config) {
	// !! todo... this is currently limited to ONE level of depth; Owner.Name is fine, but Owner.UserRole.Name will not resolve...
	const fieldLabels = {};
	if (ast) {
		try {
			const { sObject: primarySObject, fields: queryFields } = ast;

			// get all relationship fields
			const relationships = u.dedupe(
				queryFields.filter(field => Array.isArray(field.relationships))
					.flatMap(relation => relation.relationships)
					.filter(objName => objName !== primarySObject)
			);

			// get the primary object's metadata ... e.x. "FROM OPPORTUNITY"
			const primSObjectSchema = await connection.sobject(primarySObject).describe();

			// resolve references in query to actual names of related sObjects ... Owner => User
			const references = primSObjectSchema.fields
				.filter(field => relationships.includes(field.relationshipName))
				.map(schema => {
					if (schema.referenceTo.length === 1) {
						return {
							sObject: schema.referenceTo[0],
							context: schema.relationshipName
						};
					}
					// a field may reference multiple sObjects
					const allReferences = [];
					schema.referenceTo.forEach((sObject) => {
						allReferences.push({
							sObject: sObject,
							context: schema.relationshipName
						});
					});

					return allReferences;
				}).flat();


			// grab schemas of all related object and put them in a hashmap
			const allSchemas = {};
			for (const ref of references) {
				if (allSchemas[ref.context]) {
					const newFields = await queryForFields(connection, ref.sObject);
					allSchemas[ref.context] = [...newFields, ...allSchemas[ref.context]];
				}
				else {
					allSchemas[ref.context] = await queryForFields(connection, ref.sObject);
				}
			}
			allSchemas[primarySObject] = getFields(primSObjectSchema);

			//populate field labels by searching for each in the hashmap
			for (const queryField of queryFields) {
				const { rawValue: queryFieldName, field: schemaFieldName, relationships } = queryField;
				try {

					//related fields
					if (Array.isArray(relationships)) {
						const foundField = allSchemas[relationships.slice().pop()].find(desc => desc.apiName === schemaFieldName);
						fieldLabels[queryFieldName] = { label: foundField.label, type: foundField.type };
					}

					//normal fields
					else {
						const foundField = allSchemas[primarySObject].find(desc => desc.apiName === schemaFieldName);
						fieldLabels[schemaFieldName] = { label: foundField.label, type: foundField.type };
					}
				}

				catch (e) {
					// could not resolve pretty name for field... move on
					fieldLabels[queryFieldName] = { label: queryFieldName, type: "string" };
				}

			}

			return fieldLabels;

		}

		catch (e) {
			if (config.verbose) u.cLog('could not get field metadata', e.message, 'NOTICE');
			return {};
		}

	}

	else {
		if (config.verbose) u.cLog('skipping schema + field name resolution');
		return {};
	}
}

async function queryForFields(conn, objectType) {
	const allFields = (await conn.sobject(objectType).describe())?.fields.map((meta) => {
		return {
			apiName: meta.name,
			label: meta.label,
			type: meta.type,
			desc: meta.inlineHelpText,
			ref: meta.referenceTo,
			raw: meta
		};
	});
	return allFields.filter(f => f.type !== "id");

};

function getFields(schema) {
	const fields = schema.fields.map((meta) => {
		return {
			apiName: meta.name,
			label: meta.label,
			type: meta.type,
			desc: meta.inlineHelpText,
			ref: meta.referenceTo,
			raw: meta
		};
	});
	return fields.filter(f => f.type !== "id");
}


// ? https://stackoverflow.com/a/61602592
function flatten(obj, roots = [], sep = '.') {
	// find props of given object
	return Object.keys(obj)
		// return an object by iterating props
		.reduce((memo, prop) => Object.assign(
			// create a new object
			{},
			// include previously returned object
			memo,
			Object.prototype.toString.call(obj[prop]) === '[object Object]'
				// keep working if value is an object
				? flatten(obj[prop], roots.concat([prop]), sep)
				// include current prop and value and prefix prop with the roots
				: { [roots.concat([prop]).join(sep)]: obj[prop] }
		), {});
}

// ? https://stackoverflow.com/a/14810722
function objectMap(object, mapFn) {
	return Object.keys(object).reduce(function (result, key) {
		result[key] = mapFn(object[key]);
		return result;
	}, {});
}