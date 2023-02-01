import mp from "mixpanel-import";
import Stream from 'stream';
import emitter from '../emitter.js';


export default function createStream(config, cb = () => { }) {
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
		// debugger;
		emitter.emit('import start')
	});

	return inStream;

}