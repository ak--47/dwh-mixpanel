// @ts-nocheck
/* eslint-disable no-undef */
/* eslint-disable no-debugger */
/* eslint-disable no-unused-vars */
/* cSpell:disable */
import main from "../index.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const timeout = 60000;

const sflakeEvents = require('../environments/snowflake/events.json');
const sflakeUsers = require('../environments/snowflake/users.json');
const sflakeGroups = require('../environments/snowflake/groups.json');
const sflakeTables = require('../environments/snowflake/tables.json');

const opts = {
	options: {
		"verbose": false,
		"abridged": false
	}
};



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
