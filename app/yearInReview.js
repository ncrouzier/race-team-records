// A year in review: a member's year (their races, highlights, teammates) or
// the team's. Pure: given the results (and the rest) loaded by
// app/yearInReviewRoutes.js, it works out the figures the page
// (public/views/yearInReview.html) and the share image
// (app/yearInReviewImage.js) show. Times are in centiseconds, as stored.

const raceLocations = require('../config/locations');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FIRST_YEAR = 2013; // the team's first season

function idOf(x) {
    return x && x._id !== undefined ? String(x._id) : String(x);
}

// "MD" -> "Maryland", "AUT" -> "Austria" (config/locations.js)
const PLACE_NAMES = {};
raceLocations.states.forEach(s => { PLACE_NAMES['state:' + s.code] = s.name; });
raceLocations.countries.forEach(c => { PLACE_NAMES['country:' + c.code] = c.name; });
function placeName(kind, code) {
    if (kind === 'country' && code === 'USA') return 'United States';
    return PLACE_NAMES[kind + ':' + code] || code;
}

function fullName(m) {
    return ((m && m.firstname) || '') + ' ' + ((m && m.lastname) || '');
}

// The years a review can be asked for: the team's first to this one
function validYear(year, now) {
    const y = Number(year);
    const current = (now || new Date()).getUTCFullYear();
    return Number.isInteger(y) && y >= FIRST_YEAR && y <= current ? y : null;
}

// Miles of one result, as the Statistics pages count them: a multisport
// result its running legs, a variable distance the result's own miles
function resultMiles(result) {
    const race = result.race || {};
    if (result.legs && result.legs.length) {
        return result.legs.reduce((sum, leg) => sum + (leg.legType === 'run' && leg.miles ? leg.miles : 0), 0);
    }
    if (race.racetype && race.racetype.isVariable && result.miles) return result.miles;
    return race.racetype && race.racetype.miles ? race.racetype.miles : 0;
}

// "5k (road)", or the race's own name for a variable distance
function distanceName(race) {
    const type = (race && race.racetype) || {};
    if (type.isVariable && race.distanceName) return race.distanceName;
    return type.name ? type.name + (type.surface ? ' (' + type.surface + ')' : '') : '';
}

// Where it was run: a US state ("MD") or a country ("France")
function placeOf(race) {
    const loc = (race && race.location) || {};
    if (loc.state) return { kind: 'state', name: loc.state };
    if (loc.country) return { kind: 'country', name: loc.country };
    return null;
}

function raceRef(result) {
    const race = result.race || {};
    return {
        resultId: idOf(result),
        raceId: race._id ? idOf(race) : null,
        racename: race.racename,
        racedate: race.racedate
    };
}

function monthOf(result) {
    return new Date(result.race.racedate).getUTCMonth();
}

function countBy(list, key) {
    const map = new Map();
    list.forEach(item => {
        const k = key(item);
        if (k == null) return;
        map.set(k, (map.get(k) || 0) + 1);
    });
    return map;
}

// The busiest month, from twelve counts: the first of the highest
function busiest(months) {
    let best = -1;
    months.forEach((n, i) => { if (n > 0 && (best === -1 || n > months[best])) best = i; });
    return best === -1 ? null : { month: MONTHS[best], index: best, count: months[best] };
}

// The US states and the countries raced in: [{ code, name }] by name. A
// state counts the United States among the countries.
function placesIn(results) {
    const states = new Map();
    const countries = new Map();
    results.forEach(r => {
        const place = placeOf(r.race);
        if (!place) return;
        if (place.kind === 'state') {
            states.set(place.name, placeName('state', place.name));
            countries.set('USA', placeName('country', 'USA'));
        } else {
            countries.set(place.name, placeName('country', place.name));
        }
    });
    const list = map => [...map].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name));
    return { states: list(states), countries: list(countries) };
}

function placeKeys(results) {
    const keys = new Set();
    results.forEach(r => {
        const place = placeOf(r.race);
        if (place) keys.add(place.kind + ':' + place.name);
    });
    return keys;
}

// The places in `results` never raced in `before`
function newPlaces(results, before) {
    const seen = placeKeys(before);
    const fresh = [];
    const added = new Set();
    results.forEach(r => {
        const place = placeOf(r.race);
        if (!place) return;
        const key = place.kind + ':' + place.name;
        if (seen.has(key) || added.has(key)) return;
        added.add(key);
        fresh.push(placeName(place.kind, place.name));
    });
    return fresh;
}

function byDate(a, b) {
    return new Date(a.race.racedate) - new Date(b.race.racedate) || (a.race.order || 0) - (b.race.order || 0);
}

// A result's achievements of one kind, for this member (or the result's
// own when they carry no member: a team record, a one-runner result)
function achievementsFor(result, name, memberId) {
    return (result.achievements || []).filter(a => {
        if (a.name !== name) return false;
        const owner = a.value && a.value.memberId;
        return !memberId || !owner || String(owner) === memberId;
    });
}

// Miles as something to picture: the biggest comparison that fits
function milesLike(miles) {
    const as = (n, one, many) => {
        const x = n >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
        return { count: x, text: x === 1 ? one : many };
    };
    if (miles >= 2800) return as(miles / 2800, 'trip across the USA', 'trips across the USA');
    if (miles >= 225) return as(miles / 225, 'trip from DC to New York', 'trips from DC to New York');
    if (miles >= 64) return as(miles / 64, 'lap of the Capital Beltway', 'laps of the Capital Beltway');
    if (miles >= 26.2) return as(miles / 26.2, 'marathon', 'marathons');
    if (miles > 0) return as(miles / 3.1, '5K', '5Ks');
    return null;
}

// Calories burned racing (about 100 kcal a mile) as something to eat: the
// share image's "Fuel burned" line, its food picked on the page
const FOODS = [
    { key: 'poptart', one: 'strawberry Pop-Tart', many: 'strawberry Pop-Tarts', kcal: 190 },
    { key: 'donut', one: 'glazed donut', many: 'glazed donuts', kcal: 190 },
    { key: 'pizza', one: 'slice of pizza', many: 'slices of pizza', kcal: 285 },
    { key: 'bagel', one: 'bagel', many: 'bagels', kcal: 280 },
    { key: 'banana', one: 'banana', many: 'bananas', kcal: 105 },
    { key: 'cookie', one: 'chocolate chip cookie', many: 'chocolate chip cookies', kcal: 160 },
    { key: 'beer', one: 'beer', many: 'beers', kcal: 150 },
    { key: 'waffle', one: 'Honey Stinger waffle', many: 'Honey Stinger waffles', kcal: 140 },
    { key: 'gu', one: 'GU energy gel', many: 'GU energy gels', kcal: 100 },
    { key: 'maurten', one: 'Maurten Gel 100', many: 'Maurten Gel 100s', kcal: 100 },
    { key: 'sis', one: 'SiS isotonic gel', many: 'SiS isotonic gels', kcal: 87 },
    { key: 'spring', one: 'Spring Awesome Sauce gel', many: 'Spring Awesome Sauce gels', kcal: 18 }
];
const KCAL_PER_MILE = 100;

function foodBurned(miles, key) {
    const food = FOODS.find(f => f.key === key) || FOODS[0];
    const count = Math.round(miles * KCAL_PER_MILE / food.kcal);
    return count >= 1 ? { key: food.key, count, text: count === 1 ? food.one : food.many } : null;
}

const PLACES = ['overall', 'gender', 'age'];

// Their races with a place, to pick the share image's "Best race" from:
// their own results (not a relay team's), each with the places it has
function raceChoices(results) {
    const choices = [];
    results.forEach(r => {
        if ((r.members || []).length > 1) return;
        const k = r.ranking || {};
        const places = {};
        [['overall', k.overallrank, k.overalltotal], ['gender', k.genderrank, k.gendertotal], ['age', k.agerank, k.agetotal]]
            .forEach(([kind, rank, total]) => {
                if (rank >= 1 && (!total || rank <= total)) places[kind] = { rank, total: total || null };
            });
        if (Object.keys(places).length) {
            choices.push(Object.assign(raceRef(r), { distance: distanceName(r.race), time: r.time, places }));
        }
    });
    return choices;
}

// The best guess: the place that puts them furthest up its field (a field of
// ten or more), overall first on a tie; else their best place anywhere
function bestRace(choices) {
    let best = null;
    choices.forEach(c => {
        PLACES.forEach((kind, order) => {
            const p = c.places[kind];
            if (!p) return;
            const share = p.total >= 10 ? p.rank / p.total : 1 + p.rank / 1000;
            if (!best || share < best.share || (share === best.share && order < best.order)) {
                best = { resultId: c.resultId, place: kind, share, order };
            }
        });
    });
    return best ? { resultId: best.resultId, place: best.place } : null;
}

// A race and place, as the image and page show them
function racePlace(choices, resultId, place) {
    const c = choices.find(x => x.resultId === String(resultId));
    const p = c && c.places[place];
    if (!p) return null;
    const out = Object.assign({}, c, { place, rank: p.rank, total: p.total });
    delete out.places;
    return out;
}

// Their fastest pace over a mile or more, on their own results: seconds a mile
function fastestPace(results) {
    let best = null;
    results.forEach(r => {
        if ((r.members || []).length > 1 || (r.legs && r.legs.length) || (r.race && r.race.isMultisport) || !r.time) return;
        const miles = resultMiles(r);
        if (miles < 1) return;
        const pace = r.time / 100 / miles;
        if (!best || pace < best.pace) best = Object.assign(raceRef(r), { pace: Math.round(pace), distance: distanceName(r.race) });
    });
    return best;
}

// A time from centiseconds: "17:21", "1:24:39"
function clock(centiseconds) {
    const total = Math.round(centiseconds / 100);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = total % 60;
    const two = n => (n < 10 ? '0' : '') + n;
    return h ? h + ':' + two(m) + ':' + two(sec) : m + ':' + two(sec);
}

// "12h 22m"
function hoursMinutes(centiseconds) {
    const minutes = Math.round(centiseconds / 6000);
    const h = Math.floor(minutes / 60);
    return h ? h + 'h ' + (minutes % 60) + 'm' : minutes + 'm';
}

function listing(names) {
    return names.length <= 2 ? names.join(' and ') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
}

function isSolo(r) {
    return (r.members || []).length <= 1;
}

// The biggest cut to a personal best that year: a new best against their
// best before it at that distance (earlier years and earlier that year)
function pbDrop(results, earlier, memberId) {
    let best = null;
    results.forEach(r => {
        if (!achievementsFor(r, 'pb', memberId).length || !r.time) return;
        const key = distanceName(r.race);
        const day = new Date(r.race.racedate);
        const before = earlier.concat(results).filter(x => x !== r && isSolo(x) && x.time && distanceName(x.race) === key &&
            new Date(x.race.racedate) < day);
        if (!before.length) return;
        const previous = Math.min.apply(null, before.map(x => x.time));
        const drop = previous - r.time;
        if (drop > 0 && (!best || drop > best.drop)) best = Object.assign(raceRef(r), { distance: key, drop, from: previous, to: r.time });
    });
    return best;
}

// The race they ran most ("Kensington parkrun", its edition number left off), twice or more
function favoriteRace(results) {
    const counts = countBy(results, r => r.race && r.race.racename ? r.race.racename.replace(/\s*#\s*\d+\s*$/, '').trim() : null);
    let best = null;
    counts.forEach((count, name) => { if (count >= 2 && (!best || count > best.count)) best = { name, count }; });
    return best;
}

// The most months in a row with a race
function longestStreak(months) {
    let best = 0;
    let run = 0;
    months.forEach(n => { run = n > 0 ? run + 1 : 0; best = Math.max(best, run); });
    return best;
}

function ordinal(n) {
    const v = n % 100;
    return n + (v >= 11 && v <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));
}

/**
 * Where everyone on the team placed that year: member id -> { races, miles,
 * agegrade } ranks (1: the most), and how many raced. From every result of
 * the year; app/yearInReviewRoutes.js keeps it a few minutes.
 */
function teamRanks(results) {
    const tally = new Map();
    results.forEach(r => {
        const m = resultMiles(r);
        (r.members || []).forEach(member => {
            const id = idOf(member);
            const t = tally.get(id) || { races: 0, miles: 0, agegrade: 0 };
            t.races++;
            t.miles += m;
            if (isSolo(r) && r.agegrade > t.agegrade) t.agegrade = r.agegrade;
            tally.set(id, t);
        });
    });
    const all = [...tally.values()];
    const ranks = {};
    tally.forEach((t, id) => {
        const rank = key => t[key] > 0 ? 1 + all.filter(o => o[key] > t[key]).length : null;
        ranks[id] = { races: rank('races'), miles: rank('miles'), agegrade: rank('agegrade') };
    });
    return { ranks, runners: tally.size };
}

// The share image's stat line, to pick from: [{ key, label, text }] — the
// ones that apply to this member's year, in the order of the default pick
function memberStats(y, results, earlier, data) {
    const stats = [];
    const add = (key, label, text) => stats.push({ key, label, text });

    const drop = pbDrop(results, earlier, y.member._id);
    if (drop) {
        const secs = Math.round(drop.drop / 100);
        add('pbdrop', 'Biggest PB drop', 'Cut ' + (secs < 60 ? secs + ' second' + (secs === 1 ? '' : 's') : clock(drop.drop)) + ' off their ' + drop.distance + ' best');
    }

    const team = data.teamRanks;
    const mine = team && team.ranks[y.member._id];
    if (mine) {
        const words = { races: 'number of races run', miles: 'miles raced', agegrade: 'best age grade' };
        const best = ['races', 'miles', 'agegrade'].filter(k => mine[k]).sort((a, b) => mine[a] - mine[b])[0];
        if (best) add('rank', 'Team rank', '#' + mine[best] + ' of ' + team.runners + ' on the team for ' + words[best]);
    }

    const favorite = favoriteRace(results);
    if (favorite) add('favorite', 'Favorite race', 'Ran ' + favorite.name + ' ' + favorite.count + ' times');

    if (y.bestAgeGrade && y.lastYear && y.lastYear.bestAgeGrade) {
        const diff = Math.round((y.bestAgeGrade.agegrade - y.lastYear.bestAgeGrade) * 10) / 10;
        // Only a better one: a lower age grade is nothing to share
        if (diff > 0) add('agegrade', 'Age grade', (diff > 0 ? '+' : '−') + Math.abs(diff).toFixed(1) + '% vs ' + (y.year - 1) +
            ' (' + y.bestAgeGrade.agegrade.toFixed(1) + '%)');
    }

    const streak = longestStreak(y.months);
    if (streak >= 2) add('streak', 'Racing streak', streak === 12 ? 'Raced every month of the year' : 'Raced ' + streak + ' months in a row');

    if (y.totals.newPlaces.length) {
        add('newplaces', 'New places', 'First race' + (y.totals.newPlaces.length === 1 ? '' : 's') + ' in ' + listing(y.totals.newPlaces));
    }

    if (y.teammateCount) add('teammates', 'Teammates', 'Raced alongside ' + y.teammateCount + ' teammate' + (y.teammateCount === 1 ? '' : 's'));

    if (y.totals.time) add('time', 'Time on the clock', hoursMinutes(y.totals.time) + ' of racing');

    const miles = milesLike(y.totals.miles);
    if (miles) add('miles', 'That\'s', Math.round(y.totals.miles).toLocaleString('en-US') + ' miles = ' + miles.count.toLocaleString('en-US') + ' ' + miles.text);
    return stats;
}

// The fun side of a member's year, for the page and the share image
function memberFun(y, results, earlier, data) {
    const choices = raceChoices(results);
    const guess = bestRace(choices);
    const stats = memberStats(y, results, earlier, data);
    return {
        miles: milesLike(y.totals.miles),
        food: foodBurned(y.totals.miles, FOODS[0].key),
        raceChoices: choices,
        bestRace: guess,
        race: guess ? racePlace(choices, guess.resultId, guess.place) : null,
        fastestPace: fastestPace(results),
        stats,
        stat: stats[0] || null
    };
}

/**
 * A member's year with their picks for the share image: the best race and
 * which place ({ race: resultId, place: overall|gender|age }) and the food
 * (FOODS key). Anything not theirs or unknown keeps the best guess.
 */
function withChoices(y, picks) {
    picks = picks || {};
    const fun = Object.assign({}, y.fun);
    const choices = fun.raceChoices || [];
    let pick = fun.bestRace;
    const picked = picks.race && choices.find(c => c.resultId === String(picks.race));
    if (picked) {
        const place = PLACES.indexOf(picks.place) !== -1 && picked.places[picks.place] ? picks.place
            : PLACES.find(k => picked.places[k]);
        pick = { resultId: picked.resultId, place };
    } else if (pick && PLACES.indexOf(picks.place) !== -1) {
        const c = choices.find(x => x.resultId === pick.resultId);
        if (c.places[picks.place]) pick = { resultId: pick.resultId, place: picks.place };
    }
    fun.bestRace = pick;
    fun.race = pick ? racePlace(choices, pick.resultId, pick.place) : null;
    if (picks.food && FOODS.some(f => f.key === picks.food)) fun.food = foodBurned(y.totals.miles, picks.food);
    const stat = picks.stat && (fun.stats || []).find(x => x.key === picks.stat);
    if (stat) fun.stat = stat;
    // The image's background: their racing calendar, their photo, or plain
    fun.background = ['photo', 'plain'].indexOf(picks.bg) !== -1 ? picks.bg : 'calendar';
    return Object.assign({}, y, { fun });
}

// And the team's
function teamFun(y) {
    const ace = y.leaders.agegrade[0];
    const turnout = y.biggestTurnouts[0];
    const busiest = y.leaders.races[0];
    return {
        mostRaces: busiest ? { name: busiest.name, username: busiest.username, races: busiest.value,
            // Tied at the top: everyone with as many
            others: y.leaders.races.filter(l => l !== busiest && l.value === busiest.value).map(l => l.name) } : null,
        miles: milesLike(y.totals.miles),
        food: foodBurned(y.totals.miles, FOODS[0].key),
        ace: ace ? { name: ace.name, username: ace.username, agegrade: ace.value } : null,
        turnout: turnout ? { racename: turnout.racename, raceId: turnout.raceId, runners: turnout.runners } : null
    };
}

/**
 * A member's year.
 * data: {
 *   member,            the member (with achievements: their awards)
 *   year,
 *   results,           their results that year
 *   earlier,           their results before that year (race location, date, time, agegrade)
 *   lastYear,          their results the year before (subset of earlier, or [])
 *   raceResults,       every team result at the races they ran that year (for teammates)
 *   volunteerJobs,     their volunteer jobs that year
 *   teamRanks,         teamRanks() of the year (optional: the "Team rank" stat)
 *   now
 * }
 */
function memberYear(data) {
    const member = data.member;
    const memberId = idOf(member);
    const year = data.year;
    const results = (data.results || []).slice().sort(byDate);
    const earlier = data.earlier || [];
    const now = data.now || new Date();

    const months = new Array(12).fill(0);
    let miles = 0;
    let time = 0;
    let longest = null;
    results.forEach(r => {
        months[monthOf(r)]++;
        const m = resultMiles(r);
        miles += m;
        if (r.time) time += r.time;
        if (m && (!longest || m > longest.miles)) longest = Object.assign(raceRef(r), { miles: m, distance: distanceName(r.race) });
    });

    const distances = countBy(results, r => distanceName(r.race) || null);
    let mostRun = null;
    distances.forEach((count, name) => { if (!mostRun || count > mostRun.count) mostRun = { name, count }; });

    let bestAgeGrade = null;
    results.forEach(r => {
        if (r.agegrade && (!bestAgeGrade || r.agegrade > bestAgeGrade.agegrade)) {
            bestAgeGrade = Object.assign(raceRef(r), { agegrade: r.agegrade, distance: distanceName(r.race) });
        }
    });

    // Personal bests set: the fastest at each distance that year
    const pbs = new Map();
    results.forEach(r => {
        if (!achievementsFor(r, 'pb', memberId).length) return;
        const key = distanceName(r.race);
        const prev = pbs.get(key);
        if (!prev || r.time < prev.time) pbs.set(key, Object.assign(raceRef(r), { distance: key, time: r.time }));
    });

    const teamRecords = [];
    results.forEach(r => {
        achievementsFor(r, 'teamRecord', null).forEach(a => {
            teamRecords.push(Object.assign(raceRef(r), { text: a.text, time: r.time, distance: distanceName(r.race) }));
        });
    });

    const milestones = [];
    results.forEach(r => {
        achievementsFor(r, 'raceCount', memberId).forEach(a => {
            if (a.value && a.value.raceCount) milestones.push(Object.assign(raceRef(r), { count: a.value.raceCount }));
        });
    });

    const birthdayRaces = results.filter(r => achievementsFor(r, 'birthday', memberId).length).map(raceRef);

    // Places: only their own (a one-runner result), not a relay team's
    const solo = results.filter(r => (r.members || []).length <= 1);
    const ranking = { wins: 0, overallPodiums: 0, genderWins: 0, genderPodiums: 0, ageWins: 0 };
    solo.forEach(r => {
        const k = r.ranking || {};
        if (k.overallrank === 1) ranking.wins++;
        if (k.overallrank >= 1 && k.overallrank <= 3) ranking.overallPodiums++;
        if (k.genderrank === 1) ranking.genderWins++;
        if (k.genderrank >= 1 && k.genderrank <= 3) ranking.genderPodiums++;
        if (k.agerank === 1) ranking.ageWins++;
    });

    // Teammates: everyone else with a result at the same races
    const raceIds = new Set(results.map(r => r.race && r.race._id && idOf(r.race)).filter(Boolean));
    const together = new Map();
    (data.raceResults || []).forEach(r => {
        if (!r.race || !raceIds.has(idOf(r.race))) return;
        (r.members || []).forEach(m => {
            const id = idOf(m);
            if (id === memberId) return;
            const entry = together.get(id) || { memberId: id, username: m.username, firstname: m.firstname, lastname: m.lastname, name: fullName(m).trim(), races: new Set() };
            entry.races.add(idOf(r.race));
            together.set(id, entry);
        });
    });
    const teammates = [...together.values()]
        .map(t => ({ _id: t.memberId, memberId: t.memberId, username: t.username, firstname: t.firstname, lastname: t.lastname, name: t.name, count: t.races.size }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .slice(0, 5);

    const last = data.lastYear || [];
    const lastAgeGrade = last.reduce((best, r) => Math.max(best, r.agegrade || 0), 0);
    const awards = (member.achievements || [])
        .filter(a => (String(a.text || '') + ' ' + String(a.name || '')).indexOf(String(year)) !== -1)
        .map(a => ({ name: a.name, text: a.text }));

    const out = {
        kind: 'member',
        year,
        partial: year === now.getUTCFullYear(),
        member: {
            _id: memberId,
            firstname: member.firstname,
            lastname: member.lastname,
            username: member.username,
            sex: member.sex
        },
        firstYear: earlier.length === 0 && results.length > 0,
        totals: Object.assign({
            races: results.length,
            miles: Math.round(miles * 10) / 10,
            time,
            newPlaces: newPlaces(results, earlier)
        }, placesIn(results)),
        months,
        // The days raced: [month (0-11), day of the month, how many results]
        raceDays: [...countBy(results, r => {
            const d = new Date(r.race.racedate);
            return d.getUTCMonth() + '-' + d.getUTCDate();
        })].map(([key, count]) => key.split('-').map(Number).concat([count])),
        busiestMonth: busiest(months),
        longest,
        mostRun,
        bestAgeGrade,
        pbs: [...pbs.values()].sort((a, b) => new Date(a.racedate) - new Date(b.racedate)),
        teamRecords,
        milestones,
        birthdayRaces,
        ranking,
        teammates,
        teammateCount: together.size,
        volunteerJobs: (data.volunteerJobs || []).length,
        awards,
        lastYear: last.length ? {
            races: last.length,
            miles: Math.round(last.reduce((sum, r) => sum + resultMiles(r), 0) * 10) / 10,
            bestAgeGrade: lastAgeGrade || null
        } : null
    };
    out.fun = memberFun(out, results, earlier, data);
    return out;
}

// The top `n` of a map of member id -> { ..., value }, highest first
function top(map, n) {
    return [...map.values()].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)).slice(0, n);
}

/**
 * The team's year.
 * data: {
 *   year,
 *   results,           every result that year
 *   earlier,           earlier results (race location, members' ids) — for new places and first-timers
 *   lastYear,          the year before's results
 *   volunteerJobs,     that year's volunteer jobs
 *   members,           the members with a membership starting that year (membershipDates)
 *   now
 * }
 */
function teamYear(data) {
    const year = data.year;
    const results = (data.results || []).slice().sort(byDate);
    const earlier = data.earlier || [];
    const now = data.now || new Date();

    const months = new Array(12).fill(0);
    let miles = 0;
    let time = 0;
    const races = new Map(); // race id -> { ref, runners }
    const runners = new Map(); // member id -> per-member tallies
    let pbCount = 0;
    const teamRecords = [];
    const ranking = { wins: 0, overallPodiums: 0, genderWins: 0, genderPodiums: 0, ageWins: 0 };

    results.forEach(r => {
        months[monthOf(r)]++;
        const m = resultMiles(r);
        miles += m;
        if (r.time) time += r.time;

        const raceId = r.race && r.race._id ? idOf(r.race) : null;
        if (raceId) {
            const race = races.get(raceId) || { raceId, racename: r.race.racename, racedate: r.race.racedate, runners: 0 };
            race.runners += (r.members || []).length || 1;
            races.set(raceId, race);
        }

        (r.members || []).forEach(member => {
            const id = idOf(member);
            const t = runners.get(id) || { memberId: id, username: member.username, firstname: member.firstname, lastname: member.lastname, name: fullName(member).trim(), races: 0, miles: 0, pbs: 0, agegrade: 0, agegradeRace: null };
            t.races++;
            t.miles += m;
            if (r.agegrade && r.agegrade > t.agegrade && (r.members || []).length === 1) {
                t.agegrade = r.agegrade;
                t.agegradeRace = raceRef(r);
            }
            t.pbs += achievementsFor(r, 'pb', id).length ? 1 : 0;
            runners.set(id, t);
        });

        pbCount += (r.achievements || []).filter(a => a.name === 'pb').length;
        achievementsFor(r, 'teamRecord', null).forEach(a => {
            teamRecords.push(Object.assign(raceRef(r), { text: a.text, time: r.time, distance: distanceName(r.race),
                names: (r.members || []).map(x => fullName(x).trim()).join(', ') }));
        });

        if ((r.members || []).length <= 1) {
            const k = r.ranking || {};
            if (k.overallrank === 1) ranking.wins++;
            if (k.overallrank >= 1 && k.overallrank <= 3) ranking.overallPodiums++;
            if (k.genderrank === 1) ranking.genderWins++;
            if (k.genderrank >= 1 && k.genderrank <= 3) ranking.genderPodiums++;
            if (k.agerank === 1) ranking.ageWins++;
        }
    });

    const metric = (key, round) => {
        const map = new Map();
        runners.forEach((t, id) => {
            if (t[key] > 0) map.set(id, { _id: id, memberId: id, username: t.username, firstname: t.firstname, lastname: t.lastname, name: t.name, value: round ? Math.round(t[key] * 10) / 10 : t[key], race: key === 'agegrade' ? t.agegradeRace : undefined });
        });
        return top(map, 3);
    };

    const seenRunners = new Set();
    earlier.forEach(r => (r.members || []).forEach(m => seenRunners.add(idOf(m))));
    const firstTimers = [...runners.keys()].filter(id => !seenRunners.has(id)).length;

    const last = data.lastYear || [];
    const lastRunners = new Set();
    last.forEach(r => (r.members || []).forEach(m => lastRunners.add(idOf(m))));
    // Joined that year: new members (their first membership starts then) and
    // returning ones (a new membership after an earlier one ended, like
    // someone who left the team and came back), raced or not
    const joined = { new: [], returning: [] };
    (data.members || []).forEach(m => {
        const starts = (m.membershipDates || []).map(d => new Date(d.start)).filter(d => !isNaN(d)).sort((a, b) => a - b);
        const thisYear = starts.filter(d => d.getUTCFullYear() === year);
        if (!thisYear.length) return;
        const who = { _id: idOf(m), username: m.username, firstname: m.firstname, lastname: m.lastname, name: fullName(m).trim() };
        (starts[0].getUTCFullYear() === year ? joined.new : joined.returning).push(who);
    });
    const jobs = data.volunteerJobs || [];

    const out = {
        kind: 'team',
        year,
        partial: year === now.getUTCFullYear(),
        totals: Object.assign({
            results: results.length,
            races: races.size,
            runners: runners.size,
            firstTimers,
            newMembers: joined.new.length,
            returning: joined.returning.length,
            miles: Math.round(miles * 10) / 10,
            time,
            pbs: pbCount,
            newPlaces: newPlaces(results, earlier)
        }, placesIn(results)),
        months,
        busiestMonth: busiest(months),
        joined,
        biggestTurnouts: [...races.values()].sort((a, b) => b.runners - a.runners || new Date(a.racedate) - new Date(b.racedate)).slice(0, 3),
        leaders: {
            races: metric('races'),
            miles: metric('miles', true),
            pbs: metric('pbs'),
            agegrade: metric('agegrade')
        },
        teamRecords,
        ranking,
        volunteer: {
            jobs: jobs.length,
            volunteers: new Set(jobs.map(j => j.member && idOf(j.member)).filter(Boolean)).size
        },
        lastYear: last.length ? {
            results: last.length,
            runners: lastRunners.size,
            miles: Math.round(last.reduce((sum, r) => sum + resultMiles(r), 0) * 10) / 10
        } : null
    };
    out.fun = teamFun(out);
    return out;
}

module.exports = {
    MONTHS,
    FIRST_YEAR,
    validYear,
    resultMiles,
    distanceName,
    milesLike,
    FOODS,
    foodBurned,
    teamRanks,
    withChoices,
    memberYear,
    teamYear
};
