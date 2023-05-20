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
import azure from "./middleware/azure.js";
import salesforce from "./middleware/salesforce.js";

/*
----
DEPS
----
*/

import esMain from 'es-main';
import cli from './components/cli.js';
import messageBus from './components/emitter.js';
import Config from "./components/config.js";
import env from './components/env.js';
import u from 'ak-tools';
import mp from 'mixpanel-import';
import { pEvent } from 'p-event';
import { resolve } from 'path';
import _ from "lodash";
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
 * @param {Params} params your streaming configuration
 * @returns {Promise<Summary>} summary of the job containing metadata about time/throughput/responses
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
	const emitter = messageBus();
	listeners(emitter);

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

	// don't allow strict mode imports if no insert_id it supplied
	if (config.type === 'event' && config.options.strict && !config.mappings.insert_id_col) {
		if (config.verbose) u.cLog('\tstrict mode imports are not possible without $insert_id; turning strict mode off...');
		config.options.strict = false;
		delete config.mappings.insert_id_col;
	}

	config.etlTime.start();


	//* MIXPANEL STREAM
	const mpStream = createStream(config, emitter);

	//* DWH STREAM
	let dwh;
	try {
		switch (config.warehouse) {
			case 'bigquery':
				dwh = await bigQuery(config, mpStream, emitter);
				break;
			case 'snowflake':
				dwh = await snowflake(config, mpStream, emitter);
				break;
			case 'athena':
				dwh = await athena(config, mpStream, emitter);
				break;
			case 'azure':
				dwh = await azure(config, mpStream, emitter);
				break;
			case 'salesforce':
				dwh = await salesforce(config, mpStream, emitter);
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
			if (config.verbose) {
				u.cLog(c.gray(`logs written to ${logFile}\n\n`));
			}
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

function listeners(emitter) {
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
			u.cLog(c.magenta(`\nstreaming started! (${config.dwhStore.rows > 0 ? u.comma(config.dwhStore.rows) : "unknown number of"} ${config.type}s)\n`));
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
			u.cLog(c.yellow(`\tprocessed ${u.comma(summary.mixpanel.total)} ${config.type}s in ${summary.time.job.human}`));
			u.cLog(c.yellow(`\t(${successRate}% success rate; ~${u.comma(evPerSec)} EPS)`));
			u.cLog(`\ncheck out your data!\n` + c.blue.underline(`https://mixpanel.com/project/${config.mpAuth().project}\n`));
		}
	});

	emitter.on('dwh batch', (config) => {
		if (config.verbose) {
			try {
				config.progress(1, 'dwh');
			}
			catch (e) {
				//noop
			}
		}
	});

	emitter.on('mp batch', (config, numImported) => {
		if (config.verbose) {
			try {
				config.progress(numImported, 'mp');
			}
			catch (e) {
				//noop
			}
		}
	});
}

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
		//multiline fix for priv keys
		if (answers.params.auth?.private_key) answers.params.auth.private_key = answers.params.auth.private_key.replaceAll("\\n", "\n");
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



/*
-------------
JSDOC TYPINGS
-------------
*/

/**
 * @typedef {import('../node_modules/mixpanel-import/types.js').Options} ImportOptions
 */

/**
 * @typedef {'biquery' | 'athena' | 'snowflake' | 'azure' | 'salesforce'}  SupportedWarehouses the data warehouses supported by this module
 */

/**
 * @typedef {'event' | 'user' | 'group' | 'table'}  SupportedRecords types of records that can be ingested by mixpanel
 */

/**
 * @typedef Params a job configuration
 * @prop {SupportedWarehouses} dwh type of warehouse
 * @prop {Object} auth auth details for warehouse
 * @prop {string} sql SQL query to run in warehouse
 * @prop {Mappings} mappings 
 * @prop {Object.<string, string>} aliases Aliases property key names after mappings are applied `{sourceKey: targetKey}`
 * @prop {Options} options
 * @prop {Mixpanel} mixpanel
 * @prop {Tags} tags
 */

/**
 * @typedef Mappings mappings of dwh columns to mixpanel fields
 * @prop {string} [event_name_col] column for event name
 * @prop {string} [distinct_id_col] column for distinct_id (original id merge)
 * @prop {string} [user_id_col] column for user id (simplified id merge)
 * @prop {string} [device_id_col] column for device_id / anon_id (simplified id merge)
 * @prop {string} [time_col] column for event time
 * @prop {string} [insert_id_col] column for row id (deduplication)
 * @prop {string} [name_col] the $name to use for the user/group profile
 * @prop {string} [email_col] the $email to use for the user/group profile
 * @prop {string} [avatar_col] a public link to an image to be used as an $avatar for the user/group profile
 * @prop {string} [created_col] the $created (timestamp) to use for the user/group profile
 * @prop {string} [phone_col] the $phone to use for the user/group profile
 * @prop {string} [latitude_col] the $latitude to use for the user/group profile; mixpanel will geo-resolve the profile when this value is supplied
 * @prop {string} [longitude_col] the $longitude to use for the user/group profile; mixpanel will geo-resolve the profile when this value is supplied
 * @prop {string} [ip_co] the $ip to use for the user/group profile; mixpanel will geo-resolve the profile when this value is supplied 
 * @prop {string} [profileOperation] the $set style operation to use for creating/updating the profile
 * @prop {string} [lookup_col] the "join" column for the lookup table; usually the first column in the table
 */

/**
 * @typedef LocalOptions options to use for the job
 * @prop {string} logFile a local path to write log files to
 * @prop {boolean} verbose display verbose console output
 * @prop {boolean} strict use strict mode when sending data to mixpanel
 * @prop {boolean} compress compress data in transit
 * @prop {Number} workers number of concurrent workers to make requests to mixpanel
 */

/**
 * @typedef {LocalOptions & ImportOptions} Options
 */

/**
 * @typedef Mixpanel mixpanel auth details + configuration
 * @prop {string} project_id  mixpanel project id {@link https://help.mixpanel.com/hc/en-us/articles/115004490503-Project-Settings#project-id more info}
 * @prop {string} [service_account] mixpanel service account user name {@link https://developer.mixpanel.com/reference/service-accounts#managing-service-accounts more info}
 * @prop {string} [service_secret] mixpanel service account secret {@link https://developer.mixpanel.com/reference/service-accounts#managing-service-accounts more info}
 * @prop {string} [api_secret] mixpanel project api secret {@link https://help.mixpanel.com/hc/en-us/articles/115004490503-Project-Settings#api-secret more info}
 * @prop {string} [token] mixpanel project token {@link https://help.mixpanel.com/hc/en-us/articles/115004490503-Project-Settings#project-token more info}
 * @prop {'US' | 'EU'} region mixpanel project region {@link https://help.mixpanel.com/hc/en-us/articles/115004490503-Project-Settings#data-residency more info}
 * @prop {SupportedRecords} type kind of data to import {@link https://developer.mixpanel.com/docs/data-structure-deep-dive more info}
 * @prop {string} [groupKey] a group analytics key to use for profiles {@link https://help.mixpanel.com/hc/en-us/articles/360025333632-Group-Analytics#implementation more info}
 * @prop {string} [lookupTableId] the lookup table to replace {@link https://developer.mixpanel.com/reference/replace-lookup-table more info}
 */

/**
 * @typedef {Object.<string, string>} Tags arbitrary tags (k:v) to put on the data
 */


/**
 * @typedef Summary summary of stream job
 * @prop {MixpanelSummary} mixpanel
 * @prop {Object.<SupportedWarehouses, WarehouseSummary>}
 */

/**
 * @typedef MixpanelSummary
 * @prop {number} duration the full duration of the job in ms
 * @prop {string} human a human readable string of the full duration
 * @prop {number} eps the "events per second" when sending to mixpanel
 * @prop {number} rps the "requests per second" when sending to mixpanel
 * @prop {number} total the number of records processed from the warehouse
 * @prop {number} success the number of records that were successfully ingested
 * @prop {number} failed the number of records that failed to be ingested
 * @prop {number} retries the number of times a request was retried 
 * @prop {number} workers the number of concurrent workers sending requests to mixpanel
 * @prop {string} version the version of this module
 * @prop {SupportedRecords} recordType the type of record that was sent to mixpanel
 * @prop {Object[]} errors the error payloads from mixpanel
 * @prop {Object[]} responses the response payloads from mixpanel
 */

/**
 * @typedef WarehouseSummary
 * @prop {Object} job job metadata from the warehouse
 * @prop {Object} schema schema for the (usually temporary) table created as a result of the query
 * @prop {Object} sqlAnalysis an AST of the user-entered SQL Query
 * @prop {number} rows the number of rows in the table
 * @prop {Object} [table] additional metadata on the temporary table
 */