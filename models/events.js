import u from "ak-tools"

export default function modelEvent(row, mappings, timeFields, timeTransform, tags) {
	const { distinct_id_col, event_name_col, insert_id_col, time_col } = mappings;
	const modeledEvent = {
		event: row[event_name_col],
		properties: {
			distinct_id: row[distinct_id_col],
			$insert_id: row[insert_id_col],
			time: timeTransform(row[time_col]),
			$source: 'dwh-mixpanel'
		},
	};

	delete row[distinct_id_col]
	delete row[event_name_col]
	delete row[insert_id_col]
	delete row[time_col]
	
	modeledEvent.properties = u.objDefault(modeledEvent.properties, row);

	for (let key in tags) {
		modeledEvent.properties[key] = tags[key]
	}

	return modeledEvent;

}