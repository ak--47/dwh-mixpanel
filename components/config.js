import * as u from 'ak-tools';
import dayjs from 'dayjs';
import cliProgress from 'cli-progress';
import colors from 'ansi-colors';
import { createRequire } from "node:module";
import crypto from 'crypto';
import fs from 'fs';


const require = createRequire(import.meta.url);

/*
--------
DEFAULTS
--------
*/

// const defaultMappings = {
// 	event_name_col: "event",
// 	distinct_id_col: "distinct_id",
// 	time_col: "time",
// 	insert_id_col: "insert_id"
// };

/** @type {import('mixpanel-import').Options} */
const defaultImportOptions = {
	logFile: `log-${dayjs().format('YYYY-MM-DDTHH.mm-ss')}.json`,
	strict: true,
	compress: true,
	verbose: true,
	workers: 10,
	abridged: true

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

		this.mappings = spec.mappings; //u.objDefault(spec.mappings || {}, defaultMappings);
		this.aliases = spec.aliases || {};
		this.options = u.objDefault(spec.options || {}, defaultImportOptions);
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

		this.multiBar = new cliProgress.MultiBar({
			clearOnComplete: false,
			hideCursor: true,
			fps: 50,
			barsize: 60,
			autopadding: true,
			etaBuffer: 100
		}, cliProgress.Presets.rect);

		this.version = this.getVersion();

	}

	progress(createOrUpdate, type = 'dwh') {
		if (this.verbose) {
			//make labels the same padding
			let dwhLabel = this.dwh;
			let mixpanelLabel = "mixpanel";
			while (dwhLabel.length !== mixpanelLabel.length) {
				if (dwhLabel.length > mixpanelLabel.length) {
					mixpanelLabel += " ";
				}
				else {
					dwhLabel += " ";
				}
			}

			if (typeof createOrUpdate === 'object') {
				const { total, startValue } = createOrUpdate;
				if (type === 'dwh') {
					this.dwhProgress = this.multiBar.create(total, startValue, {}, {
						format: `${dwhLabel} |` + colors.cyan('{bar}') + `| {value}/{total} ${this.type}s ` + colors.green('{percentage}%') + ` {duration_formatted} ETA: {eta_formatted}`,

					});
				}
				else if (type === 'mp') {
					this.mpProgress = this.multiBar.create(total, startValue, {}, {
						format: `${mixpanelLabel} |` + colors.magenta('{bar}') + `| {value}/{total} ${this.type}s ` + colors.green('{percentage}%') + ` {duration_formatted} ETA: {eta_formatted}`

					});
				};
			}


			else if (typeof createOrUpdate === 'number') {
				if (type === 'dwh') {
					this.dwhProgress.increment(createOrUpdate);
				}
				else if (type === 'mp') {
					this.mpProgress.increment(createOrUpdate);
				}
			}


			else {
				this.multiBar.stop();
			}
		}
	}

	getVersion() {
		const { version } = require('../package.json');
		if (version) return version;
		if (process.env.npm_package_version) return process.env.npm_package_version;
		return 'unknown';
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

	sent(num) {
		this.outCount += num || 1;
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
			time: {
				job: this.etlTime.report(false),
				query: this.queryTime.report(false),
				dwhStream: this.streamTime.report(false),
				mpUpload: this.importTime.report(false),
			},
			logs: this.logStore
		};
	}

	mpAuth() {
		const mp = this.mixpanel;
		return {
			acct: mp.service_account,
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
		/** @type {import('mixpanel-import').Options} */
		const options = {
			recordType: mp.type,
			region: mp.region,
			streamFormat: 'json',
			compress: opt.compress,
			strict: opt.strict,
			logs: false,
			fixData: false,
			verbose: false,
			workers: opt.workers,
			recordsPerBatch: mp.type === 'group' ? 200 : 2000,
			abridged: opt.abridged,
			removeNulls: true,
			forceStream: true
		};
		return options;
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
			const auth = {
				account: this.auth.account,
				username: this.auth.username,
				database: this.auth.database,
				schema: this.auth.schema,
				warehouse: this.auth.warehouse,
				query: this.sql
			};

			if (this.auth.privateKey) {
				auth.authenticator = "SNOWFLAKE_JWT";
				auth.privateKey = snowflakePrivKey(this.auth.privateKey, this.auth?.passphrase);
			}
			if (this.auth.password) {
				auth.password = this.auth.password;
			}

			return auth;
		}

		if (this.dwh === 'athena') {
			return {
				accessKeyId: this.auth.accessKeyId,
				secretAccessKey: this.auth.secretAccessKey,
				region: this.auth.region,
				query: this.sql
			};
		}

		if (this.dwh === 'azure') {
			return {
				query: this.sql,
				connectionString: this.auth.connection_string,
				user: this.auth.user,
				password: this.auth.password,
				server: this.auth.server,
				port: this.auth.port,
				domain: this.auth.domain,
				database: this.auth.database

			};
		}

		if (this.dwh === 'salesforce') {
			return {
				query: this.sql,
				user: this.auth.user,
				password: this.auth.password,
				version: this.auth.version?.toString() || "51.0",
				prettyLabels: u.isNil(this.auth.resolve_field_names) ? true : this.auth.resolve_field_names,
				renameId: u.isNil(this.auth.rename_primary_id) ? true : this.auth.rename_primary_id,
				addUrls: u.isNil(this.auth.add_sfdc_links) ? true : this.auth.add_sfdc_links
			};
		}

		else {
			return {
				query: this.sql,
				...this.auth
			};
		}
	}

	//todo improve validation
	validate() {
		// lookup tables must have an id
		if (this.type === 'table' && !this.mixpanel.lookupTableId) throw 'missing lookup table id';

		// users + groups need a token
		if (this.type === 'user' && !this.mixpanel.token) throw 'missing project token';
		if (this.type === 'group' && !this.mixpanel.token) throw 'missing project token';

		//groups need a group key
		if (this.type === 'group' && !this.mixpanel.groupKey) throw 'missing group key';

		//events + lookups need an API secret or service acct
		if ((this.type === 'event' || this.type === 'table') && (!this.mixpanel.api_secret && !this.mixpanel.service_account)) throw 'missing API secret or service account';
		return true;
	}

}

// ? https://docs.snowflake.com/en/developer-guide/node-js/nodejs-driver-authenticate#label-nodejs-key-pair-authentication
function snowflakePrivKey(keyLocation, passphrase = '') {
	try {
		// Read the private key file from the filesystem.
		const privateKeyFile = fs.readFileSync(keyLocation);

		// Get the private key from the file as an object.
		const privateKeyObject = crypto.createPrivateKey({
			key: privateKeyFile,
			format: 'pem',
			passphrase
		});

		// Extract the private key from the object as a PEM-encoded string.
		const privateKey = privateKeyObject.export({
			format: 'pem',
			type: 'pkcs8'
		});
		return privateKey;
	}
	catch (e) {
		throw `could not read private key file at ${keyLocation}:\n${e.message}`;
	}
}