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
const emptyRecords = require('../environments/salesforce/empty-records.json');


const opts = {
	options: {
		"verbose": false,
		"abridged": false
	}
};

function sm(config) {
	config.sql += ` LIMIT 100`;
	return config;
}



test('events (oppFieldHistory)', async () => {
	const { mixpanel, salesforce, time } = await main(sm({ ...salesforceEventsHistory, ...opts }));
	expect(mixpanel.success).toBe(100);
	expect(mixpanel.failed).toBe(0);
	expect(mixpanel.duration).toBeGreaterThan(0);
	expect(mixpanel.responses.length).toBe(1);
	expect(mixpanel.errors.length).toBe(0);
	expect(salesforce.sObject).toBe('OpportunityFieldHistory');

}, timeout);

test('events (flat)', async () => {
	const { mixpanel, salesforce, time } = await main(sm({ ...salesforceEventsFlat, ...opts }));
	expect(mixpanel.success).toBe(100);
	expect(mixpanel.duration).toBeGreaterThan(0);
	expect(mixpanel.failed).toBe(0);
	expect(mixpanel.responses.length).toBe(1);
	expect(mixpanel.errors.length).toBe(0);
	expect(salesforce.sObject).toBe('Task');

}, timeout);

//todo decide if you want to support fields(all)
// test('users w/fields(all)', async () => {
// 	const { mixpanel, salesforce, time } = await main(sm({ ...salesforceUsers, ...opts }));
// 	expect(mixpanel.success).toBe(200);
// 	expect(mixpanel.duration).toBeGreaterThan(0);
// 	expect(mixpanel.responses.length).toBe(1);
// 	expect(mixpanel.errors.length).toBe(0);
// 	expect(salesforce.rows).toBe(200);

// 	expect(salesforce.schema).toBeTruthy();

// }, timeout);


test('groups', async () => {
	const { mixpanel, salesforce, time } = await main(sm({ ...salesforceGroups, ...opts }));
	expect(mixpanel.success).toBe(100);
	expect(mixpanel.duration).toBeGreaterThan(0);
	expect(mixpanel.responses.length).toBe(1);
	expect(mixpanel.errors.length).toBe(0);
	expect(salesforce.schema.Id).toStrictEqual({ label: "Opportunity.Id", type: "primary_identifier" });
}, timeout);

test('select star users', async () => {
	const { mixpanel, salesforce, time } = await main(sm({ ...salesforceSelectStarUsers, ...opts }));
	expect(mixpanel.success).toBe(100);
	expect(mixpanel.duration).toBeGreaterThan(0);
	expect(mixpanel.responses.length).toBe(1);
	expect(mixpanel.errors.length).toBe(0);

}, timeout);

test('tables', async () => {
	const { mixpanel, salesforce, time } = await main(sm({ ...salesforceTables, ...opts }));
	expect(mixpanel.success).toBe(100);
	expect(mixpanel.duration).toBeGreaterThan(0);
	expect(mixpanel.responses.length).toBe(1);
	expect(mixpanel.errors.length).toBe(0);
	expect(salesforce.schema.Id).toStrictEqual({ label: "Account.Id", type: "primary_identifier" });

}, timeout);


test('empty records throws', async () => {
	await expect(main(sm({ ...emptyRecords, ...opts })))
		.rejects
		.toThrow('query success with 0 results; broaden the scope of your SOQL query and try again');

}, timeout);


