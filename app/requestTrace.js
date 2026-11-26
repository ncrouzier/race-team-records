// Step-by-step timing of /api requests in the server log, to find where one
// stalls on the server (the result extractor's paste hung now and then on the
// droplet: a 502, "request aborted"). On with DEBUG_TRACE=on (app/debug.js).
//
//   [trace #12 POST /api/extract-table] start: 412 KB, from 203.0.113.7, Firefox
//   [trace #12 POST /api/extract-table] +1840ms body read (412 KB pasted)
//   [trace #12 POST /api/extract-table] +1843ms RunSignUp copy: 1847 runners
//   [trace #12 POST /api/extract-table] +2405ms answered 200
//
// or, when the connection goes first:
//   [trace #13 POST /api/extract-table] +30012ms connection closed after 210 KB of 412 KB, no answer sent
//
// start() goes before the body parser (to time reading the body), bodyRead()
// right after it; a route adds its own steps with req.trace(message), which
// does nothing when tracing is off.

// Too frequent to be worth a trace: the page's keep-alive every few seconds
const SKIP = /^\/api\/heartbeat\b/;

let lastId = 0;

const kb = bytes => Math.round(bytes / 1024) + ' KB';

function browserOf(userAgent) {
    const ua = String(userAgent || '');
    // Most telling first: Edge's agent also says Chrome, Chrome's Safari
    const names = [['Edg/', 'Edge'], ['Firefox/', 'Firefox'], ['Chrome/', 'Chrome'], ['Safari/', 'Safari']];
    const known = names.find(([mark]) => ua.includes(mark));
    return known ? known[1] : (ua.slice(0, 40) || 'unknown browser');
}

function createRequestTrace(log) {
    log = log || (line => console.log(line));

    function start(req, res, next) {
        if (SKIP.test(req.originalUrl)) return next();
        const id = ++lastId;
        const startedAt = Date.now();
        const name = 'trace #' + id + ' ' + req.method + ' ' + req.originalUrl.split('?')[0];
        const expected = parseInt(req.headers['content-length'], 10) || 0;
        const say = message => log('[' + name + '] ' + message);
        req.trace = message => say('+' + (Date.now() - startedAt) + 'ms ' + message);

        // Counts what arrives without reading it: the body parser still
        // reads the stream (a 'data' listener here would take it over)
        const socket = req.socket;
        const bytesBefore = socket ? socket.bytesRead : 0;
        const receivedSoFar = () => (socket ? Math.max(0, socket.bytesRead - bytesBefore) : 0);

        say('start: ' + (expected ? kb(expected) : 'no length') + ', from ' + (req.ip || 'unknown') + ', ' +
            browserOf(req.headers['user-agent']));

        req.traceReceived = () => kb(receivedSoFar()) + (expected ? ' of ' + kb(expected) : '');

        // 'finish' is the answer delivered. Not writableFinished: an error
        // answer written on a connection already gone sets it all the same
        let answered = false;
        res.on('finish', () => { answered = true; req.trace('answered ' + res.statusCode); });
        res.on('close', () => {
            if (answered) return;
            req.trace('connection closed after ' + req.traceReceived() +
                (req.complete ? ', body all read' : ', body not all read') + ', no answer sent');
        });
        next();
    }

    function bodyRead(req, res, next) {
        if (req.trace) {
            const body = req.body || {};
            const size = body.htmlSource ? body.htmlSource.length : 0;
            const length = parseInt(req.headers['content-length'], 10) || 0;
            if (length) {
                req.trace('body read' + (size ? ' (' + kb(size) + ' pasted)' : body.url ? ' (url ' + body.url + ')' : ' (' + kb(length) + ')'));
            }
        }
        next();
    }

    // The body parser's own failures (cut off, too large, bad JSON)
    function bodyFailed(err, req, res, next) {
        if (req.trace) req.trace('body could not be read after ' + req.traceReceived() + ': ' + (err.type || err.name) + ': ' + err.message);
        next(err);
    }

    return { start, bodyRead, bodyFailed };
}

module.exports = { createRequestTrace, browserOf };
