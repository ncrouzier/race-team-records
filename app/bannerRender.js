// Making a homepage banner from a photo: find the runner, frame them on the
// left, and fade the photo to white along the title badge's 12° slant.
//
// Ported from the offline banner tools this replaced (scripts/slant-banners.mjs
// and its editor, removed since): the same geometry, limits and render, so
// the banners made back then and those made on the site match. The framing
// and fade settings are the constants below, at the values the offline
// tools' config file had.
const sharp = require('sharp');
const { detectFaces } = require('./faceDetector');

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

const OUT_W = 2200;
const OUT_H = 572;
const DESIGN_W = 1140;
const DESIGN_CENTER_Y = 125;
const TAN = Math.tan(12 * Math.PI / 180);
const PX = OUT_W / DESIGN_W; // image px per design px
// Share of the image's height a 1140px-wide (the widest) banner shows
const WIDE_VISIBLE = 250 / (DESIGN_W * OUT_H / OUT_W);

// The badge's vertical centre lands at a slightly different image row at
// each banner width (125px of banner is 241 image rows at 1140px wide, 286
// at 962px). Aim between the two; the slant puts the error at ±2.5px.
const CENTER_ROW = 263;

const STRIPES = { x: 503.4 - 52, y: 197 };
const NAVY_STRIP = { x: 604.6, y: 87 };

// How every banner is framed, in % of the banner (the face is what's
// positioned; the runner's body follows):
//   faceSize        the smallest the face may be, of the banner's height
//   faceFromTop     gap above the top of the face, of the banner's height
//   faceFromLeft    the centre of the face, of the banner's width
//   maxFaceFromLeft how far right the runner may go when a photo doesn't
//                   reach far enough right to fill the banner
const FRAMING = { faceSize: 9, faceFromTop: 12, faceFromLeft: 20, maxFaceFromLeft: 27 };
// The fade to white behind the title: startBeforeStripes and
// endAfterNavyStrip in px on a 1140px banner; stops [position %, white %]
const FADE = { startBeforeStripes: 70, endAfterNavyStrip: 0, stops: [[0, 0], [20, 8], [45, 32], [70, 66], [88, 90], [100, 100]] };
// The banner is the only lossy step (made from the photo as uploaded): 95,
// where it stops visibly improving, and full colour resolution (4:4:4):
// ~155 KB a banner, ~320 KB at most (100 would double that)
const QUALITY = 95;

// A group shot: several faces about as big as the largest one
const GROUP_MIN_FACES = 4;
const GROUP_FACE_SIZE = 0.5;
// The runner counts as on the right when their face is past this share of the width
const RIGHT_SIDE = 0.6;

// x in the image where an edge of the badge crosses image row y, given a
// point (x, y) on that edge in design px on a 1140px banner.
function badgeEdge(designX, designY) {
    const xAtCenter = (designX + (designY - DESIGN_CENTER_Y) * TAN) * PX;
    return (row) => xAtCenter - (row - CENTER_ROW) * TAN;
}

// ---------------------------------------------------------------------------
// Analysis: the main runner's face (the largest one) and the kind of photo.
// `buffer` is the photo as uploaded: everything here works on it upright
// (its EXIF orientation applied), as the render does.
// ---------------------------------------------------------------------------

async function analyse(buffer) {
    const meta = await sharp(buffer).metadata();
    const sideways = (meta.orientation || 1) >= 5;
    const width = sideways ? meta.height : meta.width, height = sideways ? meta.width : meta.height;
    // Detection runs on a copy at most 1200px on its long side
    const { data, info } = await sharp(buffer).rotate()
        .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
        .removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const scale = width / info.width;
    const faces = (await detectFaces(data, info, 0.3)).map((f) => ({
        x: Math.round(f.x * scale), y: Math.round(f.y * scale),
        width: Math.round(f.width * scale), height: Math.round(f.height * scale)
    }));

    const face = faces[0] || null;
    let kind = 'runner-left';
    if (!face) kind = 'no-face';
    else if (faces.filter((f) => f.width >= face.width * GROUP_FACE_SIZE).length >= GROUP_MIN_FACES) kind = 'group';
    else if (face.x + face.width / 2 > width * RIGHT_SIDE) kind = 'runner-right';

    return { width, height, kind, face, otherFaces: faces.slice(1, 4), faceCount: faces.length };
}

// ---------------------------------------------------------------------------
// Framing
// ---------------------------------------------------------------------------

// White over the photo, along a gradient whose bands lean 12° like the badge
function fadeOverlay(fade) {
    fade = fade || FADE;
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

// A photo's settings: what was detected, then the framing for every banner
function photoSettings(detected) {
    return Object.assign({}, detected, FRAMING);
}

// The framing for one photo: shares of the banner (0–1), and the crop as
// source pixels
function framingFor(p) {
    const zoom = p.zoom == null ? 1 : p.zoom;
    const across = (p.faceFromLeft + (p.moveRight || 0)) / 100;
    return {
        zoom,
        faceHeight: p.faceSize / 100,
        faceTop: (p.faceFromTop + (p.moveDown || 0)) / 100,
        faceX: across,
        maxFaceX: Math.max(across, (p.maxFaceFromLeft + (p.moveRight || 0)) / 100),
        cropLeft: Math.round(p.width * (p.cropLeft || 0) / 100),
        cropRight: Math.round(p.width * (1 - (p.cropRight || 0) / 100))
    };
}

// What a crop ({ x, y, width } in source pixels: the photo area the banner
// shows) may be. The banner's height must be all photo; so must everything
// up to the end of the fade — past it, the banner is white anyway.
function cropLimits(p, overlay) {
    const reachShare = overlay.reach / OUT_W;
    const maxWidth = Math.min(p.height * OUT_W / OUT_H, p.width / reachShare);
    // Closer than this, a pixel of the photo is blown up over 3 of the banner's
    const minWidth = Math.min(maxWidth, OUT_W / 3);
    return { maxWidth, minWidth, reachShare };
}

// The nearest crop within the limits
function clampCrop(p, crop, overlay) {
    const { maxWidth, minWidth, reachShare } = cropLimits(p, overlay);
    const width = Math.min(maxWidth, Math.max(minWidth, Number(crop.width) || maxWidth));
    const x = Math.min(Math.max(0, p.width - reachShare * width), Math.max(0, Number(crop.x) || 0));
    const y = Math.min(Math.max(0, p.height - width * OUT_H / OUT_W), Math.max(0, Number(crop.y) || 0));
    return { x: Math.round(x), y: Math.round(y), width: Math.round(width) };
}

// Where the photo goes in the banner: a scale, and the offset of the
// (scaled) source area cropLeft..cropLeft+cropW. From the crop when there is
// one, else framed on the face.
function placementFor(p, overlay) {
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

    // Zoom 1 is as wide as the photo allows — the face faceSize of the
    // banner's height, or, for a photo too small for that, just enough
    // larger to fill. The photo's zoom is relative to that.
    let widest = f.faceHeight * OUT_H / face.height;
    while (!fits(widest)) widest *= 1.01;
    let scale = widest * Math.max(1, f.zoom);
    while (!fits(scale)) scale *= 1.01;
    return { mode: 'auto', scale, cropLeft, cropW, offsetX: offsetXFor(scale), offsetY: offsetYFor(scale) };
}

// A placement as the equivalent crop, in source pixels
function cropOfPlacement(pl) {
    return {
        x: Math.round(pl.cropLeft - pl.offsetX / pl.scale),
        y: Math.round(-pl.offsetY / pl.scale),
        width: Math.round(OUT_W / pl.scale)
    };
}

// The framing a photo starts from in the editor: on the face for a single
// runner on the left, else the widest crop from the top-left corner
function automaticCrop(p, overlay) {
    try {
        if (p.face && p.kind === 'runner-left') return cropOfPlacement(placementFor(Object.assign({}, p, { crop: null }), overlay));
    } catch (err) {
        // the face is cut off by the photo's own crop: fall through
    }
    return clampCrop(p, { x: 0, y: 0, width: 0 }, overlay);
}

// Whether a crop is the photo's automatic one, give or take a pixel: then
// the banner is rendered from the automatic placement itself, exactly as
// the offline tools did, rather than from that placement turned into a crop
// (which the crop limits can nudge)
function isAutomaticCrop(p, crop, overlay) {
    if (!crop || !p.face || p.kind !== 'runner-left') return false;
    const auto = automaticCrop(p, overlay);
    return ['x', 'y', 'width'].every((k) => Math.abs(Number(crop[k]) - auto[k]) <= 1);
}

// The banner, from the photo and a crop ({ x, y, width } in its pixels)
async function renderBanner(buffer, p, crop, overlay, quality) {
    overlay = overlay || fadeOverlay();
    const pl = isAutomaticCrop(p, crop, overlay)
        ? placementFor(Object.assign({}, p, { crop: null }), overlay)
        : placementFor(Object.assign({}, p, { crop }), overlay);
    const scaledW = Math.round(pl.cropW * pl.scale);
    const scaledH = Math.round(p.height * pl.scale);
    const left = Math.min(-pl.offsetX, scaledW - 1);
    const top = Math.max(0, Math.min(-pl.offsetY, scaledH - OUT_H));
    const photo = await sharp(buffer).rotate()
        .extract({ left: pl.cropLeft, top: 0, width: pl.cropW, height: p.height })
        // fastShrinkOnLoad off: libvips' shortcut of decoding a JPEG at a
        // fraction of its size softens it slightly
        .resize({ width: scaledW, height: scaledH, fastShrinkOnLoad: false })
        .extract({ left, top, width: Math.min(scaledW - left, OUT_W), height: OUT_H })
        .toBuffer();

    return sharp({ create: { width: OUT_W, height: OUT_H, channels: 3, background: '#ffffff' } })
        .composite([
            { input: photo, left: 0, top: 0 },
            { input: overlay.svg, left: 0, top: 0 }
        ])
        .jpeg({ quality: quality || QUALITY, chromaSubsampling: '4:4:4', mozjpeg: true })
        .toBuffer();
}

module.exports = {
    OUT_W, OUT_H, WIDE_VISIBLE, FRAMING, FADE, QUALITY,
    analyse, fadeOverlay, photoSettings, cropLimits, clampCrop, placementFor,
    cropOfPlacement, automaticCrop, isAutomaticCrop, renderBanner
};
