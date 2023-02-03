import * as u from 'ak-tools';
import dayjs from 'dayjs';
// eslint-disable-next-line no-unused-vars
import * as Types from "../types/types.js";

/*
--------
DEFAULTS
--------
*/

//todo
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

/*
------
CONFIG
------
*/

export default class dwhConfig {
	constructor(spec) {
		this.dwh = spec.dwh || ``;
		this.sql = spec.sql || ``;
		this.auth = spec.auth || {};

		this.mappings = u.objDefault(spec.mappings || {}, defaultMappings);
		this.options = u.objDefault(spec.options || {}, defaultOptions);
		this.mixpanel = u.objDefault(spec.mixpanel || {}, defaultMixpanel);
		this.tags = spec.tags || {};

		this.inCount = 0;
		this.outCount = 0;

		this.dwhStore = {};
		this.mpStore = {};
		this.arbStore = {};
		this.timers = {
			etl: u.timer('etl'),
			query: u.timer('query'),
			stream: u.timer('stream'),
			import: u.timer('import')
		};
	}

	get type() {
		return this.mixpanel.type.toLowerCase();
	}

	get warehouse() {
		return this.dwh.toLowerCase();
	}

	get verbose() {
		return this.options.verbose;
	}

	get queryTime() {
		return this.timers.query;
	}
	get streamTime() {
		return this.timers.stream;
	}
	get importTime() {
		return this.timers.import;
	}
	get etlTime() {
		return this.timers.etl;
	}

	in(pretty = true) {
		return pretty ? u.comma(this.inCount) : this.inCount;
	}

	out(pretty = true) {
		return pretty ? u.comma(this.outCount) : this.outCount;
	}

	got() {
		this.inCount++;
	}

	sent() {
		this.outCount++;
	}

	// ? methods
	store(data, where = 'dwh') {
		if (where === 'dwh') {
			this.dwhStore = u.objDefault(this.dwhStore, data);
		}
		else if (where === 'mp') {
			this.mpStore = u.objDefault(this.mpStore, data);
		}

		else {
			this.arbStore = u.objDefault(this.arbStore, data);
		}
	}

	summary() {
		return {
			mixpanel: this.mpStore,
			[this.dwh]: this.dwhStore,
			time: this.etlTime.report(false)
		};
	}


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
				type: this.auth.type,
				project_id: this.auth.project_id,
				private_key_id: this.auth.private_key_id,
				private_key: this.auth.private_key,
				client_email: this.auth.client_email,
				client_id: this.auth.client_id,
				client_x509_cert_url: this.auth.client_x509_cert_url,
				auth_uri: this.auth.auth_uri,
				token_uri: this.auth.token_uri,
				auth_provider_x509_cert_url: this.auth.auth_provider_x509_cert_url,
				query: this.sql,
				location: this.auth.location,
			};
		}
	}
}