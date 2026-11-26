// mika:timing results (results.baa.org, results.chicagomarathon.com,
// berlin.r.mikatiming.com, results.tcslondonmarathon.com, and other races on
// the same system), as the "Results → clipboard" bookmark copies them
// (public/bookmarklets/results.js, mika()).
//
// The bookmark searches each team member's last name on the site, keeps the
// finishers whose name could be a member's, and counts what their places are
// out of. So the table here holds candidates, not the whole field: every
// place goes with its total ("1828/2414"), and the extractor must not count
// places within the table (wholeField: false).
//
// Each site's list shows different columns (Chicago's has no age group
// place, Berlin's no gender place), so the bookmark reads each candidate's
// own page, which has all three. One it could not read stays blank, for the
// admin.
//
// The sites block no one, but their robots.txt (Boston's at least) asks
// automated clients to stay away: hence the bookmark, run by the admin in
// their own browser, rather than requests from this server.

// Races known by their results site: their name, place (country codes as
// config/locations.js has them) and distance. Any
// other mika:timing site still loads, named after its page.
const KNOWN_RACES = {
    'results.baa.org': { name: 'Boston Marathon', location: { country: 'USA', state: 'MA' }, distance: '26.2 miles' },
    'results.chicagomarathon.com': { name: 'Chicago Marathon', location: { country: 'USA', state: 'IL' }, distance: '26.2 miles' },
    'berlin.r.mikatiming.com': { name: 'Berlin Marathon', location: { country: 'DEU', state: null }, distance: '26.2 miles' },
    'results.tcslondonmarathon.com': { name: 'London Marathon', location: { country: 'GBR', state: null }, distance: '26.2 miles' }
};

const HEADERS = ['Place', 'Name', 'Gender', 'Age Group', 'Bib', 'Time', 'Gender Place', 'Division Place', 'Home', 'Country'];

// Pasted text that is the bookmark's copy of a mika:timing race: the payload,
// else null
function fromPaste(pasted) {
    const trimmed = String(pasted || '').trim();
    if (trimmed[0] !== '{') return null;
    let payload;
    try {
        payload = JSON.parse(trimmed);
    } catch (e) {
        return null;
    }
    if (!payload || payload.mcrrcMika !== 1 || !Array.isArray(payload.runners)) return null;
    return payload;
}

// "3:35:03" -> 12903; a time that does not read goes last
function seconds(time) {
    const parts = String(time || '').split(':').map(Number);
    if (!parts.length || parts.some(isNaN)) return Infinity;
    return parts.reduce((sum, part) => sum * 60 + part, 0);
}

// "1828" and 2414 -> "1828/2414"; a place without its total stays alone
function outOf(place, total) {
    if (!place) return '';
    return total ? place + '/' + total : String(place);
}

// The race's name: the known race and year, else the event and page title
function raceName(payload, known) {
    const year = payload.year ? ' ' + payload.year : '';
    if (known) return known.name + year;
    const title = String(payload.pageTitle || '').trim();
    return (title || payload.host || 'mika:timing race') + year;
}

// The bookmark's copy -> the extractor's table, as /api/extract-table gives it
function toExtraction(payload) {
    const totals = payload.totals || {};
    const genderTotals = totals.gender || {};
    const groupTotals = totals.groups || {};
    const known = KNOWN_RACES[String(payload.host || '').toLowerCase()] || null;

    // Each runner once (by the site's id: a copy made before the bookmark
    // checked it could hold one runner twice, found by two searches), then
    // fastest first: the bookmark finds runners name by name
    const seen = new Set();
    const runners = payload.runners.filter(runner => {
        if (!runner || !runner.time) return false;
        const idp = /[?&]idp=([^&]+)/.exec(runner.href || '');
        const id = runner.id || (idp ? idp[1] : null);
        if (!id) return true;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
    }).sort((a, b) => seconds(a.time) - seconds(b.time));
    const data = runners.map(runner => {
        const sex = runner.sex === 'Female' ? 'F' : runner.sex === 'Male' ? 'M' : '';
        const groupTotal = runner.groupCode ? groupTotals[runner.sexCode + '|' + runner.groupCode] : null;
        return {
            Place: outOf(runner.overall, totals.overall),
            Name: [runner.first, runner.last].filter(Boolean).join(' ') || runner.name || '',
            Gender: sex,
            'Age Group': runner.group ? sex + runner.group : '',
            Bib: runner.bib || '',
            Time: runner.time,
            'Gender Place': outOf(runner.genderPlace, genderTotals[runner.sexCode]),
            'Division Place': outOf(runner.groupPlace, groupTotal),
            // From the runner's page: tells namesakes apart
            Home: runner.home || '',
            Country: runner.nation || ''
        };
    });

    // Places still blank (not on the site's list, and not worked out by the
    // bookmark), said to the admin
    const missing = [];
    if (runners.some(r => r.overall && !r.genderPlace)) missing.push('gender place');
    if (runners.some(r => r.overall && !r.groupPlace)) missing.push('age group place');

    return {
        pageTitle: raceName(payload, known),
        headers: HEADERS,
        data,
        total: totals.overall || null,
        truncated: false,
        wholeField: false,
        resultUrl: payload.url || null,
        // The date the admin gave the bookmark (whose team it searched for)
        raceDay: /^\d{4}-\d{2}-\d{2}$/.test(payload.raceDay || '') ? payload.raceDay : undefined,
        distance: known ? known.distance : (/marathon/i.test(payload.eventName + ' ' + payload.pageTitle) ? '26.2 miles' : undefined),
        location: known ? known.location : undefined,
        notes: missing.length
            ? 'Some runners have no ' + missing.join(' and no ') + ' (their page could not be read): fill those in by hand if you want them.'
            : null,
        searched: payload.searched || null
    };
}

module.exports = { fromPaste, toExtraction, KNOWN_RACES, HEADERS };
