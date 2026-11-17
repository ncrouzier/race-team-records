// Volunteer submissions: members report a volunteer job on a public page
// (/submit-volunteer), admins add each from the Volunteer Submissions page
// with the "Add Volunteer Jobs" form filled in. The rules are in
// app/volunteerSubmissions.js. Built like result submissions
// (app/resultSubmissionRoutes.js).

const mongoose = require('mongoose');
const service = require('./service');
const Member = require('./models/member');
const Race = require('./models/race');
const VolunteerJob = require('./models/volunteerjob');
const VolunteerSubmission = require('./models/volunteersubmission');
const rules = require('./volunteerSubmissions');
const { EARLIEST_DATE, MAX_TEXT, parseDay } = require('./resultSubmissions');
const { rosters, myMemberId, submitter } = require('./resultSubmissionRoutes');

// The races the event box suggests: the recent ones, where nearly every job
// is (and a few days ahead, for set-up and packet pickup)
const RECENT_RACE_DAYS = 120;
// The jobs offered as one-tap choices, from the jobs already recorded
const COMMON_JOB_COUNT = 8;
const COMMON_JOBS_MS = 60 * 60 * 1000;

function siteUrl() {
    return (process.env.SITE_URL || '').replace(/\/$/, '') || 'https://raceteam.mcrrc.org';
}

function formatDay(date) {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

// A date as a range of that UTC day (stored dates are midnight UTC, but not all)
function sameDay(date) {
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    return { $gte: start, $lt: new Date(start.getTime() + 86400000) };
}

let commonJobs = { at: 0, list: [] };
async function commonJobList() {
    if (Date.now() - commonJobs.at < COMMON_JOBS_MS) return commonJobs.list;
    const rows = await VolunteerJob.aggregate([
        { $group: { _id: { $trim: { input: '$description' } }, n: { $sum: 1 } } }
    ]);
    commonJobs = { at: Date.now(), list: rules.commonJobs(rows, COMMON_JOB_COUNT) };
    return commonJobs.list;
}

// The admin's email for a new submission. A failure is logged: the submission
// is saved either way, and shows in the admin menu.
function notifyAdmin(submission) {
    const lines = [
        rules.runnerName(submission) + (submission.member && submission.member._id ? '' : ' (not on the roster)') + ' reported a volunteer job:',
        '',
        submission.eventName + (submission.race && submission.race._id ? '' : ' (not a race on the site)') + ', ' + formatDay(submission.jobDate),
        '"' + submission.description + '"',
        '',
        'Add it: ' + siteUrl() + '/volunteer-submissions'
    ];
    // transport: the site's mail transport (config/mail.js)
    transport.sendMail({
        from: { name: 'MCRRC Racing Team', address: process.env.MCRRC_FROM_EMAIL },
        to: { name: 'MCRRC RACE TEAM SITE ADMIN', address: process.env.MCRRC_FROM_EMAIL },
        subject: 'Volunteer job submitted: ' + rules.runnerName(submission) + ', ' + submission.eventName,
        text: lines.join('\n')
    }, function (error) {
        if (error) console.error('Volunteer submission email failed:', error);
    });
}

module.exports = function (app) {

    function route(handler) {
        return async function (req, res) {
            try {
                await handler(req, res);
            } catch (err) {
                console.error('Volunteer submission error:', err);
                res.status(500).json({ error: 'Something went wrong with the volunteer submission.' });
            }
        };
    }

    async function load(id) {
        return mongoose.isValidObjectId(id) ? VolunteerSubmission.findById(id) : null;
    }

    // Public: what the submission page (views/submitVolunteer.html) offers:
    // the roster, the recent races, the common jobs and the signed-in member
    app.get('/api/volunteer-submissions/form', route(async (req, res) => {
        const from = new Date(Date.now() - RECENT_RACE_DAYS * 86400000);
        const to = new Date(Date.now() + 7 * 86400000);
        const [roster, races, jobs] = await Promise.all([
            rosters(req.user),
            Race.find({ racedate: { $gte: from, $lte: to } }).select('racename racedate location').sort({ racedate: -1 }).lean(),
            commonJobList()
        ]);
        res.json({
            members: roster.members,
            pastMembers: roster.pastMembers,
            races: races.map(r => ({
                _id: String(r._id),
                racename: r.racename,
                racedate: new Date(r.racedate).toISOString().slice(0, 10),
                state: r.location && (r.location.state || r.location.country) || ''
            })),
            commonJobs: jobs,
            myMemberId: myMemberId(req.user),
            earliestDate: EARLIEST_DATE
        });
    }));

    // Public: the jobs the site already has for this member on this day, so
    // the page can say so before they send it again
    app.get('/api/volunteer-submissions/check', route(async (req, res) => {
        const date = parseDay(req.query.jobDate);
        if (!mongoose.isValidObjectId(req.query.memberId) || !date) return res.json({ jobs: [], pending: 0 });
        const memberId = new mongoose.Types.ObjectId(String(req.query.memberId));
        const [jobs, pending] = await Promise.all([
            VolunteerJob.find({ 'member._id': memberId, jobDate: sameDay(date) }).select('eventName description').lean(),
            VolunteerSubmission.countDocuments({ 'member._id': memberId, jobDate: sameDay(date), status: 'pending' })
        ]);
        res.json({ jobs: jobs.map(j => ({ eventName: j.eventName, description: j.description })), pending });
    }));

    // Public: send one
    app.post('/api/volunteer-submissions', route(async (req, res) => {
        const { values, error, field } = rules.clean(req.body);
        if (error) return res.status(400).json({ error, field });

        const submission = new VolunteerSubmission({
            runnerName: values.runnerName,
            eventName: values.eventName,
            jobDate: values.jobDate,
            description: values.description
        });
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
            const race = mongoose.isValidObjectId(values.raceId) &&
                await Race.findById(values.raceId).select('racename racedate').lean();
            // Gone meanwhile: keep what they typed, as an event by name
            if (race) {
                submission.race = { _id: race._id, racename: race.racename, racedate: race.racedate };
                submission.eventName = race.racename;
            }
        }

        // The same job sent twice (a double tap, a reload): say so
        const duplicate = await VolunteerSubmission.findOne({
            status: 'pending',
            jobDate: submission.jobDate,
            eventName: submission.eventName,
            description: submission.description,
            ...(submission.member && submission.member._id ? { 'member._id': submission.member._id } : { runnerName: submission.runnerName })
        }).lean();
        if (duplicate) return res.status(409).json({ error: 'This job was already sent. It is waiting for an admin to add it.' });

        if (req.user) submission.submittedBy = { _id: req.user._id, username: req.user.username };
        submission.ipAddress = req.ip;
        await submission.save();

        notifyAdmin(submission);
        // Who sent it, and for whom: not signed in, it could be anyone
        const by = submitter(req.user, submission);
        service.logActivity({
            userId: req.user && req.user._id,
            username: by.username,
            action: 'volunteer_submitted',
            description: by.who + (by.own ? ' reported their volunteer job at ' : ' reported a volunteer job for ' + by.runner + ' at ') + submission.eventName,
            targetType: 'volunteersubmission',
            targetId: submission._id.toString(),
            targetName: rules.runnerName(submission),
            metadata: {
                volunteer: rules.runnerName(submission),
                // A member picked from the list: the log links their page
                targetUsername: runnerUsername || undefined,
                submittedBy: by.signedIn ? by.who : null,
                signedIn: by.signedIn,
                ownJob: by.own,
                eventName: submission.eventName,
                jobDate: submission.jobDate,
                description: submission.description
            },
            ipAddress: req.ip
        });
        res.status(201).json({ success: true });
    }));

    // Admins: the pending submissions (with the jobs the volunteer already has
    // that day), or the closed ones
    app.get('/api/volunteer-submissions', service.isAdminLoggedIn, route(async (req, res) => {
        const done = req.query.status === 'done';
        const submissions = await VolunteerSubmission.find(done ? { status: { $ne: 'pending' } } : { status: 'pending' })
            .sort(done ? { closedAt: -1 } : { createdAt: 1 })
            .limit(done ? 200 : 0)
            .select('-ipAddress')
            .lean();
        if (done) return res.json(submissions);

        const onRoster = submissions.filter(s => s.member && s.member._id);
        const jobs = onRoster.length ? await VolunteerJob.find({
            $or: onRoster.map(s => ({ 'member._id': s.member._id, jobDate: sameDay(s.jobDate) }))
        }).select('member._id jobDate eventName description').lean() : [];
        const day = d => new Date(d).toISOString().slice(0, 10);
        submissions.forEach(s => {
            s.existingJobs = s.member && s.member._id ? jobs.filter(j =>
                String(j.member._id) === String(s.member._id) && day(j.jobDate) === day(s.jobDate)) : [];
        });
        res.json(submissions);
    }));

    // An admin saved a job from it
    app.post('/api/volunteer-submissions/:id/added', service.isAdminLoggedIn, route(async (req, res) => {
        const submission = await load(req.params.id);
        if (!submission) return res.status(404).json({ error: 'Submission not found' });
        if (submission.status !== 'pending') return res.status(409).json({ error: 'Already closed' });
        const job = mongoose.isValidObjectId(req.body && req.body.jobId) &&
            await VolunteerJob.findById(req.body.jobId).select('_id').lean();
        if (!job) return res.status(400).json({ error: 'Volunteer job not found' });
        submission.status = 'added';
        submission.job = job._id;
        submission.closedAt = new Date();
        submission.closedBy = { _id: req.user._id, username: req.user.username };
        await submission.save();
        await service.setActivityHandled('volunteersubmission', submission._id, true);
        res.json(submission);
    }));

    // An admin declines it, with an optional reason
    app.post('/api/volunteer-submissions/:id/dismiss', service.isAdminLoggedIn, route(async (req, res) => {
        const submission = await load(req.params.id);
        if (!submission) return res.status(404).json({ error: 'Submission not found' });
        if (submission.status !== 'pending') return res.status(409).json({ error: 'Already closed' });
        submission.status = 'dismissed';
        submission.dismissReason = String((req.body && req.body.reason) || '').trim().slice(0, MAX_TEXT) || null;
        submission.closedAt = new Date();
        submission.closedBy = { _id: req.user._id, username: req.user.username };
        await submission.save();
        await service.setActivityHandled('volunteersubmission', submission._id, true);
        res.json(submission);
    }));

    // An admin found it already on the site: done, with nothing to add
    app.post('/api/volunteer-submissions/:id/already', service.isAdminLoggedIn, route(async (req, res) => {
        const submission = await load(req.params.id);
        if (!submission) return res.status(404).json({ error: 'Submission not found' });
        if (submission.status !== 'pending') return res.status(409).json({ error: 'Already closed' });
        submission.status = 'already';
        submission.closedAt = new Date();
        submission.closedBy = { _id: req.user._id, username: req.user.username };
        await submission.save();
        await service.setActivityHandled('volunteersubmission', submission._id, true);
        res.json(submission);
    }));

    // Back to pending: dismissed (or marked already entered) by mistake
    app.post('/api/volunteer-submissions/:id/reopen', service.isAdminLoggedIn, route(async (req, res) => {
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
        await service.setActivityHandled('volunteersubmission', submission._id, false);
        res.json(submission);
    }));
};
