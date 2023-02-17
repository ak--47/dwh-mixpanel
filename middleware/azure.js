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
	const pool = await mssql.connect(dwhAuth.connection); //todo support things other than connection string
	pool.on('error', (e) => { throw e; });
	config.store({ connection: { ...pool.config, password: `******` } });

	// * MODELING
	if (config.type === "event") {
		//events get unix epoch
		config.timeTransform = (time) => { return dayjs(time).valueOf(); };
	}
	else {
		//all others get ISO
		config.timeTransform = (time) => { return dayjs(time).format('YYYY-MM-DDTHH:mm:ss'); };
	}
	let mpModel; //not available until "readable"

	// * LOOKUP TABLES
	if (config.type === 'table') {
		//todo resolve tables
		emitter.emit('dwh query start', config);
		const { recordset, rowsAffected } = await (new mssql.Request(pool)).query(query);
		emitter.emit('dwh query end', config);
		config.store({ rows: rowsAffected[0] });
		mpModel = transformer(config, []);
		const transformedRows = recordset.map(mpModel);
		const csv = csvMaker(transformedRows);
		return csv;
	}

	// * METADATA
	emitter.emit('dwh query start', config);
	//todo deal with trailing semicolons in query;
	const rowCountQuery = await (new mssql.Request(pool)).query(`WITH count_query AS (${query})  SELECT COUNT(*) as rows FROM count_query;`);
	config.store({ rows: rowCountQuery.recordset[0].rows });

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
			const dateFields = new Set([config.mappings.time_col, ...schemaDateFields]);
			mpModel = transformer(config, dateFields);
		});

		job.on('row', (row) => {
			config.got();
			outStream.push(mpModel(row));
		});

		job.on('rowsaffected', (rowCount) => {
			// ! seems to fire last
			config.store({ rows: rowCount });
		});

		job.on('info', (message) => {
			// ! dunno what this is
			debugger;
		});

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
