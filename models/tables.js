import u from "ak-tools";

export default function modelTable(row, mappings, lookupTableId, timeTransform, tags) {
	// todo
	const { lookup_col } = mappings;

	const modeledTable = {};

	// const modeledTable = {
	// 	event: row[event_name_col],
	// 	properties: {
	// 		distinct_id: row[distinct_id_col],
	// 		$insert_id: row[insert_id_col],
	// 		time: timeTransform(row[time_col]),
	// 		$source: 'dwh-mixpanel'
	// 	},
	// };

	// delete row[distinct_id_col]
	// delete row[event_name_col]
	// delete row[insert_id_col]
	// delete row[time_col]

	// modeledTable.properties = u.objDefault(modeledTable.properties, row);

	for (let key in tags) {
		modeledTable.properties[key] = tags[key];
	}

	return modeledTable;

}