// A parkrun results page, fetched for the parkrun check and the result
// extractor (app/routes.js).
//
// parkrun turns most servers away, so the page is asked through the proxy
// (PARKRUN_PROXY_URL) first, and directly when the proxy refuses or cannot be
// reached: a home connection, as in development, usually gets through.
// r.jina.ai is no use here: parkrun answers it with a "Human Verification"
// page.
//
// A proxy that could not be reached is left out for PROXY_REST_MS: checking
// every parkrun would otherwise wait out its timeout once per parkrun.

const { parkrunMetadata } = require('./parkrunCheck');
const debug = require('./debug');

const PROXY_REST_MS = 5 * 60 * 1000;
const PROXY_TIMEOUT_MS = 20000;
const DIRECT_TIMEOUT_MS = 30000;

// options: get (axios.get's signature), proxyUrl, proxyKey, headers,
// isBlocked(html) (a bot challenge page), parseTable(html), now(), warn()
function createParkrunFetcher(options) {
    const now = options.now || Date.now;
    const warn = options.warn || (() => {});
    let proxyDownUntil = 0;

    // One way of asking: { page } a results page, { missing } parkrun's own
    // 404 (no event that day), or { refused: why } (a block, an error, or a
    // page that is not results: a challenge not recognised, a consent page,
    // the proxy's own answer). Only the 404 means "no event": anything else
    // that does not read is a failure, said, and the next way is tried.
    // Throws when nothing answered.
    async function ask(url, viaProxy) {
        const way = viaProxy ? 'through the proxy' : 'asked directly';
        const target = viaProxy
            ? options.proxyUrl + '?url=' + encodeURIComponent(url) + '&key=' + options.proxyKey
            : url;
        const response = await options.get(target, {
            headers: options.headers,
            timeout: viaProxy ? PROXY_TIMEOUT_MS : DIRECT_TIMEOUT_MS,
            maxRedirects: 5,
            validateStatus: status => status >= 200 && status < 500
        });
        const html = typeof response.data === 'string' ? response.data : '';
        const title = (/<title[^>]*>([^<]*)/i.exec(html) || [])[1];
        const seen = 'HTTP ' + response.status + ', ' + html.length + ' characters' + (title ? ', "' + title.trim().slice(0, 80) + '"' : '');
        debug.log('parkrun', url + ' ' + way + ': ' + seen);
        // parkrun's own "not found" page; a 404 from anything else (the
        // proxy's server) is a failure like any other
        if (response.status === 404 && /parkrun/i.test(title || '')) return { missing: true };
        if (response.status >= 400 || options.isBlocked(html) || /CAPTCHA|Access Denied/.test(html.slice(0, 20000))) {
            return { refused: 'parkrun refused the request ' + way + ' (' + seen + ')' };
        }
        const meta = parkrunMetadata(html);
        if (!meta || !meta.eventNumber || !meta.raceDay) {
            return { refused: 'the answer ' + way + ' was not a results page (' + seen + ')' };
        }
        return { page: { meta, parsed: options.parseTable(html), via: viaProxy ? 'parkrun-proxy' : 'parkrun-direct' } };
    }

    // { meta, parsed, via } (parkrunMetadata, the table, 'parkrun-proxy' or
    // 'parkrun-direct'), { missing } for an event not run (parkrun's 404);
    // throws (err.refused) when every way failed, saying how each did
    return async function fetchParkrunPage(url) {
        const notes = [];
        const ways = [];
        if (options.proxyUrl && now() >= proxyDownUntil) ways.push(true);
        ways.push(false);
        for (const viaProxy of ways) {
            let got;
            try {
                got = await ask(url, viaProxy);
            } catch (err) {
                if (viaProxy) {
                    // Unreachable or too slow: not parkrun's answer, so rest it
                    proxyDownUntil = now() + PROXY_REST_MS;
                    warn('parkrun proxy unreachable (' + err.message + '); asking parkrun directly for the next ' +
                        PROXY_REST_MS / 60000 + ' minutes');
                    notes.push('the proxy could not be reached (' + err.message + ')');
                } else {
                    notes.push('asking parkrun directly failed (' + err.message + ')');
                }
                continue;
            }
            if (got.page) return got.page;
            if (got.missing) return { missing: true };
            notes.push(got.refused);
        }
        if (!options.proxyUrl) notes.push('no proxy is set (PARKRUN_PROXY_URL)');
        else if (now() < proxyDownUntil && notes.length === 1) notes.push('the proxy is skipped for a few minutes after failing');
        const err = new Error('Could not get the page: ' + notes.join('; ') + '. Try again later, or paste the page with the bookmark.');
        err.refused = true;
        throw err;
    };
}

module.exports = { createParkrunFetcher, PROXY_REST_MS };
