import transformer from '../components/transformer.js';
import { BigQuery } from "@google-cloud/bigquery";
import { GoogleToken } from "gtoken";
import emitter from '../components/emitter.js';

export default async function (config, outStream) {
	const { projectId, email, privateKey, query, location } = config.dwhAuth();
	const gtoken = new GoogleToken({
		email,
		key: privateKey,
	});
	
	// docs: https://cloud.google.com/bigquery/docs/reference/rest/v2/jobs/query
	const bigquery = new BigQuery({ projectId, gtoken });
	
	// note: location must match that of the dataset(s) referenced in the query.
	const options = {
		query,
		location,
		jobTimeoutMs: 1000 * 60 * 60 * 60
	};

	const mpModel = transformer(config);	
	emitter.emit('dwh query start', config);
	
	// Run the query as a job
	const [job] = await bigquery.createQueryJob(options);
	const [result] = await job.getMetadata();
	config.store(result);

	return new Promise((resolve, reject) => {
		job.on('complete', function (metadata) {
			config.store(metadata)
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
