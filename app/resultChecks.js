// Sanity checks on a result before it is saved: obvious mistakes in the time,
// distance, places, dates, race or runners. They warn, never block: an admin
// can always save anyway (odd results are sometimes real).
//
// Pure: the routes gather what the checks compare against (the runner's best,
// the race's other results, its other editions...) in app/resultCheckRoutes.js
// and pass it in as `context`.

const MILE = 1609.344;
const DAY = 86400000;

// Age grade outside this range is almost always a typo in the time or distance
const AG_HIGH = 95;
const AG_LOW = 35;
// How much faster than the runner's best counts as suspicious
const PB_MARGIN = { trail: 0.15, ultra: 0.15, default: 0.08 };
// Pace bounds (seconds per mile) where age grading cannot judge the time
const PACE_FAST = 4.5 * 60;
const PACE_SLOW = 20 * 60;
// A new result for a race further back than this is often the wrong year
const OLD_DAYS = 60;
// Editions of a race more than this many days apart in the year
const SEASON_DAYS = 21;
// Distances within this fraction are the same distance
const DISTANCE_TOLERANCE = 0.03;

const US_STATES = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA', 'Colorado': 'CO',
    'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
    'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA',
    'Maine': 'ME', 'Maryland': 'MD', 'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN',
    'Mississippi': 'MS', 'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
    'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC',
    'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA',
    'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX',
    'Utah': 'UT', 'Vermont': 'VT', 'Virginia': 'VA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
    'District of Columbia': 'DC'
    // Not Washington: the state, the city (DC) and a dozen race names
};

function id(x) {
    return x && x._id !== undefined ? String(x._id) : (x ? String(x) : '');
}

function num(v) {
    return v === null || v === undefined || v === '' || isNaN(Number(v)) ? null : Number(v);
}

// Centiseconds → "35:54", "1:25:00"
function formatTime(cs) {
    if (!cs && cs !== 0) return '';
    const total = Math.round(cs / 100);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = n => (n < 10 ? '0' : '') + n;
    return (h ? h + ':' + pad(m) : String(m)) + ':' + pad(s);
}

function formatPace(secondsPerMile) {
    return formatTime(secondsPerMile * 100) + '/mile';
}

function day(date) {
    return new Date(date).toISOString().slice(0, 10);
}

function formatDay(date) {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function firstName(member) {
    return (member && member.firstname) || 'The runner';
}

// The race's distance in metres: its race type's, or the one given for a
// variable race type
function raceMeters(race) {
    const rt = race && race.racetype;
    return rt && num(rt.meters) > 0 ? Number(rt.meters) : null;
}

function sameDistance(a, b) {
    return Math.abs(a - b) <= DISTANCE_TOLERANCE * Math.max(a, b);
}

// Distances written in a race name: "Turkey Chase 10K" → [10000],
// "Cherry Blossom 10 (9.39) Miler" → [16093, 15111], "Half Marathon" → [21097.5].
// Relay legs (4x400) are not the race's distance.
function distancesInName(name) {
    const text = String(name || '').toLowerCase().replace(/\d+\s*x\s*\d+\s*m?\b/g, ' ');
    const found = [];
    let m;
    const km = /(\d+(?:\.\d+)?)\s*-?\s*(k|km)\b/g;
    while ((m = km.exec(text))) found.push(Number(m[1]) * 1000);
    const mi = /(\d+(?:\.\d+)?)\s*-?\s*(mi|mile|miles|miler|milers)\b/g;
    while ((m = mi.exec(text))) found.push(Number(m[1]) * MILE);
    // "10 (9.39) Miler": the number in brackets before the unit
    const bracketed = /(\d+(?:\.\d+)?)\s*\(\s*(\d+(?:\.\d+)?)\s*\)\s*(mi|mile|miles|miler|milers)\b/g;
    while ((m = bracketed.exec(text))) found.push(Number(m[1]) * MILE, Number(m[2]) * MILE);
    const metres = /\b(\d{3,5})\s*m\b/g;
    while ((m = metres.exec(text))) found.push(Number(m[1]));
    if (/\bhalf[\s-]*marathon\b|\bhalf\b/.test(text)) found.push(21097.5);
    else if (/\bmarathon\b/.test(text)) found.push(42195);
    return found;
}

// States named in a race name ("Philadelphia Marathon" names none)
function statesInName(name) {
    const text = String(name || '');
    const found = [];
    // Longest names first: "West Virginia" is not Virginia
    Object.keys(US_STATES).sort((a, b) => b.length - a.length).forEach(stateName => {
        const re = new RegExp('\\b' + stateName.replace(/ /g, '\\s+') + '\\b', 'i');
        if (re.test(text) && !found.some(f => f.name.indexOf(stateName) !== -1)) {
            found.push({ name: stateName, code: US_STATES[stateName] });
        }
    });
    return found;
}

// Runners a relay needs: "4x400" → 4, a "relay" without a count → 2 or more
function relayRunners(race) {
    const text = [race.racename, race.racetype && race.racetype.name, race.distanceName].join(' ').toLowerCase();
    const m = /(\d+)\s*x\s*\d+/.exec(text);
    if (m) return { exactly: Number(m[1]) };
    if (/\brelay\b/.test(text)) return { atLeast: 2 };
    return null;
}

function isParkrun(name) {
    return /\bparkrun\b/i.test(String(name || ''));
}

// parkrun runs on Saturdays, plus Thanksgiving, Christmas and New Year's Day
function parkrunDay(date) {
    const d = new Date(date);
    if (d.getUTCDay() === 6) return true;
    const month = d.getUTCMonth();
    const dom = d.getUTCDate();
    if ((month === 11 && dom === 25) || (month === 0 && dom === 1)) return true;
    // Thanksgiving: the fourth Thursday of November
    return month === 10 && d.getUTCDay() === 4 && dom >= 22 && dom <= 28;
}

// Days between two dates' places in the year (wrapping around New Year)
function daysApartInYear(a, b) {
    const doy = d => {
        const date = new Date(d);
        return (Date.UTC(2001, date.getUTCMonth(), date.getUTCDate()) - Date.UTC(2001, 0, 1)) / DAY;
    };
    const diff = Math.abs(doy(a) - doy(b));
    return Math.min(diff, 365 - diff);
}

function age(raceDate, dob) {
    const race = new Date(raceDate);
    const birth = new Date(dob);
    let years = race.getUTCFullYear() - birth.getUTCFullYear();
    const m = race.getUTCMonth() - birth.getUTCMonth();
    if (m < 0 || (m === 0 && race.getUTCDate() < birth.getUTCDate())) years--;
    return years;
}

/**
 * result: what the form would save ({ race, members, time, ranking, legs, _id })
 * context: {
 *   now: Date,
 *   isNew: true for a new result (not an edit),
 *   members: the runners in full ({ _id, firstname, sex, dateofbirth, membershipDates }),
 *   ageGrades: { memberId: the age grade this time gives, or null (no standard) },
 *   bests: { memberId: their best at this race type: { time, racename, racedate } },
 *   sameDay: other results of these runners that day: [{ memberId, racename }],
 *   raceResults: the other results in the race it would be saved to,
 *   sameNameRaces: races with this name and date but other details,
 *   editions: the race's other editions (its series, or races of the same name)
 * }
 * Returns [{ code, level: 'warning' | 'danger', message, race? }]
 */
function checkResult(result, context) {
    const out = [];
    const ctx = context || {};
    const race = result.race || {};
    const members = ctx.members || [];
    const time = num(result.time);
    const ranking = result.ranking || {};
    const meters = raceMeters(race);
    const surface = race.racetype && race.racetype.surface;
    const multisport = !!race.isMultisport || surface === 'multiple';
    const now = ctx.now ? new Date(ctx.now) : new Date();
    const solo = members.length === 1;
    function add(code, message, extra) {
        out.push(Object.assign({ code: code, level: 'warning', message: message }, extra || {}));
    }

    // 1. Age grade out of range
    if (solo && time) {
        const ag = ctx.ageGrades && ctx.ageGrades[id(members[0])];
        if (ag !== null && ag !== undefined) {
            if (ag > 100) add('agegrade-high', 'Age grade ' + ag.toFixed(1) + '%: faster than the world record. Is the time missing its hours, or the distance wrong?', { level: 'danger' });
            else if (ag > AG_HIGH) add('agegrade-high', 'Age grade ' + ag.toFixed(1) + '%: world class. Check the time and the distance.');
            else if (ag < AG_LOW) add('agegrade-low', 'Age grade ' + ag.toFixed(1) + '%: unusually low. Was the time typed in the wrong unit (1:25 for 1:25:00)?');
        }
    }

    // 2. Much faster than the runner's best at this distance
    if (solo && time && !multisport) {
        const best = ctx.bests && ctx.bests[id(members[0])];
        const margin = PB_MARGIN[surface] || PB_MARGIN.default;
        if (best && best.time && time < best.time * (1 - margin)) {
            const pct = Math.round((1 - time / best.time) * 100);
            add('faster-than-best', pct + '% faster than ' + firstName(members[0]) + '\'s best at this distance (' +
                formatTime(best.time) + ', ' + best.racename + ', ' + formatDay(best.racedate) + '). Check the distance.');
        }
    }

    // 3. Pace bounds where age grading cannot judge the time
    if (time && meters && !multisport) {
        const ag = solo && ctx.ageGrades ? ctx.ageGrades[id(members[0])] : null;
        const variable = race.racetype && race.racetype.isVariable;
        if (ag === null || ag === undefined || variable || surface === 'trail' || surface === 'ultra') {
            const pace = (time / 100) / (meters / MILE);
            if (pace < PACE_FAST) add('pace-fast', 'Pace ' + formatPace(pace) + ': too fast for this distance. Check the time and the distance.');
            else if (pace > PACE_SLOW) add('pace-slow', 'Pace ' + formatPace(pace) + ': very slow for a race. Check the time and the distance.');
        }
    }

    // 4. Multisport legs that do not add up to the total
    if (multisport && time && Array.isArray(result.legs) && result.legs.length) {
        const sum = result.legs.reduce((s, leg) => s + (num(leg.time) || 0), 0);
        if (sum > 0 && Math.abs(sum - time) > 0.01 * time) {
            add('legs-sum', 'The legs add up to ' + formatTime(sum) + ', the total is ' + formatTime(time) + '.');
        }
    }

    // 5. Places that do not fit together
    const places = [['agerank', 'agetotal', 'Age group'], ['genderrank', 'gendertotal', 'Gender'], ['overallrank', 'overalltotal', 'Overall']];
    places.forEach(([rank, total, label]) => {
        if (num(ranking[rank]) && num(ranking[total]) && num(ranking[rank]) > num(ranking[total])) {
            add('place-over-total', label + ' place ' + ranking[rank] + ' is more than its ' + ranking[total] + ' finishers.');
        }
    });
    for (let i = 0; i < places.length - 1; i++) {
        const [r1, t1, l1] = places[i];
        const [r2, t2, l2] = places[i + 1];
        if (num(ranking[r1]) && num(ranking[r2]) && num(ranking[r1]) > num(ranking[r2])) {
            add('places-order', l1 + ' place (' + ranking[r1] + ') can\'t be worse than ' + l2.toLowerCase() + ' place (' + ranking[r2] + '). Were they typed in the wrong boxes?');
        }
        if (num(ranking[t1]) && num(ranking[t2]) && num(ranking[t1]) > num(ranking[t2])) {
            add('totals-order', l1 + ' finishers (' + ranking[t1] + ') can\'t be more than ' + l2.toLowerCase() + ' finishers (' + ranking[t2] + ').');
        }
    }

    // 6. A different overall finisher count from teammates in the same race
    const others = (ctx.raceResults || []).filter(r => id(r) !== id(result));
    const totals = others.map(r => num(r.ranking && r.ranking.overalltotal)).filter(Boolean);
    if (num(ranking.overalltotal) && totals.length) {
        const usual = mostCommon(totals);
        if (usual !== num(ranking.overalltotal)) {
            add('overall-total', 'Teammates in this race have ' + usual + ' overall finishers, not ' + ranking.overalltotal + '.');
        }
    }

    // 7. Outside the runner's team membership
    if (race.racedate) {
        members.forEach(m => {
            const periods = m.membershipDates || [];
            if (!periods.length) return;
            const t = new Date(race.racedate).getTime();
            const inside = periods.some(p => (!p.start || new Date(p.start).getTime() <= t + DAY) && (!p.end || t <= new Date(p.end).getTime() + DAY));
            if (!inside) add('membership', firstName(m) + ' wasn\'t on the team on ' + formatDay(race.racedate) + '. The wrong runner, or the wrong date?');
        });
    }

    // 8. Future, or old for a new result
    if (race.racedate) {
        const raceDay = new Date(race.racedate).getTime();
        if (raceDay > now.getTime() + DAY) {
            add('future', 'The race date ' + formatDay(race.racedate) + ' is in the future.', { level: 'danger' });
        } else if (ctx.isNew && raceDay < now.getTime() - OLD_DAYS * DAY) {
            add('old', 'The race was ' + Math.round((now.getTime() - raceDay) / DAY) + ' days ago. Is the year right?');
        }
    }

    // 9. The same runner in another result that day
    (ctx.sameDay || []).forEach(r => {
        const m = members.find(x => id(x) === String(r.memberId));
        add('same-day', firstName(m) + ' already has a result that day: ' + r.racename + '. A duplicate?');
    });

    // 10. A parkrun on the wrong day
    if (isParkrun(race.racename) && race.racedate && !parkrunDay(race.racedate)) {
        add('parkrun-day', 'parkruns are on Saturdays: ' + formatDay(race.racedate) + ' is a ' +
            new Date(race.racedate).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }) + '.');
    }

    // 11. A race with this name and date but other details: saving makes a near copy
    (ctx.sameNameRaces || []).forEach(r => {
        const what = [];
        if (r.location && race.location && (r.location.state || '') !== (race.location.state || '')) what.push('state ' + (r.location.state || r.location.country));
        if (r.racetype && race.racetype && id(r.racetype) !== id(race.racetype)) what.push(r.racetype.name);
        if ((r.distanceName || '') !== (race.distanceName || '') && r.distanceName) what.push('"' + r.distanceName + '"');
        add('near-duplicate-race', '"' + r.racename + '" on this date is already on the site' + (what.length ? ' (' + what.join(', ') + ')' : '') +
            ' but differs from this one: saving makes a second race.', { race: r });
    });

    // 12. Different from the race's other editions
    const editions = (ctx.editions || []).filter(e => id(e) !== id(race));
    if (editions.length && race.racedate) {
        const states = new Set(editions.map(e => e.location && (e.location.state || e.location.country)).filter(Boolean));
        const here = race.location && (race.location.state || race.location.country);
        if (here && states.size && !states.has(here)) {
            add('edition-place', 'Other editions of this race were in ' + Array.from(states).join(', ') + ', not ' + here + '.');
        }
        const editionMeters = editions.map(raceMeters).filter(Boolean);
        if (meters && editionMeters.length && !multisport && !editionMeters.some(m => sameDistance(m, meters))) {
            const usual = mostCommon(editionMeters.map(m => Math.round(m)));
            const usualName = (editions.find(e => Math.round(raceMeters(e)) === usual) || {}).racetype;
            add('edition-distance', 'Other editions of this race were ' + (usualName ? usualName.name : Math.round(usual) + 'm') + ', not ' + (race.racetype ? race.racetype.name : '') + '.');
        }
        if (!isParkrun(race.racename)) {
            const nearest = Math.min.apply(null, editions.map(e => daysApartInYear(e.racedate, race.racedate)));
            if (nearest > SEASON_DAYS) {
                const latest = editions.slice().sort((a, b) => new Date(b.racedate) - new Date(a.racedate))[0];
                add('edition-date', 'Other editions of this race were at another time of year (last one ' + formatDay(latest.racedate) + ').');
            }
        }
    }

    // 13. A state named in the race name, another one picked
    if (race.location && race.location.country === 'USA' && race.location.state) {
        const named = statesInName(race.racename);
        if (named.length && !named.some(s => s.code === race.location.state)) {
            add('state-in-name', 'The name says ' + named.map(s => s.name).join(' / ') + ', the state picked is ' + race.location.state + '.');
        }
    }

    // 14. A distance in the race name that is not the distance picked
    if (meters && !multisport) {
        const named = distancesInName(race.racename);
        if (named.length && !named.some(d => sameDistance(d, meters))) {
            add('distance-in-name', 'The name says ' + describeMeters(named[0]) + ', the distance picked is ' +
                (race.distanceName || (race.racetype && race.racetype.name)) + '.');
        }
    }

    // 15. A relay with the wrong number of runners, or a solo race with several
    const relay = relayRunners(race);
    if (relay && relay.exactly && members.length && members.length !== relay.exactly) {
        add('relay-runners', 'A ' + relay.exactly + '-runner relay with ' + members.length + ' runner' + (members.length === 1 ? '' : 's') + '.');
    } else if (relay && relay.atLeast && members.length === 1) {
        add('relay-runners', 'A relay with one runner.');
    } else if (!relay && !multisport && members.length > 1) {
        add('relay-runners', members.length + ' runners on one result, and the race isn\'t a relay.');
    }

    // 16. Gender finishers that do not fit teammates' (the other sex's count,
    // or a different one from the same sex), and runners the site can't age grade
    if (solo && num(ranking.gendertotal)) {
        const me = members[0];
        others.forEach(r => {
            const them = r.members && r.members.length === 1 ? r.members[0] : null;
            const theirs = num(r.ranking && r.ranking.gendertotal);
            if (!them || !theirs || !me.sex || !them.sex) return;
            const sameSex = String(them.sex).toLowerCase() === String(me.sex).toLowerCase();
            if (sameSex && theirs !== num(ranking.gendertotal)) {
                add('gender-total', firstName(them) + ' (same gender) has ' + theirs + ' gender finishers, not ' + ranking.gendertotal + '.');
            } else if (!sameSex && theirs === num(ranking.gendertotal) && theirs !== num(ranking.overalltotal)) {
                add('gender-total', 'Gender finishers (' + theirs + ') match ' + firstName(them) + '\'s, of the other gender. The wrong column?');
            }
        });
    }
    members.forEach(m => {
        if (!m.sex || !m.dateofbirth) add('runner-details', firstName(m) + ' has no ' + (!m.sex ? 'gender' : 'date of birth') + ' on the site: no age grade.');
        else if (race.racedate) {
            const a = age(race.racedate, m.dateofbirth);
            if (a < 5 || a > 100) add('runner-age', firstName(m) + ' would be ' + a + ' on race day. Check the date of birth or the race date.');
        }
    });

    // One message per code and text (several teammates can say the same)
    const seen = new Set();
    return out.filter(w => {
        const key = w.code + '|' + w.message;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function mostCommon(values) {
    const counts = new Map();
    values.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
    let best = null;
    let bestN = 0;
    counts.forEach((n, v) => { if (n > bestN) { best = v; bestN = n; } });
    return best;
}

function describeMeters(m) {
    if (sameDistance(m, 42195)) return 'a marathon';
    if (sameDistance(m, 21097.5)) return 'a half marathon';
    if (Math.abs(m / MILE - Math.round(m / MILE)) < 0.02) return Math.round(m / MILE) + ' mile' + (Math.round(m / MILE) === 1 ? '' : 's');
    if (m % 1000 === 0) return (m / 1000) + 'K';
    return Math.round(m) + 'm';
}

module.exports = {
    checkResult,
    distancesInName,
    statesInName,
    parkrunDay,
    daysApartInYear,
    relayRunners,
    formatTime
};
