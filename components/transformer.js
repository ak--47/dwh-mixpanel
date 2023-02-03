import eventModel from '../models/events.js';
import userModel from '../models/users.js';
import groupModel from '../models/groups.js';
import tableModel from '../models/tables.js';
import u from 'ak-tools';
import _ from 'lodash'; // https://lodash.com/docs/4.17.15#curryRight

export default function modelStreamedData(config) {
	if (config.type === 'event') {
		return _.partialRight(
			eventModel,
			config.mappings,
			config.timeTransform,
			config.tags || {});
	}
	if (config.type === 'user') {
		return _.partialRight(
			userModel,
			config.mappings,
			config.mixpanel.token,
			config.timeTransform,
			config.tags || {});
	}
	if (config.type === 'group') {
		return _.partialRight(
			groupModel,
			config.mappings,
			config.mixpanel.token,
			config.mixpanel.groupKey,
			config.timeTransform,
			config.tags || {});
	}

	// todo
	if (config.type === 'table') {
		return _.partialRight(
			tableModel,
			config.mappings,
			config.mixpanel.lookupTableId,
			config.timeTransform,
			config.tags || {});
	}

	if (config.verbose) u.cLog(`cannot model type: ${config.type}`);
	throw new Error('bad model!', { cause: config.type });
}

