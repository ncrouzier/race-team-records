const mongoose = require('mongoose');

// A member's suggested corrections to one of their results, until an admin
// handles or declines it (app/correctionRoutes.js, app/correctionRequests.js)
const correctionRequestSchema = new mongoose.Schema({
    result: { type: mongoose.Schema.Types.ObjectId, index: true, required: true },
    // As it was when the request was sent, so the list still reads well if
    // the race changes
    race: {
        _id: mongoose.Schema.Types.ObjectId,
        racename: String,
        racedate: Date
    },
    sender: {
        user: { _id: mongoose.Schema.Types.ObjectId, username: String },
        member: { _id: mongoose.Schema.Types.ObjectId, firstname: String, lastname: String }
    },
    runners: [{ _id: mongoose.Schema.Types.ObjectId, firstname: String, lastname: String }],
    // { field, label, from, to, raceWide, legOrder }
    changes: [{
        _id: false,
        field: String,
        label: String,
        from: mongoose.Schema.Types.Mixed,
        to: mongoose.Schema.Types.Mixed,
        raceWide: Boolean,
        legOrder: Number
    }],
    note: String,
    status: { type: String, enum: ['open', 'handled', 'declined', 'withdrawn'], default: 'open', index: true },
    // Which edit modals have been saved from it: 'result', 'race'
    savedKinds: [String],
    closedBy: { _id: mongoose.Schema.Types.ObjectId, username: String },
    closedAt: Date,
    dismissReason: String
}, { timestamps: true });

module.exports = mongoose.model('CorrectionRequest', correctionRequestSchema);
