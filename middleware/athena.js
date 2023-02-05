import transformer from '../components/transformer.js';
import emitter from '../components/emitter.js';
import csvMaker from '../components/csv.js';
import u from 'ak-tools';
import {
	AthenaClient,
	StartQueryExecutionCommand,
	GetQueryExecutionCommand,
	GetQueryResultsCommand,
} from "@aws-sdk/client-athena";

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import sql from 'node-sql-parser';


export default async function athena(config, outStream) {
	const { query, ...dwhAuth } = config.dwhAuth();

	// * SQL ANALYSIS
	const sqlParse = new sql.Parser();
	let tableList, columnList, ast;
	try {
		({ tableList, columnList, ast } = sqlParse.parse(query, { database: 'MySQL', }));
		config.store({ sqlAnalysis: { tableList, columnList, ast } });
	} catch (e) {
		if (config.verbose) u.cLog("\ncould not parse SQL query to AST...\n\tthat's ok though!!!\n");
	}


	// * CONNECTION
	const athena = new AthenaClient({
		region: dwhAuth.region,
		credentials: {
			accessKeyId: dwhAuth.accessKeyId,
			secretAccessKey: dwhAuth.secretAccessKey
		}
	});

	// * START QUERY
	const cmd = new StartQueryExecutionCommand({ QueryString: query });
	emitter.emit('dwh query start', config);
	const meta = await athena.send(cmd);

	const execId = meta.QueryExecutionId;
	config.store({ executionId: execId, metadata: meta.$metadata });

	const exec = new GetQueryExecutionCommand({ QueryExecutionId: execId });
	let queryFinished;

	do {
		queryFinished = await athena.send(exec);
		await u.sleep(2000);
	} while (queryFinished?.QueryExecution?.Status?.State === 'QUEUED');

	emitter.emit('dwh query end', config);
	//todo destructure bucket name + resource
	const s3URI = queryFinished.QueryExecution.ResultConfiguration.OutputLocation.replace("s3://", "").split("/")
	const s3Location = {bucket: s3URI[0], key: s3URI.slice(1).join("/")};
	config.store({
		outputLoc: s3Location,
		state: queryFinished.QueryExecution.Status.State
	});

	// * SCHEMA
	const getSchemaCmd = new GetQueryResultsCommand({ QueryExecutionId: execId, MaxResults: 10 });
	const getSchema = await athena.send(getSchemaCmd);
	const schema = getSchema.ResultSet.ResultSetMetadata.ColumnInfo;
	config.store({ schema });


	//todo consume results

	// * MODELING
	// todo
	// config.timeTransform = (row) => { return row.getTime(); };
	// let dateFields;
	// if (schema) {
	// 	dateFields = schema
	// 		.filter((col) => col.DATA_TYPE.includes("TIMESTAMP") || col.DATA_TYPE.includes("DATE"))
	// 		.map(col => col.COLUMN_NAME);
	// }
	// else {
	// 	dateFields = [config.mappings.time_col];
	// }
	const mpModel = transformer(config, []);

	// tables cannot be streamed...they are returned as a CSV
	if (config.type === 'table') {
		// TODO
		// emitter.emit('dwh query start', config);
		const rows = await athena.execute(query);
		const transformedRows = rows.map(mpModel);
		const csv = csvMaker(transformedRows);
		// emitter.emit('dwh query end', config);
		return csv;
	}


	// * STREAM
	else {

		const s3 = new S3Client({
			region: dwhAuth.region,
			credentials: {
				accessKeyId: dwhAuth.accessKeyId,
				secretAccessKey: dwhAuth.secretAccessKey
			}
		});

		//
		const fetchFile = new GetObjectCommand({
			Bucket: s3Location.bucket,
			Key: s3Location.key
		});

		const startStream = await s3.send(fetchFile)

		const stream = startStream.Body;

		return new Promise((resolve, reject) => {
			stream
				.on("error", reject)
				.on("data", (row) => {
					emitter.emit('dwh stream start', config);
					//todo model row as JSON :( 
					config.got();
					outStream.push(mpModel(row));
				})
				.on("end", () => {
					emitter.emit('dwh stream end', config);
					outStream.push(null);
					athena.destroy();
					resolve(config);
				})
				.once("close", () => {
					athena.destroy();
				});
		});
	}
}
