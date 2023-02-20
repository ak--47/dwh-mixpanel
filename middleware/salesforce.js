import transformer from '../components/transformer.js';
import emitter from '../components/emitter.js';
import csvMaker from '../components/csv.js';
import u from 'ak-tools';
import jsforce from 'jsforce';
import sqlParse from 'soql-parser-js';
import dayjs from "dayjs";



export default async function salesforce(config, outStream) {
	// todo deal with primary id cols
	// todo lookup tables
	// todo resolving of doubly nested field names	i.e. Owner.UserRole.Name
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
	const { user, password, version, prettyLabels, renameId, addUrls } = dwhAuth; //todo renameId???
	const connection = new jsforce.Connection({ version });
	const login = await connection.login(user, password);  // todo diff types of auth: https://jsforce.github.io/document/#connection
	config.store({ connection: { ...login } });
	const identity = await connection.identity();
	config.store({ instance: identity });
	const urlPrefix = `${identity.urls?.custom_domain}`;


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
	let getRowCount;
	try {
		getRowCount = await connection.query(query, { autoFetch: true, maxFetch: 1 });
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
	const primaryId = u.objFilter(schema, f => f.type === 'primary_identifier');
	emitter.emit('dwh query end', config);

	// $ check mappings to allow api field names or pretty labels in config if pretty labels are applied
	if (getRowCount?.records) {
		const testRecord = flatten(getRowCount.records.pop());
		mapLoop: for (const mapping in config.mappings) {
			if (mapping === "profileOperation") continue mapLoop;
			const userInputMapping = config.mappings[mapping];
			const prettyName = schemaLabels[userInputMapping];

			//user put in API name
			if (testRecord[userInputMapping] && prettyName) {
				if (prettyLabels) config.mappings[mapping] = prettyName;
				if (renameId && mapping === 'distinct_id_col')  config.mappings[mapping] = prettyName;
			}
			
			//user put in pretty name
			else if (testRecord[getKeyByValue(schemaLabels, userInputMapping)] && !prettyName) {
				if (!prettyLabels) config.mappings[mapping] = getKeyByValue(schemaLabels, userInputMapping);
			}

			else if (testRecord[userInputMapping]) {
				// noop; it exists
			}

			else {
				if (config.verbose) u.cLog(`label "${config.mappings[mapping]}" not found in source data; "${mapping}" will be undefined in mixpanel`);
			}
		}
	}


	// * MODELING	
	//events get unix epoch
	config.eventTimeTransform = (time) => { return dayjs(time).valueOf(); };
	//all other get ISO
	config.timeTransform = (time) => { return dayjs(time).format('YYYY-MM-DDTHH:mm:ss'); };

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
				let row = u.objFilter(flatten(record), k => !k.includes('attributes.'), 'key');
				const idKey = Object.keys(primaryId)[0];
				//sfdc urls
				if (addUrls) row['salesforce link'] = `${urlPrefix}/${row[idKey]}`;

				//labeling
				if (prettyLabels) row = u.rnKeys(row, schemaLabels);

				//primary id rename
				if (renameId) row = u.rnKeys(row, { [idKey]: primaryId[idKey].label });

				outStream.push(mpModel(row));
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
					// is it the primary object Id?
					if (schemaFieldName === 'Id' && !queryFieldName) {
						fieldLabels[queryFieldName || schemaFieldName] = { label: `${primarySObject}.${queryFieldName || schemaFieldName}`, type: "primary_identifier" };
					}
					else {
						// could not resolve pretty name for field... move on
						fieldLabels[queryFieldName || schemaFieldName] = { label: queryFieldName || schemaFieldName, type: "string" };
					}
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

// ? https://stackoverflow.com/a/28191966
function getKeyByValue(object, value) {
	return Object.keys(object).find(key => object[key] === value);
}