const mongoose = require('mongoose');

// A race the applicant submits as proof of the age-grade requirement.
// Stored as a snapshot (not linked to a Race/Result) — applicants aren't members yet.
const applicationRaceSchema = new mongoose.Schema({
    racename: String,
    racedate: Date,
    racetype: {
        _id: mongoose.Schema.Types.ObjectId,
        name: String,
        surface: String,
        meters: Number,
        miles: Number
    },
    timeCentiseconds: Number,
    agegrade: Number,
    // Optional link to the official results page. Stored only if it is http(s) —
    // the review page renders it as a clickable link.
    resultlink: String
}, { _id: false });

// Record of a decision email that was actually sent to the applicant.
// `body` is HTML — the templates support links.
function sentEmailSchema() {
    return {
        subject: String,
        body: String,
        sentAt: { type: Date, default: null },
        sentByUsername: String
    };
}

const teamApplicationSchema = new mongoose.Schema({
    firstname: { type: String, required: true, trim: true },
    lastname: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    sex: { type: String, enum: ['male', 'female', 'other'], required: true },
    dateofbirth: { type: Date, required: true },
    races: [applicationRaceSchema],
    motivation: { type: String, required: true },
    committedToRaces: { type: Boolean, required: true },

    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    // Set once approved — the Member document created from this application.
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedByUsername: String,
    reviewedAt: { type: Date, default: null },
    reviewNotes: String,

    // True when approval attached a new membership period to an existing member
    // (a returning runner) rather than creating a fresh one.
    isReturningMember: { type: Boolean, default: false },

    // Decision emails are sent by hand after the decision, not automatically.
    approvalEmail: sentEmailSchema(),
    rejectionEmail: sentEmailSchema(),

    // Hand-ticked bookkeeping on an approved application — each records who ticked it
    // and when, and can be switched back off.
    // Announced in one of the captains' team emails:
    teamNotified: { type: Boolean, default: false },
    teamNotifiedAt: { type: Date, default: null },
    teamNotifiedByUsername: String,
    // Added to the team's Groups.io mailing list:
    addedToGroupsIo: { type: Boolean, default: false },
    addedToGroupsIoAt: { type: Date, default: null },
    addedToGroupsIoByUsername: String,

    ipAddress: String
}, { timestamps: true });

module.exports = mongoose.model('TeamApplication', teamApplicationSchema);
