const http = require('http');
const express = require('express');
const { createRequestTrace, browserOf } = require('../app/requestTrace');

// The route as server.js sets it up, on a real server: the trace before the
// body parser, the body steps after it
function serve(lines) {
    const trace = createRequestTrace(line => lines.push(line));
    const app = express();
    app.use('/api', trace.start);
    app.use(express.json({ limit: '50mb' }));
    app.use('/api', trace.bodyRead, trace.bodyFailed);
    app.post('/api/heartbeat', (req, res) => res.sendStatus(200));
    app.post('/api/extract-table', (req, res) => { req.trace('route step'); res.json({ ok: true }); });
    app.use((err, req, res, next) => { res.status(err.status || 500).end(); });
    return new Promise(resolve => { const server = app.listen(0, () => resolve(server)); });
}

function post(port, body, { cutAfter, path = '/api/extract-table' } = {}) {
    return new Promise(resolve => {
        const req = http.request({ port, method: 'POST', path,
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'User-Agent': 'Mozilla/5.0 Firefox/140.0' } },
        res => { res.resume(); res.on('end', resolve); });
        req.on('error', () => resolve());
        if (cutAfter) {
            req.write(body.slice(0, cutAfter));
            setTimeout(() => { req.destroy(); setTimeout(resolve, 100); }, 50);
        } else {
            req.end(body);
        }
    });
}

describe('request trace', () => {
    let server, lines;
    beforeEach(async () => { lines = []; server = await serve(lines); });
    afterEach(() => new Promise(resolve => server.close(resolve)));

    test('a paste: start, body read, the route\'s steps, the answer', async () => {
        await post(server.address().port, JSON.stringify({ htmlSource: 'x'.repeat(300 * 1024) }));
        expect(lines[0]).toMatch(/^\[trace #\d+ POST \/api\/extract-table\] start: 300 KB, from .+, Firefox$/);
        expect(lines[1]).toMatch(/\+\d+ms body read \(300 KB pasted\)$/);
        expect(lines[2]).toMatch(/route step$/);
        expect(lines[3]).toMatch(/answered 200$/);
    });

    test('an upload cut off: how much came, and that no answer went', async () => {
        await post(server.address().port, JSON.stringify({ htmlSource: 'x'.repeat(300 * 1024) }), { cutAfter: 100 * 1024 });
        // The server hears of it a moment later
        for (let i = 0; i < 50 && !lines.some(l => /connection closed/.test(l)); i++) {
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        const end = lines.find(l => /connection closed/.test(l));
        expect(lines.find(l => /body could not be read/.test(l)))
            .toMatch(/body could not be read after \d+ KB of 300 KB: request.aborted: request aborted$/);
        expect(end).toMatch(/connection closed after \d+ KB of 300 KB, body not all read, no answer sent$/);
        expect(lines.some(l => /body read/.test(l))).toBe(false);
    });

    test('the page\'s keep-alive is left out', async () => {
        await post(server.address().port, '{}', { path: '/api/heartbeat' });
        expect(lines).toEqual([]);
    });

    test('the browser, briefly', () => {
        expect(browserOf('Mozilla/5.0 (Macintosh) Gecko/20100101 Firefox/140.0')).toBe('Firefox');
        expect(browserOf('Mozilla/5.0 Chrome/130.0 Safari/537.36 Edg/130.0')).toBe('Edge');
        expect(browserOf('')).toBe('unknown browser');
    });
});
