// The banner-making behind scripts/slant-banners.mjs (the command line) and
// scripts/banner-editor.mjs (the visual editor), so both frame, limit and
// render a photo the same way.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(__dirname, '..', '..');
const require = createRequire(import.meta.url);
export const sourceDir = path.join(repoRoot, 'public/images/banners/source');
// The settings and what was detected live with the app's config, not with the
// photos: the site never serves config/, and the server reads them
// (app/bannerDefaults.js) while the photos stay out of the Docker image
export const configDir = path.join(repoRoot, 'config/banners');
const detectedPath = path.join(configDir, 'slant-banners.detected.json');
export const configPath = path.join(configDir, 'slant-banners.config.json');
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
// What a photo's entry under "images" in the config may set
export const IMAGE_SETTINGS = ['crop', 'zoom', 'moveRight', 'moveDown', 'cropLeft', 'cropRight', 'face', 'kind', 'skip',
    'faceSize', 'faceFromTop', 'faceFromLeft', 'maxFaceFromLeft', 'note'];

// ---------------------------------------------------------------------------
// Banner geometry
//
// The banner is 962–1140px wide and 250px tall (background-size: cover,
// anchored top). An image of 2200 × 572 (3.85:1, the narrowest banner's
// aspect) is therefore always fitted to the banner's width, so a point at x
// in the image is at the same fraction of the banner's width at every size.
// On the widest banner only the top 84% shows.
//
// The badge (.banner-title in public/less/mcrrc.less) is sized in container
// units, so it scales with the banner the same way. Its edges, measured on a
// 1140px banner, vertically centred at y = 125:
//   - orange block's left edge passes through (503.4, 197)
//   - speed stripes start 52px left of that (46px wide, 10px gap, the first
//     4px transparent)
//   - navy strip's left edge passes through (604.6, 87)
// All three edges lean 12° (top to the right).
// ---------------------------------------------------------------------------

export const OUT_W = 2200;
export const OUT_H = 572;
const DESIGN_W = 1140;
const DESIGN_CENTER_Y = 125;
const TAN = Math.tan(12 * Math.PI / 180);
const PX = OUT_W / DESIGN_W; // image px per design px
// Share of the image's height a 1140px-wide (the widest) banner shows
export const WIDE_VISIBLE = 250 / (DESIGN_W * OUT_H / OUT_W);

// The badge's vertical centre lands at a slightly different image row at
// each banner width (125px of banner is 241 image rows at 1140px wide, 286
// at 962px). Aim between the two; the slant puts the error at ±2.5px.
const CENTER_ROW = 263;

// x in the image where an edge of the badge crosses image row y, given a
// point (x, y) on that edge in design px on a 1140px banner.
function badgeEdge(designX, designY) {
    const xAtCenter = (designX + (designY - DESIGN_CENTER_Y) * TAN) * PX;
    return (row) => xAtCenter - (row - CENTER_ROW) * TAN;
}

const STRIPES = { x: 503.4 - 52, y: 197 };
const NAVY_STRIP = { x: 604.6, y: 87 };

// ---------------------------------------------------------------------------
// The two files in config/banners/
// ---------------------------------------------------------------------------

async function readJson(file, fallback) {
    try {
        return JSON.parse(await fs.readFile(file, 'utf8'));
    } catch (err) {
        if (err.code === 'ENOENT') return fallback;
        throw new Error(`${path.relative(repoRoot, file)}: ${err.message}`);
    }
}

export async function loadConfig() {
    const settings = await readJson(configPath, null);
    if (!settings) throw new Error(`Missing ${path.relative(repoRoot, configPath)}`);
    return settings;
}

// Pretty-printed, with face and crop boxes and the fade stops kept on one
// line each, as they're written by hand
export async function saveConfig(settings) {
    const json = JSON.stringify(settings, null, 2)
        .replace(/("(?:face|crop)": )\{\n((?:\s*"[^"\n]+": -?[\d.]+,?\n)+)\s*\}/g,
            (m, key, body) => key + '{ ' + body.trim().split(/,?\n\s*/).join(', ') + ' }')
        .replace(/\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]/g, '[$1, $2]')
        .replace(/\[\s*((?:\[[^\[\]]*\],?\s*)+)\]/g, (m, inner) => '[' + inner.replace(/\s*\n\s*/g, ' ').trim() + ']');
    await fs.writeFile(configPath, json + '\n');
}

export async function loadDetected() {
    return readJson(detectedPath, {});
}

export async function saveDetected(detected) {
    await fs.writeFile(detectedPath, JSON.stringify(detected, null, 2) + '\n');
}

export async function listSources() {
    return (await fs.readdir(sourceDir))
        .filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()))
        .sort();
}

// A photo's settings: detected, then the framing for every photo, then its own
export function photoSettings(name, detected, settings) {
    return Object.assign({}, detected[name], settings.framing, (settings.images || {})[name]);
}

// Whether a photo gets a banner: a crop set by hand always does; otherwise
// a single runner on the left, with a face to frame on
export function makesBanner(p) {
    return !p.skip && (!!p.crop || (p.kind === 'runner-left' && !!p.face));
}

export function bannerFileName(name) {
    return path.basename(name, path.extname(name)) + '.jpg';
}

// ---------------------------------------------------------------------------
// Analysis: find the main runner's face (the largest one) and say what kind
// of photo it is. Uses face-api's SSD MobileNet model, which finds faces in
// every current photo; its tiny detector misses about a third of them.
// ---------------------------------------------------------------------------

let faceapi = null;
let tf = null;

async function initFaceDetector() {
    if (faceapi) return;
    tf = require('@tensorflow/tfjs');
    require('@tensorflow/tfjs-backend-wasm');
    const { setWasmPaths } = require('@tensorflow/tfjs-backend-wasm');
    faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');
    setWasmPaths(path.join(repoRoot, 'node_modules/@tensorflow/tfjs-backend-wasm/dist/'));
    await tf.setBackend('wasm');
    await tf.ready();
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(path.join(repoRoot, 'node_modules/@vladmandic/face-api/model'));
}

// A group shot: several faces about as big as the largest one
const GROUP_MIN_FACES = 4;
const GROUP_FACE_SIZE = 0.5;
// The runner counts as on the right when their face is past this share of the width
const RIGHT_SIDE = 0.6;

// A photo's size as displayed: one taken with the camera turned sideways is
// stored on its side with an EXIF orientation of 5–8, and every step here
// turns it upright first (.rotate()), so its width and height swap
export async function uprightSize(file) {
    const meta = await sharp(file).metadata();
    const sideways = meta.orientation >= 5;
    return { width: sideways ? meta.height : meta.width, height: sideways ? meta.width : meta.height };
}

async function analyse(file) {
    const { width, height } = await uprightSize(file);
    // Detection runs on a copy at most 1200px on its long side
    const { data, info } = await sharp(file).rotate()
        .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
        .removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const scale = width / info.width;

    const tensor = tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3], 'int32');
    let detections;
    try {
        detections = await faceapi.detectAllFaces(tensor, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }));
    } finally {
        tensor.dispose();
    }
    const faces = detections
        .map((d) => ({
            x: Math.round(d.box.x * scale), y: Math.round(d.box.y * scale),
            width: Math.round(d.box.width * scale), height: Math.round(d.box.height * scale)
        }))
        .sort((a, b) => b.width - a.width);

    const face = faces[0] || null;
    let kind = 'runner-left';
    if (!face) kind = 'no-face';
    else if (faces.filter((f) => f.width >= face.width * GROUP_FACE_SIZE).length >= GROUP_MIN_FACES) kind = 'group';
    else if (face.x + face.width / 2 > width * RIGHT_SIDE) kind = 'runner-right';

    return {
        width, height, kind, face,
        // The next few, for picking another person in an override
        otherFaces: faces.slice(1, 4),
        faceCount: faces.length
    };
}

// A photo's contents, as a short hash: says whether it changed. (Not the
// file's date, which every fresh checkout resets.)
async function contentHash(file) {
    return createHash('sha1').update(await fs.readFile(file)).digest('hex').slice(0, 16);
}

// Analyse new and changed photos (all of them with reanalyze), forget
// deleted ones, and save. Returns the detected settings for every photo.
export async function updateDetected({ reanalyze = false, log = () => {} } = {}) {
    const sources = await listSources();
    const detected = await loadDetected();
    for (const name of Object.keys(detected)) {
        if (!sources.includes(name)) delete detected[name];
    }
    let analysed = 0;
    for (const name of sources) {
        const file = path.join(sourceDir, name);
        const hash = await contentHash(file);
        const known = detected[name];
        // Entries from before hashes, analysed from the file as it is now
        // (same date): take the hash, keep the analysis
        if (known && !known.srcHash && known.srcMtime === (await fs.stat(file)).mtimeMs) {
            const { srcMtime, ...rest } = known;
            detected[name] = Object.assign({ srcHash: hash }, rest);
        }
        if (!reanalyze && detected[name] && detected[name].srcHash === hash) continue;
        if (!analysed) {
            log('Loading face detector...');
            await initFaceDetector();
        }
        detected[name] = Object.assign({ srcHash: hash }, await analyse(file));
        log(`  analysed ${name}: ${detected[name].kind}, ${detected[name].faceCount} face(s)`);
        analysed++;
    }
    await saveDetected(detected);
    if (analysed) log(`Saved → ${path.relative(repoRoot, detectedPath)}\n`);
    return detected;
}

// ---------------------------------------------------------------------------
// Framing
// ---------------------------------------------------------------------------

// White over the photo, along a gradient whose bands lean 12° like the badge
export function fadeOverlay(fade) {
    const fadeStart = badgeEdge(STRIPES.x - fade.startBeforeStripes, STRIPES.y);
    const fadeEnd = badgeEdge(NAVY_STRIP.x + fade.endAfterNavyStrip, NAVY_STRIP.y);
    // The gradient runs at right angles to the slant, from one edge to the
    // other (both measured on the top row).
    const len = Math.hypot(1, TAN);
    const nx = 1 / len;
    const ny = TAN / len;
    const x1 = fadeStart(0);
    const dist = (fadeEnd(0) - x1) * nx;
    const stops = fade.stops
        .map(([p, o]) => `<stop offset="${p}%" stop-color="#fff" stop-opacity="${(o / 100).toFixed(3)}"/>`)
        .join('');
    return {
        // The photo must reach this far right, or its edge shows
        reach: fadeEnd(0) + 4,
        svg: Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${OUT_W}" height="${OUT_H}" viewBox="0 0 ${OUT_W} ${OUT_H}" preserveAspectRatio="none">` +
            `<defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="${x1.toFixed(1)}" y1="0" ` +
            `x2="${(x1 + dist * nx).toFixed(1)}" y2="${(dist * ny).toFixed(1)}">${stops}</linearGradient></defs>` +
            `<rect width="${OUT_W}" height="${OUT_H}" fill="url(#g)"/></svg>`
        )
    };
}

// The framing for one photo, from the settings for all of them adjusted by
// its own zoom / moveRight / moveDown: shares of the banner (0–1), and the
// crop as source pixels
function framingFor(p) {
    const zoom = p.zoom ?? 1;
    const across = (p.faceFromLeft + (p.moveRight ?? 0)) / 100;
    return {
        zoom,
        faceHeight: p.faceSize / 100,
        faceTop: (p.faceFromTop + (p.moveDown ?? 0)) / 100,
        faceX: across,
        maxFaceX: Math.max(across, (p.maxFaceFromLeft + (p.moveRight ?? 0)) / 100),
        cropLeft: Math.round(p.width * (p.cropLeft ?? 0) / 100),
        cropRight: Math.round(p.width * (1 - (p.cropRight ?? 0) / 100))
    };
}

// What a hand-set crop ({ x, y, width } in source pixels: the photo area the
// banner shows) may be. The banner's height must be all photo; so must
// everything up to the end of the fade — past it, the banner is white anyway.
export function cropLimits(p, overlay) {
    const reachShare = overlay.reach / OUT_W;
    const maxWidth = Math.min(p.height * OUT_W / OUT_H, p.width / reachShare);
    // Closer than this, a pixel of the photo is blown up over 3 of the banner's
    const minWidth = Math.min(maxWidth, OUT_W / 3);
    return { maxWidth, minWidth, reachShare };
}

// The nearest crop within the limits
export function clampCrop(p, crop, overlay) {
    const { maxWidth, minWidth, reachShare } = cropLimits(p, overlay);
    const width = Math.min(maxWidth, Math.max(minWidth, crop.width || maxWidth));
    const x = Math.min(Math.max(0, p.width - reachShare * width), Math.max(0, crop.x || 0));
    const y = Math.min(Math.max(0, p.height - width * OUT_H / OUT_W), Math.max(0, crop.y || 0));
    return { x: Math.round(x), y: Math.round(y), width: Math.round(width) };
}

// Where the photo goes in the banner: a scale, and the offset of the
// (scaled) source area cropLeft..cropLeft+cropW. From the hand-set crop when
// there is one, else framed on the face.
export function placementFor(p, overlay) {
    if (p.crop) {
        const crop = clampCrop(p, p.crop, overlay);
        const scale = OUT_W / crop.width;
        return {
            mode: 'crop', crop, scale, cropLeft: 0, cropW: p.width,
            offsetX: -Math.round(crop.x * scale), offsetY: -Math.round(crop.y * scale)
        };
    }

    const { face } = p;
    const f = framingFor(p);
    const cropLeft = Math.max(0, Math.min(p.width - 1, f.cropLeft));
    const cropRight = Math.max(cropLeft + 1, Math.min(p.width, f.cropRight));
    const cropW = cropRight - cropLeft;
    const faceCenter = face.x + face.width / 2 - cropLeft;
    if (faceCenter < 0 || faceCenter > cropW) throw new Error('the crop cuts off the face');

    // Horizontally, the face goes to faceX — never past the left edge (that
    // would leave a gap). The photo also has to reach past the fade: if it
    // falls short, the runner slides right, up to maxFaceX.
    const offsetXFor = (s) => Math.min(0, Math.round(Math.max(f.faceX * OUT_W - faceCenter * s,
        Math.min(overlay.reach - cropW * s, f.maxFaceX * OUT_W - faceCenter * s))));
    // Vertically, the top of the face goes to faceTop, still covering the full height
    const offsetYFor = (s) => Math.round(Math.max(OUT_H - p.height * s,
        Math.min(0, f.faceTop * OUT_H - face.y * s)));
    const fits = (s) => p.height * s >= OUT_H && cropW * s + offsetXFor(s) >= overlay.reach;

    // Zoom: zoom 1 is as wide as the photo allows — the face faceSize of the
    // banner's height, or, for a photo too small for that, just enough larger
    // to fill (only real photo, never filler). The photo's zoom is relative to that.
    let widest = f.faceHeight * OUT_H / face.height;
    while (!fits(widest)) widest *= 1.01;
    let scale = widest * Math.max(1, f.zoom);
    while (!fits(scale)) scale *= 1.01;
    const offsetX = offsetXFor(scale);
    const offsetY = offsetYFor(scale);

    // What was used, in the config's terms, against what was asked for
    const pct = (v) => Math.round(v * 100);
    return {
        mode: 'auto', scale, cropLeft, cropW, offsetX, offsetY,
        used: {
            zoom: scale / widest,
            faceFromLeft: pct((faceCenter * scale + offsetX) / OUT_W),
            faceFromTop: pct((face.y * scale + offsetY) / OUT_H)
        },
        asked: { zoom: f.zoom, faceFromLeft: pct(f.faceX), faceFromTop: pct(f.faceTop) }
    };
}

// A placement as the equivalent crop, in source pixels
export function cropOfPlacement(pl) {
    return {
        x: Math.round(pl.cropLeft - pl.offsetX / pl.scale),
        y: Math.round(-pl.offsetY / pl.scale),
        width: Math.round(OUT_W / pl.scale)
    };
}

export async function renderBanner(file, p, pl, overlay, quality) {
    const scaledW = Math.round(pl.cropW * pl.scale);
    const scaledH = Math.round(p.height * pl.scale);
    const left = Math.min(-pl.offsetX, scaledW - 1);
    const top = Math.max(0, Math.min(-pl.offsetY, scaledH - OUT_H));
    const photo = await sharp(file).rotate()
        .extract({ left: pl.cropLeft, top: 0, width: pl.cropW, height: p.height })
        .resize({ width: scaledW, height: scaledH })
        .extract({ left, top, width: Math.min(scaledW - left, OUT_W), height: OUT_H })
        .toBuffer();

    return sharp({ create: { width: OUT_W, height: OUT_H, channels: 3, background: '#ffffff' } })
        .composite([
            { input: photo, left: 0, top: 0 },
            { input: overlay.svg, left: 0, top: 0 }
        ])
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
}
