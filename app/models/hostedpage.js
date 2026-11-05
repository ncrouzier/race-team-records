'use strict';
// A standalone HTML page an admin uploaded from the Hosted Pages screen,
// served at /pages/<slug>. Kept in the database rather than on disk so it
// needs no server folder, works the same locally and in production, and is
// covered by the nightly mongodump backup.
var mongoose = require('mongoose');

// Who may open a page. Checked on every request in app/routes.js (/pages/:slug).
var ACCESS_LEVELS = ['public', 'members', 'captains', 'admin'];

var HostedPageSchema = new mongoose.Schema({
    // The address: /pages/<slug>
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    title: { type: String, required: true, trim: true },
    // Shown in social link previews (added to the page's <head> when served)
    description: { type: String, default: '', trim: true },
    access: { type: String, enum: ACCESS_LEVELS, default: 'public' },
    // Drafts are visible to admins only
    published: { type: Boolean, default: false },
    // Off: served sandboxed (its own anonymous origin, no access to the
    // visitor's session or the site's API). On: runs as part of the site.
    trusted: { type: Boolean, default: false },
    // A bar at the very top linking back to the site. Pages saved before
    // this option existed have no value and show it (see app/routes.js).
    showBanner: { type: Boolean, default: true },
    filename: { type: String, default: '' },
    // Not selected by the admin list; only read when the page is served
    html: { type: String, required: true, select: false },
    size: { type: Number, default: 0 },
    createdBy: { _id: mongoose.Schema.Types.ObjectId, username: String },
    updatedBy: { _id: mongoose.Schema.Types.ObjectId, username: String }
}, { timestamps: true });

HostedPageSchema.statics.ACCESS_LEVELS = ACCESS_LEVELS;

module.exports = mongoose.model('HostedPage', HostedPageSchema);
