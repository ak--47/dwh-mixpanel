import transformer from '../components/transformer.js';
import emitter from '../components/emitter.js';
import csvMaker from '../components/csv.js';
import u from 'ak-tools';
import { Snowflake } from "snowflake-promise";
import sql from 'node-sql-parser';
import dayjs from 'dayjs'


export default async function snowflake(config, outStream) {
	const { query, ...dwhAuth } = config.dwhAuth();

	// * SQL ANALYSIS
	const sqlParse = new sql.Parser();
	let tableList, columnList, ast;
	try {
		({ tableList, columnList, ast } = sqlParse.parse(query, { database: 'MySQL'}));
		config.store({ sqlAnalysis: { tableList, columnList, ast } });
	} catch (e) {
		if (config.verbose) u.cLog("\ncould not parse SQL query to AST...\n\tthat's ok though!!!\n");
	}

	// ? snowflake always returns uppercase key names...
	for (let key in config.mappings) {
		config.mappings[key] = config.mappings[key].toUpperCase();
	}

	// * CONNECTION
	const snowflake = new Snowflake(dwhAuth, { logLevel: 'error', logSql: config.log.bind(config) }, {});
	await snowflake.connect();
	config.store({ connectionId: snowflake.id });


	// * SCHEMA
	let schema;
	try {
		if (config.verbose) u.cLog('attempting to fetch schema...');
		const schemaTemplate = `select TABLE_NAME, COLUMN_NAME, ORDINAL_POSITION, DATA_TYPE from ${dwhAuth.database.toUpperCase()}.INFORMATION_SCHEMA.COLUMNS where TABLE_NAME in `;
		const tables = ast.from.map((sqlPlan) => `'${sqlPlan.table.toUpperCase()}'`);
		const schemaQuery = schemaTemplate + '(' + tables.join(",") + ')';
		schema = await snowflake.execute(schemaQuery);
		config.store({ schema });
	} catch (e) {
		if (config.verbose) u.cLog(`could not query schema:\n${e.message}\n\tthat's ok though...`);
	}


	// * MODELING
	config.eventTimeTransform = (time) => { return time.getTime(); };
	config.timeTransform = (time) => { return dayjs.unix(time.getTime()).format('YYYY-MM-DDTHH:mm:ss'); };
	let dateFields;
	if (schema) {
		dateFields = schema
			.filter((col) => col.DATA_TYPE.includes("TIMESTAMP") || col.DATA_TYPE.includes("DATE"))
			.map(col => col.COLUMN_NAME);
	}
	else {
		dateFields = [config.mappings.time_col];
	}
	const mpModel = transformer(config, dateFields);

	// tables cannot be streamed...they are returned as a CSV
	if (config.type === 'table') {
		emitter.emit('dwh query start', config);
		const rows = await snowflake.execute(query);
		const transformedRows = rows.map(mpModel);
		const csv = csvMaker(transformedRows);
		emitter.emit('dwh query end', config);
		return csv;
	}

	// * STREAM
	else {
		emitter.emit('dwh query start', config);
		const statement = snowflake.createStatement({
			sqlText: query,
			streamResult: true
		});
		statement.execute();

		return new Promise((resolve, reject) => {
			statement
				.streamRows()
				.on("error", reject)
				.once('readable', () => {
					if (statement.getStatus() === 'complete') {
						emitter.emit('dwh query end', config);
						config.store({ statementId: statement.getStatementId() });
						config.store({ rows: statement.getNumRows() });
					}
				})
				.on("data", (row) => {
					emitter.emit('dwh stream start', config);
					config.got();
					outStream.push(mpModel(row));
				})
				.on("end", () => {
					emitter.emit('dwh stream end', config);
					outStream.push(null);
					snowflake.destroy();
					resolve(config);
				})
				.once("close", () => {
					snowflake.destroy();
				});
		});
	}
}
