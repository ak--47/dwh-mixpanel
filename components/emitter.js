/*
--------------------
GLOBAL EVENT EMITTER

system events:
	'dwh query start'
	'dwh query end'
	'dwh stream start'
	'dwh stream end'
	'mp import start'
	'mp import end'
--------------------
*/
import { EventEmitter } from 'events';

/**
 * a "global" event emitter
 * @example 'dwh query start' | 'dwh query end' | 'dwh stream start' | 'dwh stream end' | 'mp import start' | 'mp import end'
 */
const emitter = new EventEmitter();

export default emitter;


