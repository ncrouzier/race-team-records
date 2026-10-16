// Stats for a race series' public page, from its confirmed editions and their
// results. Pure: the route loads the data, this shapes it.
//
// Off-distance editions (a short-course year) count for turnout and age grade,
// which already adjusts for distance, but never for times.
//
// Shared: Node requires it (module.exports), and the browser bundle
// (scripts/build-js.mjs) gets window.RaceSeriesStats, so pages can work
// from cached data with the same code as the server.
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.RaceSeriesStats = factory();
}(this, function () {
    'use strict';


    const TOP = 10;

    // A result this far below a member's usual age grade says they did not race it
    // (ran with family, walked, paced someone): it says nothing about the course,
    // so course ratings leave it out
    const NOT_RACED_BELOW = 20;

    function memberRow(m) {
        return { _id: m._id, firstname: m.firstname, lastname: m.lastname, username: m.username, sex: m.sex };
    }

    function year(date) {
        return new Date(date).getUTCFullYear();
    }

    function hasTime(r) {
        return r.time > 0;
    }

    function hasAgeGrade(r) {
        return r.agegrade > 0;
    }

    // Minutes per mile, for a runner's own result at a run-only race
    function paceOf(time, race) {
        const miles = race.racetype && race.racetype.miles;
        if (!(time > 0) || !(miles > 0) || race.isMultisport) return null;
        return time / 100 / 60 / miles;
    }

    // What an edition's distance is called: a variable-distance race's own name
    // for it ("9.39 miles"), else its race type ("10 miles")
    function distanceOf(race) {
        const type = race.racetype || {};
        return (type.isVariable && race.distanceName) || type.name || '';
    }

    function placeOf(ranking) {
        if (!ranking) return null;
        const place = {};
        for (const key of ['overallrank', 'overalltotal', 'genderrank', 'gendertotal', 'agerank', 'agetotal']) {
            if (ranking[key] > 0) place[key] = ranking[key];
        }
        return Object.keys(place).length ? place : null;
    }

    // Ties are settled the same whatever order the results arrive in (database
    // order on the server, date order in a browser's cache): an equal
    // performance goes to whoever did it first, then to the lower id
    function firstSet(a, b) {
        return new Date(a.date) - new Date(b.date) || String(a.resultId).localeCompare(String(b.resultId));
    }

    function byPerson(a, b) {
        return (a.member.lastname || '').localeCompare(b.member.lastname || '') ||
            (a.member.firstname || '').localeCompare(b.member.firstname || '') ||
            String(a.member._id).localeCompare(String(b.member._id));
    }

    // Where a series is run: the most common location among its editions (state,
    // else country), a tie going to the most recent edition's, its current home
    function mainLocation(races) {
        const counts = new Map(), latest = new Map();
        for (const r of races) {
            const loc = r.location ? (r.location.state || r.location.country) : '';
            if (!loc) continue;
            counts.set(loc, (counts.get(loc) || 0) + 1);
            const when = new Date(r.racedate).getTime();
            if (!latest.has(loc) || when > latest.get(loc)) latest.set(loc, when);
        }
        let best = '';
        for (const [loc, n] of counts) {
            const top = counts.get(best) || 0;
            if (n > top || (n === top && (latest.get(loc) > latest.get(best) ||
                (latest.get(loc) === latest.get(best) && loc < best)))) best = loc;
        }
        return best;
    }

    // Each member's best by `better`, best first, at most TOP
    function bestPerMember(entries, better) {
        const order = (a, b) => (better(a, b) ? -1 : better(b, a) ? 1 : firstSet(a, b));
        const best = new Map();
        for (const e of entries) {
            const id = String(e.member._id);
            if (!best.has(id) || order(e, best.get(id)) < 0) best.set(id, e);
        }
        return [...best.values()].sort(order).slice(0, TOP);
    }

    // The keys of `usualAgeGrades`, built the same way by the route that fills it
    function distanceKey(memberId, racetype) {
        return String(memberId) + '|' + (racetype && racetype.name) + '|' + (racetype && racetype.surface);
    }

    function surfaceKey(memberId, racetype) {
        return String(memberId) + '|' + (racetype && racetype.surface);
    }

    // Age grade here against the same members' usual age grade elsewhere. Too few
    // comparable results says nothing: a member needs 3 results for a usual, and the
    // rating needs 10 comparisons.
    function rateCourse(entries, usualMap, keyOf) {
        const diffs = entries
            .map(s => ({ s, usual: usualMap.get(keyOf(s.member._id, s.racetype)) }))
            .filter(x => x.usual && x.usual.n >= 3)
            .map(x => ({ id: String(x.s.member._id), diff: x.s.agegrade - x.usual.avg }))
            .filter(d => d.diff > -NOT_RACED_BELOW);
        if (diffs.length < 10) return null;
        const mean = diffs.reduce((n, d) => n + d.diff, 0) / diffs.length;
        return { diff: Math.round(mean * 10) / 10, results: diffs.length, members: new Set(diffs.map(d => d.id)).size };
    }

    // `editions`: [{ race, offDistance }], confirmed only. `results`: lean results of
    // those races. `usualAgeGrades`: each member's average age grade over their solo
    // results outside this series, as { byDistance, bySurface } Maps of { avg, n }
    // keyed by distanceKey / surfaceKey (for how the course rates).
    function seriesStats({ editions, results, usualAgeGrades }) {
        const editionById = new Map(editions.map(e => [String(e.race._id), e]));
        const resultsByRace = new Map();
        for (const r of results) {
            const id = String(r.race._id);
            if (!resultsByRace.has(id)) resultsByRace.set(id, []);
            resultsByRace.get(id).push(r);
        }

        // A series with any team result (a relay) is a team series: every result in
        // it is a team's, including those with one runner named, where the others
        // were not club members. It then has no individual bests and no age grades.
        const teamSeries = results.some(r => (r.members || []).length > 1);

        // Individual results: they set bests, podiums and age grades. None in a team
        // series; elsewhere, single-runner results (relays still count for turnout
        // and members' appearances)
        const solo = results
            .filter(r => !teamSeries && r.members && r.members.length === 1 && editionById.has(String(r.race._id)))
            .map(r => {
                const edition = editionById.get(String(r.race._id));
                return {
                    member: r.members[0],
                    resultId: r._id,
                    raceId: edition.race._id,
                    date: edition.race.racedate,
                    time: r.time,
                    agegrade: r.agegrade,
                    genderrank: r.ranking && r.ranking.genderrank,
                    racetype: edition.race.racetype,
                    offDistance: !!edition.offDistance
                };
            });
        const runnerIds = r => (r.members || []).map(m => String(m._id));

        // ---- Summary -----------------------------------------------------------
        const years = editions.map(e => year(e.race.racedate));
        const summary = {
            editions: editions.length,
            firstYear: years.length ? Math.min(...years) : null,
            lastYear: years.length ? Math.max(...years) : null,
            results: results.length,
            runners: new Set(results.flatMap(runnerIds)).size,
            teamSeries: teamSeries,
            // False for a distance with no age grading (multisport, odd distances)
            // and for a team series: the page then leaves out everything about it
            hasAgeGrades: !teamSeries && results.some(hasAgeGrade),
            genderPodiums: solo.filter(s => s.genderrank >= 1 && s.genderrank <= 3).length
        };

        // Every result as an entry, team ones (relays) included: a team's time,
        // pace and place are each of its members' result at that edition
        const entries = results.filter(r => editionById.has(String(r.race._id))).map(r => {
            const edition = editionById.get(String(r.race._id));
            const team = teamSeries || (r.members || []).length > 1;
            return {
                members: (r.members || []).map(memberRow),
                resultId: r._id,
                raceId: edition.race._id, racename: edition.race.racename, date: edition.race.racedate,
                distance: distanceOf(edition.race), time: r.time, offDistance: !!edition.offDistance, team: team,
                // Age grade is one runner's: a team has none
                agegrade: team ? undefined : r.agegrade,
                pace: paceOf(r.time, edition.race),
                place: placeOf(r.ranking)
            };
        });
        const fastestFirst = (a, b) => a.time - b.time || firstSet(a, b);

        // ---- Editions ----------------------------------------------------------
        const editionRows = editions.map(e => {
            const rs = resultsByRace.get(String(e.race._id)) || [];
            const fastest = entries.filter(x => String(x.raceId) === String(e.race._id) && hasTime(x)).sort(fastestFirst)[0];
            return {
                race: e.race,
                offDistance: !!e.offDistance,
                results: rs.length,
                fastest: fastest ? { members: fastest.members, time: fastest.time, team: fastest.team } : null
            };
        }).sort((a, b) => new Date(b.race.racedate) - new Date(a.race.racedate) ||
            String(a.race._id).localeCompare(String(b.race._id)));

        // ---- Best performances -------------------------------------------------
        // Fastest men and women are runners on their own; a team can be mixed, so
        // teams have their own list
        const performance = s => ({
            member: memberRow(s.member), resultId: s.resultId, raceId: s.raceId, date: s.date, time: s.time, agegrade: s.agegrade
        });
        const timedOnDistance = solo.filter(s => hasTime(s) && !s.offDistance);
        const faster = (a, b) => a.time < b.time;
        const bests = {
            men: bestPerMember(timedOnDistance.filter(s => s.member.sex === 'Male'), faster).map(performance),
            women: bestPerMember(timedOnDistance.filter(s => s.member.sex === 'Female'), faster).map(performance),
            ageGrade: bestPerMember(solo.filter(hasAgeGrade), (a, b) => a.agegrade > b.agegrade).map(performance),
            teams: entries.filter(x => x.team && hasTime(x) && !x.offDistance).sort(fastestFirst).slice(0, TOP)
                .map(x => ({ members: x.members, resultId: x.resultId, raceId: x.raceId, date: x.date, time: x.time }))
        };

        // ---- Members: appearances and each one's history here -------------------
        // One row per edition a member ran: their best result there when they ran
        // it more than once (on two relay teams, say), the others noted
        const byMember = new Map();
        for (const x of entries) {
            for (const m of x.members) {
                const id = String(m._id);
                if (!byMember.has(id)) byMember.set(id, { member: m, byRace: new Map() });
                const byRace = byMember.get(id).byRace;
                const key = String(x.raceId);
                if (!byRace.has(key)) byRace.set(key, []);
                byRace.get(key).push(x);
            }
        }
        const members = [...byMember.values()].map(m => {
            const history = [...m.byRace.values()].map(runs => {
                const ordered = runs.slice().sort((a, b) => (hasTime(b) - hasTime(a)) || fastestFirst(a, b));
                const row = Object.assign({}, ordered[0]);
                delete row.members;
                if (row.team) row.teammates = ordered[0].members.filter(t => String(t._id) !== String(m.member._id));
                if (runs.length > 1) {
                    row.runs = runs.length;
                    row.otherTimes = ordered.slice(1).filter(hasTime).map(x => x.time);
                }
                return row;
            }).sort((a, b) => new Date(b.date) - new Date(a.date) || String(a.resultId).localeCompare(String(b.resultId)));

            const timed = history.filter(h => hasTime(h) && !h.offDistance).sort(fastestFirst);
            const graded = history.filter(hasAgeGrade).sort((a, b) => b.agegrade - a.agegrade || firstSet(a, b));
            // Marked in the history, with the gap to the best on every other timed run
            if (timed[0]) timed.forEach(h => { h.behindBest = h.time - timed[0].time; });
            if (timed[0]) timed[0].bestTime = true;
            if (graded[0]) graded[0].bestAgeGrade = true;
            return {
                member: m.member,
                count: history.length,
                firstYear: Math.min(...history.map(h => year(h.date))),
                lastYear: Math.max(...history.map(h => year(h.date))),
                best: timed[0] ? { time: timed[0].time, raceId: timed[0].raceId, date: timed[0].date, team: timed[0].team } : null,
                bestAgeGrade: graded[0] ? graded[0].agegrade : null,
                history: history
            };
        }).sort((a, b) => b.count - a.count || byPerson(a, b));

        // ---- How the course rates ----------------------------------------------
        // Two ways: against members' usual at the same distance and surface, and at
        // any distance on the same surface. A short-course year is not the series'
        // distance, so it only counts toward the second.
        let course = null;
        if (usualAgeGrades) {
            const graded = solo.filter(hasAgeGrade);
            const sameDistance = rateCourse(graded.filter(s => !s.offDistance), usualAgeGrades.byDistance, distanceKey);
            const sameSurface = rateCourse(graded, usualAgeGrades.bySurface, surfaceKey);
            if (sameDistance || sameSurface) course = { sameDistance, sameSurface };
        }

        return { summary, editions: editionRows, bests, members, course };
    }

    // ---- Across every series, for the Racing Stats tab -------------------------
    //
    // `seriesList`: public series as { _id, name, racetype, editions: [{ raceId,
    // year, offDistance }] } (confirmed editions only). `results`: every result,
    // lean, with race._id, race.racetype, members and agegrade.
    function teamSeriesStats({ seriesList, results }) {
        const editionOf = new Map();
        for (const s of seriesList) {
            for (const e of s.editions) editionOf.set(String(e.raceId), { series: s, edition: e });
        }
        const seriesRow = s => ({ _id: s._id, name: s.name });

        // ---- Loyalty: the most editions of one race ----------------------------
        const ranBy = new Map(); // member id -> series id -> { member, series, raceIds: Set }
        for (const r of results) {
            const hit = editionOf.get(String(r.race._id));
            if (!hit) continue;
            for (const m of r.members || []) {
                const id = String(m._id);
                if (!ranBy.has(id)) ranBy.set(id, new Map());
                const bySeries = ranBy.get(id);
                const sid = String(hit.series._id);
                if (!bySeries.has(sid)) bySeries.set(sid, { member: memberRow(m), series: hit.series, raceIds: new Set() });
                bySeries.get(sid).raceIds.add(String(r.race._id));
            }
        }

        const mostEditions = [];
        for (const bySeries of ranBy.values()) {
            let most = null;
            for (const entry of bySeries.values()) {
                const count = entry.raceIds.size;
                // A tie between two races goes to the first by name
                if (!most || count > most.count || (count === most.count && entry.series.name.localeCompare(most.series.name) < 0)) {
                    most = { member: entry.member, series: seriesRow(entry.series), count };
                }
            }
            if (most && most.count >= 2) mostEditions.push(most);
        }
        mostEditions.sort((a, b) => b.count - a.count || byPerson(a, b));

        // ---- Team best times: the fastest man and woman on the team at each race's
        // usual distance, from runners on their own. Members ranked by how many
        // races they hold one at: all together, and men and women apart.
        const teamSeriesFor = new Set();
        for (const r of results) {
            const hit = editionOf.get(String(r.race._id));
            if (hit && (r.members || []).length > 1) teamSeriesFor.add(String(hit.series._id));
        }
        const fastest = new Map(); // series id + sex -> fastest result
        for (const r of results) {
            const hit = editionOf.get(String(r.race._id));
            if (!hit || hit.edition.offDistance || (r.members || []).length !== 1 || !hasTime(r)) continue;
            if (teamSeriesFor.has(String(hit.series._id))) continue;
            const sex = r.members[0].sex;
            if (sex !== 'Male' && sex !== 'Female') continue;
            const key = String(hit.series._id) + '|' + sex;
            const best = fastest.get(key);
            // An equal time stays with whoever ran it first
            const year = hit.edition.year;
            if (!best || r.time < best.r.time || (r.time === best.r.time &&
                (year < best.year || (year === best.year && String(r._id) < String(best.r._id))))) {
                fastest.set(key, { r, series: hit.series, sex, year });
            }
        }
        const holders = new Map();
        for (const { r, series, sex, year } of fastest.values()) {
            const id = String(r.members[0]._id);
            if (!holders.has(id)) holders.set(id, { member: memberRow(r.members[0]), records: [] });
            holders.get(id).records.push({
                series: seriesRow(series), distance: series.racetype ? series.racetype.name : '',
                time: r.time, sex: sex, year: year, raceId: r.race._id, resultId: r._id
            });
        }
        const ranked = [...holders.values()]
            .map(h => Object.assign(h, {
                count: h.records.length,
                records: h.records.sort((a, b) => a.series.name.localeCompare(b.series.name))
            }))
            .sort((a, b) => b.count - a.count || byPerson(a, b));
        const recordHolders = {
            all: ranked.slice(0, TOP),
            men: ranked.filter(h => h.member.sex === 'Male').slice(0, TOP),
            women: ranked.filter(h => h.member.sex === 'Female').slice(0, TOP)
        };

        // ---- Courses: age grade here against members' usual elsewhere, at the
        // same distance and surface (as on the series page). Team series have no
        // age grades, so they are left out.
        const graded = results.filter(r => (r.members || []).length === 1 && hasAgeGrade(r));
        const totals = new Map(); // distanceKey -> { sum, n } over every solo result
        const inSeries = new Map(); // series id -> distanceKey -> { sum, n }
        const seriesResults = new Map(); // series id -> its graded results at its own distance
        const add = (map, key, ag) => {
            const t = map.get(key) || { sum: 0, n: 0 };
            map.set(key, { sum: t.sum + ag, n: t.n + 1 });
        };
        for (const r of graded) {
            const key = distanceKey(r.members[0]._id, r.race.racetype);
            add(totals, key, r.agegrade);
            const hit = editionOf.get(String(r.race._id));
            if (hit) {
                const sid = String(hit.series._id);
                if (!inSeries.has(sid)) inSeries.set(sid, new Map());
                add(inSeries.get(sid), key, r.agegrade);
                if (!hit.edition.offDistance) {
                    if (!seriesResults.has(sid)) seriesResults.set(sid, []);
                    seriesResults.get(sid).push(r);
                }
            }
        }
        const courses = [];
        for (const s of seriesList) {
            const sid = String(s._id);
            if (teamSeriesFor.has(sid)) continue;
            const own = inSeries.get(sid) || new Map();
            const diffs = [];
            for (const r of seriesResults.get(sid) || []) {
                const key = distanceKey(r.members[0]._id, r.race.racetype);
                const all = totals.get(key), here = own.get(key);
                const n = all.n - here.n;
                if (n < 3) continue;
                const diff = r.agegrade - (all.sum - here.sum) / n;
                if (diff > -NOT_RACED_BELOW) diffs.push({ id: String(r.members[0]._id), diff: diff });
            }
            if (diffs.length < 10) continue;
            const mean = diffs.reduce((t, d) => t + d.diff, 0) / diffs.length;
            courses.push({
                series: seriesRow(s), racetype: s.racetype ? { name: s.racetype.name, surface: s.racetype.surface } : null,
                diff: Math.round(mean * 10) / 10, results: diffs.length, members: new Set(diffs.map(d => d.id)).size
            });
        }
        const byName = (a, b) => a.series.name.localeCompare(b.series.name);
        const fastestCourses = courses.slice().sort((a, b) => b.diff - a.diff || b.results - a.results || byName(a, b)).slice(0, TOP);
        const toughestCourses = courses.slice().sort((a, b) => a.diff - b.diff || b.results - a.results || byName(a, b)).slice(0, TOP);

        return { mostEditions: mostEditions.slice(0, TOP), recordHolders, fastestCourses, toughestCourses };
    }

    return { seriesStats, teamSeriesStats, mainLocation, distanceKey, surfaceKey, NOT_RACED_BELOW };
}));
