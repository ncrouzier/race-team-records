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
    createdAt: Date
});

activityLogSchema.index({ createdAt: -1 });

activityLogSchema.pre('save', function(next) {
    if (this.isNew) {
        this.createdAt = Date.now();
    }
    next();
});

module.exports = mongoose.model('ActivityLog', activityLogSchema);
