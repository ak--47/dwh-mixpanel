import env from './env.js';
import inquirer from 'inquirer';

//todo...
export default async function cli() {
	const envVars = env();

	const ask = inquirer.createPromptModule();
	console.log(welcome);

	const dwh = (await ask(dwhType())).name;
	const auth = await ask(dwhAuth(dwh, envVars));
	const sql = await ask(inputSQL(dwh));
	const mixpanel = await ask(mixpanelInputs(dwh, envVars, ask));
	const mappings = await ask(getMappings(dwh, mixpanel));
	const options = await ask(getOptions(dwh, mixpanel));

	const config = {
		dwh,
		auth,
		sql,
		mappings,
		options,
		mixpanel
	};

	const shouldContinue = await ask(confirmETL(dwh, mixpanel, sql));



	return {
		params: config,
		run: shouldContinue
	};
}



function dwhType() {
	/**
	 * @type {import("inquirer").Question} 
	 */
	const questions = [
		{
			message: "what is your data warehouse",
			name: "name",
			type: "list",
			choices: [
				{ name: "Google BigQuery", value: "bigquery" },
				{ name: "Snowflake", value: "snowflake" },
				{ name: "AWS Athena", value: "athena" }
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
			validate: notEmpty
		},
		{
			message: "what is your AWS Secret Access Key?",
			name: "secretAccessKey",
			type: "input",
			validate: notEmpty
		},
		{
			message: "what is the REGION for your AWS Athena Instance?",
			name: "region",
			type: "input",
			default: "us-east-2",
			validate: notEmpty
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
			validate: notEmpty
		},
		{
			message: "what is your Service Account's email address (client_email)?",
			name: "client_email",
			type: "input",
			validate: notEmpty
		},
		{
			message: "what is your Service Account's private key?",
			name: "private_key",
			type: "input",
			validate: notEmpty
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
			validate: notEmpty
		},
		{
			message: "what's your snowflake username?",
			name: "username",
			type: "input",
			validate: notEmpty
		},
		{
			message: "what's your snowflake password?",
			name: "password",
			type: "input",
			validate: notEmpty
		},
		{
			message: "what is the name of your snowflake warehouse?",
			name: "warehouse",
			type: "input",
			default: "COMPUTE_WH",
			validate: notEmpty
		},
		{
			message: "what is the name of the database that we are querying?",
			name: "database",
			type: "input",
			validate: notEmpty
		},
		{
			message: "what is the name of the schema we're using?",
			name: "schema",
			type: "input",
			default: "PUBLIC",
			validate: notEmpty
		}

	];
}


function inputSQL(dwh) {
	/**
	 * @type {import("inquirer").Question} 
	 */
	const questions = [
		{
			message: "what is your data warehouse",
			name: "dwh",
			type: "list",
			choices: [
				{ name: "Google BigQuery", value: "bigquery" },
				{ name: "Snowflake", value: "snowflake" },
				{ name: "AWS Athena", value: "athena" }
			]
		}
	];
	return questions;
}

function mixpanelInputs(dwh, env, ask) {
	/**
	 * @type {import("inquirer").Question} 
	 */
	const questions = [
		{
			message: "what is your data warehouse",
			name: "dwh",
			type: "list",
			choices: [
				{ name: "Google BigQuery", value: "bigquery" },
				{ name: "Snowflake", value: "snowflake" },
				{ name: "AWS Athena", value: "athena" }
			]
		}
	];
	return questions;
}

function getMappings(dwh, mixpanel) {
	/**
	 * @type {import("inquirer").Question} 
	 */
	const questions = [
		{
			message: "what is your data warehouse",
			name: "dwh",
			type: "list",
			choices: [
				{ name: "Google BigQuery", value: "bigquery" },
				{ name: "Snowflake", value: "snowflake" },
				{ name: "AWS Athena", value: "athena" }
			]
		}
	];
	return questions;
}

function getOptions(dwh, mixpanel) {
	/**
	 * @type {import("inquirer").Question} 
	 */
	const questions = [
		{
			message: "what is your data warehouse",
			name: "dwh",
			type: "list",
			choices: [
				{ name: "Google BigQuery", value: "bigquery" },
				{ name: "Snowflake", value: "snowflake" },
				{ name: "AWS Athena", value: "athena" }
			]
		}
	];
	return questions;
}

function confirmETL(dwh, mixpanel, sql) {
	/**
	 * @type {import("inquirer").Question} 
	 */
	const questions = [
		{
			message: "what is your data warehouse",
			name: "dwh",
			type: "list",
			choices: [
				{ name: "Google BigQuery", value: "bigquery" },
				{ name: "Snowflake", value: "snowflake" },
				{ name: "AWS Athena", value: "athena" }
			]
		}
	];
	return questions;
};



function notEmpty(str) {
	if (!str) return "your answer can't be empty...";
	return true;
}


const hero = String.raw`
o-o   o       o o  o         o       o   o o-O-o o   o o--o    O  o   o o--o o    
|  \  |       | |  |          \      |\ /|   |    \ /  |   |  / \ |\  | |    |    
|   O o   o   o O--O     o-o   O     | O |   |     O   O--o  o---o| \ | O-o  |    
|  /   \ / \ /  |  |          /      |   |   |    / \  |     |   ||  \| |    |    
o-o     o   o   o  o         o       o   o o-O-o o   o o     o   oo   o o--o O---o                                                                                                                                                                    
`;

const banner = `\n\tby AK (v${process.env.npm_package_version || 1})\n\tmove data from your data warehouse... to mixpanel!\n\thttps://github.com/ak--47/dwh-mixpanel\n\n`;
const note = `i need to ask you a few questions to help you build a configuration file\n\nnote: you can re-use this configuration file with:\n\tnpx dwh-mixpanel ./path-to-config.json\n\n`;




const welcome = hero.concat(banner).concat(note);