import transformer from '../components/transformer.js';
import emitter from '../components/emitter.js';
import csvMaker from '../components/csv.js';
import u from 'ak-tools';
import { Snowflake } from "snowflake-promise";
import sql from 'node-sql-parser';


export default async function snowflake(config, outStream) {
	const { query, ...dwhAuth } = config.dwhAuth();
	const sqlParse = new sql.Parser();
	let tableList, columnList, ast;
	try {
		({ tableList, columnList, ast } = sqlParse.parse(query, { database: 'MySQL', }));
		config.store({ sqlAnalysis: { tableList, columnList, ast } });
	} catch (e) {
		if (config.verbose) u.cLog("\ncould not parse SQL query to AST...\n\tthat's ok though!!!\n");
	}

	// ? snowflake always returns uppercase key names...
	for (let key in config.mappings) {
		config.mappings[key] = config.mappings[key].toUpperCase();
	}

	// * CONNECTION
	const snowflake = new Snowflake(dwhAuth, { logLevel: 'error', logSql: console.log }, {});
	await snowflake.connect();
	config.store({ connectionId: snowflake.id });

	// * SQL
	const statement = snowflake.createStatement({
		sqlText: query,
		streamResult: config.type !== "table"
	});

	// * MODELING
	config.timeTransform = (row) => { return row.getTime(); };
	const dateFields = [config.mappings.time_col];
	const mpModel = transformer(config, dateFields);

	if (config.type === 'table') {
		// todo
		// emitter.emit('dwh query end', config);
		// const [rows] = await bigquery.dataset(datasetId).table(tableId).getRows();
		// const transformedRows = rows.map(mpModel);
		// const csv = csvMaker(transformedRows);
		// return csv;
	}

	else {

		// * STREAM
		emitter.emit('dwh query start', config);
		statement.execute();

		return new Promise((resolve, reject) => {
			statement
				.streamRows()
				.on("error", reject)
				.once('readable', () => {
					if (statement.getStatus() === 'complete') {
						emitter.emit('dwh query end', config);
						config.store({ statementId: statement.getStatementId() });
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
