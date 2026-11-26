// The "Results → clipboard" bookmarklet (public/bookmarklets/results.js), run
// as a browser would on a race's results page, against a fake feed: what it
// copies must be what the server reads (app/athlinks.js, app/runsignup.js).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const athlinks = require('../app/athlinks');
const mika = require('../app/mika');
const runsignup = require('../app/runsignup');
const { pagePaste, parseResultsTableFromHtml } = require('../app/resultTableParser');
const { parkrunMetadata, eventBase, eventResultsUrl } = require('../app/parkrunCheck');

// As the extractor page puts it in the bookmark (rxBookmarklet's compact():
// comments and indentation out)
const source = fs.readFileSync(path.join(__dirname, '../public/bookmarklets/results.js'), 'utf8')
    .replace(/\/\*(?!MCRRC_SITE\*\/)[\s\S]*?\*\//g, '').replace(/^\s+/gm, '').replace(/\n+/g, '\n');

// An element of the fake page: enough for the progress box, its date form
// and a <select>
function element(extra) {
    return Object.assign({
        attributes: {}, children: [], textContent: '',
        setAttribute(name, value) { this.attributes[name] = value; }, getAttribute() { return null; },
        appendChild(child) { this.children.push(child); }, remove() {}, focus() {}
    }, extra);
}

function run(href, fetchImpl, page) {
    const url = new URL(href);
    let copiedText = null;
    let alerted = null;
    const created = [];
    const sandbox = {
        location: { href, origin: url.origin, hostname: url.hostname, pathname: url.pathname, search: url.search, hash: url.hash },
        document: Object.assign({
            title: '',
            documentElement: { outerHTML: '<html>on screen</html>' },
            getElementById: id => (page && page.elements && page.elements[id]) || null,
            // A mika:timing page loads the site's search script
            querySelector: selector => (page && page.mika && /ajax2/.test(selector) ? {} : null),
            createElement: tag => { const el = element({ tag }); created.push(el); return el; },
            body: { appendChild() {} }
        }, page && { title: page.title || '' }),
        navigator: { clipboard: { writeText: t => { copiedText = t; return Promise.resolve(); } } },
        alert: m => { alerted = m; },
        fetch: fetchImpl,
        Promise
    };
    // The team site's address the extractor page writes into the bookmark
    // (rxBookmarklet), and its roster (page.team, or page.roster: a whole
    // answer); the dates the bookmark asks it for in page.rosterDates
    let code = source;
    if (page && (page.team || page.roster)) {
        code = source.replace("/*MCRRC_SITE*/''", '/*MCRRC_SITE*/"https://team.test"');
        const siteFetch = sandbox.fetch;
        sandbox.fetch = (url, options) => {
            if (!url.startsWith('https://team.test/')) return siteFetch(url, options);
            (page.rosterDates = page.rosterDates || []).push(/date=([\d-]+)/.exec(url)[1]);
            if (page.roster) return page.roster(url);
            return Promise.resolve({ ok: true, json: () => Promise.resolve({ team: page.team }) });
        };
    }
    vm.runInNewContext(code, sandbox);
    // The race date form (mika:timing): answered as the admin would, unless
    // the test does it (page.date: 'ask')
    const form = {
        input: () => created.find(e => e.tag === 'input'),
        button: label => created.find(e => e.tag === 'button' && e.textContent === label),
        error: () => created.find(e => e.tag === 'div' && /^Pick a date/.test(e.textContent)),
        submit: day => { form.input().value = day; created.find(e => e.tag === 'form').onsubmit({ preventDefault() {} }); }
    };
    if (created.some(e => e.tag === 'form') && !(page && page.date === 'ask')) {
        const day = page && 'date' in page ? page.date : '2026-04-20';
        if (day === null) form.button('Cancel').onclick();
        else form.submit(day);
    }
    return { copied: () => copiedText, alerted: () => alerted, form };
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

describe('on a mika:timing site (Boston, Chicago, Berlin, London)', () => {
    // A list page as the sites write it (trimmed): the headings, then a row
    // per runner, with its places in the headings' order
    function listPage(placeLabels, rows, { count, pages } = {}) {
        const head = '<li class=" list-group row list-group-item list-group-header "><div class="row primary-section">' +
            placeLabels.map(l => '<div class=" list-field type-place place-secondary" style="width: 50px">' + l + '</div>').join('') +
            '<div class=" list-field type-fullname">Name</div></div></li>';
        const field = (type, label, value) => '<div class=" list-field ' + type + '" style="width: 45px">' +
            '<div class="visible-xs-block visible-sm-block list-label">' + label + '</div>' + value + '</div>';
        const body = rows.map(r => '<li class=" list-active list-group-item row"><div class="row primary-section">' +
            r.places.map(p => '<div class=" list-field type-place place-primary numeric">' + p + '</div>').join('') +
            '<h4 class=" list-field type-fullname"><a href="?content=detail&amp;idp=' + r.id + '&amp;lang=EN_CAP">' + r.name + '</a></h4></div>' +
            field('type-field', 'BIB', r.bib || '1') +
            (r.group !== undefined ? field('type-age_class', 'Division', r.group) : '') +
            field('type-time', 'HALF', '01:40:00') +
            field('type-time', r.finishLabel || 'Finish Net', r.time || '<span class="text-muted">&ndash;</span>') +
            '</li>').join('\n');
        const pager = pages ? '<ul class="pagination">' + Array.from({ length: pages }, (_, i) => '<li><a href="#">' + (i + 1) + '</a></li>').join('') + '</ul>' : '';
        return '<ul class="list-group">' + head + body + '</ul>' + (count !== undefined ? '<span class="list-info__text str_num">' + count + ' Results</span>' : '') + pager;
    }
    const fields = (groups, sexes) => ({ branches: { lists: { fields: {
        sex: { data: sexes.map(([code, label]) => ({ v: [code, label] })) },
        age_class: { data: [{ v: ['%', 'All'] }].concat(groups.map(([code, label]) => ({ v: [code, label] }))) },
        event: { data: [{ v: ['R', 'Runner'] }] }
    } } } });
    const text = body => Promise.resolve({ ok: true, text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
        json: () => Promise.resolve(body) });
    const TEAM = [['Ann', 'Lee', 'Female'], ['Bob', 'Kim', 'Male']];

    test('Boston-like: the team\'s names searched, finishers kept, age groups from runner pages, totals counted', async () => {
        const urls = [];
        const out = run('https://results.baa.org/2026/', url => {
            urls.push(url);
            if (url.includes('getSearchFields')) return text(fields([['1', '18-39'], ['9', '45-49']], [['M', 'Men'], ['W', 'Women']]));
            if (url.includes('content=detail')) {
                const group = url.includes('idp=ANN') ? '45-49' : '18-39';
                return text(detailPage({ _type_age_class: group, state: 'MD' }));
            }
            const labels = ['Place Overall', 'Place Gender', 'Place Division'];
            if (url.includes('search%5Bname%5D=Lee')) {
                return text(listPage(labels, [
                    { id: 'ANN', name: 'Lee, Ann', places: [10, 5, 2], time: '03:37:04', bib: '19556' },
                    { id: 'ANN2', name: 'Lee, Ann', places: ['', '', ''], time: '' }, // started, did not finish
                    { id: 'ZED', name: 'Lee, Zed', places: [11, 6, 3], time: '03:38:00' } // nobody on the team
                ]));
            }
            if (url.includes('search%5Bname%5D=Kim')) return text(listPage(labels, [{ id: 'BOB', name: 'Kim, Bob', places: [7, 6, 4], time: '03:20:00' }]));
            // counts
            const count = url.includes('age_class%5D=9') ? 50 : url.includes('age_class%5D=1') ? 300
                : url.includes('sex%5D=W') ? 400 : url.includes('sex%5D=M') ? 600 : 1000;
            return text(listPage(labels, [], { count }));
        }, { mika: true, team: TEAM, title: 'Boston Athletic Association' });
        await flush(); await flush();
        const payload = mika.fromPaste(out.copied());
        expect(payload).toMatchObject({ host: 'results.baa.org', year: '2026', event: 'R', searched: 2,
            totals: { overall: 1000, gender: { W: 400, M: 600 }, groups: { 'W|9': 50, 'M|1': 300 } } });
        expect(urls.filter(u => u.includes('content=detail'))).toHaveLength(2); // the two finishers only
        // one search per member: last name and first
        const searches = urls.filter(u => u.includes('pid=search') && u.includes('search%5Bname%5D'));
        expect(searches).toHaveLength(2);
        expect(searches.some(u => u.includes('search%5Bname%5D=Lee') && u.includes('search%5Bfirstname%5D=Ann') && u.includes('event=R'))).toBe(true);
        const table = mika.toExtraction(payload);
        // fastest first
        expect(table.data).toEqual([
            expect.objectContaining({ Name: 'Bob Kim', Gender: 'M', 'Age Group': 'M18-39', Place: '7/1000', 'Gender Place': '6/600', 'Division Place': '4/300' }),
            expect.objectContaining({ Name: 'Ann Lee', Gender: 'F', 'Age Group': 'F45-49', Place: '10/1000', 'Gender Place': '5/400', 'Division Place': '2/50', Bib: '19556' })
        ]);
        expect(urls.some(u => /page=\d/.test(u))).toBe(false); // every place on the list: nothing worked out
    });

    // A site's finisher lists, filtered as asked: n runners, the i-th of them
    // overall place i * step, 25 to a page; the count printed or not
    function lists(labels, { printed }) {
        const sizes = url => url.includes('age_class') ? [57, 5] : url.includes('sex') ? [120, 2] : [300, 1];
        return url => {
            const [n, step] = sizes(url);
            const page = +((/[?&]page=(\d+)/.exec(url) || [])[1] || 1);
            const rows = [];
            for (let i = (page - 1) * 25 + 1; i <= Math.min(page * 25, n); i++) {
                rows.push({ id: 'R' + i, name: 'Runner, Some', places: labels.map((l, k) => (k === 0 ? i * step : i)), group: '45-49', time: '03:00:00' });
            }
            return listPage(labels, rows, printed ? { count: n } : { pages: Math.ceil(n / 25) });
        };
    }

    // A runner's own page, as the sites write it: fields by the platform's names
    const detailPage = fieldsByName => Object.entries(fieldsByName).map(([name, value]) =>
        '<tr class="list-highlight f-' + name + '" >\n<th  class="desc"    >' + name + '</th>\n<td class="f-' + name + ' last">' + value + '</td>\n</tr>').join('\n');

    test('Chicago-like: the age group place its list leaves out, from the runner\'s page; counts from its pages', async () => {
        const urls = [];
        const labels = ['Place Overall', 'Place Gender'];
        const site = lists(labels, { printed: false });
        const out = run('https://results.chicagomarathon.com/2026/?event=MAR', url => {
            urls.push(url);
            if (url.includes('getSearchFields')) return text(fields([['45', '45-49']], [['M', 'Man'], ['W', 'Woman']]));
            if (url.includes('content=detail')) {
                return text(detailPage({ __fullname: 'Kim, Bob (USA)', __city_state: 'Rockville', _type_age_class: '45-49', _type_sex: 'Man',
                    place_all: '60', place_age: '30', place_nosex: '150' }));
            }
            if (url.includes('search%5Bname%5D=Kim')) {
                return text(listPage(labels, [{ id: 'BOB', name: 'Kim, Bob (USA)', places: [150, 60], group: '45-49', time: '02:20:34', finishLabel: 'Finish' }]));
            }
            if (url.includes('search%5Bname%5D')) return text(listPage(labels, []));
            return text(site(url));
        }, { mika: true, team: TEAM });
        for (let i = 0; i < 6; i++) await flush();
        const payload = mika.fromPaste(out.copied());
        expect(payload.event).toBe('MAR');
        expect(payload.totals).toEqual({ overall: 300, gender: { M: 120 }, groups: { 'M|45': 57 } });
        expect(urls.filter(u => u.includes('content=detail'))).toHaveLength(1);
        const table = mika.toExtraction(payload);
        expect(table.data[0]).toMatchObject({ Name: 'Bob Kim', Gender: 'M', 'Age Group': 'M45-49', Place: '150/300', 'Gender Place': '60/120',
            'Division Place': '30/57', Home: 'Rockville', Country: 'USA' });
        expect(table.notes).toBeNull();
    });

    test('Berlin-like "Place" and "Pl.AC": the gender place its list leaves out, from the runner\'s page', async () => {
        const labels = ['Place', 'Pl.AC'];
        const site = lists(labels, { printed: true });
        const out = run('https://berlin.r.mikatiming.com/2026/?lang=EN_CAP', url => {
            if (url.includes('getSearchFields')) return text(fields([['45', '45']], [['M', 'Men'], ['W', 'Women']]));
            if (url.includes('content=detail')) {
                return text(detailPage({ __fullname: 'Kim, Bob (USA)', age_class_desc: '45', place_all: '15', place_age: '6', place_nosex: '30' }));
            }
            if (url.includes('search%5Bname%5D=Kim')) {
                return text(listPage(labels, [{ id: 'BOB', name: 'Kim, Bob (USA)', places: [30, 6], group: '45', time: '02:12:07', finishLabel: 'Finish' }]));
            }
            if (url.includes('search%5Bname%5D')) return text(listPage(labels, []));
            return text(site(url));
        }, { team: TEAM }); // known by its host name alone
        for (let i = 0; i < 6; i++) await flush();
        const runner = mika.fromPaste(out.copied()).runners[0];
        expect(runner).toMatchObject({ overall: 30, groupPlace: 6, genderPlace: 15, group: '45', groupCode: '45', sexCode: 'M' });
    });

    test('the site\'s sex over the team\'s guess; a page that will not load leaves what the list gave', async () => {
        const labels = ['Place Overall', 'Place Gender'];
        const site = lists(labels, { printed: true });
        // Two runners could be member Ann Lee ("Ann" finds Anne too, and
        // Andy, whom the bookmark drops): the site says which is a man
        const out = run('https://results.chicagomarathon.com/2026/', url => {
            if (url.includes('getSearchFields')) return text(fields([['45', '45-49']], [['M', 'Man'], ['W', 'Woman']]));
            if (url.includes('content=detail') && url.includes('ANNE')) return text(detailPage({ _type_sex: 'Man', place_age: '9' }));
            if (url.includes('content=detail')) return Promise.resolve({ ok: false, status: 500 });
            if (url.includes('search%5Bname%5D=Lee')) {
                return text(listPage(labels, [
                    { id: 'ANNE', name: 'Lee, Anne', places: [40, 30], group: '45-49', time: '02:30:00' },
                    { id: 'ANDY', name: 'Lee, Andy', places: [41, 31], group: '45-49', time: '02:31:00' },
                    { id: 'ANN', name: 'Lee, Ann', places: [151, 60], group: '45-49', time: '02:50:00' }]));
            }
            if (url.includes('search%5Bname%5D')) return text(listPage(labels, []));
            return text(site(url));
        }, { mika: true, team: TEAM });
        for (let i = 0; i < 6; i++) await flush();
        const table = mika.toExtraction(mika.fromPaste(out.copied()));
        expect(table.data.map(r => [r.Name, r.Gender, r['Division Place']])).toEqual([['Anne Lee', 'M', '9/57'], ['Ann Lee', 'F', '']]);
        expect(table.notes).toMatch(/no age group place/);
    });

    test('a member under two names ("Meg" and "Megan" Ryan): searched twice, copied once', async () => {
        const labels = ['Place Overall', 'Place Gender', 'Place Division'];
        const searches = [];
        const out = run('https://results.baa.org/2025/', url => {
            if (url.includes('getSearchFields')) return text(fields([['9', '45-49']], [['M', 'Men'], ['W', 'Women']]));
            if (url.includes('content=detail')) return text(detailPage({ _type_age_class: '45-49' }));
            if (url.includes('search%5Bname%5D')) {
                searches.push(url);
                const first = /firstname%5D=(\w+)/.exec(url)[1];
                // the site's link carries the search that found her
                return text(listPage(labels, [{ id: 'MEG&amp;search%5Bfirstname%5D=' + first, name: 'Ryan, Megan', places: [8833, 1699, 1373], time: '03:15:52' }]));
            }
            return text(listPage(labels, [], { count: 100 }));
        }, { mika: true, team: [['Megan', 'Ryan', 'Female'], ['Meg', 'Ryan', 'Female']] });
        for (let i = 0; i < 4; i++) await flush();
        expect(searches).toHaveLength(2);
        expect(mika.fromPaste(out.copied()).runners).toHaveLength(1);
    });

    describe('the race date it asks for', () => {
        const site = urls => url => {
            urls.push(url);
            if (url.includes('getSearchFields')) return text(fields([['9', '45-49']], [['M', 'Men'], ['W', 'Women']]));
            if (url.includes('content=detail')) return text(detailPage({ _type_age_class: '45-49' }));
            if (url.includes('search%5Bname%5D')) return text(listPage(['Place Overall'], [{ id: 'X', name: 'Lee, Ann', places: [5], time: '03:00:00' }]));
            return text(listPage(['Place Overall'], [], { count: 100 }));
        };
        const ROSTER = [['Ann', 'Lee', 'Female'], ['Bob', 'Kim', 'Male']];

        test('the team that day from the team site, then their names searched; the date goes with the copy', async () => {
            const urls = [];
            const page = { mika: true, team: ROSTER, date: '2024-04-15' };
            const out = run('https://results.baa.org/2024/', site(urls), page);
            for (let i = 0; i < 4; i++) await flush();
            expect(page.rosterDates).toEqual(['2024-04-15']);
            expect(urls.filter(u => u.includes('search%5Bname%5D')).map(u => /name%5D=(\w+)/.exec(u)[1])).toEqual(['Lee', 'Kim']);
            expect(mika.toExtraction(mika.fromPaste(out.copied())).raceDay).toBe('2024-04-15');
        });

        test('no one on the team that day, or the team site not answering: said, the results site not asked', async () => {
            for (const roster of [
                () => Promise.resolve({ ok: true, json: () => Promise.resolve({ team: [] }) }),
                () => Promise.resolve({ ok: false, status: 500 }),
                () => Promise.reject(new Error('NetworkError'))
            ]) {
                const urls = [];
                const out = run('https://results.baa.org/2010/', site(urls), { mika: true, roster, date: '2010-04-19' });
                for (let i = 0; i < 3; i++) await flush();
                expect(urls.filter(u => u.includes('search%5Bname%5D'))).toEqual([]);
                expect(out.copied()).toBeNull();
            }
        });

        test('cancelled, or not a date: nothing fetched; a bad date is said in the form', async () => {
            for (const date of [null, '21/04/2025', '2025-13-45', '']) {
                const urls = [];
                const out = run('https://results.baa.org/2025/', site(urls), { mika: true, team: ROSTER, date });
                await flush();
                expect(urls).toEqual([]);
                expect(out.copied()).toBeNull();
                if (date !== null) expect(out.form.error().textContent).toBe('Pick a date in 2025.');
            }
        });

        test('the form: this year starts at today, Today fills it in, a past year keeps the picker to that year', async () => {
            const today = new Date();
            const todayText = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
            const now = run('https://results.baa.org/' + today.getFullYear() + '/', site([]), { mika: true, team: ROSTER, date: 'ask' });
            expect(now.form.input()).toMatchObject({ type: 'date', value: todayText });

            const urls = [];
            const past = run('https://results.baa.org/2024/', site(urls), { mika: true, team: ROSTER, date: 'ask' });
            expect(past.form.input()).toMatchObject({ min: '2024-01-01', max: '2024-12-31' });
            expect(past.form.input().value).toBeUndefined();
            past.form.button('Today').onclick();
            expect(past.form.input().value).toBe(todayText);
            past.form.submit('2024-04-15');
            for (let i = 0; i < 4; i++) await flush();
            expect(urls.some(u => u.includes('search%5Bname%5D=Lee'))).toBe(true);
        });

    });

    test('a bookmark that does not know the team site says so', async () => {
        const out = run('https://results.baa.org/2026/', () => text('{}'), { mika: true });
        await flush();
        expect(out.copied()).toBeNull();
    });
});
