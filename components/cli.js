import env from './env.js';
import Config from "./config.js";
import inquirer from 'inquirer';
import sqlParse from 'node-sql-parser';
import u from 'ak-tools';
import box from 'cli-box';
import { writeFileSync } from 'fs';
import { resolve } from 'path';


export default async function cli() {
	// * CHECK FOR A PASSED-IN CONFIG
	const { configIsValid, userSuppliedConfig } = await checkForCliConfig(process.argv.slice().pop());
	if (configIsValid) {
		if (userSuppliedConfig?.options.verbose) console.log(shortWelcome);
		return {
			params: userSuppliedConfig,
			run: true
		};
	}

	// * ENV VARS
	const envVars = env();

	// * WALKTHOUGH
	const ask = inquirer.createPromptModule();
	console.log(welcome);

	// * DWH Q's
	const dwh = (await ask(dwhType())).name;

	console.log(logo(`${dwh} setup`));
	const auth = await ask(dwhAuth(dwh, envVars));
	let sql = (await ask(inputSQL(dwh))).sql;

	//* MIXPANEL Q'S
	console.log(logo(`mixpanel setup`));
	const mpOne = await ask(mixpanelFirst(envVars));
	const mpTwo = await ask(mixpanelSecond(envVars, mpOne));
	const mixpanel = { ...mpOne, ...mpTwo };

	// * OPTION Q'S
	console.log(logo(`mappings + options`));
	const mappings = await ask(getMappings(dwh, mixpanel));
	const options = await ask(getOptions(dwh, mixpanel));

	// * SMALL FIXINS
	if (options.test) sql += `LIMIT 1000`;
	if (!mappings.insert_id_col) options.strict = false;

	// * SAVE CONFIG
	const config = {
		dwh,
		auth,
		sql,
		mappings,
		options,
		mixpanel
	};
	const fileName = resolve(`./${dwh}-mixpanel.json`);

	writeFileSync(
		fileName,
		JSON.stringify(config, null, 2),
		{ encoding: 'utf8', flag: 'w' }
	);

	console.log(`\nAWESOME! nice work! thanks for doing all that!\n
i have saved your configuration file to:\n\n\t${fileName}\n\nyou can reuse it later!\n\n`);

	// * CONFIRM RUN
	const shouldContinue = (await ask(confirmETL(config))).run;

	return {
		params: config,
		run: shouldContinue
	};
}

/*
----
* QUESTIONS *
----
*/

function dwhType() {
	/**
	 * @type {import("inquirer").Question} 
	 */
	const questions = [
		{
			message: "what is your data warehouse",
			name: "name",
			type: "list",
			suffix: "\n",
			choices: [
				{ name: "\tGoogle BigQuery", value: "bigquery" },
				{ name: "\tSnowflake", value: "snowflake" },
				{ name: "\tAWS Athena", value: "athena" }
			]
		}
	];
	return questions;
}

function dwhAuth(dwh, env) {
	let questions;

	switch (dwh) {
		case "bigquery":
			questions = bigqueryAuth(env);
			break;
		case "snowflake":
			questions = snowflakeAuth(env);
			break;

		case "athena":
			questions = athenaAuth(env);
			break;

		default:
			break;
	}

	return questions;

}


function athenaAuth(env) {
	/**
	* @type {import("inquirer").Question} 
	*/
	return [
		{
			message: "what is your AWS Access Key Id?",
			name: "accessKeyId",
			type: "input",
			suffix: "\n",
			default: env?.auth?.accessKeyId,
			validate: passesNotEmpty
		},
		{
			message: "what is your AWS Secret Access Key?",
			name: "secretAccessKey",
			type: "input",
			suffix: "\n",
			default: env?.auth?.secretAccessKey,
			validate: passesNotEmpty
		},
		{
			message: "what is the REGION for your AWS Athena Instance?",
			name: "region",
			type: "input",
			default: env?.auth?.region || "us-east-2",
			suffix: "\n",
			validate: passesNotEmpty
		}
	];
}

function bigqueryAuth(env) {
	/**
	* @type {import("inquirer").Question} 
	*/
	return [
		{
			message: "what is your GCP project Id?",
			name: "project_id",
			type: "input",
			suffix: "\n",
			default: env?.auth?.project_id,
			validate: passesNotEmpty
		},
		{
			message: "which REGION is your bigQuery instance in?",
			name: "location",
			type: "input",
			suffix: "\n",
			default: env?.auth?.location || "US",
			validate: passesNotEmpty
		},
		{
			message: "what is your Service Account's email address?",
			name: "client_email",
			type: "input",
			suffix: "\n",
			default: env?.auth?.client_email,
			validate: passesNotEmpty
		},
		{
			message: "what is your Service Account's private key?",
			name: "private_key",
			type: "input",
			suffix: "\n",
			default: env?.auth?.private_key,
			validate: passesNotEmpty
		}
	];
}


function snowflakeAuth(env) {
	/**
	* @type {import("inquirer").Question} 
	*/
	return [
		{
			message: "what's your snowflake account name?",
			name: "account",
			type: "input",
			suffix: "\n",
			default: env?.auth?.account,
			validate: passesNotEmpty
		},
		{
			message: "what's your snowflake username?",
			name: "username",
			type: "input",
			suffix: "\n",
			default: env?.auth?.username,
			validate: passesNotEmpty
		},
		{
			message: "what's your snowflake password?",
			name: "password",
			type: "input",
			suffix: "\n(note: 2FA is not supported)\n",
			default: env?.auth?.password,
			validate: passesNotEmpty
		},
		{
			message: "what is the name of your snowflake warehouse?",
			name: "warehouse",
			type: "input",
			default: env?.auth?.warehouse || "COMPUTE_WH",
			suffix: "\n",
			validate: passesNotEmpty
		},
		{
			message: "what is the name of the database that we are querying?",
			name: "database",
			type: "input",
			default: env?.auth?.database,
			suffix: "\n",
			validate: passesNotEmpty
		},
		{
			message: "what is the name of the schema we're using?",
			name: "schema",
			type: "input",
			default: env?.auth?.database || "PUBLIC",
			suffix: "\n",
			validate: passesNotEmpty
		}

	];
}


function inputSQL(dwh) {
	/**
	 * @type {import("inquirer").Question} 
	 */
	const questions = [
		{
			message: `what SQL Query should we run on your ${dwh} instance?`,
			name: "sql",
			type: "input",
			suffix: '\n\n',
			validate: verifySQL

		}
	];
	return questions;
}

function mixpanelFirst(env) {
	/**
	 * @type {import("inquirer").Question} 
	 */
	const questions = [
		{
			message: "what type of data are you sending?",
			name: "type",
			type: "list",
			suffix: '\n',
			choices: [
				{ name: "\tevents", value: "event" },
				{ name: "\tuser profiles", value: "user" },
				{ name: "\tgroup profiles", value: "group" },
				{ name: "\tlookup tables", value: "table" }
			]

		},
		{
			message: "what is your mixpanel project id?",
			name: "project_id",
			type: "input",
			suffix: '\n',
			default: env?.mixpanel?.project_id,
			validate: isNumber
		},
		{
			message: "what region is your mixpanel project in?",
			name: "region",
			type: "list",
			suffix: '\n',
			choices: [
				{ name: "\t🇺🇸 United States", value: "US" },
				{ name: "\t🇪🇺 European Union", value: "EU" }
			]

		},
		{
			message: "how do you wish to authenticate with mixpanel?",
			name: "howAuth",
			type: "list",
			suffix: '\n',
			choices: [
				{ name: "\tService Account", value: "serviceAccount" },
				{ name: "\tAPI Secret (deprecated)", value: "APISecret" }
			]

		}


	];
	return questions;
}

function mixpanelSecond(env, answers) {
	const questions = [];

	const serviceAccount = [
		{
			message: "what is your service account username?",
			name: "service_account",
			type: "input",
			suffix: '\n',
			default: env?.mixpanel?.service_acct,
			validate: passesNotEmpty
		},
		{
			message: "what is your service account secret?",
			name: "service_secret",
			type: "input",
			suffix: '\n',
			default: env?.mixpanel?.service_secret,
			validate: passesNotEmpty
		}
	];

	const apiSecret = [
		{
			message: "what is your project's API Secret?",
			name: "api_secret",
			type: "input",
			suffix: '\n',
			default: env?.mixpanel?.api_secret,
			validate: passesNotEmpty
		}
	];

	const token = [
		{
			message: "what is your project's token?",
			name: "token",
			type: "input",
			suffix: '\n',
			default: env?.mixpanel?.token,
			validate: passesNotEmpty
		}
	];

	const groupKey = [
		{
			message: "what is your project's group key?",
			name: "groupKey",
			type: "input",
			suffix: '\n',
			default: env?.mixpanel?.groupKey,
			validate: passesNotEmpty
		}
	];

	const lookup = [
		{
			message: "what is your project's lookup table id?",
			name: "lookupTableId",
			type: "input",
			suffix: '\n',
			default: env?.mixpanel?.lookupTableId,
			validate: passesNotEmpty
		}
	];

	if (answers?.howAuth === 'serviceAccount') questions.push(serviceAccount);
	if (answers?.howAuth === 'APISecret') questions.push(apiSecret);
	if (['user', 'group'].includes(answers?.type)) questions.push(token);
	if (answers?.type === 'group') questions.push(groupKey);
	if (answers?.type === 'table') questions.push(lookup);


	return questions.flat();
}

function getMappings(dwh, mixpanel) {
	const questions = [];
	/**
	 * @type {import("inquirer").Question} 
	 */
	const eventQuestions = [
		{
			message: `from ${dwh}, which COLUMN header should be used for EVENT NAME in mixpanel?`,
			name: "event_name_col",
			type: "input",
			suffix: '\n',
			default: "event",
			validate: passesNotEmpty
		},
		{
			message: `from ${dwh}, which COLUMN header should be used for EVENT TIME in mixpanel?`,
			name: "time_col",
			type: "input",
			suffix: '\n',
			default: "time",
			validate: passesNotEmpty
		},
		{
			message: `from ${dwh}, which COLUMN header should be used for UNIQUE USER ID (distinct_id) in mixpanel?`,
			name: "distinct_id_col",
			type: "input",
			suffix: '\n',
			validate: passesNotEmpty
		},
		{
			message: `from ${dwh}, which COLUMN header should be used for INSERT_ID (deduplication) in mixpanel?`,
			name: "insert_id_col",
			type: "input",
			suffix: '\n',
		}
	];

	const userProfileQuestions = [
		{
			message: `from ${dwh}, which COLUMN header should be used for UNIQUE USER ID (distinct_id) in mixpanel?`,
			name: "distinct_id_col",
			type: "input",
			suffix: '\n',
			validate: passesNotEmpty
		},
		{
			message: `[optional] from ${dwh}, which COLUMN header should be used for USER NAME ($name) in mixpanel?`,
			name: "name_col",
			type: "input",
			suffix: '\n',
		},
		{
			message: `[optional] from ${dwh}, which COLUMN header should be used for USER EMAIL ($email) in mixpanel?`,
			name: "email_col",
			type: "input",
			suffix: '\n',
		},
		{
			message: `[optional] from ${dwh}, which COLUMN header should be used for USER IP ADDRESS (geolocation) in mixpanel?`,
			name: "ip_col",
			type: "input",
			suffix: '\n',
		},
		{
			message: "which type of profile operation do you wish to run?",
			name: "profileOperation",
			type: "list",
			suffix: '\n',
			choices: [
				{ name: "\t$set", value: "$set" },
				{ name: "\t$set_once", value: "$set_once" },
				{ name: "\t$add", value: "$add" },
				{ name: "\t$union", value: "$union" },
				{ name: "\t$append", value: "$append" },
				{ name: "\t$remove", value: "$remove" },
				{ name: "\t$delete", value: "$delete" }
			]
		}
	];

	const groupProfileQuestions = [
		{
			message: `from ${dwh}, which COLUMN header should be used for GROUP ID (distinct_id) in mixpanel?`,
			name: "distinct_id_col",
			type: "input",
			suffix: '\n',
			validate: passesNotEmpty
		},
		{
			message: `[optional] from ${dwh}, which COLUMN header should be used for GROUP NAME ($name) in mixpanel?`,
			name: "name_col",
			type: "input",
			suffix: '\n',
		},
		{
			message: `[optional] from ${dwh}, which COLUMN header should be used for GROUP EMAIL ($email) in mixpanel?`,
			name: "email_col",
			type: "input",
			suffix: '\n',
		},
		{
			message: "which type of profile operation do you wish to run?",
			name: "profileOperation",
			type: "list",
			suffix: '\n',
			choices: [
				{ name: "\t$set", value: "$set" },
				{ name: "\t$set_once", value: "$set_once" },
				{ name: "\t$add", value: "$add" },
				{ name: "\t$union", value: "$union" },
				{ name: "\t$append", value: "$append" },
				{ name: "\t$remove", value: "$remove" },
				{ name: "\t$delete", value: "$delete" }
			]
		}

	];

	const lookupQuestions = [
		{
			message: `from ${dwh}, which COLUMN header should be used to join with your mixpanel event's properties data?`,
			name: "lookup_col",
			type: "input",
			suffix: '\n',
			validate: passesNotEmpty
		}
	];

	if (mixpanel.type === "event") questions.push(eventQuestions);
	if (mixpanel.type === "user") questions.push(userProfileQuestions);
	if (mixpanel.type === "group") questions.push(groupProfileQuestions);
	if (mixpanel.type === "table") questions.push(lookupQuestions);

	return questions.flat();
}

function getOptions(dwh, mixpanel) {
	const questions = [];
	/**
	 * @type {import("inquirer").Question} 
	 */
	const alwaysAsk = [
		{
			message: "how many concurrent workers do you want?\t(more is faster, but too many can cause crashes)",
			name: "workers",
			type: "input",
			suffix: '\n',
			default: 20,
			validate: isNumber
		},
		{
			message: "do you want to generate logs?",
			name: "shouldLog",
			type: "list",
			suffix: '\n',
			choices: [
				{ name: "\tYes", value: true },
				{ name: "\tNo", value: false }
			]
		},
		{
			message: "is this a test run?\t\t(note this will add a 'LIMIT 1000' to your query)",
			name: "test",
			type: "list",
			suffix: '\n',
			choices: [
				{ name: "\tYes", value: true },
				{ name: "\tNo", value: false }
			]
		}
	];

	const askForEvents = [
		{
			message: "do you want to use strict mode?",
			name: "strict",
			type: "list",
			suffix: '\n',
			choices: [
				{ name: "\tYes", value: true },
				{ name: "\tNo", value: false }
			]
		},
		{
			message: "do you want to compress the data in transit?",
			name: "compress",
			type: "list",
			suffix: '\n',
			choices: [
				{ name: "\tYes (slower)", value: true },
				{ name: "\tNo (faster)", value: false }
			]
		}
	];

	if (mixpanel?.type === 'event') questions.push(askForEvents);

	questions.push(alwaysAsk);

	return questions.flat();
}

function confirmETL(config) {
	const cleanMappings = u.cleanObj(config.mappings);
	delete cleanMappings.profileOperation;

	const confirmationMsg =
		`
... so the plan is to load ${config.mixpanel.type.toUpperCase()}S from ${config.dwh.toUpperCase()} to MIXPANEL which are modeled by the SQL query:

${config.sql}

with the following column mappings:

${JSON.stringify(cleanMappings, null, 2)}

does that look right? do you want to proceed with the rETL?
`;
	/**
	 * @type {import("inquirer").Question} 
	 */
	const questions = [
		{
			message: confirmationMsg,
			name: "run",
			type: "list",
			prefix: "QUICK REVIEW!\n",
			suffix: "\n",
			choices: [
				{ name: "\tYes (let's go!)", value: true },
				{ name: "\tNo (i'll do it later)", value: false }
			]
		}
	];
	return questions;
};


/*
--------
* VALIDATION * 
--------
*/

async function checkForCliConfig(maybeJson) {
	let configExits = false;
	let configIsValid = false;
	let userSuppliedConfig = {};

	let file = null;

	try {
		file = await u.load(maybeJson, true, undefined, false);
		configExits = true;
	}

	catch (e) {
		configExits = false;
		configIsValid = false;
	}

	try {
		Config.validate.bind(file);
		configIsValid = true;
	}
	catch (e) {
		configIsValid = false;
	}

	userSuppliedConfig = file;

	return {
		configIsValid,
		configExits,
		userSuppliedConfig
	};
}

function passesNotEmpty(str) {
	if (!str) return "your answer can't be empty...";
	return true;
}

function verifySQL(sqlText) {
	if (!u.is(Boolean, passesNotEmpty(sqlText))) {
		return `can't be empty!`;
	}
	const variants = ['bigquery', 'db2', 'hive', 'mysql', 'mariadb', 'postgresql', 'sqlite', 'transactsql', 'flinksql'];
	const sqlParser = new sqlParse.Parser();
	let valid = false;

	for (let variant of variants) {
		try {
			sqlParser.parse(sqlText, { database: variant });
			valid = true;
			return valid;
		}

		catch (e) {
			valid = 'not a syntactically valid SQL Query';
		}

	}

	return valid;

}

function isNumber(n) {
	if (!u.is(Boolean, passesNotEmpty(n))) {
		return `can't be empty!`;
	}
	if (isNaN(Number(n))) {
		return 'must be a number';
	}
	return true;
}



/*
----
* STRINGS * 
----
*/


const hero = String.raw`
o-o   o       o o  o         o       o   o o-O-o o   o o--o    O  o   o o--o o    
|  \  |       | |  |          \      |\ /|   |    \ /  |   |  / \ |\  | |    |    
|   O o   o   o O--O     o-o   O     | O |   |     O   O--o  o---o| \ | O-o  |    
|  /   \ / \ /  |  |          /      |   |   |    / \  |     |   ||  \| |    |    
o-o     o   o   o  o         o       o   o o-O-o o   o o     o   oo   o o--o O---o                                                                                                                                                                    
`;

const banner = `\n\tmove data from your warehouse... to mixpanel!\n\tby AK (v${process.env.npm_package_version || 1})\n\thttps://github.com/ak--47/dwh-mixpanel\n\n`;
const note = `this tutorial will ask you a few questions to help you build a configuration file!\n\nyou will want to be logged into your data warehouse + your mixpanel account\n\nnote: once finished with this walkthrough, you will be able to re-use this configuration file with:\n\tnpx dwh-mixpanel ./path-to-config.json\n\n`;

const welcome = hero.concat(banner).concat(note);
const shortWelcome = hero.concat(banner);

// function logo(name) {
// 	return `
// ----------------------
// ${name.toUpperCase()}
// ----------------------
// `;
// }


function logo(text) {
	const output = new box({
		w: 20,
		h: 1,
		stringify: false,
		stretch: true,
		hAlign: 'middle',
		vAlign: 'center'
	}, text.toUpperCase());


	return `\n${output.stringify()}\n`;
}

