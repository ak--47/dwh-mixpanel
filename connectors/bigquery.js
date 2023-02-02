import transformer from '../transformer.js';
import { BigQuery } from "@google-cloud/bigquery";
import { GoogleToken } from "gtoken";
import emitter from '../emitter.js';

export default async function (config, outStream) {
	const { projectId, email, privateKey, query, location } = config.dwhAuth();
	const gtoken = new GoogleToken({
		email,
		key: privateKey,
	});
	// For all options, see https://cloud.google.com/bigquery/docs/reference/rest/v2/jobs/query
	const bigquery = new BigQuery({ projectId, gtoken });
	// Location must match that of the dataset(s) referenced in the query.
	const options = {
		query,
		location,
		jobTimeoutMs: 1000 * 60 * 60 * 60
	};

	const mpModel = transformer(config);	
	emitter.emit('query start', config);
	// Run the query as a job
	const [job] = await bigquery.createQueryJob(options);
	const [result] = await job.getMetadata();
	config.dwhStore = result;

	return new Promise((resolve, reject) => {
		job.on('complete', function (metadata) {
			emitter.emit('query end', metadata);
			// stream results
			emitter.emit('stream start', config);
			job
				.getQueryResultsStream()
				.on("error", reject)
				.on("data", (row) => {
					config.got();
					outStream.push(mpModel(row));
				})
				.on("end", () => {
					emitter.emit('stream end', config);
					outStream.push(null);
					resolve(config);
				});
		});


	});
}
