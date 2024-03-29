// @ts-nocheck
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

const opts = {
	options: {
		"verbose": false,
		"abridged": false
	}
};





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
