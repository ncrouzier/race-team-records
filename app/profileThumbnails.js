// Small server-side profile-photo thumbnails: a 160x160 JPEG cropped from a
// member's pictureLink, generated once and stored as a file next to the bio
// photos (app/memberPhotos.js): <PHOTO_DIR>/<memberId>.thumb.jpg, served at
// /uploads/photos/<memberId>.thumb.jpg?v=<hash of the file> (thumbUrl). The
// folder is the one production mounts from the host and backs up
// (deploy/backup.sh), so no deploy setup changes for it.
//
// Files, not data: URIs in the member list (which is how they started): the
// list is downloaded again whenever member or result data changes, and with
// every photo inside it that was ~800 KB each time. As files, each one is
// cached by the browser until it changes (the ?v= changes with its bytes).
//
// The member document keeps what describes the file (profileThumb): the hash
// of its bytes (fileHash, the ?v=), the photo it was made from (sourceHash),
// the square it was cut from (crop) and any failure. File and record are
// written one after the other, not together, so after a crash or a partial
// restore they can disagree: startup (ensureAllGenerated) hashes every file
// and remakes any that does not match its record. Generations for one member
// run one at a time (oneAtATime), so two of them (an upload, then a crop
// chosen right after) cannot interleave their writes.
//
// Thumbnails made before this lived in the record itself (profileThumb.data):
// startup moves those to files (moveFromDatabase).
//
// Regeneration triggers (wired up by the caller, not this module):
//   - server startup, via ensureAllGenerated() — for any member whose
//     pictureLink has no matching thumbnail yet
//   - right after a member's pictureLink is saved, via regenerateInBackground()
//     — fire-and-forget, so fetching the photo never slows down that save
//
// A failed fetch/resize is recorded (profileThumb.error) together with the
// pictureLink's hash, so a broken link is attempted once and not retried on
// every single startup — only once the member's pictureLink actually changes.
//
// The crop itself tries real face detection first (see detectFaceCrop below
// — the same face-api SsdMobilenetv1 model the banner scripts already use
// offline, run here with the lightweight WASM backend: @tensorflow/tfjs-core
// + @tensorflow/tfjs-backend-wasm, not the full @tensorflow/tfjs package the
// banner scripts use, to keep what ships in the runtime image to a minimum).
// A photo with no detectable face — a stats graphic, nobody in frame, a shot
// too distant or dark for the model — falls back to sharp's own generic
// "entropy" smart crop, same as before this existed.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const memberPhotos = require('./memberPhotos');
const { initFaceDetector } = require('./faceDetector');
const sharp = require('sharp');
const Member = require('./models/member');

const SIZE = 160; // px, square
const JPEG_QUALITY = 82;
const MAX_SOURCE_BYTES = 8 * 1024 * 1024; // refuse to fetch/hold anything larger
const FETCH_TIMEOUT_MS = 10000;
const CONCURRENCY = 4; // startup backfill: don't hammer remote hosts or this process
const FACE_WORKING_SIZE = 1200; // detection runs on a copy at most this many px on its long side
const FACE_CROP_MARGIN = 2.6; // the square crop is this many times the detected face's longer side

function hashSource(link) {
    return crypto.createHash('sha1').update(link || '').digest('hex');
}

// The version of a thumbnail file: the ?v= of its URL
function hashFile(data) {
    return crypto.createHash('sha1').update(data).digest('hex').slice(0, 16);
}

// ---- The files -------------------------------------------------------------

function fileFor(memberId) {
    const id = String(memberId);
    if (!memberPhotos.ID_PATTERN.test(id)) throw new Error('Not a member id');
    return path.join(memberPhotos.PHOTO_DIR, id + '.thumb.jpg');
}

// A member's thumbnail file, or null when there is none
async function readThumb(memberId) {
    try {
        return await fs.promises.readFile(fileFor(memberId));
    } catch (err) {
        if (err.code === 'ENOENT' || err.message === 'Not a member id') return null;
        throw err;
    }
}

async function writeThumb(memberId, data) {
    await fs.promises.mkdir(memberPhotos.PHOTO_DIR, { recursive: true });
    await memberPhotos.writeAtomic(fileFor(memberId), data);
}

async function deleteThumb(memberId) {
    try {
        await fs.promises.unlink(fileFor(memberId));
    } catch (err) {
        if (err.code !== 'ENOENT') throw err;
    }
}

// The URL of a member's thumbnail, from a member doc carrying _id and
// profileThumb; null when they have none. Changes whenever the file does.
function thumbUrl(member) {
    const thumb = member && member.profileThumb;
    if (!thumb || !thumb.fileHash || thumb.error) return null;
    return memberPhotos.URL_PREFIX + member._id + '.thumb.jpg?v=' + thumb.fileHash;
}

// Decides, from a member doc carrying just pictureLink + profileThumb, and
// the hash of their thumbnail file as it is on disk (null when there is
// none), whether it needs a (re)generation pass. Pure and exported so the
// decision itself can be unit tested without the network, sharp, or Mongo.
function needsGeneration(member, fileHash) {
    const link = (member.pictureLink || '').trim();
    if (!link) return false; // nothing to generate from
    const hash = hashSource(link);
    const thumb = member.profileThumb;
    if (!thumb) return true; // never attempted
    if (thumb.sourceHash !== hash) return true; // link changed since the last attempt
    if (thumb.error) return false; // same broken link already tried; don't loop forever
    // The file is missing, or is not the one the record describes (a crash
    // between the two writes, a partial restore)
    return !thumb.fileHash || thumb.fileHash !== fileHash;
}

// Runs fn for one member once the previous run for that member is done
const running = new Map();
function oneAtATime(memberId, fn) {
    const key = String(memberId);
    const run = (running.get(key) || Promise.resolve()).catch(() => { }).then(fn);
    running.set(key, run);
    const forget = () => { if (running.get(key) === run) running.delete(key); };
    run.then(forget, forget);
    return run;
}

async function fetchImageBuffer(link) {
    // A photo stored on this server: read the file, no HTTP round trip
    const localId = memberPhotos.localPhotoId(link);
    if (localId) return memberPhotos.readPhoto(localId);

    const res = await axios.get(link, {
        responseType: 'arraybuffer',
        timeout: FETCH_TIMEOUT_MS,
        maxContentLength: MAX_SOURCE_BYTES,
        maxBodyLength: MAX_SOURCE_BYTES,
        validateStatus: status => status === 200
    });
    const contentType = String(res.headers['content-type'] || '');
    if (!contentType.startsWith('image/')) {
        throw new Error('Not an image (content-type: ' + (contentType || 'unknown') + ')');
    }
    return Buffer.from(res.data);
}

// The square region — in the same pixel space as `box`/`imgWidth`/`imgHeight`
// — to crop around a detected face. Pure and exported so the clamping (a
// face near an edge, or bigger than the image itself) is unit tested without
// the network, sharp, or the face model.
function computeFaceCropRegion(box, imgWidth, imgHeight, margin) {
    margin = margin || FACE_CROP_MARGIN;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    let size = Math.round(Math.max(box.width, box.height) * margin);
    size = Math.max(1, Math.min(size, imgWidth, imgHeight));
    let left = Math.round(cx - size / 2);
    let top = Math.round(cy - size / 2);
    left = Math.max(0, Math.min(left, imgWidth - size));
    top = Math.max(0, Math.min(top, imgHeight - size));
    return { left, top, size };
}

// Finds the largest face in `buffer` and returns a square crop region around
// it, plus the (already decoded, upright, capped) raw pixels to crop from —
// or null when no face is found, or detection itself fails (a corrupt image,
// an unsupported format, the model failing to load). A thumbnail this small
// never needs more source resolution than the FACE_WORKING_SIZE cap, so the
// caller crops straight from these pixels rather than re-decoding at full
// resolution.
async function detectFaceCrop(buffer) {
    let tf, faceapi, data, info;
    try {
        ({ tf, faceapi } = await initFaceDetector());
        ({ data, info } = await sharp(buffer).rotate()
            .resize({ width: FACE_WORKING_SIZE, height: FACE_WORKING_SIZE, fit: 'inside', withoutEnlargement: true })
            .removeAlpha().raw().toBuffer({ resolveWithObject: true }));
    } catch (err) {
        return null;
    }

    const tensor = tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3], 'int32');
    let detections;
    try {
        detections = await faceapi.detectAllFaces(tensor, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }));
    } catch (err) {
        return null;
    } finally {
        tensor.dispose();
    }
    if (!detections.length) return null;

    // The largest face, in case of a group photo or a spectator in the background
    const box = detections.sort((a, b) => b.box.width - a.box.width)[0].box;
    return { data, info, region: computeFaceCropRegion(box, info.width, info.height) };
}

// An admin's chosen square (fractions, see Member.profileThumbCrop) in pixels
// of a width x height image, kept inside it. Pure and exported for testing.
function cropToRegion(crop, width, height) {
    const short = Math.min(width, height);
    const size = Math.max(1, Math.min(Math.round(crop.size * short), short));
    const left = Math.max(0, Math.min(Math.round(crop.left * width), width - size));
    const top = Math.max(0, Math.min(Math.round(crop.top * height), height - size));
    return { left, top, size };
}

// The crop to use for a member: theirs only if it was chosen on this photo
function cropFor(member, link) {
    const crop = member && member.profileThumbCrop;
    if (!crop || crop.sourceHash !== hashSource(link)) return null;
    if (![crop.left, crop.top, crop.size].every(n => typeof n === 'number' && isFinite(n))) return null;
    return crop;
}

function sameCrop(a, b) {
    if (!a || !b) return !a && !b;
    return a.left === b.left && a.top === b.top && a.size === b.size;
}

// The thumbnail, and the square it was cut from as { left, top, size }
// fractions of the upright photo (Member.profileThumbCrop's units): the
// chosen crop, else the one face detection or the smart crop picked. Stored
// with the thumbnail, so the photo pop-up can show where it is and start
// adjusting from there.
async function resizeToSquareJpeg(buffer, crop) {
    const round = n => Math.round(n * 10000) / 10000;

    if (crop) {
        // Upright first (EXIF), the same orientation the admin saw the photo in
        const upright = await sharp(buffer).rotate().toBuffer({ resolveWithObject: true });
        const region = cropToRegion(crop, upright.info.width, upright.info.height);
        const data = await sharp(upright.data)
            .extract({ left: region.left, top: region.top, width: region.size, height: region.size })
            .resize(SIZE, SIZE)
            .jpeg({ quality: JPEG_QUALITY })
            .toBuffer();
        return { data, crop: { left: crop.left, top: crop.top, size: crop.size } };
    }

    const face = await detectFaceCrop(buffer);
    if (face) {
        const { width, height } = face.info;
        const data = await sharp(face.data, { raw: { width, height, channels: 3 } })
            .extract({ left: face.region.left, top: face.region.top, width: face.region.size, height: face.region.size })
            .resize(SIZE, SIZE)
            .jpeg({ quality: JPEG_QUALITY })
            .toBuffer();
        return {
            data,
            crop: { left: round(face.region.left / width), top: round(face.region.top / height), size: round(face.region.size / Math.min(width, height)) }
        };
    }

    // No face found (a stats graphic, nobody in the shot, a corrupt image)
    // or detection itself failed — sharp's own generic smart crop, favouring
    // the most visually "salient" region of the photo. It covers the square
    // with the photo's shorter side; cropOffset* say where, in the scaled photo.
    const out = await sharp(buffer)
        .rotate() // respect EXIF orientation before the square crop
        .resize(SIZE, SIZE, { fit: 'cover', position: 'entropy' })
        .jpeg({ quality: JPEG_QUALITY })
        .toBuffer({ resolveWithObject: true });
    let autoCrop = null;
    try {
        const meta = await sharp(buffer).metadata();
        const swap = (meta.orientation || 1) >= 5;
        const w = swap ? meta.height : meta.width, h = swap ? meta.width : meta.height;
        const scale = SIZE / Math.min(w, h);
        autoCrop = {
            left: round(Math.abs(out.info.cropOffsetLeft || 0) / (w * scale)),
            top: round(Math.abs(out.info.cropOffsetTop || 0) / (h * scale)),
            size: 1
        };
    } catch (e) {
        autoCrop = null;
    }
    return { data: out.data, crop: autoCrop };
}

// Fetches, resizes and saves the thumbnail for one member — or clears it, if
// the member no longer has a pictureLink. `member` needs `_id` and
// `pictureLink` (and `profileThumbCrop`, when one was chosen); safe to call
// with a plain lean object or a full document. Resolves to whether it worked.
function generateForMember(member) {
    if (!member || !member._id) return Promise.resolve();
    return oneAtATime(member._id, () => generateNow(member));
}

async function generateNow(member) {
    const id = member._id;
    const link = (member.pictureLink || '').trim();

    if (!link) {
        // The record first: a link to a file that is gone shows initials
        await Member.updateOne({ _id: id }, { $unset: { profileThumb: '' } });
        await deleteThumb(id);
        return true;
    }

    const hash = hashSource(link);
    try {
        const source = await fetchImageBuffer(link);
        const crop = cropFor(member, link);
        const { data, crop: usedCrop } = await resizeToSquareJpeg(source, crop);
        // Superseded while this ran (face detection takes a moment)? A new
        // photo, or a crop chosen right after the upload, has its own
        // generation: writing this one now would overwrite it.
        const now = await Member.findById(id).select('pictureLink profileThumbCrop').lean();
        if (!now || (now.pictureLink || '').trim() !== link || !sameCrop(cropFor(now, link), crop)) {
            return true;
        }
        // The file first: the record then gives it its new URL
        await writeThumb(id, data);
        await Member.updateOne({ _id: id }, {
            $set: {
                profileThumb: {
                    fileHash: hashFile(data),
                    contentType: 'image/jpeg',
                    sourceHash: hash,
                    generatedAt: new Date(),
                    // Where it was cut from: the chosen crop, or the automatic one
                    crop: usedCrop || undefined
                }
            }
        });
        return true;
    } catch (err) {
        await Member.updateOne({ _id: id }, {
            $set: {
                'profileThumb.sourceHash': hash,
                'profileThumb.error': String((err && err.message) || err).slice(0, 300),
                'profileThumb.generatedAt': new Date()
            },
            $unset: { 'profileThumb.data': '', 'profileThumb.fileHash': '' }
        });
        await deleteThumb(id).catch(() => { });
        console.warn('profileThumbnails: could not generate a thumbnail for member ' + id + ': ' + (err && err.message));
        return false;
    }
}

// Thumbnails stored in the record (profileThumb.data, before they were
// files): written out as files, and the bytes dropped from the record. Also
// what a restore of a database backup from before then needs. Resolves to
// how many were moved.
async function moveFromDatabase() {
    const members = await Member.find({ 'profileThumb.data': { $exists: true } }, '_id profileThumb')
        .select('+profileThumb').lean();
    let moved = 0;
    for (const member of members) {
        await oneAtATime(member._id, async () => {
            const data = toBuffer(member.profileThumb.data);
            if (!data || !data.length) {
                await Member.updateOne({ _id: member._id }, { $unset: { 'profileThumb.data': '' } });
                return;
            }
            await writeThumb(member._id, data);
            await Member.updateOne({ _id: member._id }, {
                $set: { 'profileThumb.fileHash': hashFile(data) },
                $unset: { 'profileThumb.data': '' }
            });
            moved++;
        });
    }
    return moved;
}

// Fire-and-forget wrapper for the save-time trigger: never lets a thumbnail
// failure become an unhandled rejection or slow down the caller.
// `onDone` runs once the new thumbnail is saved (the routes use it to tell
// browsers member data changed, so cached thumbnail lists refresh).
function regenerateInBackground(member, onDone) {
    generateForMember(member).then(ok => {
        if (ok && onDone) return onDone();
    }).catch(err => {
        console.warn('profileThumbnails: background generation failed: ' + (err && err.message));
    });
}

// Startup backfill: every member with a pictureLink but no current thumbnail.
// `force: true` regenerates every member's thumbnail regardless of whether
// its source link already matches — for a one-off re-crop after a change
// like the one above, where the source hasn't changed but the result
// should. See scripts/regenerate-profile-thumbnails.js.
// Resolves to { checked, generated, moved } (moved: thumbnails taken out of
// the database, see moveFromDatabase).
async function ensureAllGenerated({ force = false } = {}) {
    const moved = await moveFromDatabase();
    const members = await Member.find(
        { pictureLink: { $exists: true, $ne: '' } },
        'pictureLink profileThumb profileThumbCrop'
    ).select('+profileThumb').lean();

    let todo = members;
    if (!force) {
        // Each file as it is on disk (a few KB each, ~150 of them)
        const fileHashes = await Promise.all(members.map(async m => {
            const data = await readThumb(m._id);
            return data ? hashFile(data) : null;
        }));
        todo = members.filter((m, i) => needsGeneration(m, fileHashes[i]));
    }
    if (!todo.length) {
        return { checked: members.length, generated: 0, moved };
    }

    let next = 0;
    let generated = 0;
    async function worker() {
        while (next < todo.length) {
            const member = todo[next++];
            await generateForMember(member);
            generated++;
        }
    }
    const workerCount = Math.min(CONCURRENCY, todo.length);
    await Promise.all(Array.from({ length: workerCount }, worker));
    return { checked: members.length, generated, moved };
}

// A .lean() Buffer field comes back from the driver as a BSON Binary
// (`{ buffer, sub_type, position }`), not a Node Buffer — this normalizes
// either shape (for moveFromDatabase).
function toBuffer(data) {
    if (!data) return null;
    if (Buffer.isBuffer(data)) return data;
    if (data.buffer) return Buffer.from(data.buffer);
    return Buffer.from(data);
}

module.exports = {
    SIZE,
    hashSource,
    needsGeneration,
    fetchImageBuffer,
    computeFaceCropRegion,
    cropToRegion,
    cropFor,
    detectFaceCrop,
    resizeToSquareJpeg,
    generateForMember,
    regenerateInBackground,
    ensureAllGenerated,
    moveFromDatabase,
    hashFile,
    fileFor,
    readThumb,
    thumbUrl,
    toBuffer
};
