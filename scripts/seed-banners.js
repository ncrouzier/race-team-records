// Usage: node scripts/seed-banners.js
// Creates a banner entry for every image in public/images/banners that lacks
// one, and sets the title side where it's missing — the same as the Banners
// admin page's "Add" (app/bannerDefaults.js). Banners made by
// scripts/slant-banners.mjs always get the title on the right, since their
// fade is drawn for it. Members, photo credit, pinned and disabled are set on
// the Banners page only; this never touches them.
require('dotenv').config();
const mongoose = require('mongoose');
const Banner = require('../app/models/banner');
const { bannerDefaults, bannerImageFiles, loadSources } = require('../app/bannerDefaults');

function isBlank(val) {
    if (val === null || val === undefined) return true;
    if (typeof val === 'string') return val.trim() === '';
    if (typeof val === 'object') return Object.values(val).every(isBlank);
    return false;
}

async function main() {
    await mongoose.connect(process.env.MONGO_DEV_URL);
    console.log('Connected to', process.env.MONGO_DEV_URL);

    const sources = loadSources();
    let created = 0, updated = 0, skipped = 0;
    for (const filename of bannerImageFiles()) {
        const defaults = bannerDefaults(filename, sources);
        const existing = await Banner.findOne({ filename });

        if (!existing) {
            await Banner.create({
                filename,
                members: [],
                pinned: false,
                titlePosition: defaults.titlePosition,
            });
            console.log(`  + ${filename} (created)`);
            created++;
            continue;
        }

        const patch = {};
        if (isBlank(existing.titlePosition) || (defaults.slant && existing.titlePosition !== 'right')) {
            patch.titlePosition = defaults.titlePosition;
        }

        if (Object.keys(patch).length) {
            await Banner.updateOne({ _id: existing._id }, { $set: patch });
            console.log(`  ~ ${filename} (filled: ${Object.keys(patch).join(', ')})`);
            updated++;
        } else {
            console.log(`  · ${filename} (no missing fields)`);
            skipped++;
        }
    }

    console.log(`\nDone. ${created} created, ${updated} updated, ${skipped} unchanged.`);
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
