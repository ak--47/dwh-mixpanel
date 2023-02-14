#! /usr/bin/env node


/*
----
DWH MIXPANEL
by AK
purpose: stream events/users/groups/tables into mixpanel... from the warehouse!
----
*/

/*
-----------
MIDDLEWARE
these are the main 'connectors'
for all the sources
-----------
*/

import createStream from "./middleware/mixpanel.js";
import bigQuery from './middleware/bigquery.js';
import snowflake from './middleware/snowflake.js';
import athena from './middleware/athena.js';

/*
----
DEPS
----
*/

import esMain from 'es-main';
import cli from './components/cli.js';
import emitter from './components/emitter.js';
import Config from "./components/config.js";
import env from './components/env.js';
import u from 'ak-tools';

import mp from 'mixpanel-import';
import { pEvent } from 'p-event';
import { resolve } from 'path';
import _ from "lodash";

// eslint-disable-next-line no-unused-vars
import * as Types from "./types/types.js";
import c from 'ansi-colors';

/*
--------
PIPELINE
--------
*/

/**
 * stream a SQL query from your data warehouse into mixpanel!
 * @example
 * const results = await dwhMixpanel(params)
 * console.log(results.mixpanel) // { duration: 3461, success: 420, responses: [], errors: [] }
 * @param {Types.Params} params your streaming configuration
 * @returns {Promise<Types.Summary>} summary of the job containing metadata about time/throughput/responses
 */
async function main(params) {
	// * TRACKING
	const track = u.tracker('dwh-mixpanel');
	const runId = u.uid();
	track('start', { runId });

	// * ENV VARS
	const envVars = env();

	// * CONFIG
	const config = new Config(
		_.merge(
			u.clone(params), //params take precedence over env
			u.clone(envVars)
		)
	);

	if (config.verbose) u.cLog(c.red('\nSTART!'));

	const { type, version, warehouse } = config;
	const props = { runId, type, version, warehouse };
	try {
		config.validate();
		props.type = config.type;
		props.warehouse = config.warehouse;
		props.version = config.version;
		track('valid', props);
	}
	catch (e) {
		track('invalid config', { ...props, reason: e });
		console.error(`configuration is invalid! reason:\n\n\t${e}\n\nquitting...\n\n`);
		process.exit(0);
	}
	config.etlTime.start();


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
				dwh = await athena(config, mpStream);
				break;
			default:
				if (config.verbose) u.cLog(`i do not know how to access ${config.warehouse}... sorry`);
				mpStream.destroy();
				track('unsupported warehouse', props);
				throw new Error('unsupported warehouse', { cause: config.warehouse, config });
		}
	}

	catch (e) {
		track('warehouse error', { ...props, msg: e.message });
		if (config.verbose) {
			console.log(c.redBright.bold(`\n${config.warehouse.toUpperCase()} ERROR:`));
			console.log(c.redBright.bold(e.message));
		}
		else {
			u.cLog(e, `${config.warehouse} error: ${e.message}`, `CRITICAL`);
		}
		mpStream.destroy();
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
			mpStream.destroy();
		} catch (e) {
			u.cLog(e, c.red('UNKNOWN FAILURE'), 'CRITICAL');
			throw e;
		}
	}


	// * LOGS + CLEANUP
	const result = config.summary();
	if (config.options.logFile) {
		try {
			const fileName = resolve(config.options.logFile);
			const logFile = await u.touch(fileName, result, true, false, true);
			u.cLog(c.gray(`logs written to ${logFile}\n\n`));
		}
		catch (e) {
			if (config.verbose) {
				u.cLog(c.red('failed to write logs'));
			}

		}
	}
	track('end', props);
	return result;
}

/*
---------
LISTENERS
---------
*/

emitter.once('dwh query start', (config) => {
	config.queryTime.start();
	if (config.verbose) u.cLog(c.cyan(`\n${config.dwh} query start`));

});

emitter.once('dwh query end', (config) => {
	config.queryTime.end(false);
	if (config.verbose) {
		u.cLog(c.cyan(`${config.dwh} query end`));
		u.cLog(c.cyan(`\t${config.warehouse} took ${config.queryTime.report(false).human}\n`));
	}
});

emitter.once('dwh stream start', (config) => {
	config.streamTime.start();
	if (config.verbose) {
		// u.cLog(`\n${config.dwh} stream start`);
		u.cLog(c.magenta(`\nstreaming started! (${u.comma(config.dwhStore.rows)} ${config.type}s)\n`));
		config.progress({ total: config.dwhStore.rows, startValue: 0 });
	}
});

emitter.once('dwh stream end', (config) => {
	config.streamTime.end(false);
	if (config.verbose) {
		// u.cLog(`${config.dwh} stream end`);
		// u.cLog(`\t${config.warehouse} took ${config.streamTime.report(false).human}\n`);
	}
});

emitter.once('mp import start', (config) => {
	config.importTime.start();
	if (config.verbose) {
		// u.cLog(`\nmixpanel import start`);
		config.progress({ total: config.dwhStore.rows, startValue: 0 }, 'mp');
	}
});

emitter.once('mp import end', (config) => {
	config.importTime.end(false);
	config.etlTime.end(false);
	const summary = config.summary();
	const successRate = u.round(summary.mixpanel.success / summary.mixpanel.total * 100, 2);
	const importTime = config.importTime.report(false).delta;
	const evPerSec = Math.floor((config.inCount / importTime) * 1000);

	if (config.verbose) {
		config.progress(); //stop progress bars
		// u.cLog(`\nmixpanel import end`);
		// u.cLog(`\tmixpanel took ${config.importTime.report(false).human}\n`);
		u.cLog(c.magenta('\nstreaming ended!'));
		u.cLog(c.red(`\nCOMPLETE!`));
		u.cLog(c.yellow(`\tprocessed ${u.comma(summary.mixpanel.total)} ${config.type}s in ${summary.time.human}`));
		u.cLog(c.yellow(`\t(${successRate}% success rate; ~${u.comma(evPerSec)} EPS)`));
		u.cLog(`\ncheck out your data!\n` + c.blue.underline(`https://mixpanel.com/project/${config.mpAuth().project}\n`));
	}
});

emitter.on('dwh batch', (config) => {
	config.progress(1, 'dwh');
});

emitter.on('mp batch', (config, numImported) => {
	config.progress(numImported, 'mp');
});

/*
--------
EXPORTS
--------
*/

export default main;

//this fires when the module is run as a standalone script
if (esMain(import.meta)) {
	cli().then(answers => {
		const { params, run } = answers;
		if (run) {
			params.options.verbose = true;
			return main(params);
		}

		else {
			u.cLog('\nnothing left to do\n\no_0\n\n');
			process.exit(0);
		}
	}).then(() => {
		//noop

	}).catch((e) => {
		u.cLog(`\nuh oh! something didn't work...\nthe error message is:\n\n\t${e.message}\n\n`);
		u.cLog(`take a closer look at your config file and try again (it's usually credentials!)\n`);
		u.cLog(`if you continue to be stuck, file an issue:\nhttps://github.com/ak--47/dwh-mixpanel/issues\n\n`);
		process.exit(1);
	}).finally(() => {
		u.cLog('\n\nhave a great day!\n\n');
		process.exit(0);
	});

}
