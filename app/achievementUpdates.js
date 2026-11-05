// The achievements the server derives across many documents, as plain
// functions from documents to the writes to make (app/service.js runs the
// queries and the writes). Kept apart so they can be tested without a
// database (tests/achievementUpdates.test.js).

function getSurfaceText(surface) {
    const surfaceMap = new Map([
        ['road', 'road'],
        ['track', 'track'],
        ['trail', 'trail'],
        ['ultra', 'ultra'],
        ['multiple', 'multi sport'],
        ['pool', 'pool'],
        ['open water', 'openwater']
    ]);
    return surfaceMap.get(surface);
}

function teamRecordsEqual(existing, expected) {
    if (existing.length !== expected.length) return false;
    const key = a => `${a.value && a.value.category}|${a.value && a.value.sex}|${a.value && a.value.time}|${a.text}`;
    const existingKeys = existing.map(key).sort();
    const expectedKeys = expected.map(key).sort();
    for (let i = 0; i < existingKeys.length; i++) {
        if (existingKeys[i] !== expectedKeys[i]) return false;
    }
    return true;
}

/**
 * The "teamRecord" achievements of a set of results, as bulkWrite operations
 * for the results whose achievements are not already right.
 *
 * Records exist in two category buckets: Open (every eligible result
 * competes) and Master (only Master-category results). A single Master
 * result can therefore earn both an Open and a Master record on the same
 * race. Within each (racetype, recordCategory, sex) bucket, walks results
 * in chronological order grouped by race date: a date-group sets a new
 * record when its minimum time is strictly faster than the previous best,
 * and every result in that group at that min time gets the achievement.
 * Ties against a previously-set record on a later date are not tagged.
 *
 * results: every eligible result of the race types concerned, sorted by
 * race date then order (buckets never span race types, so a subset of race
 * types gives the same answer for them as all of them would).
 * excludedRaceTypeIds: Set of race type ids that hold no records.
 */
function teamRecordOps(results, excludedRaceTypeIds) {
    // Group eligible results into record-category buckets.
    // Each Open-eligible result competes in Open; Master results also
    // compete in Master (so they can hold a Master record alongside Open).
    // bucketDateGroups: Map<bucketKey, Map<dateKey, Result[]>>
    const bucketDateGroups = new Map();
    const bucketDateOrder = new Map();

    const addToBucket = (result, recordCategory, sex, dateKey) => {
        const bucketKey = `${result.race.racetype._id.toString()}|${recordCategory}|${sex}`;
        let dateMap = bucketDateGroups.get(bucketKey);
        if (!dateMap) {
            dateMap = new Map();
            bucketDateGroups.set(bucketKey, dateMap);
            bucketDateOrder.set(bucketKey, []);
        }
        let dateGroup = dateMap.get(dateKey);
        if (!dateGroup) {
            dateGroup = [];
            dateMap.set(dateKey, dateGroup);
            bucketDateOrder.get(bucketKey).push(dateKey);
        }
        dateGroup.push(result);
    };

    for (const result of results) {
        if (!result.race || !result.race.racetype || !result.race.racetype._id) continue;
        if (excludedRaceTypeIds.has(result.race.racetype._id.toString())) continue;
        if (!result.category) continue;
        const sex = result.members[0].sex;
        if (!sex) continue;
        if (typeof result.time !== 'number' || result.time <= 0) continue;
        if (!result.race.racedate) continue;

        const dateKey = new Date(result.race.racedate).toISOString().slice(0, 10);
        addToBucket(result, 'Open', sex, dateKey);
        if (result.category === 'Master') {
            addToBucket(result, 'Master', sex, dateKey);
        }
    }

    // Walk each bucket chronologically; tag all results at the new min
    // when a date-group strictly improves on the previous best. Keyed
    // by (resultId, recordCategory) so a single result can hold both an
    // Open and a Master teamRecord achievement.
    // expectedByResultId: Map<resultId, Map<recordCategory, achievement>>
    const expectedByResultId = new Map();

    for (const [bucketKey, dateMap] of bucketDateGroups) {
        const recordCategory = bucketKey.split('|')[1];
        let previousBest;
        const dateKeys = bucketDateOrder.get(bucketKey);
        for (const dateKey of dateKeys) {
            const dateGroup = dateMap.get(dateKey);
            let minTime = Infinity;
            for (const r of dateGroup) {
                if (r.time < minTime) minTime = r.time;
            }
            if (previousBest === undefined || minTime < previousBest) {
                previousBest = minTime;
                for (const r of dateGroup) {
                    if (r.time !== minTime) continue;
                    const idStr = r._id.toString();
                    const sex = r.members[0].sex;
                    const achievement = {
                        name: 'teamRecord',
                        text: `New team record: ${r.race.racetype.name} (${getSurfaceText(r.race.racetype.surface)}) : ${recordCategory} ${sex}!`,
                        value: {
                            time: r.time,
                            racetypeId: r.race.racetype._id,
                            racetypeName: r.race.racetype.name,
                            surface: r.race.racetype.surface,
                            category: recordCategory,
                            sex: sex
                        }
                    };
                    let perCategory = expectedByResultId.get(idStr);
                    if (!perCategory) {
                        perCategory = new Map();
                        expectedByResultId.set(idStr, perCategory);
                    }
                    perCategory.set(recordCategory, achievement);
                }
            }
        }
    }

    // Build bulk operations: replace teamRecord achievements only when
    // the set differs from what's already on the result. When a result
    // sets both the Open and Master record, collapse the two into a
    // single combined achievement whose text names both — one record
    // run should count (and show) as one 🔥, not two. category stays
    // "Open" for existing readers; categories lists both.
    const bulkOperations = [];
    for (const result of results) {
        const idStr = result._id.toString();
        const existing = result.achievements || [];
        const existingTeamRecords = existing.filter(a => a.name === 'teamRecord');
        const expectedMap = expectedByResultId.get(idStr) || new Map();
        const openAch = expectedMap.get('Open');
        const masterAch = expectedMap.get('Master');
        let expectedList;
        if (openAch && masterAch) {
            const sex = openAch.value.sex;
            expectedList = [{
                name: 'teamRecord',
                text: `New team record: ${openAch.value.racetypeName} (${getSurfaceText(openAch.value.surface)}) : Open and Master ${sex}!`,
                value: {
                    time: openAch.value.time,
                    racetypeId: openAch.value.racetypeId,
                    racetypeName: openAch.value.racetypeName,
                    surface: openAch.value.surface,
                    category: 'Open',
                    categories: ['Open', 'Master'],
                    sex: sex
                }
            }];
        } else {
            expectedList = Array.from(expectedMap.values());
        }

        if (!teamRecordsEqual(existingTeamRecords, expectedList)) {
            const others = existing.filter(a => a.name !== 'teamRecord');
            bulkOperations.push({
                updateOne: {
                    filter: { _id: result._id },
                    update: { $set: { achievements: [...others, ...expectedList] } }
                }
            });
        }
    }
    return bulkOperations;
}

/**
 * The "newLocation" achievement of one location (a state, or a country
 * abroad): the first race there holds it, once; no other race does.
 * first: the location's first race ({ _id, location, achievements }), by date
 * then order. holders: the races there holding it now (the first race may be
 * among them). Returns bulkWrite operations, none when all is already right.
 */
function locationOps(first, holders) {
    const isIt = a => a.name === 'newLocation';
    const locationName = first.location.state || first.location.country;
    const achievement = {
        name: 'newLocation',
        text: `First team race in ${locationName}!`,
        value: { country: first.location.country, state: first.location.state, locationName: locationName }
    };
    const ops = [];
    for (const race of holders) {
        if (String(race._id) === String(first._id)) continue;
        ops.push({
            updateOne: {
                filter: { _id: race._id },
                update: { $set: { achievements: (race.achievements || []).filter(a => !isIt(a)) } }
            }
        });
    }
    const current = (first.achievements || []).filter(isIt);
    const right = current.length === 1 && current[0].text === achievement.text &&
        JSON.stringify(current[0].value) === JSON.stringify(achievement.value);
    if (!right) {
        ops.push({
            updateOne: {
                filter: { _id: first._id },
                update: { $set: { achievements: (first.achievements || []).filter(a => !isIt(a)).concat([achievement]) } }
            }
        });
    }
    return ops;
}

module.exports = { teamRecordOps, locationOps, getSurfaceText, teamRecordsEqual };
