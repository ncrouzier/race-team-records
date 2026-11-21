// Compressed copies of the race list (/api/raceinfos, app/routes.js). The
// full list is several MB of JSON, so the route keeps it compressed and sends
// the bytes as they are.
//
// Brotli sends about half what gzip does (≈475KB against ≈930KB), but at that
// size (quality 10) it takes a few seconds of CPU for the full list. So a
// list is first compressed quickly (Brotli quality 5, ≈580KB, plus gzip for
// clients without Brotli) and sent like that; quality 10 is then built in the
// background and replaces the quick copy once done.
//
// When the data changes, that background work is stopped (cancelAll): its
// bytes would be of a list that is already out of date. Brotli at quality 10
// is the one slow step, and it runs on the server's only core.

const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const brotli = promisify(zlib.brotliCompress);

const QUICK_QUALITY = 5;
// 11 saves another ~5% (≈455KB) but takes four times as long (~10s): not
// worth it on one core
const BEST_QUALITY = 10;

// The background copy is fed this much at a time, and Brotli compresses it in
// blocks of the same size (LGBLOCK 18): the work can then stop between two
// slices. Given the whole text at once, it runs to the end in one call that
// destroying the stream does not interrupt. Same size output either way.
const SLICE_BYTES = 256 * 1024;
const SLICE_LGBLOCK = 18;

function brotliOptions(quality, size, lgblock) {
    const params = {
        [zlib.constants.BROTLI_PARAM_QUALITY]: quality,
        [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: size
    };
    if (lgblock) params[zlib.constants.BROTLI_PARAM_LGBLOCK] = lgblock;
    return { params: params };
}

// { gzip, br } for a JSON text, both quick to make. Async: on the threadpool,
// not the event loop.
function encode(json) {
    const buf = Buffer.from(json);
    return Promise.all([gzip(buf), brotli(buf, brotliOptions(QUICK_QUALITY, buf.length))])
        .then(function (out) { return { gzip: out[0], br: out[1] }; });
}

// Whether an Accept-Encoding header accepts an encoding ("br", "gzip"):
// listed, and not with q=0
function accepts(header, name) {
    return String(header || '').split(',').some(function (part) {
        const bits = part.trim().split(';');
        if (bits[0].trim().toLowerCase() !== name) return false;
        const q = bits.slice(1).map(function (b) { return b.trim(); }).find(function (b) { return /^q=/i.test(b); });
        return !q || parseFloat(q.slice(2)) > 0;
    });
}

// Background compression at BEST_QUALITY, at most one per key (a newer list for
// the same key replaces the older one's work).
//
// start(key, entry, json, isCurrent): compresses json and, once done, sets
// entry.br to the result, unless cancelAll() was called since or isCurrent()
// is false by then (the entry is no longer what the route serves). Resolves
// true when entry.br was replaced. Texts under minBytes are left as they are.
function createUpgrader(options) {
    const minBytes = (options && options.minBytes) || 0;
    const quality = (options && options.quality) || BEST_QUALITY;
    let generation = 0;
    const running = new Map();

    function stop(job) {
        if (running.get(job.key) === job) running.delete(job.key);
        job.stopped = true;
        job.stream.destroy();
        job.resolve(false);
    }

    return {
        start: function (key, entry, json, isCurrent) {
            if (Buffer.byteLength(json) < minBytes) return Promise.resolve(false);
            if (running.has(key)) stop(running.get(key));
            const startedIn = generation;
            const buf = Buffer.from(json);
            return new Promise(function (resolve) {
                const stream = zlib.createBrotliCompress(brotliOptions(quality, buf.length, SLICE_LGBLOCK));
                const job = { key: key, stream: stream, resolve: resolve, stopped: false };
                running.set(key, job);
                const chunks = [];
                stream.on('data', function (chunk) { chunks.push(chunk); });
                stream.on('error', function (err) {
                    console.error('Could not compress the race list at quality ' + quality + ':', err.message);
                    if (running.get(key) === job) running.delete(key);
                    resolve(false);
                });
                stream.on('end', function () {
                    if (running.get(key) !== job) return resolve(false);
                    running.delete(key);
                    if (startedIn !== generation || !isCurrent()) return resolve(false);
                    entry.br = Buffer.concat(chunks);
                    resolve(true);
                });
                // One slice at a time, the next once the last is compressed
                (function feed(offset) {
                    if (job.stopped) return;
                    if (offset >= buf.length) return stream.end();
                    stream.write(buf.subarray(offset, offset + SLICE_BYTES), function (err) {
                        if (!err) feed(offset + SLICE_BYTES);
                    });
                })(0);
            });
        },
        // The data changed: what is being compressed is out of date
        cancelAll: function () {
            generation++;
            Array.from(running.values()).forEach(stop);
        },
        running: function () { return running.size; }
    };
}

module.exports = { encode, accepts, createUpgrader, QUICK_QUALITY, BEST_QUALITY };
