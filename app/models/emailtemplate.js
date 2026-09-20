const mongoose = require('mongoose');

// A captain-edited version of one of the built-in email templates.
//
// A row exists only once someone has edited that template: with no row the
// built-in default in routes.js is used, so "reset to default" is a delete
// rather than a copy of the original text. That way improvements to the
// defaults reach anyone who has not overridden them.
const emailTemplateSchema = mongoose.Schema({
    // 'application_approval' | 'application_rejection'
    key: { type: String, required: true, unique: true, index: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    updatedAt: Date,
    updatedByUsername: String
});

emailTemplateSchema.pre('save', function () {
    this.updatedAt = Date.now();
});

module.exports = mongoose.model('EmailTemplate', emailTemplateSchema);
