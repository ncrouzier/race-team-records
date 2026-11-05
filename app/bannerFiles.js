// Homepage banners, stored on the server: <BANNER_DIR>/<name>.jpg, made on
// the Banners admin page (app/bannerRoutes.js) — not in the repo or the
// Docker image. In production BANNER_DIR is a host folder bind-mounted into
// the container (/opt/mcrrc/uploads/banners, see deploy/docker-compose.yml);
// locally it defaults to ./uploads/banners.
//
// While a banner is being made, its photo is a draft in .drafts/: the photo
// re-encoded (upright, at most DRAFT_MAX_SIDE px, no metadata) as <id>.jpg,
// and what face detection found in it as <id>.json. The draft is deleted once
// the banner is saved — the source photo is not kept — or cancelled, and any
// draft left behind is swept after DRAFT_MAX_AGE_MS.
//
// Banner names are chosen by the admin, cleaned to NAME_CHARS, and must not
// be in use already, by another banner entry or by any file in the folder,
// compared ignoring case (macOS disks are case-insensitive). The final write
// is an exclusive create (link(2) fails if the name exists), so two saves of
// the same name cannot both win.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const BANNER_DIR = path.resolve(process.env.BANNER_DIR || path.join(__dirname, '..', 'uploads', 'banners'));
const DRAFT_DIR = path.join(BANNER_DIR, '.drafts');
const URL_PREFIX = '/uploads/banners/';

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_INPUT_PIXELS = 100 * 1000 * 1000;
const MIN_SIDE = 400;
const DRAFT_MAX_SIDE = 3000;
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ACCEPTED_FORMATS = ['jpeg', 'png', 'webp'];

const NAME_PATTERN = /^[A-Za-z0-9_-]{1,60}$/;
const FILE_PATTERN = /^([A-Za-z0-9_-]{1,60})\.jpg$/;
const DRAFT_PATTERN = /^[a-f0-9]{24}$/;

function bannerError(message, status) {
    const err = new Error(message);
    err.status = status || 400;
    err.bannerError = true;
    return err;
}

// ---- Names ----

// What an admin typed (or a file's name) as a banner name: letters, digits,
// _ and -, anything else a single -, at most 60. '' when nothing is left.
function cleanName(raw) {
    return String(raw || '')
        .replace(/\.(jpe?g|png|webp)$/i, '')
        // Accented letters keep their letter (Jérôme → Jerome)
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60)
        .replace(/-+$/, '');
}

function fileFor(name) {
    if (!NAME_PATTERN.test(String(name))) throw bannerError('Not a banner name');
    return path.join(BANNER_DIR, name + '.jpg');
}

// The names of the banner files in the folder
function listFiles() {
    try {
        return fs.readdirSync(BANNER_DIR, { withFileTypes: true })
            .filter((e) => e.isFile() && FILE_PATTERN.test(e.name))
            .map((e) => e.name);
    } catch (err) {
        if (err.code === 'ENOENT') return [];
        throw err;
    }
}

// Whether `name` is free: no other banner entry and no file has it, ignoring
// case. `filenames` are the entries' filenames ("aaronA.jpg"); `ownFilename`
// is the banner being renamed or replaced, which may keep its own name.
function nameTaken(name, filenames, ownFilename) {
    const want = (name + '.jpg').toLowerCase();
    const own = ownFilename ? String(ownFilename).toLowerCase() : null;
    if (want === own) return false;
    return filenames.concat(listFiles()).some((f) => String(f).toLowerCase() === want);
}

function urlFor(filename, version) {
    return URL_PREFIX + encodeURIComponent(filename) + (version ? '?v=' + version : '');
}

function versionOf(buffer) {
    return crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 12);
}

// ---- Writing banner files ----

async function writeTmp(data) {
    await fs.promises.mkdir(BANNER_DIR, { recursive: true });
    const tmp = path.join(BANNER_DIR, '.tmp-' + crypto.randomBytes(8).toString('hex'));
    await fs.promises.writeFile(tmp, data, { mode: 0o644 });
    return tmp;
}

// A new banner file: fails with a 409 if the name exists, even if another
// save took it a moment ago
async function createBanner(name, data) {
    const file = fileFor(name);
    const tmp = await writeTmp(data);
    try {
        await fs.promises.link(tmp, file);
    } catch (err) {
        if (err.code === 'EEXIST') throw bannerError('The name "' + name + '" is already used by another banner.', 409);
        throw err;
    } finally {
        await fs.promises.unlink(tmp).catch(() => { });
    }
}

// A banner's file replaced in place: readers see the old one or the new one
async function replaceBanner(name, data) {
    const file = fileFor(name);
    const tmp = await writeTmp(data);
    try {
        await fs.promises.rename(tmp, file);
    } catch (err) {
        await fs.promises.unlink(tmp).catch(() => { });
        throw err;
    }
}

// Rename a banner's file: the new name is created exclusively, then the old
// one removed. A rename that only changes case goes through a temporary name
// (on a case-insensitive disk the two names are one file).
async function renameBanner(oldName, newName) {
    const from = fileFor(oldName), to = fileFor(newName);
    if (oldName.toLowerCase() === newName.toLowerCase()) {
        const tmp = path.join(BANNER_DIR, '.tmp-' + crypto.randomBytes(8).toString('hex'));
        await fs.promises.rename(from, tmp);
        await fs.promises.rename(tmp, to);
        return;
    }
    try {
        await fs.promises.link(from, to);
    } catch (err) {
        if (err.code === 'EEXIST') throw bannerError('The name "' + newName + '" is already used by another banner.', 409);
        throw err;
    }
    await fs.promises.unlink(from);
}

function deleteBanner(name) {
    let file;
    try { file = fileFor(name); } catch (e) { return Promise.resolve(); }
    return fs.promises.unlink(file).catch((err) => { if (err.code !== 'ENOENT') throw err; });
}

// ---- Drafts ----

function draftFiles(id) {
    if (!DRAFT_PATTERN.test(String(id))) throw bannerError('No such draft', 404);
    return { photo: path.join(DRAFT_DIR, id + '.jpg'), info: path.join(DRAFT_DIR, id + '.json') };
}

// The uploaded photo checked and stored as a draft. `analyse` (from
// app/bannerRender.js) finds the runner. Resolves to { id, detected }.
async function createDraft(buffer, analyse) {
    if (!Buffer.isBuffer(buffer) || !buffer.length) throw bannerError('No file was received.');
    if (buffer.length > MAX_UPLOAD_BYTES) throw bannerError('The file is over 20 MB.', 413);

    let meta;
    try {
        meta = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
    } catch (e) {
        throw bannerError('This file is not an image we can read. Use a JPEG, PNG or WebP photo.');
    }
    if (ACCEPTED_FORMATS.indexOf(meta.format) === -1) {
        throw bannerError('Only JPEG, PNG or WebP photos are accepted' +
            (meta.format === 'heif' ? ' (iPhone HEIC photos are not: export it as JPEG first).' : '.'));
    }
    if ((meta.pages || 1) > 1) throw bannerError('Animated images are not accepted.');
    const sideways = (meta.orientation || 1) >= 5;
    const w = sideways ? meta.height : meta.width, h = sideways ? meta.width : meta.height;
    if (!w || !h || w * h > MAX_INPUT_PIXELS) throw bannerError('This image is too large (over 100 megapixels).');
    if (Math.min(w, h) < MIN_SIDE) throw bannerError(`Too small (${w}×${h}): use a photo at least ${MIN_SIDE}px on each side.`);

    let photo;
    try {
        photo = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
            .rotate()
            .resize(DRAFT_MAX_SIDE, DRAFT_MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
            .flatten({ background: '#ffffff' })
            .toColourspace('srgb')
            .jpeg({ quality: 92, mozjpeg: true })
            .toBuffer();
    } catch (e) {
        throw bannerError('This image could not be read. Try saving it again as a JPEG.');
    }

    // Face detection failing (the model not loading, say) must not stop the
    // banner: the editor then starts from the whole photo, framed by hand
    let detected;
    try {
        detected = await analyse(photo);
    } catch (err) {
        console.error('Banners: face detection failed, framing by hand:', err);
        const m = await sharp(photo).metadata();
        detected = { width: m.width, height: m.height, kind: 'no-face', face: null, otherFaces: [], faceCount: 0, detectionFailed: true };
    }
    const id = crypto.randomBytes(12).toString('hex');
    const files = draftFiles(id);
    await fs.promises.mkdir(DRAFT_DIR, { recursive: true });
    await fs.promises.writeFile(files.photo, photo, { mode: 0o600 });
    await fs.promises.writeFile(files.info, JSON.stringify(detected), { mode: 0o600 });
    return { id, detected };
}

async function readDraft(id) {
    const files = draftFiles(id);
    try {
        const [photo, info] = await Promise.all([fs.promises.readFile(files.photo), fs.promises.readFile(files.info, 'utf8')]);
        return { photo, detected: JSON.parse(info) };
    } catch (err) {
        if (err.code === 'ENOENT') throw bannerError('This photo is no longer here (it was saved, cancelled, or left for over a day). Upload it again.', 404);
        throw err;
    }
}

function draftPhotoPath(id) {
    return draftFiles(id).photo;
}

async function deleteDraft(id) {
    const files = draftFiles(id);
    await Promise.all([files.photo, files.info].map((f) =>
        fs.promises.unlink(f).catch((err) => { if (err.code !== 'ENOENT') throw err; })));
}

// Drafts (and temporary files) older than maxAge: an editor closed without
// saving or cancelling. Resolves to how many files were removed.
async function sweepDrafts(maxAge) {
    const cutoff = Date.now() - (maxAge == null ? DRAFT_MAX_AGE_MS : maxAge);
    let removed = 0;
    for (const dir of [DRAFT_DIR, BANNER_DIR]) {
        let entries;
        try { entries = await fs.promises.readdir(dir); } catch (e) { continue; }
        for (const name of entries) {
            if (dir === BANNER_DIR && !name.startsWith('.tmp-')) continue;
            const file = path.join(dir, name);
            try {
                const st = await fs.promises.stat(file);
                if (st.isFile() && st.mtimeMs < cutoff) {
                    await fs.promises.unlink(file);
                    removed++;
                }
            } catch (e) { /* gone already */ }
        }
    }
    return removed;
}

// ---- Startup ----

async function checkWritable() {
    try {
        await fs.promises.mkdir(DRAFT_DIR, { recursive: true });
        await fs.promises.access(BANNER_DIR, fs.constants.W_OK);
        return true;
    } catch (err) {
        console.error('Banners: ' + BANNER_DIR + ' is not writable (' + err.code + '). ' +
            'New banners cannot be saved. In production, create it owned by uid 1000 (see deploy/update.sh).');
        return false;
    }
}

module.exports = {
    BANNER_DIR, DRAFT_DIR, URL_PREFIX, MAX_UPLOAD_BYTES, ACCEPTED_TYPES, NAME_PATTERN, FILE_PATTERN, DRAFT_PATTERN,
    DRAFT_MAX_AGE_MS,
    cleanName, fileFor, listFiles, nameTaken, urlFor, versionOf,
    createBanner, replaceBanner, renameBanner, deleteBanner,
    createDraft, readDraft, draftPhotoPath, deleteDraft, sweepDrafts,
    checkWritable
};
