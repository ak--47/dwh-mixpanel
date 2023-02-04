import Papaparse from 'papaparse';

export default function jsonToCSV(data, lookupCol) {
	const csv = Papaparse.unparse(data);
	return csv;
	
}