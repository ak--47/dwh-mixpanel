// @ts-nocheck
/* eslint-disable no-undef */
/* eslint-disable no-debugger */
/* eslint-disable no-unused-vars */
/* cSpell:disable */
import main from "../index.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const timeout = 60000;

const azureEvents = require('../environments/azure/events.json');
const azureUsers = require('../environments/azure/users.json');
const azureGroups = require('../environments/azure/groups.json');
const azureTables = require('../environments/azure/tables.json');

const opts = {
	options: {
		"verbose": false,
		"abridged": false
	}
};




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
