import dayjs from "dayjs";
import u from "ak-tools"

export default function modelEvent(row, mappings) {
	const { distinct_id_col, event_name_col, insert_id_col, time_col } = mappings;
	//! todo, resolve mappings
	const modeledEvent = {
		event: row[event_name_col],
		properties: {
			distinct_id: row[distinct_id_col],
			$insert_id: row[insert_id_col],
			time: dayjs(row[time_col].value).valueOf(),
		},
	};

	delete row[distinct_id_col]
	delete row[event_name_col]
	delete row[insert_id_col]
	delete row[time_col]
	

	modeledEvent.properties = u.objDefault(modeledEvent.properties, row);

	return modeledEvent;

}