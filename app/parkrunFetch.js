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

const PROXY_REST_MS = 5 * 60 * 1000;
const PROXY_TIMEOUT_MS = 20000;
const DIRECT_TIMEOUT_MS = 30000;

// options: get (axios.get's signature), proxyUrl, proxyKey, headers,
// isBlocked(html) (a bot challenge page), parseTable(html), now(), warn()
function createParkrunFetcher(options) {
    const now = options.now || Date.now;
    const warn = options.warn || (() => {});
    let proxyDownUntil = 0;

    // { html } | { missing } | { refused: why }; throws when nothing answered
    async function getHtml(url, viaProxy) {
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
        if (response.status === 404) return { missing: true };
        if (response.status >= 400 || options.isBlocked(html) || /CAPTCHA|Access Denied/.test(html.slice(0, 20000))) {
            return { refused: 'parkrun refused the request' + (viaProxy ? ' through the proxy' : ' made directly') + ' (HTTP ' + response.status + ')' };
        }
        return { html };
    }

    // { meta, parsed, via } (parkrunMetadata, the table, 'parkrun-proxy' or
    // 'parkrun-direct'), { missing } for an event not run yet; throws
    // (err.refused) when every way said no
    return async function fetchParkrunPage(url) {
        const notes = [];
        let got = null;
        let via = 'parkrun-proxy';
        if (options.proxyUrl && now() >= proxyDownUntil) {
            try {
                got = await getHtml(url, true);
                if (got.refused) { notes.push(got.refused); got = null; }
            } catch (err) {
                // Unreachable or too slow: not parkrun's answer, so rest it
                proxyDownUntil = now() + PROXY_REST_MS;
                warn('parkrun proxy unreachable (' + err.message + '); asking parkrun directly for the next ' +
                    PROXY_REST_MS / 60000 + ' minutes');
                notes.push('the proxy could not be reached (' + err.message + ')');
            }
        }
        if (!got) {
            via = 'parkrun-direct';
            try {
                got = await getHtml(url, false);
                if (got.refused) { notes.push(got.refused); got = null; }
            } catch (err) {
                notes.push('asking parkrun directly failed (' + err.message + ')');
            }
        }
        if (!got) {
            const err = new Error('Could not get the page: ' + notes.join('; ') + '. Try again later, or paste the page with the bookmark.');
            err.refused = true;
            throw err;
        }
        if (got.missing) return { missing: true };
        const meta = parkrunMetadata(got.html);
        if (!meta || !meta.eventNumber || !meta.raceDay) return { missing: true };
        return { meta, parsed: options.parseTable(got.html), via };
    };
}

module.exports = { createParkrunFetcher, PROXY_REST_MS };
