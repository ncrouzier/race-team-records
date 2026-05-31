// Usage: node scripts/seed-banners.js
// Creates missing banners and fills in any fields not yet set on existing ones.
// Never overwrites fields that are already defined (members, pinned, admin-edited titleTheme, etc).
require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const Banner = require('../app/models/banner');

const configPath = path.join(__dirname, '..', 'public', 'images', 'banners', 'source', 'banners.config.json');

function isBlank(val) {
    if (val === null || val === undefined) return true;
    if (typeof val === 'string') return val.trim() === '';
    if (typeof val === 'object') return Object.values(val).every(isBlank);
    return false;
}

async function main() {
    await mongoose.connect(process.env.MONGO_DEV_URL);
    console.log('Connected to', process.env.MONGO_DEV_URL);

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const entries = Object.entries(config);

    let created = 0, updated = 0, skipped = 0;
    for (const [filename, data] of entries) {
        const copyright = data.copyright || (data.userOverrides && data.userOverrides.copyright) || {};
        const titleTheme = data.titleTheme || {};

        const existing = await Banner.findOne({ filename });

        if (!existing) {
            await Banner.create({
                filename,
                members: [],
                pinned: false,
                titleTheme,
                copyright: typeof copyright === 'object' ? copyright : {},
            });
            console.log(`  + ${filename} (created)`);
            created++;
            continue;
        }

        // Fill in only fields that are blank/missing on the existing document.
        const patch = {};
        for (const field of ['name', 'url', 'color']) {
            if (isBlank(existing.copyright[field]) && !isBlank(copyright[field])) {
                patch[`copyright.${field}`] = copyright[field];
            }
        }
        if (isBlank(existing.titleTheme)) patch.titleTheme = titleTheme;
        else {
            for (const field of ['topColor', 'bottomColor', 'background', 'backdropFilter', 'textShadow']) {
                if (isBlank(existing.titleTheme[field]) && !isBlank(titleTheme[field])) {
                    patch[`titleTheme.${field}`] = titleTheme[field];
                }
            }
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
