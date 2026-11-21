// Homepage banners, stored on the server: <BANNER_DIR>/<name>.jpg, made on
// the Banners admin page (app/bannerRoutes.js) — not in the repo or the
// Docker image. Next to each, <name>.avif: the same banner at about half the
// bytes, sent to browsers that take AVIF (nearly all); the JPG is the master
// copy, and what every other browser gets. In production BANNER_DIR is a host folder bind-mounted into
// the container (/opt/mcrrc/uploads/banners, see deploy/docker-compose.yml);
// locally it defaults to ./uploads/banners.
//
// While a banner is being made, its photo is a draft in .drafts/: the
// uploaded file itself, unchanged (<id>.src), so the banner is rendered from
// the original pixels and compressed once, at the end; a small upright copy
// for the editor to show (<id>.jpg); and what face detection found (<id>.json).
// Only a photo too big to render comfortably is scaled down first, at high
// quality. The original keeps its metadata while it is a draft — admins only,
// never served — and the banner made from it has none. The draft is deleted once
// the banner is saved — the source photo is not kept — or cancelled, and any
// draft left behind is swept after DRAFT_MAX_AGE_MS.
//
// The AVIF is current when it is at least as new as its JPG: every write of
// a JPG comes before its AVIF's, so a JPG replaced without one (a failed
// encode, a crash in between) leaves an older AVIF, which is not served
// (avifFor) and is made again at the next start (ensureAvifs). Saves from the
// editor make both from the same rendered pixels; startup makes any missing
// one from its JPG, and drops AVIFs whose JPG is gone.
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
// Above this, the draft is scaled down (to DRAFT_MAX_SIDE, at high quality)
// before anything else: decoding it for every preview would strain the server
const DRAFT_KEEP_PIXELS = 40 * 1000 * 1000;
const DRAFT_MAX_SIDE = 8000;
const PREVIEW_SIDE = 1600;
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ACCEPTED_FORMATS = ['jpeg', 'png', 'webp'];

const NAME_PATTERN = /^[A-Za-z0-9_-]{1,60}$/;
const FILE_PATTERN = /^([A-Za-z0-9_-]{1,60})\.jpg$/;
const AVIF_PATTERN = /^([A-Za-z0-9_-]{1,60})\.avif$/;
// Indistinguishable from the JPG (quality 95) even zoomed in, at ~60% of its
// bytes; 60 would be ~45%, slightly soft in fine detail. Changing it remakes
// every AVIF at the next start (QUALITY_STAMP).
const AVIF_QUALITY = 70;
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

// The quality the AVIFs were made at: when it is not AVIF_QUALITY, startup
// makes them all again (ensureAvifs)
const QUALITY_STAMP = '.avif-quality';

function avifFileFor(name) {
    if (!NAME_PATTERN.test(String(name))) throw bannerError('Not a banner name');
    return path.join(BANNER_DIR, name + '.avif');
}

// The AVIF of a banner: from its JPG, or from its rendered pixels
// ({ data, info }, bannerRender.renderBannerFiles)
function toAvif(input) {
    const img = input && input.info ? sharp(input.data, { raw: input.info }) : sharp(input);
    return img.avif({ quality: AVIF_QUALITY, effort: 4 }).toBuffer();
}

// The path of a banner's AVIF when it is current (see the top), else null
async function avifFor(name) {
    try {
        const [jpg, avif] = await Promise.all([fs.promises.stat(fileFor(name)), fs.promises.stat(avifFileFor(name))]);
        return avif.mtimeMs >= jpg.mtimeMs ? avifFileFor(name) : null;
    } catch (err) {
        return null;
    }
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

// The banner's address. Its version names the picture and the AVIF quality:
// the URL is cached for good ("immutable"), so a browser fetches it again
// only when one of them changes. Without the quality, browsers that had the
// JPG at this URL before AVIFs existed (or an AVIF at an older quality) would
// keep it for a year.
function urlFor(filename, version) {
    return URL_PREFIX + encodeURIComponent(filename) + (version ? '?v=' + version + '-a' + AVIF_QUALITY : '');
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

// A banner's AVIF written in place (after its JPG: see the top). Without
// one, an older AVIF is removed rather than left to be made again.
async function writeAvif(name, avif) {
    const file = avifFileFor(name);
    if (!avif) return removeFile(file);
    const tmp = await writeTmp(avif);
    try {
        await fs.promises.rename(tmp, file);
    } catch (err) {
        await fs.promises.unlink(tmp).catch(() => { });
        // Not fatal: the JPG is there, and startup makes the AVIF again
        console.error('Banners: could not write ' + name + '.avif:', err.message);
        await removeFile(file).catch(() => { });
    }
}

function removeFile(file) {
    return fs.promises.unlink(file).catch((err) => { if (err.code !== 'ENOENT') throw err; });
}

// A new banner: its JPG, then its AVIF (when given). Fails with a 409 if the
// name exists, even if another save took it a moment ago.
async function createBanner(name, data, avif) {
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
    await writeAvif(name, avif);
}

// A banner's files replaced in place: readers see the old one or the new one
async function replaceBanner(name, data, avif) {
    const file = fileFor(name);
    const tmp = await writeTmp(data);
    try {
        await fs.promises.rename(tmp, file);
    } catch (err) {
        await fs.promises.unlink(tmp).catch(() => { });
        throw err;
    }
    await writeAvif(name, avif);
}

// Rename a banner's file: the new name is created exclusively, then the old
// one removed. A rename that only changes case goes through a temporary name
// (on a case-insensitive disk the two names are one file).
// Its AVIF follows (moved, so it stays as new as the JPG).
async function renameBanner(oldName, newName) {
    const from = fileFor(oldName), to = fileFor(newName);
    if (oldName.toLowerCase() === newName.toLowerCase()) {
        await renameThroughTmp(from, to);
    } else {
        try {
            await fs.promises.link(from, to);
        } catch (err) {
            if (err.code === 'EEXIST') throw bannerError('The name "' + newName + '" is already used by another banner.', 409);
            throw err;
        }
        await fs.promises.unlink(from);
    }
    await renameAvif(oldName, newName);
}

async function renameThroughTmp(from, to) {
    const tmp = path.join(BANNER_DIR, '.tmp-' + crypto.randomBytes(8).toString('hex'));
    await fs.promises.rename(from, tmp);
    await fs.promises.rename(tmp, to);
}

// The AVIF under the banner's new name. None, or one that cannot be moved:
// any under either name is removed, and startup makes it again from the JPG.
async function renameAvif(oldName, newName) {
    const from = avifFileFor(oldName), to = avifFileFor(newName);
    try {
        if (oldName.toLowerCase() === newName.toLowerCase()) await renameThroughTmp(from, to);
        else await fs.promises.rename(from, to);
    } catch (err) {
        if (err.code !== 'ENOENT') console.error('Banners: could not rename ' + oldName + '.avif:', err.message);
        await removeFile(from).catch(() => { });
        if (oldName.toLowerCase() !== newName.toLowerCase()) await removeFile(to).catch(() => { });
    }
}

// Both of a banner's files
async function deleteBanner(name) {
    let file, avif;
    try { file = fileFor(name); avif = avifFileFor(name); } catch (e) { return; }
    await removeFile(file);
    await removeFile(avif);
}

// At startup: an AVIF for every banner without a current one (made from its
// JPG, one at a time: each takes a fraction of a second of the one core), or
// for every banner when AVIF_QUALITY changed since they were made; and none
// for a banner that is gone. Resolves to { made, removed, requality }.
async function ensureAvifs() {
    let entries;
    try { entries = await fs.promises.readdir(BANNER_DIR); } catch (err) { return { made: 0, removed: 0, requality: false }; }
    const stampFile = path.join(BANNER_DIR, QUALITY_STAMP);
    const stamped = (await fs.promises.readFile(stampFile, 'utf8').catch(() => '')).trim();
    const requality = stamped !== String(AVIF_QUALITY);
    let made = 0, removed = 0, failed = 0;
    for (const entry of entries) {
        const m = AVIF_PATTERN.exec(entry);
        if (m && !entries.includes(m[1] + '.jpg')) {
            await removeFile(path.join(BANNER_DIR, entry));
            removed++;
        }
    }
    const mtimeOf = (file) => fs.promises.stat(file).then((st) => st.mtimeMs, () => null);
    for (const entry of entries) {
        const m = FILE_PATTERN.exec(entry);
        if (!m || (!requality && await avifFor(m[1]))) continue;
        try {
            const jpgBefore = await mtimeOf(fileFor(m[1]));
            const avifBefore = await mtimeOf(avifFileFor(m[1]));
            const avif = await toAvif(await fs.promises.readFile(fileFor(m[1])));
            // Either file written meanwhile (an admin's save, which writes
            // both): this one is of the old picture, or not needed
            if (await mtimeOf(fileFor(m[1])) !== jpgBefore || await mtimeOf(avifFileFor(m[1])) !== avifBefore) continue;
            await writeAvif(m[1], avif);
            made++;
        } catch (err) {
            failed++;
            console.error('Banners: could not make ' + m[1] + '.avif:', err.message);
        }
    }
    // Only once they all are at this quality: a failed one is tried again
    if (requality && !failed) {
        await fs.promises.writeFile(stampFile, String(AVIF_QUALITY) + '\n').catch((err) => {
            console.error('Banners: could not record the AVIF quality:', err.message);
        });
    }
    return { made, removed, requality };
}

// ---- Drafts ----

function draftFiles(id) {
    if (!DRAFT_PATTERN.test(String(id))) throw bannerError('No such draft', 404);
    return {
        source: path.join(DRAFT_DIR, id + '.src'),
        preview: path.join(DRAFT_DIR, id + '.jpg'),
        info: path.join(DRAFT_DIR, id + '.json')
    };
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

    // The original as it is, unless it is huge; and the editor's small copy.
    // Decoding all of it here also proves the whole file reads.
    let source = buffer, preview;
    let upright = { width: w, height: h };
    try {
        if (w * h > DRAFT_KEEP_PIXELS) {
            source = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
                .rotate()
                .resize(DRAFT_MAX_SIDE, DRAFT_MAX_SIDE, { fit: 'inside', fastShrinkOnLoad: false })
                .jpeg({ quality: 95, chromaSubsampling: '4:4:4', mozjpeg: true })
                .toBuffer();
            const m = await sharp(source).metadata();
            upright = { width: m.width, height: m.height };
        }
        preview = await sharp(source, { limitInputPixels: MAX_INPUT_PIXELS })
            .rotate()
            .resize(PREVIEW_SIDE, PREVIEW_SIDE, { fit: 'inside', withoutEnlargement: true })
            .flatten({ background: '#ffffff' })
            .jpeg({ quality: 85, mozjpeg: true })
            .toBuffer();
    } catch (e) {
        throw bannerError('This image could not be read. Try saving it again as a JPEG.');
    }

    // Face detection failing (the model not loading, say) must not stop the
    // banner: the editor then starts from the whole photo, framed by hand
    let detected;
    try {
        detected = await analyse(source);
    } catch (err) {
        console.error('Banners: face detection failed, framing by hand:', err);
        detected = { width: upright.width, height: upright.height, kind: 'no-face', face: null, otherFaces: [], faceCount: 0, detectionFailed: true };
    }
    const id = crypto.randomBytes(12).toString('hex');
    const files = draftFiles(id);
    await fs.promises.mkdir(DRAFT_DIR, { recursive: true });
    await fs.promises.writeFile(files.source, source, { mode: 0o600 });
    await fs.promises.writeFile(files.preview, preview, { mode: 0o600 });
    await fs.promises.writeFile(files.info, JSON.stringify(detected), { mode: 0o600 });
    return { id, detected };
}

async function readDraft(id) {
    const files = draftFiles(id);
    try {
        const [photo, info] = await Promise.all([fs.promises.readFile(files.source), fs.promises.readFile(files.info, 'utf8')]);
        return { photo, detected: JSON.parse(info) };
    } catch (err) {
        if (err.code === 'ENOENT') throw bannerError('This photo is no longer here (it was saved, cancelled, or left for over a day). Upload it again.', 404);
        throw err;
    }
}

// The editor's small copy of the draft
function draftPhotoPath(id) {
    return draftFiles(id).preview;
}

async function deleteDraft(id) {
    const files = draftFiles(id);
    await Promise.all([files.source, files.preview, files.info].map((f) =>
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
    AVIF_QUALITY,
    cleanName, fileFor, avifFileFor, avifFor, toAvif, listFiles, nameTaken, urlFor, versionOf,
    createBanner, replaceBanner, renameBanner, deleteBanner, ensureAvifs,
    createDraft, readDraft, draftPhotoPath, deleteDraft, sweepDrafts,
    checkWritable
};
