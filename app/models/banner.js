'use strict';
var mongoose = require('mongoose');

var DEFAULT_TITLE_THEME = {
    background: 'rgba(0,0,0,0.25)',
    backdropFilter: 'blur(2px)',
    topColor: '#008cba',
    bottomColor: '#F47920',
    textShadow: '0 2px 8px rgba(0,0,0,0.55)',
};

var BannerSchema = new mongoose.Schema({
    filename: { type: String, required: true, unique: true },
    members:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'Member' }],
    pinned:   { type: Boolean, default: false },
    // Never shown on the homepage (not even for a birthday), but kept — unlike
    // deleting, which would make the image show up as new on the Banners page
    disabled: { type: Boolean, default: false },
    // Side of the photo the title sits on, away from the runner; 'center' for
    // group shots. Unset reads as 'right' (most banners have the runner on the
    // left). scripts/seed-banners.js fills it in from the crop config.
    titlePosition: { type: String, enum: ['left', 'center', 'right'] },
    // From the previous see-through title design; no longer shown. Still
    // written by scripts/crop-banners.mjs and scripts/seed-banners.js.
    titleTheme: {
        background:     { type: String, default: DEFAULT_TITLE_THEME.background },
        backdropFilter: { type: String, default: DEFAULT_TITLE_THEME.backdropFilter },
        topColor:       { type: String, default: DEFAULT_TITLE_THEME.topColor },
        bottomColor:    { type: String, default: DEFAULT_TITLE_THEME.bottomColor },
        textShadow:     { type: String, default: DEFAULT_TITLE_THEME.textShadow },
    },
    copyright: {
        name:  { type: String, default: '' },
        url:   { type: String, default: '' },
        color: { type: String, default: '' },
    },
}, { timestamps: true });

module.exports = mongoose.model('Banner', BannerSchema);
