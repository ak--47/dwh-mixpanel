// @ts-nocheck
/* eslint-disable no-undef */
/* eslint-disable no-debugger */
/* eslint-disable no-unused-vars */
/* cSpell:disable */
import main from "../index.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const timeout = 60000;


const salesforceGroups = require('../environments/salesforce/groups.json');
const salesforceEventsHistory = require('../environments/salesforce/eventsHistories.json');
const salesforceUsers = require('../environments/salesforce/users.json');
const salesforceTables = require('../environments/salesforce/tables.json');
const salesforceEventsFlat = require('../environments/salesforce/eventsFlat.json');
const salesforceSelectStarUsers = require('../environments/salesforce/selectStarUsers.json');


const opts = {
	options: {
		"verbose": false,
		"abridged": false
	}
};



test('events (oppFieldHistory)', async () => {
	const { mixpanel, salesforce, time } = await main({ ...salesforceEventsHistory, ...opts });
	expect(mixpanel.success).toBeGreaterThan(3000);
	expect(mixpanel.failed).toBe(0);
	expect(mixpanel.duration).toBeGreaterThan(0);
	expect(mixpanel.responses.length).toBeGreaterThan(1);
	expect(mixpanel.errors.length).toBe(0);
	expect(salesforce.sObject).toBe('OpportunityFieldHistory');

}, timeout);

test('events (flat)', async () => {
	const { mixpanel, salesforce, time } = await main({ ...salesforceEventsFlat, ...opts });
	expect(mixpanel.success).toBeGreaterThan(19000);
	expect(mixpanel.duration).toBeGreaterThan(0);
	expect(mixpanel.failed).toBe(0);
	expect(mixpanel.responses.length).toBe(10);
	expect(mixpanel.errors.length).toBe(0);
	expect(salesforce.sObject).toBe('Task');

}, timeout);

//todo decide if you want to support fields(all)
// test('users w/fields(all)', async () => {
// 	const { mixpanel, salesforce, time } = await main({ ...salesforceUsers, ...opts });
// 	expect(mixpanel.success).toBe(200);
// 	expect(mixpanel.duration).toBeGreaterThan(0);
// 	expect(mixpanel.responses.length).toBe(1);
// 	expect(mixpanel.errors.length).toBe(0);
// 	expect(salesforce.rows).toBe(200);

// 	expect(salesforce.schema).toBeTruthy();

// }, timeout);


test('groups', async () => {
	const { mixpanel, salesforce, time } = await main({ ...salesforceGroups, ...opts });
	expect(mixpanel.success).toBe(400);
	expect(mixpanel.duration).toBeGreaterThan(0);
	expect(mixpanel.responses.length).toBe(2);
	expect(mixpanel.errors.length).toBe(0);
	expect(salesforce.schema.Id).toStrictEqual({ label: "Opportunity.Id", type: "primary_identifier" });
}, timeout);

test('select star users', async () => {
	const { mixpanel, salesforce, time } = await main({ ...salesforceSelectStarUsers, ...opts });
	expect(mixpanel.success).toBeGreaterThan(1300);
	expect(mixpanel.duration).toBeGreaterThan(0);
	expect(mixpanel.responses.length).toBeGreaterThan(1);
	expect(mixpanel.errors.length).toBe(0);

}, timeout);

test('tables', async () => {
	const { mixpanel, salesforce, time } = await main({ ...salesforceTables, ...opts });
	expect(mixpanel.success).toBe(100);
	expect(mixpanel.duration).toBeGreaterThan(0);
	expect(mixpanel.responses.length).toBe(1);
	expect(mixpanel.errors.length).toBe(0);
	expect(salesforce.schema.Id).toStrictEqual({ label: "Account.Id", type: "primary_identifier" });

}, timeout);


