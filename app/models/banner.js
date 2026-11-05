'use strict';
var mongoose = require('mongoose');

var BannerSchema = new mongoose.Schema({
    filename: { type: String, required: true, unique: true },
    members:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'Member' }],
    pinned:   { type: Boolean, default: false },
    // Never shown on the homepage (not even for a birthday), but kept —
    // deleting a banner deletes its image too
    disabled: { type: Boolean, default: false },
    // Side of the photo the title sits on, away from the runner; 'center' for
    // group shots. Unset reads as 'right' (most banners have the runner on the
    // left). Banners made in the editor (app/bannerRoutes.js) are 'right':
    // their fade is drawn for it.
    titlePosition: { type: String, enum: ['left', 'center', 'right'] },
    // Hash of the banner file's contents (app/bannerFiles.js): its link
    // carries ?v=<version>, so a replaced banner is fetched afresh
    version: { type: String, default: '' },
    copyright: {
        name:  { type: String, default: '' },
        url:   { type: String, default: '' },
        color: { type: String, default: '' },
    },
}, { timestamps: true });

module.exports = mongoose.model('Banner', BannerSchema);
