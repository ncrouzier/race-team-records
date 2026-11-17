var mongoose = require('mongoose');

var activityLogSchema = mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: String,
    action: String,
    description: String,
    targetType: String,
    targetId: String,
    targetName: String,
    metadata: mongoose.Schema.Types.Mixed,
    ipAddress: String,
    createdAt: Date,
    // Admins who have individually opened this entry — lets "seen" be
    // per-entry (opening one log doesn't silently clear others), alongside
    // each admin's lastSeenActivityLogAt cursor used for bulk mark-all.
    seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // What it is about has been dealt with (a submission added or
    // dismissed: service.setActivityHandled): no longer "unseen" for anyone
    handled: Boolean
});

activityLogSchema.index({ createdAt: -1 });

activityLogSchema.pre('save', function() {
    if (this.isNew) {
        this.createdAt = Date.now();
    }
});

module.exports = mongoose.model('ActivityLog', activityLogSchema);
