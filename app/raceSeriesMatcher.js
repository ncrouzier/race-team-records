// Decides which races are editions of the same race. Pure functions only: the
// backfill migration and the race-creation hook both build on these.
//
// Deliberately no date-of-year check: races move (Boston was once in October).

// "Cherry Blossom 10 (9.39) Miler 2015" and "Cherry Blossom 10 Miler" both become
// "cherry blossom 10 mile". Distance words are kept: they are what tells
// "Going Green Track Meet 1 Mile" from "Going Green Track Meet 4x400".
function normalizeRaceName(name) {
    return String(name || '')
        .normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[‘’“”"]/g, '\'')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/#\s*\d+/g, ' ')
        .replace(/\b(19|20)\d{2}\b/g, ' ')
        .replace(/\b\d+(st|nd|rd|th)\b/g, ' ')
        .replace(/\b(annual|the)\b/g, ' ')
        .replace(/'/g, '')
        .replace(/[^a-z0-9.]+/g, ' ')
        .replace(/(^|\s)\.|\.(\s|$)/g, ' ')
        .replace(/\b(\d+(?:\.\d+)?)\s+(k|mi)\b/g, '$1$2')
        .replace(/\b(milers?|miles)\b/g, 'mile')
        .replace(/\s+/g, ' ')
        .trim();
}

// "Kensington parkrun #313" -> "Kensington parkrun", "parkrun de Montsouris #46" ->
// "parkrun de Montsouris"; null for anything that is not a parkrun.
function parkrunName(name) {
    if (!/\bparkrun\b/i.test(name || '')) return null;
    return name.replace(/#\s*\d+/g, ' ').replace(/[‘’]/g, '\'').replace(/\s+/g, ' ').trim();
}

// The key two races must share to be editions of one series.
function seriesKey(race) {
    const parkrun = parkrunName(race.racename);
    return parkrun ? normalizeRaceName(parkrun) : normalizeRaceName(race.racename);
}

function locationKey(race) {
    const loc = race.location || {};
    if (!loc.state && !loc.country) return '';
    return (loc.country || '') + '|' + (loc.state || '');
}

function locationLabel(key) {
    const [country, state] = key.split('|');
    return state || country;
}

function isVariableDistance(race) {
    return !!(race.racetype && race.racetype.isVariable);
}

function seriesNameFor(races) {
    const latest = races.reduce((a, b) => (new Date(b.racedate) > new Date(a.racedate) ? b : a));
    const parkrun = parkrunName(latest.racename);
    if (parkrun) return parkrun;
    const cleaned = latest.racename
        .replace(/#\s*\d+/g, ' ')
        .replace(/\b(19|20)\d{2}\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return cleaned || latest.racename;
}

function groupBy(items, keyFn) {
    const map = new Map();
    for (const item of items) {
        const k = keyFn(item);
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(item);
    }
    return map;
}

function largest(map) {
    let best = null;
    for (const [k, v] of map) {
        if (!best || v.length > best[1].length) best = [k, v];
    }
    return best;
}

// Splits one same-name group by distance. Races at a variable distance ("Odd road
// distance" for the 9.96-mile Cherry Blossom year) join the most common fixed
// distance as off-distance editions; they only form their own group when no edition
// was at a fixed distance (trail races that are always "Odd trail distance").
function splitByDistance(races) {
    const fixed = races.filter(r => !isVariableDistance(r));
    const variable = races.filter(isVariableDistance);
    if (!fixed.length) {
        return [{ racetype: races[0].racetype, entries: races.map(r => ({ race: r })) }];
    }
    const byType = groupBy(fixed, r => (r.racetype && r.racetype.name) || '');
    const [mainType] = largest(byType);
    return [...byType.entries()].map(([typeName, typed]) => ({
        racetype: typed[0].racetype,
        entries: typed.map(r => ({ race: r })).concat(
            typeName === mainType ? variable.map(r => ({ race: r, offDistance: true })) : [])
    }));
}

// Proposes series for a set of races (none of them already in a series). State is
// not used to split: a differing state is far more often a data-entry slip or a
// relocated race than a different race, so those editions stay in and are flagged
// for the admin, who can reject them.
function proposeSeries(races) {
    const proposals = [];
    for (const [key, sameName] of groupBy(races, seriesKey)) {
        if (!key || sameName.length < 2) continue;
        const isParkrun = !!parkrunName(sameName[0].racename);

        for (const group of splitByDistance(sameName)) {
            if (group.entries.length < 2) continue;
            const groupRaces = group.entries.map(e => e.race);
            const located = groupBy(groupRaces.filter(locationKey), locationKey);
            const mainLocation = located.size ? largest(located)[0] : '';
            proposals.push({
                key,
                isParkrun,
                name: seriesNameFor(groupRaces),
                racetype: group.racetype,
                location: mainLocation ? locationLabel(mainLocation) : '',
                entries: group.entries.map(e => ({
                    race: e.race,
                    offDistance: !!e.offDistance,
                    reason: reasonFor(e, isParkrun, mainLocation)
                }))
            });
        }
    }
    return proposals.sort((a, b) => b.entries.length - a.entries.length);
}

function reasonFor(entry, isParkrun, mainLocation) {
    const parts = [isParkrun ? 'same parkrun' : 'same name'];
    if (entry.offDistance) parts.push('different distance (' + entry.race.racetype.name + ')');
    const loc = locationKey(entry.race);
    if (!loc) parts.push('no location on race');
    else if (mainLocation && loc !== mainLocation) {
        parts.push('different state (' + locationLabel(loc) + '; series is mostly in ' + locationLabel(mainLocation) + ')');
    }
    return parts.join('; ');
}

// What a series looks like to the matcher, from the races already linked to it.
function describeSeries(series, linkedRaces) {
    return {
        series,
        keys: new Set(linkedRaces.map(seriesKey).concat(seriesKey({ racename: series.name })).filter(Boolean)),
        locations: new Set(linkedRaces.map(locationKey).filter(Boolean)),
        racetypeName: series.racetype && series.racetype.name,
        rejected: new Set((series.rejected || []).map(String))
    };
}

// Every existing series a race could belong to, best first. The name must match
// and the distance must be the series' own or a variable one; a different state
// only lowers the rank, so a relocated race is still offered.
function rankSeriesForRace(race, described) {
    const key = seriesKey(race);
    if (!key) return [];
    const typeName = race.racetype && race.racetype.name;
    const loc = locationKey(race);
    const matches = [];
    for (const d of described) {
        if (!d.keys.has(key) || (race._id && d.rejected.has(String(race._id)))) continue;
        const sameType = !!typeName && typeName === d.racetypeName;
        if (!sameType && !isVariableDistance(race)) continue;
        const sameLocation = !loc || !d.locations.size || d.locations.has(loc);

        const parts = [parkrunName(race.racename) ? 'same parkrun' : 'same name'];
        if (!sameType) parts.push('different distance (' + typeName + ')');
        if (!sameLocation) {
            parts.push('different state (' + locationLabel(loc) + '; series is in ' +
                [...d.locations].map(locationLabel).join(', ') + ')');
        }
        matches.push({
            series: d.series, offDistance: !sameType, reason: parts.join('; '),
            score: (sameType ? 2 : 0) + (sameLocation ? 1 : 0)
        });
    }
    return matches.sort((a, b) => b.score - a.score);
}

// The existing series a new race most likely belongs to, or null.
function findSeriesForRace(race, described) {
    return rankSeriesForRace(race, described)[0] || null;
}

function editDistance(a, b) {
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        const cur = [i];
        for (let j = 1; j <= b.length; j++) {
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        prev = cur;
    }
    return prev[b.length];
}

// Why two normalized names might be the same race under a looser rule than the
// matcher's exact one, or null. Too loose for automatic suggestions (it pairs
// Boston with Houston Marathon), so these only go to an admin as possible merges.
function similarNames(a, b) {
    if (!a || !b || a === b) return null;
    if (a.replace(/ /g, '') === b.replace(/ /g, '')) return 'same name apart from spacing';
    if (Math.min(a.length, b.length) > 8 && Math.abs(a.length - b.length) <= 2 && editDistance(a, b) <= 2) {
        return 'names differ by a letter or two';
    }
    const [short, long] = a.length < b.length ? [a, b] : [b, a];
    if (short.split(' ').length >= 3 && (' ' + long + ' ').includes(' ' + short + ' ')) {
        return 'one name contains the other';
    }
    return null;
}

// Pairs worth an admin's look. `items` are { id, key, racetypeName, isSeries };
// only items at the same distance are compared, and at least one side must be a
// series (two lone races are left for the matcher to group once one recurs).
function findPossibleMerges(items, isDismissed) {
    const pairs = [];
    for (const sameDistance of groupBy(items, i => i.racetypeName || '').values()) {
        for (let i = 0; i < sameDistance.length; i++) {
            for (let j = i + 1; j < sameDistance.length; j++) {
                const a = sameDistance[i], b = sameDistance[j];
                if (!a.isSeries && !b.isSeries) continue;
                const why = similarNames(a.key, b.key);
                if (why && !(isDismissed && isDismissed(a, b))) pairs.push({ a, b, why });
            }
        }
    }
    return pairs;
}

module.exports = {
    normalizeRaceName,
    parkrunName,
    seriesKey,
    isVariableDistance,
    proposeSeries,
    describeSeries,
    rankSeriesForRace,
    findSeriesForRace,
    similarNames,
    findPossibleMerges
};
