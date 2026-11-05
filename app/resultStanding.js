// How one result's time stands: on the team (all time, that year, by sex, by
// age), in the runner's own history (rank, previous best), and where it falls
// among the team's times at that distance (histograms). Everything the result
// page shows beyond the result itself, from one list: every record-eligible
// solo result with a time at the same race type.
//
// Shared: Node requires it (the result detail route), and the browser bundle
// (scripts/build-js.mjs) gets window.ResultStanding, so the result page can work
// from the cached race list with the same code as the server.
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.ResultStanding = factory();
}(this, function () {
    'use strict';

    // Same convention as the age records grid (RecordsGridService)
    function ageAtDate(birthday, date) {
        const bd = new Date(birthday);
        const d = new Date(date);
        let age = d.getUTCFullYear() - bd.getUTCFullYear();
        if (d.getUTCMonth() < bd.getUTCMonth() ||
            (d.getUTCMonth() === bd.getUTCMonth() && d.getUTCDate() < bd.getUTCDate())) {
            age--;
        }
        return Math.max(0, age);
    }

    // Buckets every team time at one distance into a histogram, so the page
    // can show where this particular time falls among them.
    // Times are centiseconds throughout.
    function buildTimeDistribution(times, markTime) {
        // Bucket-count budget for the bulk of the field, and the floor on how
        // much of it may be swept into the single overflow bar
        // The floor matters most for small populations: a dozen marathons
        // spread over twenty minutes have room for far more than a dozen bars,
        // and 2*sqrt(n) alone would round them into three-minute blocks.
        const MIN_BUCKETS = 24;
        const MAX_BUCKETS = 60;
        const MIN_KEPT_PERCENTILE = 0.95;
        // Bucket widths that read as round numbers on a time axis
        const NICE_WIDTHS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 300, 600, 900, 1800]
            .map(function (seconds) { return seconds * 100; });

        if (times.length < 8) {
            return null;
        }

        // times arrives sorted
        const quantile = function (fraction) {
            const position = fraction * (times.length - 1);
            const lower = Math.floor(position);
            const upper = Math.min(times.length - 1, lower + 1);
            return times[lower] + (times[upper] - times[lower]) * (position - lower);
        };

        // The fast end stays exact — a team record belongs at its own time —
        // but the slow tail is cut off and collected into a single bar at the
        // end. Twenty near-empty buckets stretching out to a walked race cost
        // the bulk of the field both pixels and resolution.
        //
        // The result being viewed is never swept into that bar: if it is
        // itself a slow outlier the cutoff moves out to include it.
        //
        // Tukey's fence rather than a fixed percentile, because it follows how
        // tightly the times actually cluster. A runner whose 5ks sit inside a
        // 35-second band, with one 35-minute jog, has 61 of 63 results under
        // Q3 + 1.5*IQR — a 99th-percentile cut would keep the jog and flatten
        // the band it exists to show. Floored at the 95th percentile so the
        // overflow bar never swallows a meaningful share of the population.
        const q1 = quantile(0.25);
        const q3 = quantile(0.75);
        const cutoff = Math.max(q3 + 1.5 * (q3 - q1), quantile(MIN_KEPT_PERCENTILE));

        const lo = times[0];
        const hi = Math.max(cutoff, markTime);

        // Roughly 2*sqrt(n) buckets: enough shape for a large population
        // without turning a small one into a comb of single-result spikes.
        const targetBuckets = Math.min(MAX_BUCKETS,
            Math.max(MIN_BUCKETS, Math.round(Math.sqrt(times.length) * 2)));
        const span = hi - lo;
        const target = span > 0 ? span / targetBuckets : NICE_WIDTHS[0];

        const bucketsAt = function (w) {
            return Math.floor((hi - Math.floor(lo / w) * w) / w) + 1;
        };

        let widthIndex = NICE_WIDTHS.findIndex(function (w) { return w >= target; });
        if (widthIndex === -1) {
            widthIndex = NICE_WIDTHS.length - 1;
        }
        // Widen rather than overrun the bar budget; at the coarsest width we
        // simply accept what we get.
        while (widthIndex < NICE_WIDTHS.length - 1 && bucketsAt(NICE_WIDTHS[widthIndex]) > MAX_BUCKETS) {
            widthIndex++;
        }
        const width = NICE_WIDTHS[widthIndex];

        const start = Math.floor(lo / width) * width;
        const count = Math.floor((hi - start) / width) + 1;
        // Strictly past the last bucket, so markTime can never land here
        const overflowFrom = start + count * width;

        const buckets = [];
        for (let i = 0; i < count; i++) {
            buckets.push({ start: start + i * width, end: start + (i + 1) * width, count: 0 });
        }

        let overflow = 0;
        times.forEach(function (time) {
            const index = Math.floor((time - start) / width);
            if (index >= count) {
                overflow++;
            } else {
                buckets[Math.max(0, index)].count++;
            }
        });
        if (overflow > 0) {
            buckets.push({ start: overflowFrom, end: null, count: overflow, overflow: true });
        }

        return {
            bucketWidth: width,
            buckets: buckets,
            markIndex: Math.min(count - 1, Math.max(0, Math.floor((markTime - start) / width))),
            markTime: markTime,
            overflowFrom: overflow > 0 ? overflowFrom : null,
            overflowCount: overflow,
            total: times.length
        };
    }

    // `result`: { _id, time, members, isRecordEligible, category }. `race`: its
    // race, { racedate, racetype: { name, surface, isVariable }, isMultisport }.
    // `sameDistance`: every record-eligible result with one runner and a time
    // at that race type, this one included, as { _id, time, memberId, sex, dob,
    // racedate, racename }.
    function resultStanding({ result, race, sameDistance }) {
        const none = { stats: null, distributions: null, defaultDistribution: 'all' };

        // Standings only mean something for one runner's time over a fixed
        // distance — relay/multisport entries and results flagged as not
        // record eligible have nothing comparable to rank against.
        //
        // Neither do the variable race types: "Odd road distance", the
        // other Odd types, and Swim/Cycling name no distance of their own,
        // so two results sharing that type are not the same race length
        // and ranking one against the other would be meaningless.
        const members = result.members || [];
        const isSolo = members.length === 1 && !race.isMultisport;
        const comparable = isSolo &&
            result.isRecordEligible === true &&
            result.time > 0 &&
            !(race.racetype && race.racetype.isVariable === true);
        if (!comparable) return none;

        const member = members[0];
        const memberId = String(member._id);
        const year = new Date(race.racedate).getUTCFullYear();
        const inYear = r => new Date(r.racedate).getUTCFullYear() === year;
        const mine = r => String(r.memberId) === memberId;
        const sameSex = r => r.sex === member.sex;

        // Ties take the better rank: tied for the fastest time is 1st, not
        // 2nd. `tied` counts the other results on exactly this time, so the
        // page can say "T5th".
        const rankAgainst = function (keep) {
            const scope = sameDistance.filter(keep);
            return {
                rank: scope.filter(r => r.time < result.time).length + 1,
                total: scope.length,
                tied: Math.max(0, scope.filter(r => r.time === result.time).length - 1)
            };
        };

        const personal = rankAgainst(mine);
        const teamAllTime = rankAgainst(() => true);
        const teamGender = rankAgainst(sameSex);

        // How the time stands among runners of the same sex who were exactly
        // this age when they ran — the same single-year treatment the age
        // records grid uses.
        let teamAgeGroup = null;
        if (member.dateofbirth) {
            const age = ageAtDate(member.dateofbirth, race.racedate);
            const peers = sameDistance.filter(r => sameSex(r) && r.dob && ageAtDate(r.dob, r.racedate) === age);
            teamAgeGroup = {
                age: age,
                rank: peers.filter(r => r.time < result.time).length + 1,
                total: peers.length,
                tied: Math.max(0, peers.filter(r => r.time === result.time).length - 1)
            };
        }

        // The time to beat as of race day — what the runner improved on (or
        // missed), rather than their best ever. An equal time goes to the
        // earlier race, then the lower id, whatever order the list is in.
        const raceDay = new Date(race.racedate).getTime();
        const previousBest = sameDistance
            .filter(r => mine(r) && String(r._id) !== String(result._id) && new Date(r.racedate).getTime() < raceDay)
            .sort((a, b) => a.time - b.time || new Date(a.racedate) - new Date(b.racedate) ||
                String(a._id).localeCompare(String(b._id)))[0];

        // Each histogram is built from exactly the population its rank is
        // counted against, so the chart and the "Nth best" line can never
        // disagree.
        const distributionFor = function (keep, standing) {
            const times = sameDistance.filter(keep).map(r => r.time).sort((a, b) => a - b);
            const dist = buildTimeDistribution(times, result.time);
            return dist ? Object.assign(dist, { rank: standing.rank }) : null;
        };

        return {
            stats: {
                // Always the race type's own name — variable types never reach
                // here, so there is no distanceName to fall back on
                distanceLabel: race.racetype.name,
                surface: race.racetype.surface,
                year: year,
                sex: member.sex,
                category: result.category,
                teamAllTime: teamAllTime,
                teamYear: rankAgainst(inYear),
                teamGender: teamGender,
                teamGenderYear: rankAgainst(r => sameSex(r) && inYear(r)),
                teamAgeGroup: teamAgeGroup,
                personal: personal,
                isPersonalBest: personal.rank === 1,
                previousBest: previousBest ? {
                    // Lets the sentence link to that result's own page
                    _id: previousBest._id,
                    time: previousBest.time,
                    racename: previousBest.racename,
                    racedate: previousBest.racedate,
                    improvement: previousBest.time - result.time
                } : null
            },
            distributions: {
                all: distributionFor(() => true, teamAllTime),
                gender: distributionFor(sameSex, teamGender),
                // Null unless the runner has enough of this distance to make a
                // shape — buildTimeDistribution wants at least 8.
                member: distributionFor(mine, personal)
            },
            // Women are the smaller population and the one a woman's time is
            // most usefully read against, so that is what her page opens on;
            // the toggle still gets her to the whole team.
            defaultDistribution: member.sex === 'Female' ? 'gender' : 'all'
        };
    }

    return { resultStanding, ageAtDate, buildTimeDistribution };
}));
