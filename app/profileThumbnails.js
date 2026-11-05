// Small server-side profile-photo thumbnails: a 160x160 JPEG cropped from a
// member's pictureLink, generated once and kept on the member document in
// Mongo, behind `profileThumb`'s `select: false` so it never bloats a
// list/bio query by accident (app/models/member.js). Not in a folder next to
// the photos (app/memberPhotos.js), on purpose:
//   - the cached list of all members embeds every thumbnail as a data: URI
//     (MembersService.getAllMembersWithThumbs), so a page full of avatars is
//     one request; with files that list would read ~150 files to build, or
//     link to them and cost a request per avatar;
//   - the thumbnail, the photo it was made from (sourceHash), the square it
//     was cut from and any failure change in one write, so they can never
//     disagree, as a file and its record could after a crash or a partial
//     restore;
//   - it is small (a few KB of JPEG, under 1 MB for the whole team), backed
//     up with the database, and can always be made again from the photo.
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

// Decides, from a member doc carrying just pictureLink + profileThumb,
// whether it needs a (re)generation pass. Pure and exported so the decision
// itself can be unit tested without the network, sharp, or Mongo.
function needsGeneration(member) {
    const link = (member.pictureLink || '').trim();
    if (!link) return false; // nothing to generate from
    const hash = hashSource(link);
    const thumb = member.profileThumb;
    if (!thumb) return true; // never attempted
    if (thumb.sourceHash !== hash) return true; // link changed since the last attempt
    if (thumb.error) return false; // same broken link already tried; don't loop forever
    return !thumb.data; // defensive: hash matches but nothing was actually saved
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
async function generateForMember(member) {
    if (!member || !member._id) return;
    const id = member._id;
    const link = (member.pictureLink || '').trim();

    if (!link) {
        await Member.updateOne({ _id: id }, { $unset: { profileThumb: '' } });
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
        await Member.updateOne({ _id: id }, {
            $set: {
                profileThumb: {
                    data,
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
            $unset: { 'profileThumb.data': '' }
        });
        console.warn('profileThumbnails: could not generate a thumbnail for member ' + id + ': ' + (err && err.message));
        return false;
    }
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
async function ensureAllGenerated({ force = false } = {}) {
    const members = await Member.find(
        { pictureLink: { $exists: true, $ne: '' } },
        'pictureLink profileThumb profileThumbCrop'
    ).select('+profileThumb').lean();

    const todo = force ? members : members.filter(needsGeneration);
    if (!todo.length) {
        return { checked: members.length, generated: 0 };
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
    return { checked: members.length, generated };
}

// A .lean() Buffer field comes back from the driver as a BSON Binary
// (`{ buffer, sub_type, position }`), not a Node Buffer — this normalizes
// either shape. Shared by the single-thumbnail route and the data-URI
// embedding below, so there is one place that knows that.
function toBuffer(data) {
    if (!data) return null;
    if (Buffer.isBuffer(data)) return data;
    if (data.buffer) return Buffer.from(data.buffer);
    return Buffer.from(data);
}

// A ready-to-use `data:` URI for a thumbnail, for embedding directly in a
// list response (see GET /api/members) instead of one request per photo.
// null when there is nothing to embed (no thumbnail, or a stored failure).
function toDataUri(thumb) {
    const buf = thumb && toBuffer(thumb.data);
    if (!buf) return null;
    return 'data:' + (thumb.contentType || 'image/jpeg') + ';base64,' + buf.toString('base64');
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
    toBuffer,
    toDataUri
};
