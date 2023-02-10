import * as dotenv from 'dotenv';

export default function gatherCliParams() {
	dotenv.config({ override: true });
	const { MP_API_SECRET,
		MP_SERVICE_ACCOUNT,
		MP_SERVICE_SECRET,
		MP_TOKEN,
		MP_PROJECT,
		MP_LOOKUP_TABLE,
		DWH_AUTH } = process.env;

	const valuesFound = {
		mixpanel: {}
	};

	if (MP_API_SECRET) valuesFound.mixpanel.api_secret = MP_API_SECRET;
	if (MP_SERVICE_ACCOUNT) valuesFound.mixpanel.service_account = MP_SERVICE_ACCOUNT;
	if (MP_SERVICE_SECRET) valuesFound.mixpanel.service_secret = MP_SERVICE_SECRET;
	if (MP_TOKEN) valuesFound.mixpanel.token = MP_TOKEN;
	if (MP_PROJECT) valuesFound.mixpanel.project_id = MP_PROJECT;
	if (MP_LOOKUP_TABLE) valuesFound.mixpanel.lookupTableId = MP_LOOKUP_TABLE;

	if (DWH_AUTH) {
		try {
			const dwhAuth = JSON.parse(DWH_AUTH);
			valuesFound.auth = dwhAuth;
		}

		catch (e) {
			console.error('failed to parse DWH auth...');
		}
	}
	return valuesFound;
}