import dayjs from "dayjs";

export default function modelEvent(row, mappings) {
	//! todo, resolve mappings
	const modeledEvent = {
		event: row.action,
		properties: {
			distinct_id: row.guid,
			$insert_id: row.insert_id,
			time: dayjs(row.time.value).valueOf(),
		},
	};

	delete row.action;
	delete row.guid;
	delete row.insert_id;
	delete row.time;

	modeledEvent.properties = { ...modeledEvent.properties, ...row };

	return modeledEvent;

}