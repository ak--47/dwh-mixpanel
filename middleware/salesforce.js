import transformer from '../components/transformer.js';
import emitter from '../components/emitter.js';
import csvMaker from '../components/csv.js';
import u from 'ak-tools';
import jsforce from 'jsforce';
import sqlParse from 'soql-parser-js';
import dayjs from "dayjs";


export default async function salesforce(config, outStream) {

	const { query, ...dwhAuth } = config.dwhAuth();
	let ast;
	try {
		ast = sqlParse.parseQuery(query)
		config.store({ sqlAnalysis: ast });
	} catch (e) {
		if (config.verbose) u.cLog("\ncould not parse SQL query to AST...\n\tthat's ok though!!!\n");
	}

	// * AUTH
	const { user, password, version, prettyLabels } = dwhAuth;
	const connection = new jsforce.Connection({ version });
	const login = await connection.login(user, password);
	config.store({ instance: { ...login } });


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

	// // * LOOKUP TABLES
	// if (config.type === 'table') {
	// 	emitter.emit('dwh query start', config);
	// 	const { recordset, rowsAffected } = await (new mssql.Request(pool)).query(query);
	// 	emitter.emit('dwh query end', config);
	// 	config.store({ rows: rowsAffected[0] });
	// 	config.store({ schema: recordset.columns });
	// 	mpModel = transformer(config, []);
	// 	const transformedRows = recordset.map(mpModel);
	// 	const csv = csvMaker(transformedRows);
	// 	return csv;
	// }

	// * METADATA + ROW COUNTS
	emitter.emit('dwh query start', config);
	try {
		const getRowCount = await connection.query(query);
		config.store({ rows: getRowCount.totalSize });
	}
	catch (e) {
		if (config.verbose) u.cLog('error getting row counts', e.message, 'ERROR');
		config.store({ rows: 0 });
	}

	if (prettyLabels) {
		//get metadata! 
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
			const dateFields = new Set([config.mappings.time_col, ...schemaDateFields]);
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
			connection.logout()
			resolve(config);
		});
	});
}
