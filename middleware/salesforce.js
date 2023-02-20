import transformer from '../components/transformer.js';
import emitter from '../components/emitter.js';
import csvMaker from '../components/csv.js';
import u from 'ak-tools';
import jsforce from 'jsforce';
import sqlParse from 'soql-parser-js';
import dayjs from "dayjs";



export default async function salesforce(config, outStream) {
	// TODOs 
	// % events (!!!)
	// % resolving of doubly nested field names	i.e. Owner.UserRole.Name
	// % docs

	// * AST
	let ast;
	try {
		ast = sqlParse.parseQuery(config.sql);
		config.store({ sqlAnalysis: ast });

		// $ name resolution unavailable w/FIELDS(ALL)
		if (isUsingFieldsAll(ast)) {
			config.auth.resolve_field_names = false;
			config.auth.rename_primary_id = false;
			// config.auth.add_sfdc_links = false
			if (config.verbose) u.cLog('\n\tappears as FIELDS(ALL) query; schema resolution is turned off');
		}
	} catch (e) {
		if (config.verbose) u.cLog("\ncould not parse SOQL query to AST...\n\tfield label resolution won't work (but the data can still be sent!)\n");
	}

	// * AUTH & OPTIONS
	const { query, ...dwhAuth } = config.dwhAuth();
	const { user, password, version, prettyLabels, renameId, addUrls } = dwhAuth; // $ options

	const connection = new jsforce.Connection({ version });
	const login = await connection.login(user, password);  // ? other auth: https://jsforce.github.io/document/#connection
	config.store({ connection: { ...login } });
	const identity = await connection.identity();
	config.store({ instance: identity });
	const urlPrefix = `${identity.urls?.custom_domain}`;

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
	config.store({ apiLimits: { limit: connection.limitInfo.apiUsage.limit, used: connection.limitInfo.apiUsage.used } });

	const dateFields = u.objFilter(schema, f => f.type.includes('date'));
	const schemaLabels = objectMap(schema, scheme => scheme.label);
	const primaryId = u.objFilter(schema, f => f.type === 'primary_identifier');

	confirmMappings(config, getRowCount, schemaLabels, prettyLabels, renameId);
	emitter.emit('dwh query end', config);

	// * MODELING	
	config.eventTimeTransform = (time) => { return dayjs(time).valueOf(); };
	config.timeTransform = (time) => { return dayjs(time).format('YYYY-MM-DDTHH:mm:ss'); };
	const mpModel = transformer(config, prettyLabels ? Object.values(dateFields).map(f => f.label) : Object.keys(dateFields));

	// * LOOKUP TABLES
	if (config.type === 'table') {
		const { records } = await connection.query(query, { autoFetch: true, maxFetch: 100000000 }); // max size is 2000
		const idKey = Object.keys(primaryId)[0];

		const cleanUpSalesforce = records
			.map((record) => {
				return u.objFilter(flatten(record), k => !k.includes('attributes.'), 'key');
			})
			.map((row) => {
				if (addUrls) row['salesforce link'] = `${urlPrefix}/${row[idKey || 'Id']}`;
				if (prettyLabels) row = u.rnKeys(row, schemaLabels);
				if (renameId) row = u.rnKeys(row, { [idKey]: primaryId[idKey].label });
				return row;
			});

		// want pretty labels but they used the API label
		if (prettyLabels && !cleanUpSalesforce[0][config.mappings.lookup_col]) config.mappings.lookup_col = schemaLabels[config.mappings.lookup_col];

		const mpModel = transformer(config, dateFields);
		const transformedRows = cleanUpSalesforce.map(mpModel);
		const csv = csvMaker(transformedRows);
		return csv;
	}

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
				if (addUrls) row['salesforce link'] = `${urlPrefix}/${row[idKey || 'Id']}`;

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
			let { sObject: primarySObject, fields: queryFields } = ast;

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

function confirmMappings(config, testResult, schemaLabels, prettyLabels, renameId) {
	// $ check mappings to allow api field names or pretty labels in config if pretty labels are applied
	if (testResult?.records) {
		const testRecord = flatten(testResult.records.pop());
		mapLoop: for (const mapping in config.mappings) {
			if (mapping === "profileOperation") continue mapLoop;
			const userInputMapping = config.mappings[mapping];
			const prettyName = schemaLabels[userInputMapping];

			//user put in API name
			if (testRecord[userInputMapping] && prettyName) {
				if (prettyLabels) config.mappings[mapping] = prettyName;
				if (renameId && mapping === 'distinct_id_col') config.mappings[mapping] = prettyName;
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
}

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

function isUsingFieldsAll(ast) {
	const functionFieldCount = ast.fields.filter(f => f.type === 'FieldFunctionExpression').length > 0;
	const isTheAllThing = true;
	if (functionFieldCount > 0 && isTheAllThing) {
		return true;
	}
	
	return false;
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