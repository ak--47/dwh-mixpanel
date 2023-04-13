import u from "ak-tools";

export default function modelEvent(row, mappings, timeFields = [], eventTimeTransform, timeTransform, tags) {
	const { distinct_id_col = "", user_id_col = "", device_id_col = "", event_name_col, insert_id_col, time_col } = mappings;
	const modeledEvent = {
		event: row[event_name_col],
		properties: {
			distinct_id: row[distinct_id_col],
			$insert_id: row[insert_id_col]?.toString(), //insert_ids are always strings
			time: eventTimeTransform(row[time_col]),
			$source: 'dwh-mixpanel'
		},
	};

	//id mgmt v3
	if (user_id_col && device_id_col) {
		modeledEvent.properties.$user_id = row[user_id_col] || ""
		modeledEvent.properties.$device_id = row[device_id_col] || ""
	}

	//id mgmt v2
	else if (distinct_id_col) {
		modeledEvent.properties.distinct_id = row[distinct_id_col] || ""
	}

	else {
		throw 'no distinct_id or user_id/device_id mapping provided'
	}

	
	
	timeFields = timeFields.filter(f => f !== time_col);
	// other time transforms
	try {
		for (const timeField of timeFields) {
			row[timeField] = timeTransform(row[timeField]);
		}
	}

	catch (e) {
		//noop
	}

	delete row[distinct_id_col];
	delete row[event_name_col];
	delete row[insert_id_col];
	delete row[time_col];

	modeledEvent.properties = u.objDefault(modeledEvent.properties, row);

	for (let key in tags) {
		modeledEvent.properties[key] = tags[key];
	}

	return modeledEvent;

}