const { createParkrunFetcher, PROXY_REST_MS } = require('../app/parkrunFetch');

const PAGE = '<html><head><title>results | Bushy parkrun</title></head><body>' +
    '<div class="Results-header"><h1>Bushy parkrun</h1><h3><span class="format-date">21/11/2026</span><span>|</span><span>#1050</span></h3></div>' +
    '<table><tr><th>Position</th></tr><tr><td>1</td></tr></table></body></html>';
const CHALLENGE = '<html><head><title>Human Verification</title></head></html>';

// answers: proxy and direct, each a function of the call count
function fetcher(answers, extra) {
    const calls = { proxy: 0, direct: 0 };
    let clock = 0;
    const get = url => {
        const way = url.startsWith('https://proxy.test') ? 'proxy' : 'direct';
        calls[way]++;
        return answers[way](calls[way]);
    };
    const fetch = createParkrunFetcher(Object.assign({
        get, proxyUrl: 'https://proxy.test/p', proxyKey: 'k', headers: {},
        isBlocked: html => /Human Verification/.test(html), parseTable: () => ({ headers: ['Position'], data: [] }),
        now: () => clock
    }, extra));
    return { fetch, calls, wait: ms => { clock += ms; } };
}
const ok = html => () => Promise.resolve({ status: 200, data: html });
const down = () => Promise.reject(new Error('connect ETIMEDOUT'));
const URL = 'https://www.parkrun.org.uk/bushy/results/latestresults/';

describe('fetching a parkrun page', () => {
    test('through the proxy when it answers', async () => {
        const { fetch, calls } = fetcher({ proxy: ok(PAGE), direct: ok(PAGE) });
        const page = await fetch(URL);
        expect(page).toMatchObject({ via: 'parkrun-proxy', meta: { eventNumber: 1050, raceDay: '2026-11-21' } });
        expect(calls).toEqual({ proxy: 1, direct: 0 });
    });

    test('directly when the proxy cannot be reached, which is then left out for a while', async () => {
        const { fetch, calls, wait } = fetcher({ proxy: down, direct: ok(PAGE) });
        expect((await fetch(URL)).via).toBe('parkrun-direct');
        await fetch(URL);
        expect(calls).toEqual({ proxy: 1, direct: 2 });
        wait(PROXY_REST_MS);
        await fetch(URL);
        expect(calls.proxy).toBe(2);
    });

    test('directly when parkrun refuses the proxy, which is tried again next time', async () => {
        const { fetch, calls } = fetcher({ proxy: ok(CHALLENGE), direct: ok(PAGE) });
        expect((await fetch(URL)).via).toBe('parkrun-direct');
        await fetch(URL);
        expect(calls).toEqual({ proxy: 2, direct: 2 });
    });

    test('directly when no proxy is set', async () => {
        const { fetch, calls } = fetcher({ proxy: ok(PAGE), direct: ok(PAGE) }, { proxyUrl: undefined });
        expect((await fetch(URL)).via).toBe('parkrun-direct');
        expect(calls.proxy).toBe(0);
    });

    test('both refused: one error saying why each failed', async () => {
        const { fetch } = fetcher({ proxy: down, direct: ok(CHALLENGE) });
        await expect(fetch(URL)).rejects.toMatchObject({
            refused: true,
            message: expect.stringMatching(/proxy could not be reached \(connect ETIMEDOUT\); parkrun refused the request made directly/)
        });
    });

    test('an event not run yet', async () => {
        const { fetch } = fetcher({ proxy: () => Promise.resolve({ status: 404, data: '' }), direct: ok(PAGE) });
        expect(await fetch(URL)).toEqual({ missing: true });
    });
});
