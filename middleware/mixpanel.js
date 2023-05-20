import mp from "mixpanel-import";
import Stream from 'stream';
import u from 'ak-tools';

export default function createStream(config, emitter, cb = () => { }) {

	const inStream = new Stream.PassThrough({
		objectMode: true,
		highWaterMark: config.options.workers * 2000
	});

	//tables cannot be streamed!
	if (config.type === 'table') return inStream;

	const outStream = mp.createMpStream(config.mpAuth(), config.mpOpts(), (err, results) => {
		if (err) {
			if (config.verbose) u.cLog(err, 'pipeline fail', 'ERROR');
			//debugger;
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
		config.log(err);
	});

	outStream.on("error", (err) => {
		if (config.verbose) u.cLog(err, 'mp fail', 'ERROR');
		config.log(err);
	});

	outStream.once('data', () => {
		emitter.emit('mp import start', config);
	});

	inStream.on('data', () => {
		config.got();
		emitter.emit('dwh batch', config);
	});

	outStream.on("data", (resp) => {
		const records = resp?.num_records_imported || config.mpOpts()?.recordsPerBatch || 2000;
		config.sent(records);
		emitter.emit('mp batch', config, records);
	});

	return inStream;

}