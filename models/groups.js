import u from "ak-tools";

export default function modelGroups(row, mappings, token, groupKey, timeFields, timeTransform, tags) {
	const {
		distinct_id_col,
		name_col,
		email_col,
		phone_col,
		avatar_col,
		created_col,
		ip_col,
		profileOperation = '$set'
	} = mappings;

	const modeledProfile = {
		$token: token,
		$group_key: groupKey,
		$group_id: row[distinct_id_col],
		$ip: "0",
		$ignore_time: true,
		[profileOperation]: {}
	};

	delete row[distinct_id_col];

	// mixpanel reserved keys
	if (name_col) {
		modeledProfile[profileOperation].$name = row[name_col];
		delete row[name_col];
	}

	if (email_col) {
		modeledProfile[profileOperation].$email = row[email_col];
		delete row[email_col];
	}

	if (phone_col) {
		modeledProfile[profileOperation].$phone = row[phone_col];
		delete row[phone_col];
	}

	if (avatar_col) {
		modeledProfile[profileOperation].$avatar = row[avatar_col];
		delete row[avatar_col];
	}

	if (created_col) {
		modeledProfile[profileOperation].$created = timeTransform(row[created_col]);
		delete row[created_col];
	}

	if (ip_col) {
		modeledProfile.$ip = row[ip_col];
		modeledProfile[profileOperation]["IP Address"] = row[ip_col];
		delete row[ip_col];
	}


	for (let key in tags) {
		modeledProfile[profileOperation][key] = tags[key]
	}


	modeledProfile[profileOperation] = u.objDefault(modeledProfile[profileOperation], row);

	return modeledProfile;

}


