import transformer from '../components/transformer.js';
import { BigQuery } from "@google-cloud/bigquery";
import emitter from '../components/emitter.js';
import { auth } from 'google-auth-library';
import dayjs from "dayjs";

export default async function (config, outStream) {

	const { location, query, ...dwhAuth } = config.dwhAuth();
	// todo support other auth types: https://cloud.google.com/nodejs/docs/reference/google-auth-library/latest
	const googAuth = auth.fromJSON(dwhAuth);

	// docs: https://googleapis.dev/nodejs/bigquery/latest/index.html
	const bigquery = new BigQuery({
		// authClient: googAuth
		projectId: dwhAuth.project_id,
		credentials: {
			client_email: dwhAuth.client_email,
			private_key: dwhAuth.private_key
		}
	});

	// note: location must match that of the dataset(s) referenced in the query.
	const options = {
		query,
		location,
		jobTimeoutMs: 1000 * 60 * 60 * 60
	};

	// Run the query as a job
	emitter.emit('dwh query start', config);
	const [job] = await bigquery.createQueryJob(options);
	const [result] = await job.getMetadata();

	//store metadata and determine time transform needed
	config.store(result);
	config.timeTransform = (time) => { return dayjs(time.value).valueOf(); };
	// ! todo: examine schema to determine which fields are BigQuery timestamps
	const mpModel = transformer(config);


	return new Promise((resolve, reject) => {
		job.on('complete', function (metadata) {
			config.store(metadata);
			emitter.emit('dwh query end', config);

			// stream results
			emitter.emit('dwh stream start', config);
			job
				.getQueryResultsStream()
				.on("error", reject)
				.on("data", (row) => {
					config.got();
					outStream.push(mpModel(row));
				})
				.on("end", () => {
					emitter.emit('dwh stream end', config);
					outStream.push(null);
					resolve(config);
				});
		});


	});
}
