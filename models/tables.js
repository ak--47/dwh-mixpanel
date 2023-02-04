import u from "ak-tools";

export default function modelTable(row, mappings, lookupTableId, timeFields, timeTransform, tags) {
	const { lookup_col } = mappings;

	if (!row[lookup_col]) {
		u.cLog(`lookup table row is missing lookup key: ${lookup_col}`)
		u.cLog(row)		
	}

	const modeledRow = row;

	for (let key in tags) {
		if (!modeledRow[key]) modeledRow[key] = tags[key];
	}

	return modeledRow;

}