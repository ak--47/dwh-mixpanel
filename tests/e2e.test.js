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
const bgTables = require('../environments/bigquery/tables.json');

const sflakeEvents = require('../environments/snowflake/events.json');
const sflakeUsers = require('../environments/snowflake/users.json');
const sflakeGroups = require('../environments/snowflake/groups.json');
const sflakeTables = require('../environments/snowflake/tables.json');


const athenaEvents = require('../environments/athena/events.json');
const athenaUsers = require('../environments/athena/users.json');
const athenaGroups = require('../environments/athena/groups.json');
const athenaTables = require('../environments/athena/tables.json');

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
		const { mixpanel, bigquery, time } = await main({ ...bgTables, ...opts });
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

	//todo test for groups + users
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
		expect(athena.connectionId).toBeTruthy();
		expect(athena.statementId).toBeTruthy();


	}, timeout);

	//todo test for groups + users
	test('users', async () => {
		const { mixpanel, athena, time } = await main({ ...athenaUsers, ...opts });
		expect(mixpanel.success).toBe(10005);
		expect(mixpanel.duration).toBeGreaterThan(0);
		expect(mixpanel.responses.length).toBe(6);
		expect(mixpanel.errors.length).toBe(0);
		expect(athena.connectionId).toBeTruthy();
		expect(athena.statementId).toBeTruthy();

	}, timeout);


	test('groups', async () => {
		const { mixpanel, athena, time } = await main({ ...athenaGroups, ...opts });
		expect(mixpanel.success).toBe(10005);
		expect(mixpanel.duration).toBeGreaterThan(0);
		expect(mixpanel.responses.length).toBe(51);
		expect(mixpanel.errors.length).toBe(0);
		expect(athena.connectionId).toBeTruthy();
		expect(athena.statementId).toBeTruthy();

	}, timeout);

	test('tables', async () => {
		const { mixpanel, athena, time } = await main({ ...athenaTables, ...opts });
		expect(mixpanel.success).toBe(1000);
		expect(mixpanel.duration).toBeGreaterThan(0);
		expect(mixpanel.responses.length).toBe(1);
		expect(mixpanel.errors.length).toBe(0);
		expect(athena.connectionId).toBeTruthy();

	}, timeout);
});

