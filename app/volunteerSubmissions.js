// Volunteer submissions: a member reports a volunteer job on the public page
// (public/views/submitVolunteer.html), and an admin adds it with the usual "Add
// Volunteer Jobs" form, filled in from the submission
// (app/volunteerSubmissionRoutes.js). Dates and limits as for result
// submissions (app/resultSubmissions.js).

const { parseDay, EARLIEST_DATE, MAX_TEXT, MAX_SHORT } = require('./resultSubmissions');

function text(value, max) {
    return String(value === null || value === undefined ? '' : value).trim().slice(0, max);
}

// The submitted form → the values to store, or the first problem found:
// { error, field }. The member and race ids are checked against the database
// by the route.
function clean(body) {
    body = body || {};
    function fail(field, error) { return { field: field, error: error }; }
    const values = {};

    const memberId = text(body.memberId, 50);
    const runnerName = text(body.runnerName, MAX_SHORT);
    if (memberId) values.memberId = memberId;
    else if (runnerName) values.runnerName = runnerName;
    else return fail('runner', 'Please pick your name, or type it if you are not on the list.');

    // A race on the site, or any other event by name
    const raceId = text(body.raceId, 50);
    if (raceId) values.raceId = raceId;
    values.eventName = text(body.eventName, MAX_SHORT);
    if (!values.eventName) return fail('event', 'Please enter the race or event.');

    values.jobDate = parseDay(body.jobDate);
    if (!values.jobDate) return fail('jobDate', 'Please enter the date.');
    // A day of slack for the volunteer's time zone
    if (values.jobDate.getTime() > Date.now() + 86400000) return fail('jobDate', 'The date can\'t be in the future.');
    if (values.jobDate < parseDay(EARLIEST_DATE)) return fail('jobDate', 'Volunteer jobs go back to 2013 on this site.');

    values.description = text(body.description, MAX_TEXT);
    if (!values.description) return fail('description', 'Please say what you did.');

    return { values: values };
}

// One entry per job however it was typed ("Course Marshal", "course marshal",
// "Course Marshall": case, spaces and doubled letters don't count), in its
// most used spelling, most used first. rows: [{ _id: spelling, n }]
function commonJobs(rows, count) {
    const byKey = new Map();
    rows.forEach(row => {
        const spelling = String(row._id || '').trim();
        if (!spelling) return;
        const key = spelling.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/(.)\1+/g, '$1');
        const entry = byKey.get(key) || { total: 0, best: null, bestN: 0 };
        entry.total += row.n;
        if (row.n > entry.bestN) {
            entry.best = spelling;
            entry.bestN = row.n;
        }
        byKey.set(key, entry);
    });
    return [...byKey.values()]
        // Long ones are one-offs ("Presented on injury prevention to …")
        .filter(e => e.total > 1 && e.best.length <= 40)
        .sort((a, b) => b.total - a.total)
        .slice(0, count)
        .map(e => e.best);
}

function runnerName(submission) {
    if (submission.member && submission.member._id) {
        return ((submission.member.firstname || '') + ' ' + (submission.member.lastname || '')).trim();
    }
    return submission.runnerName || '';
}

module.exports = { clean, commonJobs, runnerName };
