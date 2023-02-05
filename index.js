#! /usr/bin/env node

/*
----
DWH MIXPANEL
by AK
purpose: stream events/users/groups/tables into mixpanel... from the warehouse!
----
*/

/*
----
DEPS
----
*/
import Config from "./components/config.js";
import createStream from "./middleware/mixpanel.js";
import bigQuery from './middleware/bigquery.js';
import snowflake from './middleware/snowflake.js';
import emitter from './components/emitter.js';
import u from 'ak-tools';
import { pEvent } from 'p-event';
import mp from 'mixpanel-import';

// eslint-disable-next-line no-unused-vars
import * as Types from "./types/types.js";

/*
--------
PIPELINE
--------
*/
async function main(params = {}) {
	// * CONFIG
	const config = new Config({ ...params });
	config.etlTime.start();
	if (config.verbose) u.cLog('\nSTART!');
	config.validate();

	// * ENV VARS
	// todo

	// * CLI
	// todo	

	//* MIXPANEL STREAM
	const mpStream = createStream(config);

	//* DWH STREAM
	let dwh;
	try {
		switch (config.warehouse) {
			case 'bigquery':
				dwh = await bigQuery(config, mpStream);
				break;
			case 'snowflake':
				dwh = await snowflake(config, mpStream);
				break;
			case 'athena':
				// todo
				break;
			default:
				if (config.verbose) u.cLog(`i do not know how to access ${config.warehouse}... sorry`);
				mpStream.destroy();
				throw new Error('unsupported warehouse', { cause: config.warehouse, config });
		}
	}

	catch (e) {
		if (config.verbose) u.cLog(e, `${config.warehouse} error: ${e.message}`, `CRITICAL`);
		mpStream.destroy();
		// debugger;
		throw e;
	}

	// ? SPECIAL CASE: lookup tables cannot be streamed as batches
	if (config.type === 'table') {
		mpStream.destroy();
		emitter.emit('mp import start', config);
		const tableImport = await mp(config.mpAuth(), dwh, { ...config.mpOpts(), logs: false });
		config.store(tableImport, 'mp');
		emitter.emit('mp import end', config);
	}

	else {
		// * WAIT
		try {
			await pEvent(emitter, 'mp import end');
		} catch (e) {
			u.cLog(e, 'UNKNOWN FAILURE', 'CRITICAL');
			throw e;
		}
	}


	// * LOGS + CLEANUP
	// todo
	const result = config.summary();
	return result;
}

/*
---------
LISTENERS
---------
*/

emitter.once('dwh query start', (config) => {
	config.queryTime.start();
	if (config.verbose) u.cLog(`\n${config.dwh} query start`);

});

emitter.once('dwh query end', (config) => {
	config.queryTime.end(false);
	if (config.verbose) {
		u.cLog(`${config.dwh} query end`);
		u.cLog(`\t${config.warehouse} took ${config.queryTime.report(false).human}\n`);
	}
});

emitter.once('dwh stream start', (config) => {
	config.streamTime.start();
	if (config.verbose) u.cLog(`\n${config.dwh} stream start`);
});

emitter.once('dwh stream end', (config) => {
	config.streamTime.end(false);
	if (config.verbose) {
		u.cLog(`${config.dwh} stream end`);
		u.cLog(`\t${config.warehouse} took ${config.streamTime.report(false).human}\n`);
	}
});

emitter.once('mp import start', (config) => {
	config.importTime.start();
	if (config.verbose) u.cLog(`\nmixpanel import start`);
});

emitter.once('mp import end', (config) => {
	config.importTime.end(false);
	config.etlTime.end(false);
	const summary = config.summary();
	const successRate = u.round(summary.mixpanel.success / summary.mixpanel.total * 100, 2);
	const importTime = config.importTime.report(false).delta
	const evPerSec = Math.floor((config.inCount / importTime) * 1000)

	if (config.verbose) {
		u.cLog(`\nmixpanel import end`);
		u.cLog(`\tmixpanel took ${config.importTime.report(false).human}\n`);
		u.cLog(`\nCOMPLETE!`);
		u.cLog(`\nETL processed COMPLETE!`);
		u.cLog(`\tprocessed ${u.comma(summary.mixpanel.total)} ${config.type}s in ${summary.time.human}`);
		u.cLog(`\t(${successRate}% success rate; ~${u.comma(evPerSec)} RPS)`);
		u.cLog(`\ncheck out your data! https://mixpanel.com/project/${config.mpAuth().project}\n`);
	}
});

/*
--------
EXPORTS
--------
*/

export default main;