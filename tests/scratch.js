/**
 * 
 * THIS IS JUST A SCRATCH FILE 
 * TO TEST RANDOM CONFIGS LOCALLY
 * YOU PROBABLY DON'T NEED THIS 
 * BUT I DID... ;) 
 */

/* eslint-disable no-undef */
/* eslint-disable no-debugger */
/* eslint-disable no-unused-vars */
/* cSpell:disable */
import main from "../index.js"
import { createRequire } from "module";
const require = createRequire(import.meta.url);

// link to a config!
const current = require("../environments/current.json");


// do the thing!
main(current)
	.then(result => {
		//noop
		// debugger;
	})
	.catch(e => {
		//noop
		// debugger;
	}) 