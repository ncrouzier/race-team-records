// Where one result falls in its runner's history with the team: their Nth race,
// Nth on this surface, at this distance, this year, at this race series, and how
// long since the race before. Pure: the result detail route loads the data.
//
// `result` and every entry of `history` (all of the member's results, this one
// included) carry _id and race { _id, racename, racedate, order, racetype,
// isMultisport }. `series` is { _id, name, raceIds: Set } when the race is a
// confirmed edition of a public series, else null.

const DAY = 24 * 60 * 60 * 1000;

// Race date, then the order of races on the same day, then the result itself,
// so the count is the same on every load
function chronological(a, b) {
    return new Date(a.race.racedate) - new Date(b.race.racedate) ||
        (a.race.order || 0) - (b.race.order || 0) ||
        String(a._id).localeCompare(String(b._id));
}

function year(r) {
    return new Date(r.race.racedate).getUTCFullYear();
}

function memberRaceCounts({ result, history, series }) {
    const sorted = history.slice().sort(chronological);
    const at = sorted.findIndex(r => String(r._id) === String(result._id));
    if (at === -1) return null;
    const upTo = sorted.slice(0, at + 1);
    // Nth of all so far that match, and how many there are in all
    const count = match => ({ n: upTo.filter(match).length, of: sorted.filter(match).length });

    const type = result.race.racetype || {};
    const surface = type.surface;
    const fixedDistance = !type.isVariable && !result.race.isMultisport && type.name;
    const sameDistance = r => r.race.racetype && r.race.racetype.name === type.name && r.race.racetype.surface === surface;
    const thisYear = year(result);
    const previous = at > 0 ? sorted[at - 1] : null;

    return {
        overall: count(() => true),
        surface: surface ? Object.assign({ surface: surface }, count(r => r.race.racetype && r.race.racetype.surface === surface)) : null,
        distance: fixedDistance ? Object.assign({ name: type.name, surface: surface }, count(sameDistance)) : null,
        year: Object.assign({ year: thisYear }, count(r => year(r) === thisYear)),
        series: series ? Object.assign({ _id: series._id, name: series.name },
            count(r => series.raceIds.has(String(r.race._id)))) : null,
        previous: previous ? {
            days: Math.round((new Date(result.race.racedate) - new Date(previous.race.racedate)) / DAY),
            resultId: previous._id,
            racename: previous.race.racename,
            racedate: previous.race.racedate
        } : null
    };
}

module.exports = { memberRaceCounts };
