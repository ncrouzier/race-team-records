// The "Results → clipboard" bookmarklet (public/bookmarklets/results.js), run
// as a browser would on a race's results page, against a fake feed: what it
// copies must be what the server reads (app/athlinks.js, app/runsignup.js).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const athlinks = require('../app/athlinks');
const runsignup = require('../app/runsignup');
const { pagePaste, parseResultsTableFromHtml } = require('../app/resultTableParser');
const { parkrunMetadata, eventBase, eventResultsUrl } = require('../app/parkrunCheck');

const source = fs.readFileSync(path.join(__dirname, '../public/bookmarklets/results.js'), 'utf8');

// An element of the fake page: enough for the progress box and a <select>
function element(extra) {
    return Object.assign({ setAttribute() {}, getAttribute() { return null; }, appendChild() {}, remove() {}, textContent: '' }, extra);
}

function run(href, fetchImpl, page) {
    const url = new URL(href);
    let copiedText = null;
    let alerted = null;
    const sandbox = {
        location: { href, origin: url.origin, hostname: url.hostname, pathname: url.pathname, search: url.search, hash: url.hash },
        document: Object.assign({
            title: '',
            documentElement: { outerHTML: '<html>on screen</html>' },
            getElementById: id => (page && page.elements && page.elements[id]) || null,
            createElement: () => element(),
            body: { appendChild() {} }
        }, page && { title: page.title || '' }),
        navigator: { clipboard: { writeText: t => { copiedText = t; return Promise.resolve(); } } },
        alert: m => { alerted = m; },
        fetch: fetchImpl,
        Promise
    };
    vm.runInNewContext(source, sandbox);
    return { copied: () => copiedText, alerted: () => alerted };
}

const flush = () => new Promise(resolve => setTimeout(resolve, 20));
const answer = body => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

describe('on Athlinks', () => {
    const ATHLINKS_URL = 'https://www.athlinks.com/event/386693/results/Event/1133982/Course/2670521/Results';
    const feedRunner = i => ({
        displayName: 'Runner ' + i, gender: 'F', age: 40, bib: String(i), chipTimeInMillis: 1500000 + i,
        startTimeInMillis: Date.UTC(2026, 7, 23, 12), rankings: { overall: i, gender: i, primary: 1 }
    });
    const feedPage = (from, count, total) => ({
        race: { name: 'Twilight 5K' }, division: { totalAthletes: total },
        intervals: [{ distance: { meters: 5000 }, results: Array.from({ length: count }, (_, i) => feedRunner(from + i + 1)) }]
    });

    test('every runner, page by page, copied in the form the server reads', async () => {
        const urls = [];
        const out = run(ATHLINKS_URL, url => {
            urls.push(url);
            const from = parseInt(/from=(\d+)/.exec(url)[1], 10);
            return answer(feedPage(from, Math.min(100, 230 - from), 230));
        });
        await flush();
        expect(urls).toHaveLength(3);
        expect(urls[0]).toBe('https://reignite-api.athlinks.com/event/1133982/race/2670521/results?from=0&limit=100');
        const payload = athlinks.fromPaste(out.copied());
        expect(payload.results).toHaveLength(230);
        expect(payload).toMatchObject({ url: ATHLINKS_URL, raceName: 'Twilight 5K', total: 230 });
        expect(payload.results[0]).toEqual(athlinks.runnerOf(feedRunner(1)));
    });
});

describe('on RunSignUp\'s system', () => {
    const headings = [{ name: 'Place', key: 'race_placement' }, { name: 'Name', key: 'name' }, { name: 'Chip Time', key: 'chip_time' }];
    const feed = (from, count, total) => ({
        headings,
        resultSet: {
            numResults: total,
            setInfo: { race_category_id: 777, individual_result_set_name: 'Overall' },
            results: Array.from({ length: count }, (_, i) => [from + i + 1, 'Runner ' + (from + i + 1), '30:00'])
        }
    });

    test('on a race\'s own domain: from that site, every page, read by the server as a table', async () => {
        const urls = [];
        const href = 'https://www.turkeychase.com/Race/Results/97804#resultSetId-604512;perpage:100';
        const out = run(href, url => {
            urls.push(url);
            const page = parseInt(/page=(\d+)/.exec(url)[1], 10);
            return answer(feed((page - 1) * 2500, page === 1 ? 2500 : 97, 2597));
        }, { title: 'Turkey Chase 10K Results' });
        await flush();
        expect(urls).toHaveLength(2);
        expect(urls[0]).toBe('https://www.turkeychase.com/Race/Results/97804/?format=json&resultSetId=604512&num=2500&search=&page=1');

        const payload = runsignup.fromPaste(out.copied());
        expect(payload).toMatchObject({ url: href, raceId: '97804', resultSetId: '604512', pageTitle: 'Turkey Chase 10K',
            numResults: 2597, eventId: 777, setName: 'Overall' });
        expect(payload.results).toHaveLength(2597);

        const raceApi = () => Promise.resolve({ data: { race: { address: { country_code: 'US', state: 'MD' },
            events: [{ event_id: 777, start_time: '11/27/2025 08:00', distance: '10 K' }] } } });
        const table = await runsignup.fromPastePayload(payload, raceApi);
        expect(table).toMatchObject({ total: 2597, truncated: false, raceDay: '2025-11-27', resultUrl: href,
            location: { country: 'USA', state: 'MD' }, headers: ['Place', 'Name', 'Chip Time'] });
        expect(table.data[2596]).toEqual({ Place: '2597', Name: 'Runner 2597', 'Chip Time': '30:00' });
    });

    test('no set in the address: the one picked on the page', async () => {
        const urls = [];
        const select = element({ value: '555', options: [] });
        run('https://runsignup.com/Race/Results/108889', url => { urls.push(url); return answer(feed(0, 1, 1)); },
            { elements: { resultsSelect: select } });
        await flush();
        expect(urls[0]).toContain('resultSetId=555');
    });

    test('several sets and none picked: asks for one, fetches nothing', async () => {
        const option = (value, year, name) => ({ value, textContent: name, getAttribute: () => String(year) });
        const select = element({ value: '', options: [option('1', 2026, '5K'), option('2', 2026, '10K')] });
        let fetched = false;
        run('https://runsignup.com/Race/Results/108889', () => { fetched = true; }, { elements: { resultsSelect: select } });
        await flush();
        expect(fetched).toBe(false);
    });
});

describe('on any other page (mcrrc.org)', () => {
    const href = 'https://mcrrc.org/race-result/black-hill-10k-3/';
    const SOURCE = '<html><head><title>Black Hill 10K</title></head><body><table><tr><th>Place</th><th>Name</th><th>Net Time</th></tr>' +
        '<tr><td>1</td><td>Ann Lee</td><td>36:01</td></tr><tr><td>2</td><td>Bob Kim</td><td>37:30</td></tr></table></body></html>';

    function pageRun(fetchImpl) {
        return run(href, fetchImpl, { title: 'Black Hill 10K' });
    }

    test('the page as the site sends it, with its address, read by the server as a table', async () => {
        const urls = [];
        const out = pageRun(url => { urls.push(url); return Promise.resolve({ ok: true, text: () => Promise.resolve(SOURCE) }); });
        await flush();
        expect(urls).toEqual([href]);
        const copy = pagePaste(out.copied());
        expect(copy).toEqual({ url: href, html: SOURCE });
        expect(parseResultsTableFromHtml(copy.html).data).toHaveLength(2);
    });

    test('the site refusing the second visit: what is on screen', async () => {
        const out = pageRun(() => Promise.reject(new Error('offline')));
        await flush();
        expect(pagePaste(out.copied())).toEqual({ url: href, html: '<html>on screen</html>' });
    });

    test('an Athlinks page that is not one course\'s results: says so, fetches nothing', () => {
        let fetched = false;
        const out = run('https://www.athlinks.com/event/386693', () => { fetched = true; });
        expect(out.alerted()).toMatch(/Athlinks/);
        expect(fetched).toBe(false);
    });
});

describe('on parkrun', () => {
    const SHOWN = '<html><body><div class="Results-header"><h1>Kensington parkrun</h1><h3><span class="format-date">2026-11-14</span>' +
        '<span>|</span><span>#384</span></h3></div><table class="Results-table"><thead><tr><th>Position</th><th>parkrunner</th>' +
        '<th>Gender</th><th>Time</th></tr></thead><tbody><tr><td>1</td><td>Ann Lee</td><td>Female1</td><td>18:01 PB</td></tr>' +
        '<tr><td>2</td><td>Bob Kim</td><td>Male1</td><td>18:30</td></tr></tbody></table></body></html>';

    function parkrun(href, shown) {
        let fetched = false;
        const out = run(href, () => { fetched = true; }, { title: 'Kensington parkrun' });
        return { out, fetched: () => fetched, shown };
    }

    test('the page as shown, no request to parkrun; read with its event, date and number', async () => {
        const href = 'https://www.parkrun.us/kensington/results/2026-11-14/';
        let fetched = false;
        const url = new URL(href);
        let copied = null;
        vm.runInNewContext(source, {
            location: { href, origin: url.origin, hostname: url.hostname, pathname: url.pathname, search: '', hash: '' },
            document: { title: 'Kensington parkrun', documentElement: { outerHTML: SHOWN }, getElementById: () => null,
                createElement: () => element(), body: { appendChild() {} } },
            navigator: { clipboard: { writeText: t => { copied = t; return Promise.resolve(); } } },
            alert() {}, fetch: () => { fetched = true; }, Promise
        });
        await flush();
        expect(fetched).toBe(false);
        const copy = pagePaste(copied);
        expect(copy).toEqual({ url: href, html: SHOWN });
        expect(parkrunMetadata(copy.html)).toMatchObject({ eventNumber: 384, raceDay: '2026-11-14' });
        // Saved under the event's number, not the day's address
        expect(eventResultsUrl(eventBase(copy.url), 384)).toBe('https://www.parkrun.us/kensington/results/384/');
        expect(parseResultsTableFromHtml(copy.html).data).toHaveLength(2);
    });

    test('a parkrun page with no results: says so', async () => {
        const { fetched } = parkrun('https://www.parkrun.us/kensington/');
        await flush();
        expect(fetched()).toBe(false);
    });
});

describe('pagePaste', () => {
    test('the bookmark\'s copy of a page, or not', () => {
        expect(pagePaste(JSON.stringify({ mcrrcPage: 1, url: 'https://x.org/r', html: '<p>' }))).toEqual({ url: 'https://x.org/r', html: '<p>' });
        expect(pagePaste('<html><table></table></html>')).toBeNull();
        expect(pagePaste('{"mcrrcPage": 1}')).toBeNull();
    });
});
