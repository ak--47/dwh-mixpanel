/*
--------------------
GLOBAL EVENT EMITTER

system events:
	'import start'
	'import end'
	'export start'
	'export end'
--------------------
*/
import { EventEmitter } from 'events';

/**
 * a global event emitter
 * @example 'import start' | 'import end' | 'export start' | 'export end'
 */
const emitter = new EventEmitter();

export default emitter;


