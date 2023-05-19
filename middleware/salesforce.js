import transformer from '../components/transformer.js';
import emitter from '../components/emitter.js';
import csvMaker from '../components/csv.js';
import u from 'ak-tools';
import jsforce from 'jsforce';
import sqlParse from 'soql-parser-js';
import dayjs from "dayjs";



export default async function salesforce(config, outStream) {
	// * AUTH & OPTIONS
	let connection, urlPrefix, query, prettyLabels, renameId, addUrls, user, password, version, dwhAuth;
	try {
		({ query, ...dwhAuth } = config.dwhAuth());
		({ user, password, version, prettyLabels = true, renameId = true, addUrls = true } = dwhAuth); // $ options

		connection = new jsforce.Connection({ version });
		const login = await connection.login(user, password);  // ? other auth: https://jsforce.github.io/document/#connection
		config.store({ connection: { ...login } });
		const identity = await connection.identity();
		config.store({ instance: identity });
		urlPrefix = `${identity.urls?.custom_domain}`;
	}

	catch (e) {
		u.cLog('could not connect to salesforce', e.message, 'ERROR');
		process.exit(0);
	}

	// * AST
	let ast;
	try {
		// % check for SELECT * queries
		if (isSelectStarQuery(config.sql)) query = await resolveSelectStarQueries(config.sql, connection, config);

		// % parse query to AST
		ast = sqlParse.parseQuery(query);
		config.store({ sqlAnalysis: ast });

		// % name resolution unavailable w/FIELDS(ALL)
		if (isUsingFieldsAll(ast)) {
			config.auth.resolve_field_names = false;
			config.auth.rename_primary_id = false;
			// config.auth.add_sfdc_links = false
			if (config.verbose) u.cLog('\n\tappears as FIELDS(ALL) query; schema resolution is turned off');
		}

		// % subqueries are not supported
		const hasSubqueries = isUsingSubqueries(ast);
		if (hasSubqueries) {
			u.cLog(hasSubqueries, `\nSubqueries (with nested objects) are not currently support by this module... please flatten your table an try again:`, 'ERROR');
			process.exit(0);
		}

		// % history queries are treated differently
		if (config.type === 'event') {
			config.store({ fieldHistoryQuery: isFieldHistoryQuery(ast) });
		}
		else {
			config.store({ fieldHistoryQuery: false });
		};

	} catch (e) {
		if (config.verbose) u.cLog("\ncould not parse SOQL query to AST...\n\tfield label resolution won't work (but the data can still be sent!)\n");
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
	config.store({ apiLimits: { limit: connection.limitInfo.apiUsage.limit, used: connection.limitInfo.apiUsage.used } });

	const dateFields = u.objFilter(schema, f => f.type.includes('date'));
	const schemaLabels = objectMap(schema, scheme => scheme.label);
	const primaryId = u.objFilter(schema, f => f.type === 'primary_identifier');
	const sObject = config.dwhStore.sObject;
	const sObjectsSchemas = config.dwhStore.sObjectsSchemas;
	const isHistoryQuery = config.dwhStore.fieldHistoryQuery;
	const event_name_col = config.mappings.event_name_col;
	confirmMappings(config, getRowCount, schemaLabels, prettyLabels, renameId, isHistoryQuery);
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
				let row = u.objFilter(flatten(record), k => !k.includes('attributes.'), 'key');
				const idKey = Object.keys(primaryId)[0];

				// events get special treatment
				if (config.type === 'event') {
					buildEvName(row, sObject, sObjectsSchemas, prettyLabels, isHistoryQuery, event_name_col);
					addInsert(row, sObject, isHistoryQuery);
				}

				//sfdc urls
				if (addUrls) row['salesforce link'] = `${urlPrefix}/${row[idKey || 'Id']}`;

				//pretty labels
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
async function getSchema(ast, connection, config, justSchema = false) {
	// $ note... this is currently limited to ONE level of depth; 
	// $ Owner.Name is fine, but Owner.UserRole.Name will not resolve...
	const fieldLabels = {};
	if (ast) {
		try {
			let { sObject: primarySObject, fields: queryFields } = ast;
			config.store({ sObject: primarySObject });
			// get all relationship fields
			const relationships = u.dedupe(
				queryFields.filter(field => Array.isArray(field.relationships))
					.flatMap(relation => relation.relationships)
					.filter(objName => objName !== primarySObject)
			);

			// get the primary object's metadata ... e.x. "FROM OPPORTUNITY"
			const primSObjectSchema = await connection.sobject(primarySObject).describe();

			if (justSchema) return getFields(primSObjectSchema);


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

			//stash all found fields in the config
			const sObjectsSchemas = [];
			for (const key in allSchemas) {
				for (const scheme of allSchemas[key])
					sObjectsSchemas.push(scheme);
			}
			config.store({ sObjectsSchemas });

			//populate field labels by searching for each in the hashmap
			for (const queryField of queryFields) {
				const { rawValue: queryFieldName, field: schemaFieldName, relationships } = queryField;
				try {
					//don't resolve name, id, and other common fields across many objects
					if (queryFieldName?.includes(".Name")) throw 'name field';
					if (queryFieldName?.includes(".Id")) throw 'id field';
					if (queryFieldName?.includes(".SobjectType")) throw 'sobject field';
					if (schemaFieldName === "Name") throw 'name field';
					if (schemaFieldName === "Id") throw 'id field';
					if (schemaFieldName === "SobjectType") throw 'sobject field';

					//related fields
					if (Array.isArray(relationships)) {
						const foundField = allSchemas[relationships.slice().pop()].find(desc => desc.apiName === schemaFieldName);
						//don't overwrite
						if (Object.keys(u.objFilter(fieldLabels, (s) => s.label === schemaFieldName)).length) {
							throw "exists";
						}
						else {
							fieldLabels[queryFieldName] = { label: foundField.label, type: foundField.type };
						}
					}

					//normal fields
					else {
						const foundField = allSchemas[primarySObject].find(desc => desc.apiName === schemaFieldName);
						//don't overwrite
						if (Object.keys(u.objFilter(fieldLabels, (s) => s.label === schemaFieldName)).length) {
							throw "exists";
						}
						else {
							fieldLabels[schemaFieldName] = { label: foundField.label, type: foundField.type };
						}
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

function buildEvName(row, sObject, schemas, prettyLabels, isHistoryQuery, event_name_col) {
	// non history queries get sObject names
	if (!isHistoryQuery) {
		if (event_name_col) {
			row.constructedEventName = event_name_col?.toString();
		}
		else {
			row.constructedEventName = u.multiReplace(sObject.toLowerCase(), [["history", ""], ["field", ""], ["__c", ""], ["__", ""]]);
		}
		return row;
	}

	// field history queries get constructed names
	const { Field: apiField, NewValue, OldValue } = row;
	let field = ``;
	let action = ``;
	let object = u.multiReplace(sObject.toLowerCase(), [["history", ""], ["field", ""], ["__c", ""], ["__", ""]]);

	// actions states
	if (u.isNil(NewValue) && u.isNil(OldValue) && apiField === 'created') action = 'created';
	if (u.isNil(NewValue) && !u.isNil(OldValue)) action = 'added';
	if (!u.isNil(NewValue) && u.isNil(OldValue)) action = 'removed';
	if (!u.isNil(NewValue) && !u.isNil(OldValue)) action = 'changed';

	//field resolution
	if (prettyLabels) {
		const fieldLabel = schemas.find(f => f.apiName === apiField);
		if (fieldLabel) field = fieldLabel.label;
	}

	if (!field && action !== 'created') field = apiField;

	row.constructedEventName = `${object}: ${field} ${action}`.toLowerCase().replace(/^\s+|\s+$/g, ""); // ? https://stackoverflow.com/a/7636022
	return row;
}

// ? because https://bit.ly/3IBTj3M
function addInsert(row, sObject, isHistoryQuery) {
	if (!isHistoryQuery) {
		return row;
	}
	const { Field: apiField, NewValue: current, OldValue: old, CreatedDate: when, CreatedById: who } = row;
	const deDuple = { apiField, current, old, when, who, sObject };
	row.$insert_id = u.md5(JSON.stringify(deDuple));
	return row;
}

// ! mutate the config to make it work with the schema
function confirmMappings(config, testResult, schemaLabels, prettyLabels, renameId, isHistoryQuery) {
	// $ check mappings to allow api field names or pretty labels in config if pretty labels are applied
	if (testResult?.records) {
		const testRecord = flatten(testResult.records.pop());
		mapLoop: for (const mapping in config.mappings) {
			if (mapping === "profileOperation") continue mapLoop;
			const userInputMapping = config.mappings[mapping];
			const prettyName = schemaLabels[userInputMapping];

			//user put in API name
			if (!u.isNil(testRecord[userInputMapping]) && prettyName) {
				if (prettyLabels) config.mappings[mapping] = prettyName;
				if (renameId && mapping === 'distinct_id_col') config.mappings[mapping] = prettyName;
			}

			//user put in pretty name
			else if (!u.isNil(testRecord[getKeyByValue(schemaLabels, userInputMapping)]) && !prettyName) {
				if (!prettyLabels) config.mappings[mapping] = getKeyByValue(schemaLabels, userInputMapping);
			}

			else if (!u.isNil(testRecord[userInputMapping])) {
				// noop; it exists
			}

			else {
				if (config.type !== "event" && mapping !== "event_name_col")
					if (config.verbose) u.cLog(`\n\tlabel "${config.mappings[mapping]}" not found in source data; "${mapping}" may be undefined in mixpanel\n`);
			}
		}
	}

	if (config.type === 'event') {
		config.mappings.event_name_col = 'constructedEventName';
		if (isHistoryQuery) {
			config.mappings.insert_id_col = '$insert_id';
			if (prettyLabels) config.mappings.time_col = 'Created Date';
			if (!prettyLabels) config.mappings.time_col = 'CreatedDate';
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

function isFieldHistoryQuery(ast) {
	return ast?.sObject?.toLowerCase()?.includes('history');
}

function isUsingSubqueries(ast) {
	const subQuery = ast.fields.filter(f => f.subquery);
	if (subQuery.length) {
		return subQuery;
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


function isSelectStarQuery(query) {
	if (query.includes('SELECT *')) {
		return true;
	}
	return false;
}

async function resolveSelectStarQueries(query, connection, config) {
	query = query.replace('SELECT *', 'SELECT Id');
	const ast = sqlParse.parseQuery(query);
	const { sObject } = ast;
	const schema = await getSchema(ast, connection, config, true);
	const allFields = schema.map(f => f.apiName);
	const newQuery = `SELECT Id, ${allFields.join(', ')} FROM ${sObject}`;
	return newQuery;
}