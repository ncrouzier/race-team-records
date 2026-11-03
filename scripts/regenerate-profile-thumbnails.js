/**
 * Regenerates member profile photo thumbnails (app/profileThumbnails.js).
 *
 * By default this is the same backfill that already runs at server startup:
 * only members with no thumbnail yet, or whose pictureLink changed since
 * their last one. Run it by hand after a change to how thumbnails are made
 * (a new crop strategy, a new size) to apply it to everyone immediately,
 * with --force — otherwise an already-successful thumbnail is left alone
 * forever, since its source link never changes.
 *
 *   node scripts/regenerate-profile-thumbnails.js            backfill only
 *   node scripts/regenerate-profile-thumbnails.js --force     regenerate everyone
 *
 * Safe to re-run; also safe to run against production (it only touches
 * Member.profileThumb, fetching each member's own already-public pictureLink).
 */

require('dotenv').config();
const mongoose = require('mongoose');
const profileThumbnails = require('../app/profileThumbnails');

const FORCE = process.argv.includes('--force');

async function main() {
    const url = process.env.MONGODB_URI || process.env.MONGO_DEV_URL;
    if (!url) {
        console.error('Set MONGODB_URI or MONGO_DEV_URL (see .env).');
        process.exit(1);
    }
    await mongoose.connect(url);
    console.log('Database: ' + url.replace(/\/\/[^@]*@/, '//***@'));
    console.log(FORCE ? 'Regenerating every member\'s thumbnail...' : 'Backfilling missing thumbnails only (use --force to redo everyone)...');

    const t0 = Date.now();
    const { checked, generated } = await profileThumbnails.ensureAllGenerated({ force: FORCE });
    console.log(`Checked ${checked} member photo(s), generated ${generated} thumbnail(s) in ${Math.round((Date.now() - t0) / 1000)}s.`);

    await mongoose.disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
