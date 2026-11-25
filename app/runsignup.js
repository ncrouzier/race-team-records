// RunSignUp results for the result extractor (POST /api/extract-table).
//
// A race's results page (runsignup.com/Race/Results/108889) is filled in by
// JavaScript, so its source has no results. They come from two feeds instead,
// neither needing a key:
//   - the page's own results feed, /Race/Results/<race>/?format=json&
//     resultSetId=<set>&page=<n>&num=<per page>: the columns and the runners
//     of one result set (a race has one per event and year, "Adult Overall
//     Results", "Virtual Runner"...), page by page, with the total;
//   - RunSignUp's public race API, /Rest/race/<race>: each event's date,
//     distance and the race's address. The result set names its event
//     (setInfo.race_category_id), which is how the date is found.
//
// Many races show RunSignUp's results on their own domain (turkeychase.com,
// trisignup.com, sbymarathon.com: /Race/Results/<race> all the same). Race
// numbers are RunSignUp's own, so those are read from runsignup.com.
//
// An address without a result set (the race's results page as first opened)
// gets this year's one when there is a single real one (a virtual run is not
// one); otherwise the admin picks from the list the page offers.
//
// fetchRunSignUp takes the HTTP getter (axios.get) so the rest can be tested
// without the network: tests/runsignup.test.js.

const cheerio = require('cheerio');

const PER_PAGE = 2500;
// 2500 a page: 50,000 runners, more than any race the team runs
const MAX_PAGES = 20;

// The race and, when the address names one, the result set. Both spellings
// RunSignUp uses: ?resultSetId=123 and #resultSetId-123; when both are there
// the one after the # is what the page was showing.
// Any domain: see the top of this file.
function parseUrl(url) {
    const race = /^https?:\/\/[^/]+\/Race\/Results\/(\d+)/i.exec(url || '');
    if (!race) return null;
    const sets = [...String(url).matchAll(/resultSetId[-=](\d+)/gi)];
    return { raceId: race[1], resultSetId: sets.length ? sets[sets.length - 1][1] : null };
}

// The result sets the race's results page offers: [{ id, year, name }], the
// newest year first, as the page lists them
function resultSetsFromPage(html) {
    const $ = cheerio.load(html || '');
    const sets = [];
    $('#resultsSelect option').each(function () {
        const id = ($(this).attr('value') || '').trim();
        if (!/^\d+$/.test(id)) return;
        sets.push({
            id: id,
            year: parseInt($(this).attr('data-year'), 10) || null,
            name: $(this).text().replace(/\s+/g, ' ').trim()
        });
    });
    return sets;
}

// The result set to use when the address names none: the newest year's, if
// it has one real one (virtual runs left out). null when the admin must pick.
function pickResultSet(sets) {
    if (!sets.length) return null;
    const newest = Math.max(...sets.map(s => s.year || 0));
    const real = sets.filter(s => (s.year || 0) === newest && !/virtual/i.test(s.name));
    return real.length === 1 ? real[0] : null;
}

// Award divisions ("M Top Finishers", "Female Overall", "OVL_M", "Masters"): a runner
// placed in one is taken out of their age group, so their "age place" there
// is an award place, not an age group rank
const AWARD_DIVISION = /top\s*finisher|overall|\bovl|\bovr|masters|award/i;

// The results feed's pages -> { headers, data } as the extractor takes them:
// the visible columns, one row object per runner. An award division and its
// place are blanked (see AWARD_DIVISION), so no wrong age group rank is saved.
function buildTable(pages) {
    const first = pages[0];
    const visible = first.headings
        .map((heading, index) => ({ heading, index, name: String(heading.name || '').replace(/\n/g, ' ').trim() }))
        .filter(col => !col.heading.hidden);
    const keyIndex = key => first.headings.findIndex(h => h.key === key);
    const divisionIndex = keyIndex('division');
    const divisionPlaceIndex = keyIndex('division_place');

    const data = [];
    pages.forEach(page => {
        page.resultSet.results.forEach(result => {
            const award = divisionIndex >= 0 && AWARD_DIVISION.test(String(result[divisionIndex] || ''));
            const row = {};
            visible.forEach(col => {
                const blank = award && (col.index === divisionIndex || col.index === divisionPlaceIndex);
                const value = result[col.index];
                row[col.name] = blank || value === null || value === undefined ? '' : String(value);
            });
            data.push(row);
        });
    });
    return { headers: visible.map(col => col.name), data: data };
}

// An event of the race API: its day ("10/24/2026 08:30" -> "2026-10-24"), its
// distance as RunSignUp writes it ("3.76 Miles"), and the race's location in
// the codes races are stored with (US states only: RunSignUp's country codes
// are not ours)
function eventInfo(race, eventId) {
    const event = (race.events || []).find(e => String(e.event_id) === String(eventId));
    const info = {};
    if (event) {
        const day = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(event.start_time || '');
        if (day) info.raceDay = day[3] + '-' + day[1].padStart(2, '0') + '-' + day[2].padStart(2, '0');
        if (event.distance) info.distance = String(event.distance);
    }
    const address = race.address || {};
    if (address.country_code === 'US' && /^[A-Z]{2}$/.test(address.state || '')) {
        info.location = { country: 'USA', state: address.state };
    }
    return info;
}

// The whole thing: { needsChoice, resultSets } when the admin must pick a
// result set, else the table, the page title, and what the race API knows
// (raceDay, distance, location). get is axios.get.
async function fetchRunSignUp(url, get, headers) {
    const parsed = parseUrl(url);
    if (!parsed) {
        const err = new Error('Could not find the race number in the RunSignUp address');
        err.status = 400;
        throw err;
    }
    const raceBase = 'https://runsignup.com/Race/Results/' + parsed.raceId;
    const page = await get(raceBase, { headers: headers, timeout: 30000 });
    const pageHtml = typeof page.data === 'string' ? page.data : '';
    const $ = cheerio.load(pageHtml);
    const pageTitle = $('title').text().trim().replace(/\s*results\s*$/i, '') || 'RunSignUp Race';

    let resultSetId = parsed.resultSetId;
    if (!resultSetId) {
        const sets = resultSetsFromPage(pageHtml);
        const picked = pickResultSet(sets);
        if (!picked) {
            return { needsChoice: true, pageTitle: pageTitle, raceId: parsed.raceId, resultSets: sets };
        }
        resultSetId = picked.id;
    }

    const feed = n => get(raceBase + '/?format=json&resultSetId=' + resultSetId + '&page=' + n + '&num=' + PER_PAGE + '&search=', {
        headers: Object.assign({}, headers, { Accept: 'application/json' }),
        timeout: 60000
    }).then(res => res.data);

    const pages = [await feed(1)];
    if (!pages[0] || !pages[0].resultSet || !Array.isArray(pages[0].resultSet.results)) {
        const err = new Error('RunSignUp sent no results for result set ' + resultSetId);
        err.status = 400;
        throw err;
    }
    const total = pages[0].resultSet.numResults || 0;
    let count = pages[0].resultSet.results.length;
    while (count < total && pages.length < MAX_PAGES) {
        const next = await feed(pages.length + 1);
        const results = next && next.resultSet && next.resultSet.results;
        if (!results || !results.length) break;
        pages.push(next);
        count += results.length;
    }
    return finish(pages, parsed.raceId, resultSetId, pageTitle, get, headers);
}

// The feed's pages -> the table and what the race API knows of the event
async function finish(pages, raceId, resultSetId, pageTitle, get, headers) {
    const total = pages[0].resultSet.numResults || 0;
    const count = pages.reduce((sum, page) => sum + page.resultSet.results.length, 0);
    if (!count) {
        const err = new Error('No results in that result set yet');
        err.status = 400;
        throw err;
    }

    // The date, distance and place: a bonus, never a reason to fail
    let info = {};
    const setInfo = pages[0].resultSet.setInfo || {};
    try {
        const race = await get('https://runsignup.com/Rest/race/' + raceId +
            '?format=json&future_events_only=F&most_recent_events_only=F', { headers: headers, timeout: 20000 });
        if (race.data && race.data.race) info = eventInfo(race.data.race, setInfo.race_category_id);
    } catch (e) {
        // the table is what matters
    }

    return Object.assign({
        pageTitle: pageTitle,
        resultSetId: String(resultSetId),
        resultSetName: setInfo.individual_result_set_name || null,
        truncated: count < total,
        total: total || count
    }, buildTable(pages), info);
}

// Pasted text that is the bookmarklet's copy of a RunSignUp result set
// (public/bookmarklets/results.js): the payload, else null
function fromPaste(pasted) {
    const trimmed = String(pasted || '').trim();
    if (trimmed[0] !== '{') return null;
    let payload;
    try {
        payload = JSON.parse(trimmed);
    } catch (e) {
        return null;
    }
    if (!payload || payload.mcrrcRunSignUp !== 1 || !Array.isArray(payload.headings) || !Array.isArray(payload.results)) {
        return null;
    }
    return payload;
}

// The bookmarklet's copy -> the same answer as fetchRunSignUp (the race API
// is still asked from here: it does not refuse servers)
function fromPastePayload(payload, get, headers) {
    const page = {
        headings: payload.headings,
        resultSet: {
            results: payload.results,
            numResults: payload.numResults,
            setInfo: { race_category_id: payload.eventId, individual_result_set_name: payload.setName }
        }
    };
    return finish([page], payload.raceId, payload.resultSetId, payload.pageTitle || 'RunSignUp Race', get, headers)
        .then(out => Object.assign(out, { resultUrl: payload.url || null }));
}

module.exports = { parseUrl, resultSetsFromPage, pickResultSet, buildTable, eventInfo, fetchRunSignUp, fromPaste, fromPastePayload, AWARD_DIVISION };
