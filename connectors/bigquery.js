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
	const options = {
		query,
		// Location must match that of the dataset(s) referenced in the query.
		location
	};

	const mpModel = transformer(config);

	// Run the query as a job
	const [job] = await bigquery.createQueryJob(options);

	console.log(`bigquery start\n`);
	emitter.emit('export start')
	// stream results
	job
		.getQueryResultsStream({ timeoutMs: 1000 * 10 })
		.on("error", console.error)
		.on("data", (row) => { outStream.push(mpModel(row)); })
		.on("end", () => {
			console.log('bigquery end\n');
			emitter.emit('export end', config)
			outStream.push(null);
		});
}
