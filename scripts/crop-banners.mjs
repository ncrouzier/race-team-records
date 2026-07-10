#!/usr/bin/env node
//
// Smart-crop banner images for the homepage top banner.
//
// Reads every image from public/images/banners/source/ and writes a
// banner-ready (wide aspect ratio, focused on people) JPG to
// public/images/banners/.
//
// Detection picks one of two modes:
//   gradient  — a single prominent runner; subject is placed left or right
//               with a gradient fade to a solid background color.
//   full      — a group or wide scene; smartcrop picks the best rectangular
//               crop with no gradient.
//
// Users can override any detected value in public/images/banners/source/banners.config.json
// under a "userOverrides" key for each image.
//
// Usage:
//   node scripts/crop-banners.mjs                      # process all sources
//   node scripts/crop-banners.mjs path/to/photo.jpg    # process one file
//
// Flags:
//   --width=2200      output width in px (default 2200)
//   --ratio=4         output aspect ratio width/height (default 4)
//   --quality=82      JPEG quality (default 82)
//   --maxKB=150       cap output file size; quality is reduced as needed
//   --outdir=...      override output directory
//   --no-faces        skip face detection, use heuristic only
//   --force           re-crop all images even if params are unchanged
//
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import smartcrop from 'smartcrop-sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

const DEFAULTS = {
    sourceDir: path.join(repoRoot, 'public/images/banners/source'),
    outDir: path.join(repoRoot, 'public/images/banners'),
    width: 2200,
    ratio: 4,
    quality: 100,
    maxKB: null,
    useFaces: true,
};

function parseArgs(argv) {
    const opts = { ...DEFAULTS, files: [] };
    for (const arg of argv.slice(2)) {
        if (arg.startsWith('--width=')) opts.width = Number(arg.split('=')[1]);
        else if (arg.startsWith('--ratio=')) opts.ratio = Number(arg.split('=')[1]);
        else if (arg.startsWith('--quality=')) opts.quality = Number(arg.split('=')[1]);
        else if (arg.startsWith('--outdir=')) opts.outDir = path.resolve(arg.split('=')[1]);
        else if (arg.startsWith('--maxKB=')) opts.maxKB = Number(arg.split('=')[1]);
        else if (arg === '--no-faces') opts.useFaces = false;
        else if (arg === '--force') opts.force = true;
        else if (arg.startsWith('--')) throw new Error(`Unknown flag: ${arg}`);
        else opts.files.push(path.resolve(arg));
    }
    return opts;
}

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

async function collectSources(opts) {
    if (opts.files.length) return opts.files;
    try {
        const entries = await fs.readdir(opts.sourceDir);
        return entries
            .filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()))
            .map((f) => path.join(opts.sourceDir, f));
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.error(`Source directory not found: ${opts.sourceDir}`);
            console.error('Create it and drop source images inside, or pass a file path argument.');
            process.exit(1);
        }
        throw err;
    }
}

// Face detector — lazily initialized so --no-faces avoids the load cost.
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

    const modelDir = path.join(repoRoot, 'node_modules/@vladmandic/face-api/model');
    await faceapi.nets.tinyFaceDetector.loadFromDisk(modelDir);
}

async function detectFaces(buffer) {
    // Resize to a max of 1200px on the long side before detection so that
    // faces in tall portrait images are large enough for TinyFaceDetector.
    const MAX_DIM = 1200;
    const meta = await sharp(buffer).metadata();
    const longest = Math.max(meta.width, meta.height);
    const scale = longest > MAX_DIM ? MAX_DIM / longest : 1;
    const detBuf = scale < 1
        ? await sharp(buffer).resize({ width: Math.round(meta.width * scale), height: Math.round(meta.height * scale) }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
        : await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const { data, info } = detBuf;

    const tensor = tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3], 'int32');
    try {
        const detections = await faceapi.detectAllFaces(tensor, new faceapi.TinyFaceDetectorOptions({ inputSize: 608, scoreThreshold: 0.4 }));
        return detections
            .filter((d) => d && d.box && d.box.width > 0 && d.box.height > 0 && Number.isFinite(d.box.x) && Number.isFinite(d.box.y))
            .map((d) => ({
                // Scale coords back to original image space.
                x: Math.max(0, Math.round(d.box.x / scale)),
                y: Math.max(0, Math.round(d.box.y / scale)),
                width: Math.round(d.box.width / scale),
                height: Math.round(d.box.height / scale),
                score: d.score,
            }));
    } finally {
        tensor.dispose();
    }
}

function buildBoostFromFaces(faces, srcW, srcH) {
    // Extend each boost region from above the head down to estimated waist/torso
    // (3× face height below the chin) so smartcrop favours including the body.
    return faces.map((f) => {
        const padX = Math.round(f.width * 0.5);
        const padTop = Math.round(f.height * 0.5);
        const bodyExt = Math.round(f.height * 3.0);
        const x = Math.max(0, f.x - padX);
        const y = Math.max(0, f.y - padTop);
        const bottom = Math.min(srcH, f.y + f.height + bodyExt);
        const width = Math.min(srcW - x, f.width + 2 * padX);
        const height = bottom - y;
        return { x, y, width, height, weight: 20.0 };
    });
}

function buildBoostHeuristic(srcW, srcH) {
    // Bias toward the top quarter where race-photo faces typically sit,
    // with a small downward inset so the crop has room above each face.
    return [{
        x: 0,
        y: Math.round(srcH * 0.05),
        width: srcW,
        height: Math.round(srcH * 0.30),
        weight: 20.0,
    }];
}

// Returns the leftmost face from a non-empty array.
function leftmostFace(faces) {
    return faces.reduce((a, b) => a.x < b.x ? a : b);
}

// Returns true when there is at least one prominent face (single-runner photo).
// "Prominent" = the largest face width is at least 10% of image width.
function isSingleRunner(faces, srcW) {
    if (!faces.length) return false;
    const largest = faces.reduce((a, b) => a.width > b.width ? a : b);
    return largest.width / srcW >= 0.10;
}

// Default fade stops: [[position%, opacity%], ...] transparent → opaque.
const DEFAULT_FADE_STOPS = [[0, 0], [25, 2], [50, 10], [70, 30], [85, 60], [95, 88], [100, 100]];

// Build a gradient SVG from an array of [position%, opacity%] stops.
// Pass reversed=true to flip the gradient for right-placement (opaque → transparent).
function makeFadeSvg(fadeW, h, color, stops = DEFAULT_FADE_STOPS, reversed = false) {
    const c = `rgb(${color.r},${color.g},${color.b})`;
    const src = reversed
        ? [...stops].map(([p, o]) => [p, 100 - o]).sort((a, b) => a[0] - b[0])
        : [...stops].sort((a, b) => a[0] - b[0]);
    const svgStops = src
        .map(([p, o]) => `<stop offset="${p.toFixed(1)}%" stop-color="${c}" stop-opacity="${(o / 100).toFixed(3)}"/>`)
        .join('');
    return Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${fadeW}" height="${h}">` +
        `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0">${svgStops}</linearGradient></defs>` +
        `<rect width="${fadeW}" height="${h}" fill="url(#g)"/>` +
        `</svg>`
    );
}

function makeFadeSvgReversed(fadeW, h, color, stops = DEFAULT_FADE_STOPS) {
    return makeFadeSvg(fadeW, h, color, stops, true);
}

// Sample the center region of an output banner and return a titleTheme object.
// Samples a horizontal band around the vertical center (where the title sits).
async function detectTitleTheme(outBuf) {
    const meta = await sharp(outBuf).metadata();
    const sampleH = Math.max(1, Math.round(meta.height * 0.5));
    const sampleTop = Math.round((meta.height - sampleH) / 2);
    const sampleW = Math.max(1, Math.round(meta.width * 0.4));
    const sampleLeft = Math.round((meta.width - sampleW) / 2);

    const stats = await sharp(outBuf)
        .extract({ left: sampleLeft, top: sampleTop, width: sampleW, height: sampleH })
        .stats();

    const r = stats.channels[0].mean;
    const g = stats.channels[1].mean;
    const b = stats.channels[2].mean;
    // Perceived luminance (sRGB)
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const dark = luma < 128;

    const veryLight = luma > 180;
    if (veryLight) {
        return { background: 'transparent', backdropFilter: 'none', topColor: '#354082', bottomColor: '#F47920', textShadow: 'none' };
    }
    return dark
        ? { background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(2px)', topColor: '#ffffff', bottomColor: '#F47920', textShadow: '0 2px 8px rgba(0,0,0,0.55)' }
        : { background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(2px)', topColor: '#ffffff', bottomColor: '#F47920', textShadow: '0 2px 8px rgba(0,0,0,0.55)' };
}

// ---------------------------------------------------------------------------
// gradient mode: single runner, placed left or right, with gradient fade.
// Works for both landscape and portrait source images.
// ---------------------------------------------------------------------------

async function cropGradient(buffer, params, meta, opts) {
    const outW = opts.width;
    const outH = Math.round(outW / opts.ratio);
    const placement = params.placement ?? 'left';
    const face = params.face ?? null;

    const headTop = Math.max(0, Math.min(meta.height - 1,
        params.headTop ?? (face ? Math.max(0, face.y - Math.round(face.height * 0.6)) : 0)));
    const bodyBottom = Math.max(headTop + 1, Math.min(meta.height,
        params.bodyBottom ?? (face ? Math.min(meta.height, face.y + face.height + Math.round(face.height * 3.5)) : meta.height)));
    const cropLeft = Math.max(0, Math.min(meta.width - 1, params.cropLeft ?? 0));
    const cropRight = Math.max(cropLeft + 1, Math.min(meta.width,
        (params.cropRight > 0 ? params.cropRight : null) ?? meta.width));

    const subjectH = bodyBottom - headTop;
    const subjectW = cropRight - cropLeft;

    // Scale subject so it fills the banner height exactly.
    const scaledBuf = await sharp(buffer)
        .extract({ left: cropLeft, top: headTop, width: subjectW, height: subjectH })
        .resize({ height: outH, withoutEnlargement: false })
        .toBuffer();

    const scaledMeta = await sharp(scaledBuf).metadata();
    const scaledW = scaledMeta.width;
    const scale = scaledW / subjectW;

    const fadeStops = params.fadeStops ?? DEFAULT_FADE_STOPS;
    const minFadeW = Math.round(scaledW * (params.fadeZone != null ? params.fadeZone / 100 : 0.40));
    const white = { r: 255, g: 255, b: 255 };

    if (placement === 'right') {
        // Subject on the right; fade runs opaque-white → transparent on the left side.
        const faceLocalX = face ? face.x - cropLeft : subjectW * 0.4;
        const safeFaceLeft = Math.max(0, faceLocalX - (face ? face.width * 1.5 : 0));
        const fadeW = Math.max(minFadeW, Math.round(safeFaceLeft * scale));
        const fadeSvg = makeFadeSvgReversed(fadeW, outH, white, fadeStops);
        const fadedBuf = await sharp(scaledBuf)
            .composite([{ input: fadeSvg, left: 0, top: 0 }])
            .toBuffer();
        return sharp({
            create: { width: outW, height: outH, channels: 3, background: white },
        })
            .composite([{ input: fadedBuf, left: outW - scaledW, top: 0 }])
            .jpeg({ quality: opts.quality, mozjpeg: true })
            .toBuffer();
    }

    // Default: placement === 'left' — subject on left, fade to white on the right.
    const faceLocalX = face ? face.x - cropLeft : 0;
    const safeFaceRight = Math.min(subjectW, faceLocalX + (face ? face.width + face.width * 1.5 : subjectW));
    const fadeLeft = Math.min(Math.round(safeFaceRight * scale), scaledW - minFadeW);
    const fadeW = scaledW - fadeLeft;
    const fadeSvg = makeFadeSvg(Math.max(1, fadeW), outH, white, fadeStops);
    const fadedBuf = await sharp(scaledBuf)
        .composite([{ input: fadeSvg, left: fadeLeft, top: 0 }])
        .toBuffer();
    return sharp({
        create: { width: outW, height: outH, channels: 3, background: white },
    })
        .composite([{ input: fadedBuf, left: 0, top: 0 }])
        .jpeg({ quality: opts.quality, mozjpeg: true })
        .toBuffer();
}

// ---------------------------------------------------------------------------
// full mode: group/scene, plain smartcrop rectangle.
// ---------------------------------------------------------------------------

async function cropFull(buffer, params, opts) {
    return sharp(buffer)
        .extract({ left: params.cropX, top: params.cropY, width: params.cropW, height: params.cropH })
        .resize({ width: opts.width, withoutEnlargement: false })
        .jpeg({ quality: opts.quality, mozjpeg: true })
        .toBuffer();
}

// Hash the crop parameters that actually affect output pixels.
// Excludes metadata fields (srcMtime, userOverrides, titleTheme, status).
function hashParams(params) {
    const { srcMtime, userOverrides, titleTheme, status, paramsHash, ...cropParams } = params;
    return createHash('sha1').update(JSON.stringify(cropParams)).digest('hex').slice(0, 12);
}

// ---------------------------------------------------------------------------
// Per-image config: detected params saved to public/images/banners/source/banners.config.json.
// Users can edit the file to override any value before re-running the script.
// ---------------------------------------------------------------------------

async function loadConfig(sourceDir) {
    const cfgPath = path.join(sourceDir, 'banners.config.json');
    try {
        return JSON.parse(await fs.readFile(cfgPath, 'utf8'));
    } catch {
        return {};
    }
}

async function saveConfig(sourceDir, config) {
    const cfgPath = path.join(sourceDir, 'banners.config.json');
    // Pretty-print but collapse fadeStops arrays-of-arrays onto single lines.
    const json = JSON.stringify(config, null, 2)
        .replace(/\[(\s*\[\s*\d+\s*,\s*\d+\s*\]\s*,?\s*)+\]/g, (m) => m.replace(/\s+/g, ' '));
    await fs.writeFile(cfgPath, json + '\n', 'utf8');
}

// banners.params.json stores a hash per image of the params used for the last
// successful crop. On the next run we compare the current config params against
// this snapshot to detect changes without re-running face detection.
async function loadParamsSnapshot(sourceDir) {
    const p = path.join(sourceDir, 'banners.params.json');
    try {
        return JSON.parse(await fs.readFile(p, 'utf8'));
    } catch {
        return {};
    }
}

async function saveParamsSnapshot(sourceDir, snapshot) {
    const p = path.join(sourceDir, 'banners.params.json');
    await fs.writeFile(p, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
}

// Merge detected params with user overrides.
// Only fields inside `saved.userOverrides` win over fresh detection.
function resolveParams(detected, saved) {
    const overrides = saved.userOverrides || {};
    return { ...detected, ...overrides, srcMtime: saved.srcMtime, userOverrides: overrides };
}

async function detectParams(srcPath, opts, forceMode) {
    const buffer = await fs.readFile(srcPath);
    const meta = await sharp(buffer).metadata();
    if (!meta.width || !meta.height) throw new Error(`Could not read dimensions of ${srcPath}`);

    let faces = [];
    if (opts.useFaces) faces = await detectFaces(buffer);

    const srcAspect = meta.width / meta.height;

    // Decide mode: portrait source OR single prominent runner → gradient; otherwise full.
    const isPortrait = srcAspect < 1;
    const singleRunner = opts.useFaces && isSingleRunner(faces, meta.width);

    if (isPortrait || singleRunner || forceMode === 'gradient') {
        const face = faces.length ? leftmostFace(faces) : null;
        // Face center in right 55% → person likely faces left → place on right.
        const placement = face
            ? ((face.x + face.width / 2) > meta.width * 0.55 ? 'right' : 'left')
            : 'left';
        return {
            mode: 'gradient',
            placement,
            srcWidth: meta.width,
            srcHeight: meta.height,
            face: face ? { x: face.x, y: face.y, width: face.width, height: face.height } : null,
            headTop: face ? Math.max(0, face.y - Math.round(face.height * 0.6)) : 0,
            bodyBottom: face ? Math.min(meta.height, face.y + face.height + Math.round(face.height * 3.5)) : meta.height,
            cropLeft: 0,
            cropRight: meta.width,
            fadeZone: 40,
            fadeStops: DEFAULT_FADE_STOPS,
        };
    }

    // full mode — run smartcrop.
    if (forceMode === 'full') faces = []; // when user forces full, ignore face boosts

    const targetAspect = opts.ratio;
    let cropW, cropH;
    if (srcAspect > targetAspect) { cropH = meta.height; cropW = Math.round(cropH * targetAspect); }
    else { cropW = meta.width; cropH = Math.round(cropW / targetAspect); }

    const boost = faces.length
        ? buildBoostFromFaces(faces, meta.width, meta.height)
        : buildBoostHeuristic(meta.width, meta.height);
    const result = await smartcrop.crop(buffer, { width: cropW, height: cropH, boost });
    let { x, y } = result.topCrop;

    if (faces.length) {
        const padTop = Math.round(cropH * 0.10);
        let needTop = Math.min(...faces.map((f) => f.y));
        let needBottom = Math.max(...faces.map((f) => f.y + f.height + Math.round(f.height * 3.0)));
        needTop = Math.max(0, needTop - padTop);
        needBottom = Math.min(meta.height, needBottom);
        y = Math.min(y, needTop);
        if (needBottom <= y + cropH) y = Math.max(0, y - Math.round((cropH - (needBottom - y)) / 2));
        y = Math.max(0, Math.min(y, meta.height - cropH));
    } else if (y === 0 && cropH < meta.height) {
        y = Math.min(Math.round(meta.height * 0.04), meta.height - cropH);
    }

    return {
        mode: 'full',
        srcWidth: meta.width,
        srcHeight: meta.height,
        faces: faces.map((f) => ({ x: f.x, y: f.y, width: f.width, height: f.height })),
        cropX: x,
        cropY: y,
        cropW,
        cropH,
    };
}

// Binary-search JPEG quality to fit within opts.maxKB, flooring at quality 40.
async function fitToMaxKB(sharpInstance, opts) {
    const targetBytes = opts.maxKB * 1024;
    let lo = 40, hi = opts.quality, best = null, bestQ = opts.quality;

    let buf = await sharpInstance.clone().jpeg({ quality: opts.quality, mozjpeg: true }).toBuffer();
    if (buf.length <= targetBytes) return { buf, quality: opts.quality };

    while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        buf = await sharpInstance.clone().jpeg({ quality: mid, mozjpeg: true }).toBuffer();
        if (buf.length <= targetBytes) {
            best = buf; bestQ = mid; lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }

    if (!best) {
        best = await sharpInstance.clone().jpeg({ quality: 40, mozjpeg: true }).toBuffer();
        bestQ = 40;
        process.stderr.write(`  ! warning: could not fit within ${opts.maxKB} KB even at quality 40 (${Math.round(best.length / 1024)} KB)\n`);
    }
    return { buf: best, quality: bestQ };
}

async function writeOutput(outPath, defaultBuf, sharpInstance, opts) {
    if (opts.maxKB) {
        const { buf, quality } = await fitToMaxKB(sharpInstance, opts);
        await fs.writeFile(outPath, buf);
        return { buf, quality };
    }
    await fs.writeFile(outPath, defaultBuf);
    return { buf: defaultBuf, quality: opts.quality };
}

const GRADIENT_ONLY_FIELDS = ['placement', 'face', 'headTop', 'bodyBottom', 'cropLeft', 'cropRight', 'fadeZone', 'fadeStops'];
const FULL_ONLY_FIELDS = ['faces', 'cropX', 'cropY', 'cropW', 'cropH'];

function removeIrrelevantFields(params) {
    const stale = params.mode === 'gradient' ? FULL_ONLY_FIELDS : GRADIENT_ONLY_FIELDS;
    const cleaned = { ...params };
    for (const f of stale) delete cleaned[f];
    return cleaned;
}

// Map legacy mode names from the old script to the new two-mode system.
// portrait / sole-runner → gradient; everything else with cropX/Y → full.
function migrateLegacyMode(params) {
    const { mode } = params;
    if (mode === 'gradient' || mode === 'full') return params;
    if (mode === 'portrait' || mode === 'sole-runner') {
        return { ...params, mode: 'gradient' };
    }
    // faces:N, heuristic, heuristic (no faces) → full
    return { ...params, mode: 'full' };
}

async function cropOne(srcPath, params, opts) {
    const outName = path.basename(srcPath, path.extname(srcPath)) + '.jpg';
    const outPath = path.join(opts.outDir, outName);
    const buffer = await fs.readFile(srcPath);

    params = migrateLegacyMode(params);
    const meta = { width: params.srcWidth, height: params.srcHeight };

    let outBuf, quality;
    if (params.mode === 'gradient') {
        outBuf = await cropGradient(buffer, params, meta, opts);
        ({ buf: outBuf, quality } = await writeOutput(outPath, outBuf, sharp(outBuf), opts));
    } else {
        outBuf = await cropFull(buffer, params, opts);
        ({ buf: outBuf, quality } = await writeOutput(outPath, outBuf, sharp(outBuf), opts));
    }

    const outMeta = await sharp(outPath).metadata();
    const outKB = Math.round(outBuf.length / 1024);
    return { outPath, outSize: [outMeta.width, outMeta.height], outBuf, quality, outKB };
}

async function main() {
    const opts = parseArgs(process.argv);
    await fs.mkdir(opts.outDir, { recursive: true });

    const sources = await collectSources(opts);
    if (!sources.length) {
        console.log(`No images found in ${opts.sourceDir}`);
        return;
    }

    if (opts.useFaces) {
        process.stdout.write('Loading face detector... ');
        await initFaceDetector();
        process.stdout.write('ok\n');
    }

    const config = await loadConfig(opts.sourceDir);
    const snapshot = await loadParamsSnapshot(opts.sourceDir);
    const cfgPath = path.join(opts.sourceDir, 'banners.config.json');

    // Remove entries for images that no longer exist.
    const sourceKeys = new Set(sources.map((s) => path.basename(s)));
    for (const key of Object.keys(config)) {
        if (!sourceKeys.has(key)) {
            delete config[key];
            console.log(`  - removed stale config entry: ${key}`);
        }
    }

    console.log(`Config: ${cfgPath}`);
    console.log(`Cropping ${sources.length} image(s) → ${opts.outDir}`);
    console.log(`Target: ${opts.width}px wide, aspect ${opts.ratio}:1, quality ${opts.quality}\n`);

    let ok = 0;
    let skipped = 0;
    let failed = 0;
    for (const src of sources) {
        const key = path.basename(src);
        try {
            const stat = await fs.stat(src);
            const mtime = stat.mtimeMs.toString();
            const saved = config[key] || {};

            let params;
            const overrides = saved.userOverrides || {};
            const modeOverridden = overrides.mode && overrides.mode !== saved.mode;
            const outName = path.basename(src, path.extname(src)) + '.jpg';
            const outPath = path.join(opts.outDir, outName);
            const outExists = await fs.access(outPath).then(() => true).catch(() => false);

            const srcUnchanged = saved.srcMtime === mtime && !modeOverridden;

            if (srcUnchanged) {
                params = { ...saved, ...overrides };
                const currentHash = hashParams(params);
                if (!opts.force && outExists && snapshot[key] && snapshot[key] === currentHash) {
                    if (!params.userOverrides) params.userOverrides = {};
                    if (!params.userOverrides.copyright) params.userOverrides.copyright = { name: '', url: '', color: '' };
                    process.stdout.write(`  ~ ${key} (unchanged, skipping)\n`);
                    config[key] = removeIrrelevantFields(params);
                    skipped++;
                    continue;
                }
                const reason = !outExists ? 'output missing' : 'params changed';
                process.stdout.write(`  * ${key} (${reason}, re-cropping)\n`);
            } else {
                const detected = await detectParams(src, opts, overrides.mode);
                params = resolveParams(detected, saved);
                params.srcMtime = mtime;
                const reason = modeOverridden ? `mode override → ${overrides.mode}` : (saved.srcMtime ? 'changed' : 'new');
                process.stdout.write(`  * ${key} (${reason}, detected params)\n`);
            }

            if (!params.userOverrides) params.userOverrides = {};
            if (!params.userOverrides.copyright) params.userOverrides.copyright = { name: '', url: '', color: '' };
            config[key] = removeIrrelevantFields(params);

            const r = await cropOne(src, params, opts);

            if (!(params.userOverrides && params.userOverrides.titleTheme)) {
                config[key].titleTheme = await detectTitleTheme(r.outBuf);
            }
            snapshot[key] = hashParams(config[key]);

            const locStr = params.cropX != null ? ` crop@(${params.cropX},${params.cropY})` : '';
            const placementStr = params.placement ? ` ${params.placement}` : '';
            console.log(`  ✓ ${key}  ${params.srcWidth}x${params.srcHeight} → ${r.outSize.join('x')}  [${params.mode}${placementStr}${locStr}]  q${r.quality}  ${r.outKB}KB`);
            ok++;
        } catch (err) {
            console.error(`  ✗ ${key}: ${err.message}`);
            failed++;
        }
    }

    await saveConfig(opts.sourceDir, config);
    await saveParamsSnapshot(opts.sourceDir, snapshot);
    console.log(`\nDone. ${ok} cropped, ${skipped} skipped, ${failed} failed.`);
    console.log(`Config saved → ${cfgPath}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
