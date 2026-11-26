// The parkrun check on the result extractor page: which parkruns are worth
// checking after a Saturday, and where their results are.
//
// The list is every parkrun the team has run at least MIN_RUNS times, plus any
// run in the last RECENT_DAYS. Each one's address comes from results already
// saved (parkrun.us/kensington/results/384/ -> parkrun.us/kensington), so
// nobody types one. Its newest results are at .../results/latestresults/; the
// race is saved under the event's own number (.../results/385/), the address
// that stays the same once a newer event is run.
//
// The results of an earlier date are at .../results/2026-11-14/ (a 404 when
// there was no event that day); they too are saved under the event's number.
//
// Fetching and saving are in app/routes.js (/api/parkrun-check); this module
// is the pure part, tested in tests/parkrunCheck.test.js.

const cheerio = require('cheerio');
const { parkrunName } = require('./raceSeriesMatcher');

const MIN_RUNS = 5;
const RECENT_DAYS = 92; // about 3 months

// parkrun.us, parkrun.org.uk, parkrun.com.au, parkrun.co.za, parkrun.fr...
const PARKRUN_HOST = /^(www\.)?parkrun\.(com?\.)?[a-z]{2,3}(\.[a-z]{2})?$/i;
// An event's number, its latest, or a day's (2026-11-14)
const RESULTS_PATH = /^\/([a-z0-9-]+)\/results\/(\d+|latestresults|\d{4}-\d{2}-\d{2})\/?$/i;

// The event a parkrun results address belongs to: { origin, slug }, or null
// for anything else (another site, a runner's page, a typo)
function eventBase(link) {
    let url;
    try {
        url = new URL(String(link || '').trim());
    } catch (e) {
        return null;
    }
    if (!/^https?:$/.test(url.protocol) || !PARKRUN_HOST.test(url.hostname)) return null;
    const m = RESULTS_PATH.exec(url.pathname);
    if (!m) return null;
    return { origin: 'https://' + url.hostname.toLowerCase(), slug: m[1].toLowerCase() };
}

function latestResultsUrl(base) {
    return base.origin + '/' + base.slug + '/results/latestresults/';
}

function eventResultsUrl(base, eventNumber) {
    return base.origin + '/' + base.slug + '/results/' + eventNumber + '/';
}

// The results of a day ("2026-11-14")
function dateResultsUrl(base, day) {
    return base.origin + '/' + base.slug + '/results/' + day + '/';
}

// The spellings a saved result link may have for one event's page, for the
// "already added" check: with or without www, http or https, the final slash
function linkVariants(url) {
    const base = eventBase(url);
    if (!base) return [url];
    const path = new URL(url).pathname.replace(/\/$/, '');
    const host = base.origin.replace(/^https:\/\/(www\.)?/, '');
    const out = [];
    for (const scheme of ['https://', 'http://']) {
        for (const www of ['www.', '']) {
            for (const slash of ['/', '']) out.push(scheme + www + host + path + slash);
        }
    }
    return out;
}

// "2026-11-21" -> its time (UTC midnight); NaN for anything else
function dayTime(day) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(day || '')) ? Date.parse(day + 'T00:00:00Z') : NaN;
}

// "Kensington parkrun #384" -> 384; null without a number
function eventNumberOf(racename) {
    const m = /#\s*(\d+)\s*$/.exec(String(racename || ''));
    return m ? parseInt(m[1], 10) : null;
}

// The parkruns to check, most run first.
//   races: [{ racename, racedate, location }], every parkrun race saved
//   links: [{ racename, racedate, resultlink }], their results' links
// Each: { name, runs, lastDate, lastRacename, lastEvent, location, latestUrl } —
// lastEvent: { eventNumber, day } of the last one saved, when its name has one;
// latestUrl null when no saved result links to that parkrun's results.
function buildList(races, links, options) {
    options = options || {};
    const now = options.now ? new Date(options.now) : new Date();
    const minRuns = options.minRuns || MIN_RUNS;
    const recentSince = now.getTime() - (options.recentDays || RECENT_DAYS) * 24 * 60 * 60 * 1000;

    const groups = new Map();
    for (const race of races || []) {
        const name = parkrunName(race.racename);
        if (!name) continue;
        const key = name.toLowerCase();
        const when = new Date(race.racedate).getTime();
        let g = groups.get(key);
        if (!g) groups.set(key, g = { name, runs: 0, last: -Infinity, lastRacename: null, location: null, linkWhen: -Infinity, base: null });
        g.runs++;
        if (when > g.last) {
            g.last = when;
            g.name = name;
            g.lastRacename = race.racename;
            g.location = race.location || null;
        }
    }
    // Its address: from the most recent saved result that links to it
    for (const link of links || []) {
        const name = parkrunName(link.racename);
        const g = name && groups.get(name.toLowerCase());
        const base = g && eventBase(link.resultlink);
        const when = new Date(link.racedate).getTime();
        if (base && when > g.linkWhen) {
            g.linkWhen = when;
            g.base = base;
        }
    }

    return Array.from(groups.values())
        .filter(g => g.runs >= minRuns || g.last >= recentSince)
        .sort((a, b) => (b.runs - a.runs) || (b.last - a.last))
        .map(g => ({
            name: g.name,
            runs: g.runs,
            lastDate: new Date(g.last),
            lastRacename: g.lastRacename,
            lastEvent: eventNumberOf(g.lastRacename) && isFinite(g.last)
                ? { eventNumber: eventNumberOf(g.lastRacename), day: new Date(g.last).toISOString().slice(0, 10) }
                : null,
            location: g.location,
            latestUrl: g.base ? latestResultsUrl(g.base) : null
        }));
}

// parkrun puts the event name, number and date in its own header markup rather
// than anywhere the generic parser would look, so pull them out when they are
// there. Returns null for any other site.
function parkrunMetadata(html) {
    const $ = cheerio.load(html);
    const resultsHeader = $('.Results-header h1').text().trim();
    if (!resultsHeader) return null;

    const dateText = $('.Results-header h3 .format-date').text().trim();
    const eventNumber = $('.Results-header h3 span:last-child').text().trim().replace('#', '');

    // parkrun writes DD/MM/YYYY on some sites and YYYY-MM-DD on others
    // (parkrun.us, since 2026)
    let raceDate, raceDay;
    const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dateText);
    const ymd = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(dateText);
    const parts = dmy ? { year: dmy[3], month: dmy[2], day: dmy[1] } : ymd ? { year: ymd[1], month: ymd[2], day: ymd[3] } : null;
    if (parts) {
        raceDate = new Date(parseInt(parts.year), parseInt(parts.month) - 1, parseInt(parts.day));
        // The day as written, which no time zone can move (the parkrun check)
        raceDay = parts.year + '-' + parts.month.padStart(2, '0') + '-' + parts.day.padStart(2, '0');
    }

    return {
        pageTitle: eventNumber ? `${resultsHeader} #${eventNumber}` : resultsHeader,
        raceDate: raceDate,
        raceDay: raceDay,
        eventNumber: /^\d+$/.test(eventNumber) ? parseInt(eventNumber, 10) : null
    };
}

module.exports = {
    MIN_RUNS, RECENT_DAYS,
    eventBase, latestResultsUrl, eventResultsUrl, dateResultsUrl, linkVariants, buildList,
    dayTime, eventNumberOf, parkrunMetadata
};
