// Athlinks results for the result extractor (POST /api/extract-table).
//
// An Athlinks results page (athlinks.com/event/<id>/results/Event/<event>/
// Course/<course>/Results) is filled in by JavaScript from Athlinks' results
// feed, reignite-api.athlinks.com/event/<event>/race/<course>/results, 100
// runners a request. Two ways to that feed:
//   - from this server, as before (fetchAthlinks). Athlinks' CloudFront has
//     taken to refusing servers (HTTP 403, seen November 2026), and r.jina.ai
//     is refused too;
//   - from the admin's own browser: the "Results → clipboard" bookmarklet
//     (public/bookmarklets/results.js), run on the race's results page, asks
//     the feed for every runner the way the page does and copies them; pasted
//     into the extractor, they arrive here (fromPaste).
// Both give the same runner list, turned into the extractor's table here.
//
// Tested in tests/athlinks.test.js.

const { formatDuration } = require('./resultTableParser');

const PER_PAGE = 100;
// 300 requests: 30,000 runners, more than any race the team runs, and an end
// should the feed ever ignore `from` and send the same page forever
const MAX_PAGES = 300;

const HEADERS = ['Place', 'Name', 'Gender', 'Age', 'Bib', 'Time', 'Gender Place', 'Division Place'];

// The event and course numbers in an Athlinks results address
// (.../Event/<event>/Course/<course>/...), or null. The two together: the
// address also starts /event/<another number>/, the event series.
function parseUrl(url) {
    const ids = /\/Event\/(\d+)\/Course\/(\d+)/i.exec(url || '');
    return ids ? { eventId: ids[1], raceId: ids[2] } : null;
}

// One runner of the feed, keeping what the table needs. The bookmarklet does
// the same in the browser (it must stay small enough for the clipboard).
function runnerOf(result) {
    const ranks = result.rankings || {};
    return {
        name: result.displayName,
        gender: result.gender,
        age: result.age,
        bib: result.bib,
        chipTime: result.chipTimeInMillis,
        start: result.startTimeInMillis,
        overall: ranks.overall,
        genderPlace: ranks.gender,
        divisionPlace: ranks.primary
    };
}

// A day as the race lived it: the start time's calendar day in Eastern time
// (most of the team's races), not UTC, where an evening race is a day later
function eventDay(ms) {
    if (typeof ms !== 'number' || !isFinite(ms) || ms <= 0) return null;
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date(ms));
    return /^\d{4}-\d{2}-\d{2}$/.test(parts) ? parts : null;
}

const text = value => (value === null || value === undefined ? '' : String(value));

// ---- Age groups ----
// Athlinks gives each runner's place in their age group ("primary" ranking),
// but neither the group nor its size. Both follow from the results: try the
// usual ways races cut age groups (5 or 10 years, an open youngest group, an
// open oldest one) and keep the one under which counting runners of the same
// gender and group, in finishing order, gives back every place Athlinks gave.
// A real race (November 2026, 239 runners): 5-year groups, under 15, 80+,
// all 239 places. Nothing matching every place: no groups, rather than a guess.

// Finest first: when few runners leave two ways possible (nobody between 60
// and 80, say, so "60+" fits as well as "80+"), the groups stay as small as
// the places allow
const STEPS = [5, 10];
const YOUNGEST = [null, 10, 15, 20];
const OLDEST = [null, 90, 85, 80, 75, 70, 65, 60];
// Too few places to tell one way of cutting from another
const MIN_PLACED = 10;

// A scheme's group for an age, as "40-44", "0-14" or "80+"
function groupOf(scheme, age) {
    if (scheme.youngest && age < scheme.youngest) return '0-' + (scheme.youngest - 1);
    if (scheme.oldest && age >= scheme.oldest) return scheme.oldest + '+';
    const low = Math.floor(age / scheme.step) * scheme.step;
    return low + '-' + (low + scheme.step - 1);
}

const SCHEMES = [];
STEPS.forEach(step => YOUNGEST.forEach(youngest => OLDEST.forEach(oldest => {
    // An open group must start where a group would
    if ((youngest && youngest % step) || (oldest && oldest % step)) return;
    SCHEMES.push({ step, youngest, oldest });
})));

const placed = r => typeof r.age === 'number' && r.age > 0 && r.gender && Number(r.divisionPlace) > 0 && Number(r.overall) > 0;

// The runners' age groups, { runner index: "M40-44" }, or null when no
// scheme gives back every place
function ageGroups(runners) {
    const order = runners
        .map((runner, index) => ({ runner, index }))
        .filter(item => placed(item.runner))
        .sort((a, b) => a.runner.overall - b.runner.overall);
    if (order.length < MIN_PLACED) return null;

    for (const scheme of SCHEMES) {
        const counts = {};
        const groups = {};
        const fits = order.every(item => {
            const group = item.runner.gender + groupOf(scheme, item.runner.age);
            counts[group] = (counts[group] || 0) + 1;
            groups[item.index] = group;
            return counts[group] === Number(item.runner.divisionPlace);
        });
        if (fits) return groups;
    }
    return null;
}

// The runner list (from either way in) -> what /api/extract-table answers
function toExtraction(payload) {
    const runners = payload.results || [];
    // Worked out (above): the column the age group sizes are counted from
    const groups = ageGroups(runners);
    const data = runners.map((r, index) => {
        const row = {
            'Place': text(r.overall),
            'Name': text(r.name),
            'Gender': text(r.gender),
            'Age': text(r.age),
            'Bib': text(r.bib),
            'Time': formatDuration(r.chipTime),
            'Gender Place': text(r.genderPlace),
            'Division Place': text(r.divisionPlace)
        };
        if (groups) row['Age Group'] = groups[index] || '';
        return row;
    });
    const firstStart = runners.map(r => r.start).find(ms => typeof ms === 'number' && ms > 0);
    const meters = payload.distance && Number(payload.distance.meters);
    const total = Number(payload.total) || 0;
    return {
        headers: groups ? HEADERS.concat(['Age Group']) : HEADERS.slice(),
        data: data,
        pageTitle: payload.raceName || 'Athlinks race',
        raceDay: eventDay(firstStart),
        // In miles, which the distance guess reads (ResultExtractionService)
        distance: meters > 0 ? (meters / 1609.344).toFixed(2) + ' miles' : null,
        total: total || data.length,
        truncated: total > 0 && data.length < total,
        resultUrl: payload.url || null
    };
}

// Pasted text that is the bookmarklet's output: the payload, else null
function fromPaste(pasted) {
    const trimmed = String(pasted || '').trim();
    if (trimmed[0] !== '{') return null;
    let payload;
    try {
        payload = JSON.parse(trimmed);
    } catch (e) {
        return null;
    }
    if (!payload || payload.mcrrcAthlinks !== 1 || !Array.isArray(payload.results)) return null;
    return payload;
}

// The feed, from this server: the same payload the bookmarklet builds. get is
// axios.get. A refusal (403) is thrown with err.blocked, for the message that
// points to the bookmarklet.
async function fetchAthlinks(url, get, headers) {
    const ids = parseUrl(url);
    if (!ids) {
        const err = new Error('Could not find the event and course numbers in the Athlinks address (…/Event/<number>/Course/<number>/…)');
        err.status = 400;
        throw err;
    }
    const feed = 'https://reignite-api.athlinks.com/event/' + ids.eventId + '/race/' + ids.raceId + '/results';
    const payload = { mcrrcAthlinks: 1, url: url, eventId: ids.eventId, raceId: ids.raceId, results: [] };

    for (let page = 0; page < MAX_PAGES; page++) {
        let response;
        try {
            response = await get(feed + '?from=' + payload.results.length + '&limit=' + PER_PAGE, {
                headers: Object.assign({}, headers, { Accept: 'application/json' }),
                timeout: 30000
            });
        } catch (error) {
            const status = error.response && error.response.status;
            const err = new Error(status === 403 || status === 429
                ? 'Athlinks refused the request from our server (HTTP ' + status + '). ' +
                  'Open the race on athlinks.com, click the "Results → clipboard" bookmark, and paste here.'
                : 'Could not fetch the Athlinks results: ' + error.message);
            err.status = 502;
            err.blocked = status === 403 || status === 429;
            throw err;
        }
        const body = response.data || {};
        const interval = body.intervals && body.intervals[0];
        if (page === 0) {
            payload.raceName = body.race && body.race.name;
            payload.total = body.division && body.division.totalAthletes;
            payload.distance = interval && interval.distance;
        }
        const results = (interval && interval.results) || [];
        results.forEach(result => payload.results.push(runnerOf(result)));
        if (!results.length || (payload.total && payload.results.length >= payload.total)) break;
    }

    if (!payload.results.length) {
        const err = new Error('No results found for this Athlinks race');
        err.status = 400;
        throw err;
    }
    return payload;
}

module.exports = { parseUrl, runnerOf, eventDay, toExtraction, fromPaste, fetchAthlinks, ageGroups, HEADERS, PER_PAGE, MAX_PAGES };
