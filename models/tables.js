import u from "ak-tools";

export default function modelTable(row, mappings, lookupTableId, timeFields = [], timeTransform, tags) {
	const { lookup_col } = mappings;

	if (!row[lookup_col]) {
		u.cLog(row, `lookup table row is missing lookup key: ${lookup_col}`, )	
	}

	// time transforms
	try {
		for (const timeField of timeFields) {
			row[timeField] = timeTransform(row[timeField]);
		}
	}

	catch(e) {
		//noop
	}

	const modeledRow = row;

	for (let key in tags) {
		if (!modeledRow[key]) modeledRow[key] = tags[key];
	}

	return modeledRow;

}