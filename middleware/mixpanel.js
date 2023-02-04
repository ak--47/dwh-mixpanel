import mp from "mixpanel-import";
import Stream from 'stream';
import emitter from '../components/emitter.js';
import u from 'ak-tools';

export default function createStream(config, cb = () => { }) {
	let reqCount = 0;
	const inStream = new Stream.PassThrough({
		objectMode: true,
	});

	const outStream = mp.createMpStream(config.mpAuth(), config.mpOpts(), (err, results) => {
		if (err) {
			if (config.verbose) u.cLog(err, 'pipeline fail', 'ERROR');
			throw err;
		}
		else {
			config.store(results, 'mp');
			cb(results);
		}
		emitter.emit('mp import end', config);
	});

	inStream.pipe(outStream);

	inStream.on("error", (err) => {
		if (config.verbose) u.cLog(err, 'dwh fail', 'ERROR');
	});

	outStream.on("error", (err) => {
		if (config.verbose) u.cLog(err, 'mp fail', 'ERROR');
	});

	outStream.on("data", () => {
		reqCount++;
		emitter.emit('mp import start', config);
		if (config.verbose) u.progress('\tbatches', reqCount, 'sent:');
	});

	return inStream;

}