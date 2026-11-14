const mongoose = require('mongoose');

// A race result a runner reported on the public submission page
// (/submit-result), until an admin adds it as a result or dismisses it
// (app/resultSubmissionRoutes.js, app/resultSubmissions.js).
const resultSubmissionSchema = new mongoose.Schema({
    // The runner picked from the roster. Unset when they typed their name
    // instead (not on the list), in runnerName.
    member: {
        _id: mongoose.Schema.Types.ObjectId,
        firstname: String,
        lastname: String
    },
    runnerName: String,

    racename: { type: String, required: true },
    // The race on the site the runner picked, if any (the admin's form then
    // adds the result to it). Unset for a race typed by name.
    race: {
        _id: mongoose.Schema.Types.ObjectId,
        racename: String
    },
    racedate: { type: Date, required: true },
    location: {
        country: String,
        state: String
    },
    // The site's race type, as it was when submitted. Unset for "Other",
    // described in distanceText (a triathlon, an odd distance).
    racetype: {
        _id: mongoose.Schema.Types.ObjectId,
        name: String,
        surface: String,
        meters: Number,
        miles: Number,
        isVariable: Boolean
    },
    distanceText: String,
    // Centiseconds, like Result.time
    time: { type: Number, required: true },
    // Multisport splits, as typed ("swim 33:00, T1 1:30, …")
    splits: String,
    ranking: {
        agerank: Number,
        agetotal: Number,
        genderrank: Number,
        gendertotal: Number,
        overallrank: Number,
        overalltotal: Number
    },
    // http(s) only: the admin page renders it as a link
    resultlink: String,
    noResultLink: Boolean,
    // For the newsletter's highlights: what makes the result special
    highlight: String,
    // Shown next to the result on the site
    comments: String,
    photoLink: String,

    // already: it was on the site before anyone added it from here (entered
    // by hand, or sent twice): done, but not added from it nor turned down
    status: { type: String, enum: ['pending', 'added', 'already', 'dismissed'], default: 'pending', index: true },
    // The result an admin created from it
    result: { type: mongoose.Schema.Types.ObjectId, default: null },
    dismissReason: String,
    closedBy: { _id: mongoose.Schema.Types.ObjectId, username: String },
    closedAt: Date,

    // Signed in when submitting, if they were
    submittedBy: { _id: mongoose.Schema.Types.ObjectId, username: String },
    ipAddress: String
}, { timestamps: true });

module.exports = mongoose.model('ResultSubmission', resultSubmissionSchema);
