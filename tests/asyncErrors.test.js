const express = require('express');
const catchAsyncErrors = require('../app/asyncErrors');

// An app with the wrapper, listening on a free port, and fetch against it
async function serve(setup) {
    const app = express();
    catchAsyncErrors(app);
    app.set('answer', 42);
    setup(app);
    const server = await new Promise(resolve => { const s = app.listen(0, () => resolve(s)); });
    const base = 'http://127.0.0.1:' + server.address().port;
    return { app, server, get: path => fetch(base + path) };
}

describe('catchAsyncErrors', () => {
    let env;
    afterEach(() => env && env.server.close());

    test('an async route that throws answers 500 instead of crashing', async () => {
        env = await serve(app => {
            app.get('/boom', async () => { JSON.parse('notjson'); });
            app.get('/ok', (req, res) => res.send('still here'));
        });
        expect((await env.get('/boom')).status).toBe(500);
        expect(await (await env.get('/ok')).text()).toBe('still here');
    });

    test('a rejection after an await is caught too', async () => {
        env = await serve(app => {
            app.post('/later', async () => { await Promise.resolve(); throw new Error('later'); });
        });
        const res = await fetch(env.server.address && ('http://127.0.0.1:' + env.server.address().port + '/later'), { method: 'POST' });
        expect(res.status).toBe(500);
    });

    test('middleware chains and ordinary handlers work as before', async () => {
        env = await serve(app => {
            const mark = (req, res, next) => { req.marked = true; next(); };
            app.get('/chain', mark, async (req, res) => { res.json({ marked: req.marked }); });
        });
        expect(await (await env.get('/chain')).json()).toEqual({ marked: true });
    });

    test('app.get(setting) still reads a setting', async () => {
        env = await serve(() => {});
        expect(env.app.get('answer')).toBe(42);
    });
});
