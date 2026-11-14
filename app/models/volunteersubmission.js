const mongoose = require('mongoose');

// A volunteer job a member reported on the public submission page
// (/submit-volunteer), until an admin adds it or dismisses it
// (app/volunteerSubmissionRoutes.js, app/volunteerSubmissions.js).
const volunteerSubmissionSchema = new mongoose.Schema({
    // The volunteer picked from the roster. Unset when they typed their name
    // instead (not on the list), in runnerName.
    member: {
        _id: mongoose.Schema.Types.ObjectId,
        firstname: String,
        lastname: String
    },
    runnerName: String,

    // The race on the site they picked, as it was when submitted. Unset for
    // any other event, named in eventName (which mirrors the race name when
    // there is one, like VolunteerJob).
    race: {
        _id: mongoose.Schema.Types.ObjectId,
        racename: String,
        racedate: Date
    },
    eventName: { type: String, required: true },
    jobDate: { type: Date, required: true },
    description: { type: String, required: true },

    // already: it was on the site before anyone added it from here (entered
    // by hand, or sent twice): done, but not added from it nor turned down
    status: { type: String, enum: ['pending', 'added', 'already', 'dismissed'], default: 'pending', index: true },
    // The volunteer job an admin created from it
    job: { type: mongoose.Schema.Types.ObjectId, default: null },
    dismissReason: String,
    closedBy: { _id: mongoose.Schema.Types.ObjectId, username: String },
    closedAt: Date,

    // Signed in when submitting, if they were
    submittedBy: { _id: mongoose.Schema.Types.ObjectId, username: String },
    ipAddress: String
}, { timestamps: true });

module.exports = mongoose.model('VolunteerSubmission', volunteerSubmissionSchema);
