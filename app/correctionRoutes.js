// Correction requests: members suggest fixes to their own results, admins
// review them (docs/superpowers/specs/2026-10-16-result-correction-requests-design.md).
// The rules are in app/correctionRequests.js, shared with the member's form.

const mongoose = require('mongoose');
const service = require('./service');
const Result = require('./models/result');
const CorrectionRequest = require('./models/correctionrequest');
const { formValues, changesBetween, mergeSuggestion, describeChange, requestRole, afterSave, MAX_TEXT } = require('./correctionRequests');

function siteUrl() {
    return (process.env.SITE_URL || '').replace(/\/$/, '') || 'https://raceteam.mcrrc.org';
}

function fullName(m) {
    return ((m.firstname || '') + ' ' + (m.lastname || '')).trim();
}

// The admin's email for a new or updated request. A failure is logged: the
// request itself is saved either way, and shows in the admin menu.
function notifyAdmin(request, updated) {
    const year = request.race.racedate ? new Date(request.race.racedate).getUTCFullYear() : '';
    const runners = request.runners.map(fullName).join(', ');
    const lines = [
        fullName(request.sender.member) + (updated ? ' updated their correction request' : ' suggests a correction') +
            ' for ' + request.race.racename + (year ? ' (' + year + ')' : '') + ':',
        ''
    ];
    request.changes.forEach(function (change) {
        lines.push('  ' + describeChange(change) + (change.raceWide ? ' (race-wide)' : ''));
    });
    if (request.note) lines.push('', 'Note: "' + request.note + '"');
    lines.push('', 'Review: ' + siteUrl() + '/corrections');

    // transport: the site's mail transport (config/mail.js)
    transport.sendMail({
        from: { name: 'MCRRC Racing Team', address: process.env.MCRRC_FROM_EMAIL },
        to: { name: 'MCRRC RACE TEAM SITE ADMIN', address: process.env.MCRRC_FROM_EMAIL },
        subject: 'Correction request: ' + runners + ', ' + request.race.racename + (year ? ' (' + year + ')' : ''),
        text: lines.join('\n')
    }, function (error) {
        if (error) console.error('Correction request email failed:', error);
    });
}

// Closes deleted results' open requests (the result and race delete routes)
async function closeForResults(resultIds) {
    await CorrectionRequest.updateMany(
        { result: { $in: resultIds }, status: 'open' },
        { $set: { status: 'declined', dismissReason: 'Result deleted', closedAt: new Date() } }
    );
}

async function closeForResult(resultId) {
    await closeForResults([resultId]);
}

module.exports = function (app) {

    function route(handler) {
        return async function (req, res) {
            try {
                await handler(req, res);
            } catch (err) {
                console.error('Correction request error:', err);
                res.status(500).json({ error: 'Something went wrong with the correction request.' });
            }
        };
    }

    async function load(resultId) {
        if (!mongoose.isValidObjectId(resultId)) return {};
        const result = await Result.findById(resultId).lean();
        const open = result ? await CorrectionRequest.findOne({ result: result._id, status: 'open' }) : null;
        return { result, open };
    }

    // What this user may do on this result, and their own open request. For
    // those who may send one, the form's starting values too, from the result
    // as stored: a copy cached in the browser may be out of date, and the
    // changes are worked out against this one.
    app.get('/api/results/:resultId/correction', service.isLoggedIn, route(async (req, res) => {
        const { result, open } = await load(req.params.resultId);
        if (!result) return res.status(404).json({ error: 'Result not found' });
        const role = requestRole(req.user, result, open);
        const mayEdit = role === 'can-send' || role === 'own-pending';
        res.json({
            role,
            request: role === 'own-pending' ? open : null,
            values: mayEdit ? formValues(result) : null,
            runners: mayEdit ? result.members.map(m => ({ _id: m._id, firstname: m.firstname, lastname: m.lastname })) : null,
            isMultisport: mayEdit ? !!(result.race && result.race.isMultisport) : null
        });
    }));

    // Send a request, or update one's own open one. The changes are worked out
    // here from the result as stored, whatever the form sent.
    app.post('/api/results/:resultId/correction', service.isLoggedIn, route(async (req, res) => {
        const { result, open } = await load(req.params.resultId);
        if (!result) return res.status(404).json({ error: 'Result not found' });
        const role = requestRole(req.user, result, open);
        if (role === 'admin' || role === 'none') return res.status(403).json({ error: 'Not allowed' });
        // Who sent it: the teammate's form says so
        if (role === 'other-pending') {
            return res.status(409).json({ error: 'pending', by: open.sender.member && open.sender.member.firstname });
        }

        const current = formValues(result);
        // Only what the member changed, put on the result as stored
        const suggested = mergeSuggestion(current, req.body && req.body.values);
        const changes = changesBetween(current, suggested);
        const note = String((req.body && req.body.note) || '').trim().slice(0, MAX_TEXT) || null;
        if (!changes.length && !note) return res.status(400).json({ error: 'Nothing to correct' });

        if (role === 'own-pending') {
            open.changes = changes;
            open.note = note;
            await open.save();
            notifyAdmin(open, true);
            return res.json(open);
        }

        const me = String(req.user.member._id || req.user.member);
        const member = result.members.find(m => String(m._id) === me);
        const request = await CorrectionRequest.create({
            result: result._id,
            race: { _id: result.race._id, racename: result.race.racename, racedate: result.race.racedate },
            sender: {
                user: { _id: req.user._id, username: req.user.username },
                member: { _id: member._id, firstname: member.firstname, lastname: member.lastname }
            },
            runners: result.members.map(m => ({ _id: m._id, firstname: m.firstname, lastname: m.lastname })),
            changes,
            note
        });
        notifyAdmin(request, false);
        res.status(201).json(request);
    }));

    // The sender takes back their open request
    app.delete('/api/corrections/:id', service.isLoggedIn, route(async (req, res) => {
        const request = mongoose.isValidObjectId(req.params.id) && await CorrectionRequest.findById(req.params.id);
        if (!request || String(request.sender.user._id) !== String(req.user._id)) {
            return res.status(404).json({ error: 'Request not found' });
        }
        if (request.status !== 'open') return res.status(409).json({ error: 'Already closed' });
        request.status = 'withdrawn';
        request.closedAt = new Date();
        await request.save();
        res.json(request);
    }));

    // Admins: the open requests, or the closed ones
    app.get('/api/corrections', service.isAdminLoggedIn, route(async (req, res) => {
        const open = req.query.status !== 'done';
        const requests = await CorrectionRequest.find(open ? { status: 'open' } : { status: { $ne: 'open' } })
            .sort(open ? { createdAt: -1 } : { closedAt: -1 })
            .limit(open ? 0 : 200)
            .lean();
        res.json(requests);
    }));

    // An admin saved an edit from this request
    app.post('/api/corrections/:id/saved', service.isAdminLoggedIn, route(async (req, res) => {
        const request = mongoose.isValidObjectId(req.params.id) && await CorrectionRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ error: 'Request not found' });
        const kind = req.body && req.body.kind === 'race' ? 'race' : 'result';
        const patch = afterSave(request.toObject(), kind, !!(req.body && req.body.keepOpen), req.user, new Date());
        if (!patch) return res.status(409).json({ error: 'Already closed' });
        Object.assign(request, patch);
        await request.save();
        res.json(request);
    }));

    // An admin declines it, with an optional reason
    app.post('/api/corrections/:id/dismiss', service.isAdminLoggedIn, route(async (req, res) => {
        const request = mongoose.isValidObjectId(req.params.id) && await CorrectionRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ error: 'Request not found' });
        if (request.status !== 'open') return res.status(409).json({ error: 'Already closed' });
        request.status = 'declined';
        request.dismissReason = String((req.body && req.body.reason) || '').trim().slice(0, MAX_TEXT) || null;
        request.closedAt = new Date();
        request.closedBy = { _id: req.user._id, username: req.user.username };
        await request.save();
        res.json(request);
    }));
};

module.exports.closeForResult = closeForResult;
module.exports.closeForResults = closeForResults;
