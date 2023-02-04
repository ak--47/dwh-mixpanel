import eventModel from '../models/events.js';
import userModel from '../models/users.js';
import groupModel from '../models/groups.js';
import tableModel from '../models/tables.js';
import u from 'ak-tools';
import _ from 'lodash'; // https://lodash.com/docs/4.17.15#curryRight

export default function modelStreamedData(config, timeFields) {
	// todo TIME FIELDS!

	if (config.type === 'event') {
		return _.partial(
			eventModel,
			_,
			config.mappings,
			timeFields,
			config.timeTransform,
			config.tags || {});
	}

	if (config.type === 'user') {
		return _.partial(
			userModel,
			_,
			config.mappings,
			config.mixpanel.token,
			timeFields,
			config.timeTransform,
			config.tags || {});
	}
	
	if (config.type === 'group') {
		return _.partial(
			groupModel,
			_,
			config.mappings,
			config.mixpanel.token,
			config.mixpanel.groupKey,
			timeFields,
			config.timeTransform,
			config.tags || {});
	}

	if (config.type === 'table') {
		return _.partial(
			tableModel,
			_,
			config.mappings,
			config.mixpanel.lookupTableId,
			timeFields,
			config.timeTransform,
			config.tags || {});
	}

	if (config.verbose) u.cLog(`cannot model type: ${config.type}`);
	throw new Error('bad model!', { cause: config.type });
}

