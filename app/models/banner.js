'use strict';
var mongoose = require('mongoose');

var BannerSchema = new mongoose.Schema({
    filename: { type: String, required: true, unique: true },
    members:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'Member' }],
    pinned:   { type: Boolean, default: false },
    // Never shown on the homepage (not even for a birthday), but kept — unlike
    // deleting, which would make the image show up as new on the Banners page
    disabled: { type: Boolean, default: false },
    // Side of the photo the title sits on, away from the runner; 'center' for
    // group shots. Unset reads as 'right' (most banners have the runner on the
    // left). New entries get it from app/bannerDefaults.js.
    titlePosition: { type: String, enum: ['left', 'center', 'right'] },
    copyright: {
        name:  { type: String, default: '' },
        url:   { type: String, default: '' },
        color: { type: String, default: '' },
    },
}, { timestamps: true });

module.exports = mongoose.model('Banner', BannerSchema);
