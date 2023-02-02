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

	debugger;

}

const l = console.log

emitter.on('query start', ()=>{
	l('query start')
})

emitter.on('query end', ()=>{
	l('query end')
})

emitter.on('stream start', ()=>{
	l('stream start')
})

emitter.on('stream end', ()=>{
	l('stream end')
})

emitter.once('import start', ()=>{
	l('import start')
})

emitter.once('import end', (summary) => {
	debugger;
})


