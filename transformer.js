import eventModel from './models/events.js';
import _ from 'lodash'; // https://lodash.com/docs/4.17.15#curryRight

export default function modelStreamedData(config) {
	if (config.type === 'event') return _.partialRight(eventModel, config.mappings);

	throw Error(`cannot model type: ${config.type}`)
}