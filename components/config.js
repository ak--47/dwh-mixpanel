import * as u from 'ak-tools';
import dayjs from 'dayjs';
// eslint-disable-next-line no-unused-vars
import * as Types from "../types/types.js";

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
		this.logStore = [];
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

	log(something) {
		this.logStore.push(something);
	}

	summary() {
		return {
			mixpanel: this.mpStore,
			[this.dwh]: this.dwhStore,
			time: this.etlTime.report(false),
			logs: this.logStore
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
		if (this.dwh === 'snowflake') {
			return {
				account: this.auth.account,
				username: this.auth.username,
				password: this.auth.password,
				database: this.auth.database,
				schema: this.auth.schema,
				warehouse: this.auth.warehouse,
				query: this.sql
			};
		}

		if (this.dwh === 'athena') {
			return {
				accessKeyId: this.auth.accessKeyId,
				secretAccessKey: this.auth.secretAccessKey,
				region: this.auth.region,
				query: this.sql
			};
		}
	}

	//todo
	validate() {
		// lookup tables must have an id
		if (this.type === 'table' && !this.mixpanel.lookupTableId) throw 'missing lookup table id';
		
		// users + groups need a token
		if (this.type === 'user' && !this.mixpanel.token) throw 'missing project token';
		if (this.type === 'group' && !this.mixpanel.token) throw 'missing project token';

		//groups need a group key
		if (this.type === 'group' && !this.mixpanel.groupKey) throw 'missing group key';

		//events + lookups need an API secret or service acct
		if ((this.type === 'event' || this.type === 'table') && (!this.mixpanel.api_secret || !this.mixpanel.service_acct)) throw 'missing API secret or service acct';

	}
}