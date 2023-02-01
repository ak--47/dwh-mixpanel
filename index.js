import Config from "./config.js";
import createStream from "./connectors/mixpanel.js";
import bigQuery from './connectors/bigquery.js';
import emitter from './emitter.js';

export default async function main(params = {}) {
	//CONFIG
	const config = new Config({ ...params });


	//ENV 

	//CLI	


	//STREAMS
	const mpStream = createStream(config);


	//EXECUTE
	const bq = await bigQuery(config, mpStream);



}


emitter.once('import end', (summary) => {
	debugger;
})

/*
----
STREAMS
----
*/

