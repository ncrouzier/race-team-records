// Result submissions: runners report a race result on a public page
// (/submit-result), admins turn each into a result from the Result
// Submissions page with the "Add result" form filled in. The rules are in
// app/resultSubmissions.js, shared with the admin's page.

const mongoose = require('mongoose');
const service = require('./service');
const bumpStamp = require('./models/stamp');
const Member = require('./models/member');
const Race = require('./models/race');
const RaceType = require('./models/racetype');
const Result = require('./models/result');
const ResultSubmission = require('./models/resultsubmission');
const raceLocations = require('../config/locations');
const rules = require('./resultSubmissions');

const COUNTRY_CODES = raceLocations.countries.map(c => c.code);
const STATE_CODES = raceLocations.states.map(s => s.code);

function siteUrl() {
    return (process.env.SITE_URL || '').replace(/\/$/, '') || 'https://raceteam.mcrrc.org';
}

function formatDay(date) {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

// The admin's email for a new submission. A failure is logged: the submission
// is saved either way, and shows in the admin menu.
function notifyAdmin(submission) {
    const r = submission.ranking || {};
    const places = rules.PLACES
        .map(p => rules.placeText(r, p.rank) && p.label + ': ' + rules.placeText(r, p.rank))
        .filter(Boolean);
    const where = submission.location.state ? submission.location.state + ', ' + submission.location.country : submission.location.country;
    const lines = [
        rules.runnerName(submission) + (submission.member && submission.member._id ? '' : ' (not on the roster)') + ' submitted a result:',
        '',
        submission.racename + ' (' + where + '), ' + formatDay(submission.racedate),
        rules.distanceLabel(submission) + ' in ' + rules.formatTime(submission.time)
    ];
    if (submission.splits) lines.push('Splits: ' + submission.splits);
    if (places.length) lines.push(places.join(', '));
    lines.push('Results: ' + (submission.resultlink || 'none online'));
    if (submission.photoLink) lines.push('Photos: ' + submission.photoLink);
    if (submission.comments) lines.push('', 'Remarks: "' + submission.comments + '"');
    if (submission.highlight) lines.push('', 'For the Ins & Outs highlights: "' + submission.highlight + '"');
    lines.push('', 'Add it: ' + siteUrl() + '/result-submissions');

    // transport: the site's mail transport (config/mail.js)
    transport.sendMail({
        from: { name: 'MCRRC Racing Team', address: process.env.MCRRC_FROM_EMAIL },
        to: { name: 'MCRRC RACE TEAM SITE ADMIN', address: process.env.MCRRC_FROM_EMAIL },
        subject: 'Result submitted: ' + rules.runnerName(submission) + ', ' + submission.racename,
        text: lines.join('\n')
    }, function (error) {
        if (error) console.error('Result submission email failed:', error);
    });
}

// The results already on the site for these runners on these days, keyed
// 'memberId|day': a submission someone already added by hand, or sent twice
async function existingResults(pairs) {
    if (!pairs.length) return {};
    const results = await Result.find({
        $or: pairs.map(p => ({ 'members._id': p.memberId, 'race.racedate': sameDay(p.racedate) }))
    }).select('time members._id race._id race.racename race.racedate race.racetype.name race.distanceName').lean();
    const byKey = {};
    results.forEach(result => {
        result.members.forEach(m => {
            const key = String(m._id) + '|' + new Date(result.race.racedate).toISOString().slice(0, 10);
            (byKey[key] = byKey[key] || []).push({
                _id: result._id,
                raceId: result.race._id,
                racename: result.race.racename,
                distance: result.race.distanceName || (result.race.racetype && result.race.racetype.name),
                time: result.time
            });
        });
    });
    return byKey;
}

// A race date as a range of that UTC day: stored dates are midnight UTC, but
// an odd one with a time would otherwise be missed
function sameDay(date) {
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    return { $gte: start, $lt: new Date(start.getTime() + 86400000) };
}

// The race types with the most races, most first: the top of the page's
// distance list. Counted at most once an hour.
const POPULAR_COUNT = 10;
// The races the race name box suggests: the recent ones, where nearly every
// submission is
const RECENT_RACE_DAYS = 120;
const POPULAR_MS = 60 * 60 * 1000;
let popular = { at: 0, ids: [] };
async function popularRacetypeIds() {
    if (Date.now() - popular.at < POPULAR_MS) return popular.ids;
    const counts = await Race.aggregate([
        { $group: { _id: '$racetype._id', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        // Room for variable types, which the page leaves out
        { $limit: POPULAR_COUNT * 2 }
    ]);
    popular = { at: Date.now(), ids: counts.filter(c => c._id).map(c => String(c._id)) };
    return popular.ids;
}

function dayKey(memberId, date) {
    return String(memberId) + '|' + new Date(date).toISOString().slice(0, 10);
}

// The rosters the pages' "Who?" picker offers: the current members (plus
// the signed-in member, on the team or not), and the past ones, searched
// next by someone not on the current list
async function rosters(user) {
    const fields = 'firstname lastname memberStatus';
    const all = await Member.find({}, fields).sort({ firstname: 1, lastname: 1 }).lean();
    const entry = m => ({ _id: String(m._id), name: ((m.firstname || '') + ' ' + (m.lastname || '')).trim() });
    const me = user && user.member && user.member._id ? String(user.member._id) : '';
    const current = all.filter(m => m.memberStatus === 'current' || String(m._id) === me);
    const past = all.filter(m => m.memberStatus !== 'current' && String(m._id) !== me);
    return { members: current.map(entry), pastMembers: past.map(entry) };
}

// Who sent a submission, for the activity log: the signed-in user, who may
// be sending it for a teammate, or someone not signed in, who could be anyone
// (not necessarily the runner they name). Returns the log entry's username,
// the sentence's subject ("Liz Ozeki", "Someone (not signed in)"), whether it
// is the runner's own (`own`), and the runner as the sentence names them.
function submitter(user, submission) {
    const runner = submission.member && submission.member._id
        ? ((submission.member.firstname || '') + ' ' + (submission.member.lastname || '')).trim()
        : (submission.runnerName || '') + ' (typed, not on the roster)';
    if (!user) {
        return { username: 'not signed in', who: 'Someone (not signed in)', own: false, runner: runner, signedIn: false };
    }
    const me = user.member;
    const name = me && me.firstname ? (me.firstname + ' ' + (me.lastname || '')).trim() : user.username;
    const own = !!(me && me._id && submission.member && submission.member._id &&
        String(me._id) === String(submission.member._id));
    return { username: user.username, who: name, own: own, runner: runner, signedIn: true };
}

function myMemberId(user) {
    return user && user.member && user.member._id ? String(user.member._id) : '';
}

module.exports = function (app) {

    function route(handler) {
        return async function (req, res) {
            try {
                await handler(req, res);
            } catch (err) {
                console.error('Result submission error:', err);
                res.status(500).json({ error: 'Something went wrong with the result submission.' });
            }
        };
    }

    async function load(id) {
        return mongoose.isValidObjectId(id) ? ResultSubmission.findById(id) : null;
    }

    // Public: what the submission page (views/submitResult.html) offers: the
    // roster, the distances (the most raced first) and the signed-in member
    app.get('/api/result-submissions/form', route(async (req, res) => {
        const from = new Date(Date.now() - RECENT_RACE_DAYS * 86400000);
        const [roster, racetypes, popularIds, races] = await Promise.all([
            rosters(req.user),
            // Variable race types (multisport, odd distances) need details the
            // admin fills in: the runner picks "Other" and describes it
            RaceType.find({ isVariable: { $ne: true } }).select('name surface meters miles').sort({ meters: 1 }).lean(),
            popularRacetypeIds(),
            Race.find({ racedate: { $gte: from, $lte: new Date(Date.now() + 86400000) } })
                .select('racename racedate location racetype distanceName isMultisport').sort({ racedate: -1 }).lean()
        ]);
        const offered = new Set(racetypes.map(rt => String(rt._id)));
        res.json({
            members: roster.members,
            pastMembers: roster.pastMembers,
            racetypes,
            popularRacetypeIds: popularIds.filter(id => offered.has(id)).slice(0, POPULAR_COUNT),
            // The recent races, for the race name box: picking one fills in
            // its date, place and distance
            races: races.map(r => ({
                _id: String(r._id),
                racename: r.racename,
                racedate: new Date(r.racedate).toISOString().slice(0, 10),
                location: { country: r.location && r.location.country, state: r.location && r.location.state },
                racetypeId: r.racetype && r.racetype._id ? String(r.racetype._id) : '',
                distance: r.distanceName || (r.racetype && r.racetype.name) || '',
                surface: r.racetype && r.racetype.surface || ''
            })),
            myMemberId: myMemberId(req.user),
            earliestDate: rules.EARLIEST_DATE
        });
    }));

    // Public: what the site already has for this runner on this day, so the
    // page can say "already on the site" before they send it again
    app.get('/api/result-submissions/check', route(async (req, res) => {
        const date = rules.parseDay(req.query.racedate);
        if (!mongoose.isValidObjectId(req.query.memberId) || !date) return res.json({ results: [], pending: 0 });
        const memberId = new mongoose.Types.ObjectId(String(req.query.memberId));
        const [byKey, pending] = await Promise.all([
            existingResults([{ memberId, racedate: date }]),
            ResultSubmission.countDocuments({ 'member._id': memberId, racedate: sameDay(date), status: 'pending' })
        ]);
        const results = (byKey[dayKey(memberId, date)] || []).map(r => ({
            _id: r._id, raceId: r.raceId, racename: r.racename, distance: r.distance, time: rules.formatTime(r.time)
        }));
        // Their result in the race they picked, if it is in already
        const raceId = mongoose.isValidObjectId(req.query.raceId) ? String(req.query.raceId) : null;
        const inRace = raceId ? results.filter(r => String(r.raceId) === raceId) : [];
        res.json({ results, inRace, pending });
    }));

    // Public: send one
    app.post('/api/result-submissions', route(async (req, res) => {
        const { values, error, field } = rules.clean(req.body, { countries: COUNTRY_CODES, states: STATE_CODES });
        if (error) return res.status(400).json({ error, field });

        const submission = new ResultSubmission(values);
        let runnerUsername = null;
        if (values.memberId) {
            const member = mongoose.isValidObjectId(values.memberId) &&
                await Member.findById(values.memberId).select('firstname lastname username').lean();
            if (!member) return res.status(400).json({ error: 'Please pick your name from the list.', field: 'runner' });
            submission.member = { _id: member._id, firstname: member.firstname, lastname: member.lastname };
            // The log links the runner's page (not for a name typed in)
            runnerUsername = member.username;
        }
        if (values.raceId) {
            // Gone meanwhile: the race is just named, as typed
            const race = mongoose.isValidObjectId(values.raceId) && await Race.findById(values.raceId).select('racename').lean();
            if (race) submission.race = { _id: race._id, racename: race.racename };
        }
        if (values.racetypeId) {
            const rt = mongoose.isValidObjectId(values.racetypeId) && await RaceType.findById(values.racetypeId).lean();
            if (!rt) return res.status(400).json({ error: 'Please pick the distance.', field: 'distance' });
            submission.racetype = { _id: rt._id, name: rt.name, surface: rt.surface, meters: rt.meters, miles: rt.miles, isVariable: !!rt.isVariable };
        }

        // The same result sent twice (a double tap, a reload): say so
        const duplicate = await ResultSubmission.findOne({
            status: 'pending',
            racedate: submission.racedate,
            time: submission.time,
            ...(submission.member && submission.member._id ? { 'member._id': submission.member._id } : { runnerName: submission.runnerName })
        }).lean();
        if (duplicate) return res.status(409).json({ error: 'This result was already sent. It is waiting for an admin to add it.' });

        if (req.user) submission.submittedBy = { _id: req.user._id, username: req.user.username };
        submission.ipAddress = req.ip;
        await submission.save();

        notifyAdmin(submission);
        // Who sent it, and for whom: not signed in, it could be anyone
        const by = submitter(req.user, submission);
        service.logActivity({
            userId: req.user && req.user._id,
            username: by.username,
            action: 'result_submitted',
            description: by.who + (by.own ? ' submitted their result for ' : ' submitted a result for ' + by.runner + ': ') + submission.racename,
            targetType: 'resultsubmission',
            targetId: submission._id.toString(),
            targetName: rules.runnerName(submission),
            metadata: {
                runner: rules.runnerName(submission),
                // A member picked from the list: the log links their page
                targetUsername: runnerUsername || undefined,
                submittedBy: by.signedIn ? by.who : null,
                signedIn: by.signedIn,
                ownResult: by.own,
                racename: submission.racename,
                racedate: submission.racedate,
                distance: rules.distanceLabel(submission),
                time: rules.formatTime(submission.time)
            },
            ipAddress: req.ip
        });
        res.status(201).json({ success: true });
    }));

    // Admins: the pending submissions (with what the site already has that
    // day: the runner's results, and races a teammate's result is in), or the
    // closed ones
    app.get('/api/result-submissions', service.isAdminLoggedIn, route(async (req, res) => {
        const done = req.query.status === 'done';
        const submissions = await ResultSubmission.find(done ? { status: { $ne: 'pending' } } : { status: 'pending' })
            .sort(done ? { closedAt: -1 } : { createdAt: 1 })
            .limit(done ? 200 : 0)
            .select('-ipAddress')
            .lean();
        if (done || !submissions.length) return res.json(submissions);

        const byKey = await existingResults(submissions
            .filter(s => s.member && s.member._id)
            .map(s => ({ memberId: s.member._id, racedate: s.racedate })));
        const days = [...new Set(submissions.map(s => new Date(s.racedate).getTime()))].map(t => new Date(t));
        const races = await Race.find({ $or: days.map(day => ({ racedate: sameDay(day) })) })
            .select('racename racedate order isMultisport distanceName location racetype')
            .sort({ racename: 1 })
            .lean();
        const { checksFor } = require('./resultCheckRoutes');
        for (const s of submissions) {
            // The checks the result form would run, on the result as submitted
            // (added to the race the runner picked, if they did)
            const linked = s.race && s.race._id && await Race.findById(s.race._id, 'racename racedate location racetype distanceName isMultisport order').lean();
            s.checks = await checksFor({
                members: s.member && s.member._id ? [{ _id: s.member._id }] : [],
                race: linked || { racename: s.racename, racedate: s.racedate, location: s.location, racetype: s.racetype && s.racetype._id ? s.racetype : null },
                time: s.time,
                ranking: s.ranking
            }, { isNew: true }).catch(err => {
                console.error('Submission checks error:', err);
                return [];
            });
        }
        submissions.forEach(s => {
            s.existingResults = s.member && s.member._id ? byKey[dayKey(s.member._id, s.racedate)] || [] : [];
            // The submission's distance first: the likeliest match
            const sameType = r => !!(s.racetype && r.racetype && String(r.racetype._id) === String(s.racetype._id));
            s.sameDayRaces = races
                .filter(r => dayKey('', r.racedate) === dayKey('', s.racedate))
                .sort((a, b) => sameType(b) - sameType(a));
        });
        res.json(submissions);
    }));

    // Admins: the runners' Ins & Outs notes for races in a period (the Create
    // Report page puts them in the highlights document for Claude). From
    // submissions that made it onto the site: added from here (`result`), or
    // found already entered (matched to a result by runner and day there).
    app.get('/api/result-submissions/highlights', service.isAdminLoggedIn, route(async (req, res) => {
        const from = rules.parseDay(req.query.from);
        const to = rules.parseDay(req.query.to);
        if (!from || !to) return res.status(400).json({ error: 'from and to (YYYY-MM-DD) are required' });
        const submissions = await ResultSubmission.find({
            status: { $in: ['added', 'already'] },
            highlight: { $nin: [null, ''] },
            racedate: { $gte: from, $lt: new Date(to.getTime() + 86400000) }
        }, 'member runnerName racename racedate highlight result status').lean();
        res.json(submissions.map(s => ({
            resultId: s.result ? String(s.result) : null,
            memberId: s.member && s.member._id ? String(s.member._id) : null,
            runner: rules.runnerName(s),
            racename: s.racename,
            racedate: new Date(s.racedate).toISOString().slice(0, 10),
            note: s.highlight
        })));
    }));

    // An admin saved a result from it. With addPhotoLink, the runner's photo
    // gallery link goes on the race (and its copies in the race's results).
    app.post('/api/result-submissions/:id/added', service.isAdminLoggedIn, route(async (req, res) => {
        const submission = await load(req.params.id);
        if (!submission) return res.status(404).json({ error: 'Submission not found' });
        if (submission.status !== 'pending') return res.status(409).json({ error: 'Already closed' });
        const result = mongoose.isValidObjectId(req.body && req.body.resultId) &&
            await Result.findById(req.body.resultId).select('race._id').lean();
        if (!result) return res.status(400).json({ error: 'Result not found' });

        submission.status = 'added';
        submission.result = result._id;
        submission.closedAt = new Date();
        submission.closedBy = { _id: req.user._id, username: req.user.username };
        await submission.save();
        await service.setActivityHandled('resultsubmission', submission._id, true);

        if (req.body.addPhotoLink && submission.photoLink && result.race && result.race._id) {
            const link = { url: submission.photoLink, label: 'Photos' };
            const raceChange = await Race.updateOne(
                { _id: result.race._id, 'photoLinks.url': { $ne: link.url } }, { $push: { photoLinks: link } });
            await Result.updateMany(
                { 'race._id': result.race._id, 'race.photoLinks.url': { $ne: link.url } }, { $push: { 'race.photoLinks': link } });
            if (raceChange.modifiedCount) {
                await bumpStamp('raceUpdate');
                await bumpStamp('resultUpdate');
            }
        }
        res.json(submission);
    }));

    // An admin declines it, with an optional reason
    app.post('/api/result-submissions/:id/dismiss', service.isAdminLoggedIn, route(async (req, res) => {
        const submission = await load(req.params.id);
        if (!submission) return res.status(404).json({ error: 'Submission not found' });
        if (submission.status !== 'pending') return res.status(409).json({ error: 'Already closed' });
        submission.status = 'dismissed';
        submission.dismissReason = String((req.body && req.body.reason) || '').trim().slice(0, rules.MAX_TEXT) || null;
        submission.closedAt = new Date();
        submission.closedBy = { _id: req.user._id, username: req.user.username };
        await submission.save();
        await service.setActivityHandled('resultsubmission', submission._id, true);
        res.json(submission);
    }));

    // An admin found it already on the site: done, with nothing to add
    app.post('/api/result-submissions/:id/already', service.isAdminLoggedIn, route(async (req, res) => {
        const submission = await load(req.params.id);
        if (!submission) return res.status(404).json({ error: 'Submission not found' });
        if (submission.status !== 'pending') return res.status(409).json({ error: 'Already closed' });
        submission.status = 'already';
        submission.closedAt = new Date();
        submission.closedBy = { _id: req.user._id, username: req.user.username };
        await submission.save();
        await service.setActivityHandled('resultsubmission', submission._id, true);
        res.json(submission);
    }));

    // Back to pending: dismissed (or marked already entered) by mistake
    app.post('/api/result-submissions/:id/reopen', service.isAdminLoggedIn, route(async (req, res) => {
        const submission = await load(req.params.id);
        if (!submission) return res.status(404).json({ error: 'Submission not found' });
        if (submission.status !== 'dismissed' && submission.status !== 'already') {
            return res.status(409).json({ error: 'Only a dismissed or already entered submission can be reopened' });
        }
        submission.status = 'pending';
        submission.dismissReason = null;
        submission.closedAt = null;
        submission.closedBy = undefined;
        await submission.save();
        await service.setActivityHandled('resultsubmission', submission._id, false);
        res.json(submission);
    }));
};

module.exports.rosters = rosters;
module.exports.submitter = submitter;
module.exports.myMemberId = myMemberId;
