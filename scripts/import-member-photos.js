/**
 * One-time import: copies every member photo that is still a link to another
 * site (Cloudinary, SmugMug, Google...) into the server's photo folder
 * (app/memberPhotos.js), with the same checks and processing as an upload,
 * then points the member at the stored copy.
 *
 *   node scripts/import-member-photos.js --dry-run   list what would happen
 *   node scripts/import-member-photos.js             import
 *   node scripts/import-member-photos.js --only=<memberId>   one member
 *
 * In production, run it inside the app container, where PHOTO_DIR is the
 * host folder:
 *   docker compose exec app node scripts/import-member-photos.js --dry-run
 *   docker compose exec app node scripts/import-member-photos.js
 *
 * Safe to re-run: members already on a stored photo are skipped. A link that
 * fails (gone, not an image...) is reported and the member keeps it, so
 * nothing that displays today stops displaying.
 *
 * An admin-chosen thumbnail crop is kept: the stored photo is the same
 * picture, only smaller, and the crop is in fractions of it.
 */

require('dotenv').config({ quiet: true });
const axios = require('axios');
const mongoose = require('mongoose');
const memberPhotos = require('../app/memberPhotos');
const profileThumbnails = require('../app/profileThumbnails');
const Member = require('../app/models/member');
const bumpStamp = require('../app/models/stamp');

const DRY_RUN = process.argv.includes('--dry-run');
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice('--only='.length);
const MAX_SOURCE_BYTES = 30 * 1024 * 1024;

async function download(link) {
    const res = await axios.get(link, {
        responseType: 'arraybuffer',
        timeout: 30000,
        maxRedirects: 5,
        maxContentLength: MAX_SOURCE_BYTES,
        headers: { 'User-Agent': 'Mozilla/5.0 (MCRRC race team photo import)', 'Accept': 'image/*' },
        validateStatus: status => status === 200
    });
    const type = String(res.headers['content-type'] || '');
    if (!type.startsWith('image/')) throw new Error('not an image (' + (type || 'no content-type') + ')');
    return Buffer.from(res.data);
}

async function main() {
    const url = process.env.MONGODB_URI || process.env.MONGO_DEV_URL;
    if (!url) {
        console.error('Set MONGODB_URI or MONGO_DEV_URL (see .env).');
        process.exit(1);
    }
    await mongoose.connect(url);
    console.log('Database: ' + url.replace(/\/\/[^@]*@/, '//***@'));
    console.log('Photo folder: ' + memberPhotos.PHOTO_DIR);
    if (!DRY_RUN && !(await memberPhotos.checkWritable())) process.exit(1);

    const query = { pictureLink: { $exists: true, $ne: '' } };
    if (ONLY) query._id = ONLY;
    const members = await Member.find(
        query,
        'firstname lastname pictureLink profileThumbCrop'
    ).lean();
    const todo = members.filter(m => !memberPhotos.localPhotoId(m.pictureLink));
    console.log(`${members.length} member(s) with a photo, ${todo.length} still a link to another site.` +
        (DRY_RUN ? ' Dry run: nothing is changed.' : ''));

    const failed = [];
    let imported = 0;
    for (const m of todo) {
        const name = m.firstname + ' ' + m.lastname;
        try {
            const buffer = await download(m.pictureLink);
            if (DRY_RUN) {
                // Same checks as the real run, without writing anything
                const jpeg = await memberPhotos.processPhoto(buffer, { maxBytes: MAX_SOURCE_BYTES });
                console.log(`  ok    ${name}: ${Math.round(buffer.length / 1024)} KB -> ${Math.round(jpeg.length / 1024)} KB`);
                imported++;
                continue;
            }
            const link = await memberPhotos.savePhoto(m._id, buffer, { maxBytes: MAX_SOURCE_BYTES });
            const update = { pictureLink: link };
            const crop = m.profileThumbCrop;
            if (crop && crop.sourceHash === profileThumbnails.hashSource(m.pictureLink)) {
                update['profileThumbCrop.sourceHash'] = profileThumbnails.hashSource(link);
            }
            // updateOne, not save(): no per-member stamp bump, one at the end
            await Member.updateOne({ _id: m._id }, { $set: update });
            await profileThumbnails.generateForMember(Object.assign({}, m, update, {
                profileThumbCrop: crop && update['profileThumbCrop.sourceHash']
                    ? Object.assign({}, crop, { sourceHash: update['profileThumbCrop.sourceHash'] }) : crop
            }));
            console.log(`  done  ${name}`);
            imported++;
        } catch (err) {
            failed.push({ name, link: m.pictureLink, reason: err.message });
            console.log(`  FAIL  ${name}: ${err.message}`);
        }
    }

    if (!DRY_RUN && imported) {
        // Browsers reload the member lists (new pictureLinks); race data untouched
        await bumpStamp('memberProfileUpdate', new Date(), { quiet: true });
    }

    console.log(`\n${DRY_RUN ? 'Would import' : 'Imported'} ${imported} of ${todo.length}.`);
    if (failed.length) {
        console.log(`${failed.length} could not be imported and keep their current link:`);
        failed.forEach(f => console.log(`  - ${f.name}: ${f.reason}\n      ${f.link}`));
    }
    await mongoose.disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
