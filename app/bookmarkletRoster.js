// The team on a race day, for the "Results → clipboard" bookmark on a
// mika:timing site (public/bookmarklets/results.js, mika()): it asks the
// admin for the race date, then this, so the names it searches for are the
// roster as it is now, not as it was when the bookmark was dragged.
//
// Served to any site (the bookmark runs on results.baa.org and the like),
// with no login: nothing here that /api/members does not already show to
// anyone (names, sex; no birth dates).

// On the team that day: one of the member's periods covers it, a period with
// no end running to now. The same rule as the extractor's wasActiveOn
// (public/js/services/ResultExtractionService.js).
function wasActiveOn(member, day) {
    const when = day.getTime();
    return (member.membershipDates || []).some(period => {
        if (!period.start) return false;
        const start = new Date(period.start).getTime();
        const end = period.end ? new Date(period.end).getTime() : Date.now();
        return when >= start && when <= end;
    });
}

// "2025-04-21" -> that day (UTC midnight), else null
function parseDay(text) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(text || ''))) return null;
    const day = new Date(text + 'T00:00:00.000Z');
    return isNaN(day) || day.toISOString().slice(0, 10) !== text ? null : day;
}

// Members -> [[first, last, 'Male'|'Female'], ...] of those on the team that
// day, a member's other names (alternateFullNames) as more entries
function rosterOn(members, day) {
    const team = [];
    members.filter(m => m.firstname && m.lastname && wasActiveOn(m, day)).forEach(m => {
        team.push([m.firstname, m.lastname, m.sex || '']);
        (m.alternateFullNames || []).forEach(full => {
            const words = String(full).trim().split(/\s+/);
            if (words.length > 1) team.push([words[0], words.slice(1).join(' '), m.sex || '']);
        });
    });
    return team;
}

module.exports = { rosterOn, parseDay, wasActiveOn };
