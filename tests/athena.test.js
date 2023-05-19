// @ts-nocheck
/* eslint-disable no-undef */
/* eslint-disable no-debugger */
/* eslint-disable no-unused-vars */
/* cSpell:disable */
import main from "../index.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const timeout = 60000;

const athenaEvents = require('../environments/athena/events.json');
const athenaUsers = require('../environments/athena/users.json');
const athenaGroups = require('../environments/athena/groups.json');
const athenaTables = require('../environments/athena/tables.json');

const opts = {
	options: {
		"verbose": false,
		"abridged": false
	}
};


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
