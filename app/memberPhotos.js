// Member bio photos, stored on the server: one file per member,
// <PHOTO_DIR>/<memberId>.jpg, replaced whenever a new photo is uploaded.
//
// In production PHOTO_DIR is a host folder bind-mounted into the container
// (/opt/mcrrc/uploads/photos, see deploy/docker-compose.yml) — outside any
// Docker volume, and outside the image. Locally it defaults to ./uploads/photos.
//
// Whatever is uploaded is never stored as is. It is decoded by sharp, which
// is what proves it is an image (the browser's stated type is only a first
// filter), then re-encoded as a fresh JPEG: upright, at most MAX_SIDE pixels,
// no metadata (EXIF, GPS, ICC profile...), at JPEG_QUALITY with full colour
// resolution (4:4:4) whatever the size. 95 is where photos stop visibly
// improving (SSIM ~0.988 on real race photos, worst 0.984): ~350 KB typical,
// ~600 KB at most; 100 would double that for no visible gain.
// The file name is the member's id, never the uploader's.
//
// The member's pictureLink then reads /uploads/photos/<id>.jpg?v=<hash>: the
// hash changes with each new photo, so browsers fetch it again, and the
// existing display and thumbnail code keeps working on a plain URL.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const PHOTO_DIR = path.resolve(process.env.PHOTO_DIR || path.join(__dirname, '..', 'uploads', 'photos'));
const URL_PREFIX = '/uploads/photos/';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
// Refuse anything bigger before decoding it: a small file can declare a huge
// image ("decompression bomb"). 100 megapixels covers 48 MP phone cameras.
const MAX_INPUT_PIXELS = 100 * 1000 * 1000;
const MIN_SIDE = 100;
const MAX_SIDE = 1000;
const JPEG_QUALITY = 95;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ACCEPTED_FORMATS = ['jpeg', 'png', 'webp'];

const ID_PATTERN = /^[a-f0-9]{24}$/;

function photoError(message, status) {
    const err = new Error(message);
    err.status = status || 400;
    err.photoError = true;
    return err;
}

function fileFor(memberId) {
    const id = String(memberId);
    if (!ID_PATTERN.test(id)) throw photoError('Not a member id');
    return path.join(PHOTO_DIR, id + '.jpg');
}

// Is this pictureLink one of ours? Returns the member id it names, or null.
function localPhotoId(link) {
    const m = /^\/uploads\/photos\/([a-f0-9]{24})\.jpg(\?.*)?$/.exec(String(link || '').trim());
    return m ? m[1] : null;
}

// The upload, decoded and re-encoded. Resolves to the JPEG buffer; rejects
// with a photoError the uploader can act on. options.maxBytes: a larger
// file cap, for the one-time import of photos already on the site.
async function processPhoto(buffer, options) {
    const maxBytes = (options && options.maxBytes) || MAX_UPLOAD_BYTES;
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw photoError('No file was received.');
    if (buffer.length > maxBytes) throw photoError('The file is over ' + Math.round(maxBytes / 1024 / 1024) + ' MB.', 413);

    let meta;
    try {
        meta = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
    } catch (e) {
        throw photoError('This file is not an image we can read. Use a JPEG, PNG or WebP photo.');
    }
    if (ACCEPTED_FORMATS.indexOf(meta.format) === -1) {
        throw photoError('Only JPEG, PNG or WebP photos are accepted' +
            (meta.format === 'heif' ? ' (iPhone HEIC photos are not: export it as JPEG first).' : '.'));
    }
    if ((meta.pages || 1) > 1) throw photoError('Animated images are not accepted.');
    if (!meta.width || !meta.height) throw photoError('This image has no size.');
    if (meta.width * meta.height > MAX_INPUT_PIXELS) throw photoError('This image is too large (over 100 megapixels).');
    if (Math.min(meta.width, meta.height) < MIN_SIDE) throw photoError('This image is too small (under ' + MIN_SIDE + ' px).');

    try {
        return await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
            .rotate()
            // fastShrinkOnLoad off: libvips' shortcut of decoding a JPEG at a
            // fraction of its size softens it slightly
            .resize(MAX_SIDE, MAX_SIDE, { fit: 'inside', withoutEnlargement: true, fastShrinkOnLoad: false })
            .flatten({ background: '#ffffff' })
            .toColourspace('srgb')
            .jpeg({ quality: JPEG_QUALITY, chromaSubsampling: '4:4:4', mozjpeg: true })
            .toBuffer();
    } catch (e) {
        throw photoError('This image could not be read. Try saving it again as a JPEG.');
    }
}

// Write atomically: a reader sees the old photo or the new one, never half
function writeAtomic(file, data) {
    const tmp = file + '.' + crypto.randomBytes(6).toString('hex') + '.tmp';
    return fs.promises.writeFile(tmp, data, { mode: 0o644 })
        .then(() => fs.promises.rename(tmp, file))
        .catch(err => fs.promises.unlink(tmp).catch(() => { }).then(() => { throw err; }));
}

// Process and store a member's photo. Resolves to its new pictureLink.
async function savePhoto(memberId, buffer, options) {
    const file = fileFor(memberId);
    const jpeg = await processPhoto(buffer, options);
    await fs.promises.mkdir(PHOTO_DIR, { recursive: true });
    await writeAtomic(file, jpeg);
    const version = crypto.createHash('sha1').update(jpeg).digest('hex').slice(0, 12);
    return URL_PREFIX + String(memberId) + '.jpg?v=' + version;
}

function deletePhoto(memberId) {
    let file;
    try { file = fileFor(memberId); } catch (e) { return Promise.resolve(); }
    return fs.promises.unlink(file).catch(err => { if (err.code !== 'ENOENT') throw err; });
}

// A stored photo's bytes, for the thumbnail generator (no HTTP round trip)
function readPhoto(memberId) {
    return fs.promises.readFile(fileFor(memberId));
}

// At startup: say clearly when photos cannot be saved, rather than failing
// on the first upload
async function checkWritable() {
    try {
        await fs.promises.mkdir(PHOTO_DIR, { recursive: true });
        await fs.promises.access(PHOTO_DIR, fs.constants.W_OK);
        return true;
    } catch (err) {
        console.error('Member photos: ' + PHOTO_DIR + ' is not writable (' + err.code + '). ' +
            'Uploads will fail. In production, create it owned by uid 1000 (see deploy/update.sh).');
        return false;
    }
}

module.exports = {
    PHOTO_DIR,
    URL_PREFIX,
    MAX_UPLOAD_BYTES,
    ACCEPTED_TYPES,
    ID_PATTERN,
    fileFor,
    localPhotoId,
    processPhoto,
    savePhoto,
    deletePhoto,
    readPhoto,
    checkWritable
};
