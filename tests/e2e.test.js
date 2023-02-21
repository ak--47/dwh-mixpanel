/* eslint-disable no-undef */
/* eslint-disable no-debugger */
/* eslint-disable no-unused-vars */
/* cSpell:disable */
import main from "../index.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const timeout = 60000;

const bqEvents = require('../environments/bigquery/events.json');
const bqUsers = require('../environments/bigquery/users.json');
const bqGroups = require('../environments/bigquery/groups.json');
const bqTables = require('../environments/bigquery/tables.json');
const bqAdc = require('../environments/bigquery/adc.json');

const sflakeEvents = require('../environments/snowflake/events.json');
const sflakeUsers = require('../environments/snowflake/users.json');
const sflakeGroups = require('../environments/snowflake/groups.json');
const sflakeTables = require('../environments/snowflake/tables.json');

const athenaEvents = require('../environments/athena/events.json');
const athenaUsers = require('../environments/athena/users.json');
const athenaGroups = require('../environments/athena/groups.json');
const athenaTables = require('../environments/athena/tables.json');

const azureEvents = require('../environments/azure/events.json');
const azureUsers = require('../environments/azure/users.json');
const azureGroups = require('../environments/azure/groups.json');
const azureTables = require('../environments/azure/tables.json');

const salesforceGroups = require('../environments/salesforce/groups.json');
const salesforceEventsHistory = require('../environments/salesforce/eventsHistories.json');
const salesforceUsers = require('../environments/salesforce/users.json');
const salesforceTables = require('../environments/salesforce/tables.json');
const salesforceEventsFlat = require('../environments/salesforce/eventsFlat.json');

const opts = {
	options: {
		"verbose": false
	}
};

describe('do tests work?', () => {
	test('a = a', () => {
		expect(true).toBe(true);
	});
});


describe('bigQuery', () => {
	test('events', async () => {
		const { mixpanel, bigquery, time } = await main({ ...bqEvents, ...opts });
		expect(mixpanel.success).toBe(10005);
		expect(mixpanel.duration).toBeGreaterThan(0);
		expect(mixpanel.responses.length).toBe(6);
		expect(mixpanel.errors.length).toBe(0);
		expect(bigquery.job.status.state).toBe('DONE');


	}, timeout);

	test('verbose events', async () => {
		const { mixpanel, bigquery, time } = await main({ ...bqEvents, ...opts, verbose: true });
		expect(mixpanel.success).toBe(10005);
		expect(mixpanel.duration).toBeGreaterThan(0);
		expect(mixpanel.responses.length).toBe(6);
		expect(mixpanel.errors.length).toBe(0);
		expect(bigquery.job.status.state).toBe('DONE');


	}, timeout);

	test('adc creds', async () => {
		const { mixpanel, bigquery, time } = await main({ ...bqAdc, ...opts, verbose: true });
		expect(mixpanel.success).toBe(10005);
		expect(mixpanel.duration).toBeGreaterThan(0);
		expect(mixpanel.responses.length).toBe(6);
		expect(mixpanel.errors.length).toBe(0);
		expect(bigquery.job.status.state).toBe('DONE');


	}, timeout);

	test('users', async () => {
		const { mixpanel, bigquery, time } = await main({ ...bqUsers, ...opts });
		expect(mixpanel.success).toBe(10005);
		expect(mixpanel.duration).toBeGreaterThan(0);
		expect(mixpanel.responses.length).toBe(6);
		expect(mixpanel.errors.length).toBe(0);
		expect(bigquery.job.status.state).toBe('DONE');

	}, timeout);


	test('groups', async () => {
		const { mixpanel, bigquery, time } = await main({ ...bqGroups, ...opts });
		expect(mixpanel.success).toBe(10005);
		expect(mixpanel.duration).toBeGreaterThan(0);
		expect(mixpanel.responses.length).toBe(51);
		expect(mixpanel.errors.length).toBe(0);
		expect(bigquery.job.status.state).toBe('DONE');

	}, timeout);

	test('tables', async () => {
		const { mixpanel, bigquery, time } = await main({ ...bqTables, ...opts });
		expect(mixpanel.success).toBe(1000);
		expect(mixpanel.duration).toBeGreaterThan(0);
		expect(mixpanel.responses.length).toBe(1);
		expect(mixpanel.errors.length).toBe(0);
		expect(bigquery.job.status.state).toBe('DONE');

	}, timeout);
});

describe('snowflake', () => {
	test('events', async () => {
		const { mixpanel, snowflake, time } = await main({ ...sflakeEvents, ...opts });
		expect(mixpanel.success).toBe(10000);
		expect(mixpanel.duration).toBeGreaterThan(0);
		expect(mixpanel.responses.length).toBe(5);
		expect(mixpanel.errors.length).toBe(0);
		expect(snowflake.connectionId).toBeTruthy();
		expect(snowflake.statementId).toBeTruthy();


	}, timeout);

	test('users', async () => {
		const { mixpanel, snowflake, time } = await main({ ...sflakeUsers, ...opts });
		expect(mixpanel.success).toBe(10005);
		expect(mixpanel.duration).toBeGreaterThan(0);
		expect(mixpanel.responses.length).toBe(6);
		expect(mixpanel.errors.length).toBe(0);
		expect(snowflake.connectionId).toBeTruthy();
		expect(snowflake.statementId).toBeTruthy();

	}, timeout);


	test('groups', async () => {
		const { mixpanel, snowflake, time } = await main({ ...sflakeGroups, ...opts });
		expect(mixpanel.success).toBe(10005);
		expect(mixpanel.duration).toBeGreaterThan(0);
		expect(mixpanel.responses.length).toBe(51);
		expect(mixpanel.errors.length).toBe(0);
		expect(snowflake.connectionId).toBeTruthy();
		expect(snowflake.statementId).toBeTruthy();

	}, timeout);

	test('tables', async () => {
		const { mixpanel, snowflake, time } = await main({ ...sflakeTables, ...opts });
		expect(mixpanel.success).toBe(1000);
		expect(mixpanel.duration).toBeGreaterThan(0);
		expect(mixpanel.responses.length).toBe(1);
		expect(mixpanel.errors.length).toBe(0);
		expect(snowflake.connectionId).toBeTruthy();

	}, timeout);
});


describe('athena', () => {
	test('events', async () => {
		const { mixpanel, athena, time } = await main({ ...athenaEvents, ...opts });
		expect(mixpanel.success).toBe(10000);
		expect(mixpanel.duration).toBeGreaterThan(0);
		expect(mixpanel.responses.length).toBe(5);
		expect(mixpanel.errors.length).toBe(0);
		expect(athena.executionId).toBeTruthy();
		expect(athena.schema.length).toBe(6);
		expect(athena.deleteS3.$metadata.httpStatusCode).toBe(200);
		expect(athena.deleteS3.Deleted.length).toBe(2);
		expect(athena.state).toBe('SUCCEEDED');


	}, timeout);

	test('users', async () => {
		const { mixpanel, athena, time } = await main({ ...athenaUsers, ...opts });
		expect(mixpanel.success).toBe(10005);
		expect(mixpanel.duration).toBeGreaterThan(0);
		expect(mixpanel.responses.length).toBe(6);
		expect(mixpanel.errors.length).toBe(0);
		expect(athena.schema.length).toBe(9);
		expect(athena.deleteS3.$metadata.httpStatusCode).toBe(200);
		expect(athena.deleteS3.Deleted.length).toBe(2);
		expect(athena.state).toBe('SUCCEEDED');

	}, timeout);


	test('groups', async () => {
		const { mixpanel, athena, time } = await main({ ...athenaGroups, ...opts });
		expect(mixpanel.success).toBe(10005);
		expect(mixpanel.duration).toBeGreaterThan(0);
		expect(mixpanel.responses.length).toBe(51);
		expect(mixpanel.errors.length).toBe(0);
		expect(athena.schema.length).toBe(9);
		expect(athena.deleteS3.$metadata.httpStatusCode).toBe(200);
		expect(athena.deleteS3.Deleted.length).toBe(2);
		expect(athena.state).toBe('SUCCEEDED');

	}, timeout);

	test('tables', async () => {
		const { mixpanel, athena, time } = await main({ ...athenaTables, ...opts });
		expect(mixpanel.success).toBe(1000);
		expect(mixpanel.duration).toBeGreaterThan(0);
		expect(mixpanel.responses.length).toBe(1);
		expect(mixpanel.errors.length).toBe(0);
		expect(athena.schema.length).toBe(6);
		expect(athena.deleteS3.$metadata.httpStatusCode).toBe(200);
		expect(athena.deleteS3.Deleted.length).toBe(2);
		expect(athena.state).toBe('SUCCEEDED');

	}, timeout);
});

describe('azure', () => {
	test('events', async () => {
		const { mixpanel, azure, time } = await main({ ...azureEvents, ...opts });
		expect(mixpanel.success).toBe(5000);
		expect(mixpanel.duration).toBeGreaterThan(0);
		expect(mixpanel.responses.length).toBe(3);
		expect(mixpanel.errors.length).toBe(0);
		expect(azure.job).toBeTruthy();
		expect(azure.schema).toBeTruthy();

	}, timeout);

	test('users', async () => {
		const { mixpanel, azure, time } = await main({ ...azureUsers, ...opts });
		expect(mixpanel.success).toBe(3000);
		expect(mixpanel.duration).toBeGreaterThan(0);
		expect(mixpanel.responses.length).toBe(2);
		expect(mixpanel.errors.length).toBe(0);
		expect(azure.job).toBeTruthy();
		expect(azure.schema).toBeTruthy();

	}, timeout);


	test('groups', async () => {
		const { mixpanel, azure, time } = await main({ ...azureGroups, ...opts });
		expect(mixpanel.success).toBe(500);
		expect(mixpanel.duration).toBeGreaterThan(0);
		expect(mixpanel.responses.length).toBe(3);
		expect(mixpanel.errors.length).toBe(0);
		expect(azure.job).toBeTruthy();
		expect(azure.schema).toBeTruthy();

	}, timeout);

	test('tables', async () => {
		const { mixpanel, azure, time } = await main({ ...azureTables, ...opts });
		expect(mixpanel.success).toBe(999);
		expect(mixpanel.duration).toBeGreaterThan(0);
		expect(mixpanel.responses.length).toBe(1);
		expect(mixpanel.errors.length).toBe(0);
		expect(azure.job).toBeTruthy();
		expect(azure.schema).toBeTruthy();


	}, timeout);
});

describe('salesforce', () => {
	test('events (oppFieldHistory)', async () => {
		const { mixpanel, salesforce, time } = await main({ ...salesforceEventsHistory, ...opts });
		expect(mixpanel.success).toBe(4029);
		expect(mixpanel.duration).toBeGreaterThan(0);
		expect(mixpanel.responses.length).toBe(3);
		expect(mixpanel.errors.length).toBe(0);
		expect(salesforce.sObject).toBe('OpportunityFieldHistory');

	}, timeout);

	test('events (flat)', async () => {
		const { mixpanel, salesforce, time } = await main({ ...salesforceEventsFlat, ...opts });
		expect(mixpanel.success).toBe(19451);
		expect(mixpanel.duration).toBeGreaterThan(0);
		expect(mixpanel.responses.length).toBe(10);
		expect(mixpanel.errors.length).toBe(0);
		expect(salesforce.sObject).toBe('Task');

	}, timeout);


	test('users w/fields(all)', async () => {
		const { mixpanel, salesforce, time } = await main({ ...salesforceUsers, ...opts });
		expect(mixpanel.success).toBe(200);
		expect(mixpanel.duration).toBeGreaterThan(0);
		expect(mixpanel.responses.length).toBe(1);
		expect(mixpanel.errors.length).toBe(0);
		expect(salesforce.rows).toBe(200);

		expect(salesforce.schema).toBeTruthy();

	}, timeout);


	test('groups', async () => {
		const { mixpanel, salesforce, time } = await main({ ...salesforceGroups, ...opts });
		expect(mixpanel.success).toBe(400);
		expect(mixpanel.duration).toBeGreaterThan(0);
		expect(mixpanel.responses.length).toBe(2);
		expect(mixpanel.errors.length).toBe(0);
		expect(salesforce.schema.Id).toStrictEqual({ label: "Opportunity.Id", type: "primary_identifier" });
	}, timeout);

	test('tables', async () => {
		const { mixpanel, salesforce, time } = await main({ ...salesforceTables, ...opts });
		expect(mixpanel.success).toBe(100);
		expect(mixpanel.duration).toBeGreaterThan(0);
		expect(mixpanel.responses.length).toBe(1);
		expect(mixpanel.errors.length).toBe(0);
		expect(salesforce.schema.Id).toStrictEqual({ label: "Account.Id", type: "primary_identifier" });

	}, timeout);
});
