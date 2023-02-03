import eventModel from '../models/events.js';
import u from 'ak-tools'
import _ from 'lodash'; // https://lodash.com/docs/4.17.15#curryRight

export default function modelStreamedData(config) {
	if (config.type === 'event') return _.partialRight(eventModel, config.mappings);
	
	// todo
	if (config.type === 'user') return {}
	if (config.type === 'group') return {}
	if (config.type === 'table') return {}
	
	if (config.verbose) u.cLog(`cannot model type: ${config.type}`)
	throw new Error('bad model!', {cause: config.type})
}