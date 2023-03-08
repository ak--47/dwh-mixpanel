import transformer from '../components/transformer.js';
import emitter from '../components/emitter.js';

import u from 'ak-tools';
import sql from 'node-sql-parser';
import asyncToStream from 'async-iterator-to-stream';
import _ from 'highland';
import jsonParser from 'stream-json/jsonl/Parser.js';
import dayjs from 'dayjs';

import {
	AthenaClient,
	StartQueryExecutionCommand,
	GetQueryExecutionCommand,
	GetQueryResultsCommand,
	GetQueryRuntimeStatisticsCommand
} from "@aws-sdk/client-athena";

import {
	S3Client,
	GetObjectCommand,
	SelectObjectContentCommand,
	DeleteObjectsCommand
} from "@aws-sdk/client-s3";

export default async function athena(config, outStream) {
	const { query, ...dwhAuth } = config.dwhAuth();

	// * SQL ANALYSIS
	const sqlParse = new sql.Parser();
	let tableList, columnList, ast;
	try {
		({ tableList, columnList, ast } = sqlParse.parse(query, { database: 'MySQL' }));
		config.store({ sqlAnalysis: { tableList, columnList, ast } });
	} catch (e) {
		if (config.verbose) u.cLog("\ncould not parse SQL query to AST...\n\tthat's ok though!!!\n");
	}

	// * CONNECTION
	// ? https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-athena/index.html
	const athena = new AthenaClient({
		region: dwhAuth.region,
		credentials: {
			accessKeyId: dwhAuth.accessKeyId,
			secretAccessKey: dwhAuth.secretAccessKey
		}
	});

	// ? https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/index.html
	const s3 = new S3Client({
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

	// athena queues everything, so we poll until the query is complete
	let queryFinished;
	do {
		queryFinished = await athena.send(exec);
		await u.sleep(1000);
	} while (
		queryFinished?.QueryExecution?.Status?.State === 'QUEUED' ||
		queryFinished?.QueryExecution?.Status?.State === 'RUNNING'
	);
	const getQueryRows = new GetQueryRuntimeStatisticsCommand({ QueryExecutionId: execId });
	const queryStats = await athena.send(getQueryRows);
	config.store({ queryStats });
	config.store({ rows: queryStats.QueryRuntimeStatistics.Rows.OutputRows });
	emitter.emit('dwh query end', config);

	// * S3
	const s3URI = queryFinished.QueryExecution.ResultConfiguration.OutputLocation.replace("s3://", "").split("/");
	const s3Location = { bucket: s3URI[0], key: s3URI.slice(1).join("/") };
	config.store({
		s3Result: s3Location,
		state: queryFinished.QueryExecution.Status.State
	});

	// * SCHEMA
	const getSchemaCmd = new GetQueryResultsCommand({ QueryExecutionId: execId, MaxResults: 10 });
	const getSchema = await athena.send(getSchemaCmd);
	const schema = getSchema.ResultSet.ResultSetMetadata.ColumnInfo;
	config.store({ schema });


	// * MODELING
	config.eventTimeTransform = (time) => { return dayjs(time).valueOf(); };
	config.timeTransform = (time) => { return dayjs(time).format('YYYY-MM-DDTHH:mm:ss'); };

	let dateFields;
	if (schema) {
		dateFields = schema
			.filter(col => col.Type.includes('timestamp') || col.Type.includes('date'))
			.map(col => col.Name);
	}
	else {
		dateFields = [config.mappings.time_col];
	}
	const mpModel = transformer(config, dateFields);

	// * LOOKUP TABLES
	if (config.type === 'table') {
		// tables cannot be streamed...they are returned as a CSV
		emitter.emit('dwh stream start', config);

		const getCSV = new GetObjectCommand({
			Bucket: s3Location.bucket,
			Key: s3Location.key
		});
		const response = await s3.send(getCSV);
		const { Body } = response;
		const csv = await streamToString(Body);

		const cmd = new DeleteObjectsCommand({
			Bucket: s3Location.bucket,
			Delete: {
				Objects: [
					{ Key: s3Location.key },
					{ Key: `${s3Location.key}.metadata` }
				],
				Quiet: false
			}
		});
		const deleteFiles = await s3.send(cmd);
		config.store({ deleteS3: deleteFiles });

		emitter.emit('dwh stream end', config);

		return csv.trim();
	}

	else {
		// * STREAM FROM S3
		const getCSVasJSON = new SelectObjectContentCommand({
			Bucket: s3Location.bucket,
			Key: s3Location.key,
			ExpressionType: 'SQL',
			Expression: 'SELECT * FROM S3Object',
			InputSerialization: {
				CSV: {
					FileHeaderInfo: 'USE',
					RecordDelimiter: '\n',
					FieldDelimiter: ','
				}
			},
			OutputSerialization: {
				JSON: {
					RecordDelimiter: '\n'
				}
			},

		});

		const parser = new jsonParser({ objectMode: true, emitClose: true });
		const startStream = await s3.send(getCSVasJSON);
		const stream = _
			(asyncToStream(startStream.Payload, { objectMode: true }))
			.map((resp) => {
				if (resp?.Records?.Payload) {
					return resp.Records.Payload;
				}
				if (resp?.Stats?.Details) {
					config.store({ s3Bytes: resp.Stats.Details });
				}
				if (resp.End) {
					return null;
				}

			})
			.toNodeStream()
			.pipe(parser);

		return new Promise((resolve, reject) => {
			stream
				.on("error", reject)
				.once("readable", () => {
					athena.destroy();
					emitter.emit('dwh stream start', config);
				})
				.on("data", (record) => {
					outStream.push(mpModel(record.value));
				})
				.on("end", () => {
					emitter.emit('dwh stream end', config);
					outStream.push(null);

					// delete s3 objects
					const cmd = new DeleteObjectsCommand({
						Bucket: s3Location.bucket,
						Delete: {
							Objects: [
								{ Key: s3Location.key },
								{ Key: `${s3Location.key}.metadata` }
							],
							Quiet: false
						}
					});

					s3.send(cmd).then((response) => {
						config.store({ deleteS3: response });
						resolve(config);
					});

				})
				.once("close", () => {
					s3.destroy();
				});
		});
	}
}

// helper since s3 objects are streams, but for tables we want the whole file...
// ? https://blog.salvatorecozzubo.com/read-files-from-amazon-s3-using-node-js-f89be033ba12
const streamToString = (stream) => new Promise((resolve, reject) => {
	const chunks = [];
	stream.on('data', (chunk) => chunks.push(chunk));
	stream.on('error', reject);
	stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
});