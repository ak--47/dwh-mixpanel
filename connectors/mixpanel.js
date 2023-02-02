import mp from "mixpanel-import";
import Stream from 'stream';
import emitter from '../emitter.js';
import u from 'ak-tools'


export default function createStream(config, cb = () => { }) {
	let count = 0
	const inStream = new Stream.PassThrough({
		objectMode: true,
	});

	const outStream = mp.createMpStream(config.mpAuth(), config.mpOpts(), (err, results) => {
		if (err) {
			throw err;
		}
		else {
			cb(results);
		}

		emitter.emit('import end', results);
	});

	inStream.pipe(outStream);

	inStream.on("error", (err) => {
		debugger;
	});

	outStream.on("error", (err) => {
		debugger;
	});

	outStream.on("data", (resp) => {
		count++
		u.progress('batch', count)
		emitter.emit('import start')
	});

	return inStream;

}