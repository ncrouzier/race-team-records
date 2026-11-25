// A member has at most one result in a race (a relay team: one per set of
// runners). Saving the same results page twice, from the result extractor or
// anywhere else that bulk-saves, must not give everyone a second copy, so the
// bulk save skips a result whose runners already have one in that race.
//
// Used by POST /api/results/bulk (app/routes.js); tested in
// tests/resultDuplicates.test.js.

// The runners of a result, in any order, as one string: the same runners give
// the same key
function runnersKey(memberIds) {
    return memberIds.map(String).sort().join(',');
}

// The query for a saved result in this race with exactly these runners
function savedResultFilter(raceId, memberIds) {
    return {
        'race._id': raceId,
        'members._id': { $all: memberIds },
        members: { $size: memberIds.length }
    };
}

// What the bulk save tells the admin: how many were saved, which were skipped
// as already saved, and how many failed
function saveSummary(createdCount, skippedNames, failedCount) {
    const parts = ['Saved ' + createdCount + ' result' + (createdCount === 1 ? '' : 's')];
    if (skippedNames.length) {
        parts.push('skipped ' + skippedNames.length + ' already saved (' + skippedNames.join(', ') + ')');
    }
    if (failedCount) {
        parts.push(failedCount + ' could not be saved');
    }
    return parts.join('; ');
}

module.exports = { runnersKey, savedResultFilter, saveSummary };
