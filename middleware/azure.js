import transformer from '../components/transformer.js';
import emitter from '../components/emitter.js';
import csvMaker from '../components/csv.js';
import u from 'ak-tools';
import mssql from 'mssql';
import sql from 'node-sql-parser';
import dayjs from "dayjs";


export default async function azure(config, outStream) {

	const { query, ...dwhAuth } = config.dwhAuth();
	const sqlParse = new sql.Parser();
	let tableList, columnList, ast;
	try {
		({ tableList, columnList, ast } = sqlParse.parse(query, { database: 'transactsql' }));
		config.store({ sqlAnalysis: { tableList, columnList, ast } });
	} catch (e) {
		if (config.verbose) u.cLog("\ncould not parse SQL query to AST...\n\tthat's ok though!!!\n");
	}

	// * AUTH
	const auth = dwhAuth.connectionString ? dwhAuth.connectionString : dwhAuth;
	const pool = await mssql.connect(auth);
	pool.on('error', (e) => { throw e; });
	config.store({ job: { ...pool.config, password: `******` } });

	// * MODELING
	config.eventTimeTransform = (time) => { return dayjs(time).valueOf(); };
	config.timeTransform = (time) => { return dayjs(time).format('YYYY-MM-DDTHH:mm:ss'); };

	let mpModel; //not available until "readable"

	// * LOOKUP TABLES
	if (config.type === 'table') {
		emitter.emit('dwh query start', config);
		const { recordset, rowsAffected } = await (new mssql.Request(pool)).query(query);
		emitter.emit('dwh query end', config);
		config.store({ rows: rowsAffected[0] });
		config.store({ schema: recordset.columns });
		mpModel = transformer(config, []);
		const transformedRows = recordset.map(mpModel);
		const csv = csvMaker(transformedRows);
		return csv;
	}

	// * METADATA + ROW COUNTS
	emitter.emit('dwh query start', config);
	try {
		const getRowCount = await (new mssql.Request(pool)).query(`WITH count_query AS (${query}) SELECT COUNT(*) as rows FROM count_query;`);
		config.store({ rows: getRowCount.recordset[0].rows });
	}
	catch (e) {
		try {
			// trailing semicolons mess up the row count query
			if (query.endsWith(';')) {
				const rowCountQuery = query.substring(0, query.length - 1);
				const getRowCount = await (new mssql.Request(pool)).query(`WITH count_query AS (${rowCountQuery}) SELECT COUNT(*) as rows FROM count_query;`);
				config.store({ rows: getRowCount.recordset[0].rows });
			}

			// try to re-serialize query from the ast
			else if (ast) {
				const rowCountQuery = sqlParse.sqlify(ast);
				const getRowCount = await (new mssql.Request(pool)).query(`WITH count_query AS (${rowCountQuery}) SELECT COUNT(*) as rows FROM count_query;`);
				config.store({ rows: getRowCount.recordset[0].rows });
			}

			// todo add a @@ROWCOUNT attempt to get rows
			// ? https://www.sqlshack.com/working-with-sql-server-rowcount/

			else {
				throw e;
			}

		}
		catch (e) {
			if (config.verbose) u.cLog('error getting row counts', e.message, 'ERROR');
			config.store({ rows: 0 });
		}
	}

	// * STREAMING QUERY
	const job = new mssql.Request(pool);
	job.stream = true;
	job.query(`${query}`);

	return new Promise((resolve, reject) => {
		job.on('recordset', (columns) => {
			emitter.emit('dwh query end', config);
			emitter.emit('dwh stream start', config);
			config.store({ schema: columns });
			const schemaDateFields = Object.keys(u.objFilter(columns, (col) => col?.type?.declaration === 'datetime'));
			const dateFields = Array.from(new Set([config.mappings.time_col, ...schemaDateFields]));
			mpModel = transformer(config, dateFields);
		});

		job.on('row', (row) => {
			config.got();
			outStream.push(mpModel(row));
		});

		// job.on('rowsaffected', (rowCount) => {
		// 	// ! seems to fire last
		// 	config.store({ rows: rowCount });
		// });

		// job.on('info', (message) => {
		// 	// ! dunno what this is
		// 	debugger;
		// });

		job.on('error', (err) => {
			reject(err);
		});

		job.on('done', () => {
			emitter.emit('dwh stream end', config);
			outStream.push(null);
			pool.close();
			resolve(config);
		});
	});
}
