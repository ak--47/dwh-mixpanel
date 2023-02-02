import * as u from 'ak-tools';
import dayjs from 'dayjs';

/*
--------
DEFAULTS
--------
*/

const defaultMappings = {
	event_name_col: "event",
	distinct_id_col: "distinct_id",
	time_col: "time",
	insert_id_col: "insert_id"
};

const defaultOptions = {
	test: false,
	logFile: `./logs/log-${dayjs().format('YYYY-MM-DDTHH.mm-ss')}.txt`,
	strict: true,
	compress: false,
	verbose: true,
	streamSize: 27
};

const defaultMixpanel = {
	region: "US",
	type: "event"
};

export default class dwhConfig {
	constructor(spec) {
		this.dwh = spec.dwh || ``;
		this.sql = spec.sql || ``;
		this.auth = spec.auth || {};
		this.mappings = u.objDefault(spec.mappings || {}, defaultMappings);
		this.options = u.objDefault(spec.options || {}, defaultOptions);
		this.mixpanel = u.objDefault(spec.mixpanel || {}, defaultMixpanel);
		this.dwhStore = {};
		this.inCount = 0;
		this.outCount = 0;
	}

	get type() {
		return this.mixpanel.type.toLowerCase()
	}

	in() {
		return this.inCount
	}

	out() {
		return this.outCount
	}

	got() {
		this.inCount++
	}

	sent() {
		this.outCount++
	}

	// set dwhStore(metaData = {}) {
	// 	for (const key in metaData) {
	// 		this.dwhStore[key] = metaData[key]
	// 	}
	// }
	
	// ? methods
	mpAuth() {
		const mp = this.mixpanel;
		return {
			acct: mp.service_acct,
			pass: mp.service_secret,
			project: mp.project_id,
			token: mp.token,
			secret: mp.api_secret,
			lookupTableId: mp.lookupTableId,
			groupKey: mp.groupKey
		};

	}
	mpOpts() {
		const mp = this.mixpanel;
		const opt = this.options;
		return {
			recordType: mp.type,
			region: mp.region,
			streamFormat: 'json',
			compress: opt.compress,
			strict: opt.strict,
			logs: opt.verbose,
			fixData: false,
			streamSize: opt.streamSize

		};
	}
	dwhAuth() {
		if (this.dwh === 'bigquery') {
			return {
				projectId: this.auth.project_id,
				email: this.auth.client_email,
				privateKey: this.auth.private_key,
				query: this.sql,
				location: this.auth.location,
			};
		}
	}
}