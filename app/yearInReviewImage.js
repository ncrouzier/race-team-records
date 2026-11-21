// The year in review's share image (1080x1080 PNG): a member's year
// (their photo, name and six big figures) or the team's. Drawn as an SVG and
// rendered by sharp; the text uses Inter, installed in the server image
// (Dockerfile), with fallbacks elsewhere. Also the pages' link preview.

const path = require('path');
const sharp = require('sharp');
const profileThumbnails = require('./profileThumbnails');

const SIZE = 1080;
const LOGO = path.join(__dirname, '..', 'public', 'images', 'mcrrc_logo_256.png');
const FONT = "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif";
// The member's photo: its diameter and centre. Its bottom edge stays at
// 325 (just above the name); it grows upwards into the space by the year.
const PHOTO_D = 250;
const PHOTO_Y = 325 - PHOTO_D / 2;

function esc(text) {
    return String(text == null ? '' : text)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function number(n) {
    return Math.round(n).toLocaleString('en-US');
}

function hours(centiseconds) {
    const h = centiseconds / 360000;
    return h >= 10 ? number(h) : (Math.round(h * 10) / 10).toString();
}

function places(totals) {
    const states = totals.states.length;
    const abroad = totals.countries.filter(c => c.code !== 'USA').length;
    return states + abroad;
}

// The four figures: [value, label]. Personal bests when there are some,
// else age-group wins, else volunteer jobs: nothing to share shows as 0.
function highlight(y) {
    if (y.pbs.length) return [String(y.pbs.length), y.pbs.length === 1 ? 'personal best' : 'personal bests'];
    if (y.ranking.ageWins) return [String(y.ranking.ageWins), y.ranking.ageWins === 1 ? 'age-group win' : 'age-group wins'];
    if (y.volunteerJobs) return [String(y.volunteerJobs), y.volunteerJobs === 1 ? 'volunteer job' : 'volunteer jobs'];
    return [hours(y.totals.time), 'hours racing'];
}

function memberFigures(y) {
    const t = y.totals;
    return [
        [number(t.races), t.races === 1 ? 'race' : 'races'],
        [number(t.miles), 'miles raced'],
        highlight(y),
        y.bestAgeGrade ? [y.bestAgeGrade.agegrade.toFixed(1) + '%', 'best age grade'] : [String(places(t)), 'states & countries']
    ];
}

function teamFigures(y) {
    const t = y.totals;
    return [
        [number(t.results), 'results'],
        [number(t.runners), 'members raced'],
        [number(t.pbs), 'personal bests'],
        [String(y.teamRecords.length), y.teamRecords.length === 1 ? 'team record' : 'team records']
    ];
}

// A race time from centiseconds: "17:21", "1:24:39"
function clock(centiseconds) {
    const total = Math.round(centiseconds / 100);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = total % 60;
    const two = n => (n < 10 ? '0' : '') + n;
    return h ? h + ':' + two(m) + ':' + two(sec) : m + ':' + two(sec);
}

function pace(seconds) {
    const m = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return m + ':' + (sec < 10 ? '0' : '') + sec + '/mi';
}

function ordinal(n) {
    const v = n % 100;
    return n + (v >= 11 && v <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));
}

// "2nd of 412 overall", "1st of 230 women", "1st of 31 in age group"
function placeText(race, sex) {
    const group = race.place === 'overall' ? 'overall'
        : race.place === 'gender' ? (sex === 'Female' ? 'women' : sex === 'Male' ? 'men' : 'in gender')
            : 'in age group';
    if (!race.total) return ordinal(race.rank) + (race.place === 'gender' && group !== 'in gender' ? ' of the ' + group : ' ' + group);
    return ordinal(race.rank) + ' of ' + number(race.total) + ' ' + group;
}

// The fun lines under the figures: [label, text]
function funLines(y) {
    const f = y.fun || {};
    const lines = [];
    if (y.kind === 'member') {
        // The picked stat (the first that applies by default)
        if (f.stat) lines.push([f.stat.label, f.stat.text]);
        // (the best race has a section of its own)
        if (!f.race && f.fastestPace) lines.push(['Fastest pace', pace(f.fastestPace.pace) + ' at ' + f.fastestPace.racename]);
        if (f.food) lines.push(['Fuel burned', '≈ ' + number(f.food.count) + ' ' + f.food.text]);
    } else {
        if (f.miles) lines.push(['That\'s', number(y.totals.miles) + ' miles = ' + f.miles.count.toLocaleString('en-US') + ' ' + f.miles.text]);
        if (f.mostRaces) lines.push(['Most races', [f.mostRaces.name].concat(f.mostRaces.others).join(' & ') + ' · ' + f.mostRaces.races + ' races']);
        if (f.ace) lines.push(['Age grade of the year', f.ace.name + ' · ' + f.ace.agegrade.toFixed(2) + '%']);
        if (f.turnout) lines.push(['Biggest turnout', f.turnout.racename + ' · ' + f.turnout.runners + ' members']);
    }
    // Three on a member's (their best race has its own box), four on the team's
    return lines.slice(0, y.kind === 'member' ? 3 : 4);
}

// Shrinks a text to fit a width (Inter is roughly 0.55em per character)
function fitSize(text, max, width) {
    return Math.min(max, Math.floor(width / (Math.max(1, text.length) * 0.56)));
}

// Cuts a line too long for its width, with an ellipsis
function clip(text, size, width) {
    const fits = Math.floor(width / (size * 0.53));
    return text.length > fits ? text.slice(0, fits - 1).trim() + '…' : text;
}

// The club logo on the orange slant in the top-right corner (the banner
// badge's): the slant as tall as the logo plus a margin, leaning 12°, and the
// logo centred on it
const TAN12 = Math.tan(12 * Math.PI / 180);
function logoBox(kind) {
    const size = kind === 'member' ? 170 : 210;
    const h = size + 44;
    const shift = h * TAN12; // how far the slanted edges lean over its height
    // The slant: its top edge from x=820 to the right edge, its bottom edge
    // 40px wider and leaning left by `shift`
    const points = [[SIZE - 260, 0], [SIZE, 0], [SIZE - shift, h], [SIZE - 300 - shift, h]];
    // Centred between its top and bottom edges' middles
    const cx = ((SIZE - 130) + (SIZE - 150 - shift)) / 2;
    return { size, h, points, cx, cy: h / 2 };
}

// The team's faces, tiled across the whole square: everyone who raced that
// year with a profile thumbnail, in grey (repeated to fill when there are
// few). A JPEG data URI, laid faintly over the background; null without any.
async function facesMosaic(thumbs) {
    const faces = (thumbs || []).filter(Boolean);
    if (!faces.length) return null;
    const cols = Math.max(4, Math.ceil(Math.sqrt(faces.length)));
    const tile = Math.ceil(SIZE / cols);
    const rows = Math.ceil(SIZE / tile);
    const cells = await Promise.all(faces.map(buffer => sharp(buffer).resize(tile, tile, { fit: 'cover' })
        .grayscale().jpeg().toBuffer().catch(() => null)));
    const usable = cells.filter(Boolean);
    if (!usable.length) return null;
    const layers = [];
    for (let i = 0; i < cols * rows; i++) {
        layers.push({ input: usable[i % usable.length], left: (i % cols) * tile, top: Math.floor(i / cols) * tile });
    }
    const jpeg = await sharp({ create: { width: cols * tile, height: rows * tile, channels: 3, background: '#000000' } })
        .composite(layers).resize(SIZE, SIZE, { fit: 'cover', position: 'top' }).jpeg({ quality: 70 }).toBuffer();
    return 'data:image/jpeg;base64,' + jpeg.toString('base64');
}

// A member's year as a calendar, faint behind everything: a column a month,
// a row a day (31), the days they raced lit up, brighter for more races
function raceCalendar(y) {
    const raced = {};
    (y.raceDays || []).forEach(([m, d, n]) => { raced[m + '-' + d] = n; });
    const margin = 18;
    const gx = 6;
    const gy = 4;
    const w = (SIZE - 2 * margin - 11 * gx) / 12;
    const h = (SIZE - 2 * margin - 30 * gy) / 31;
    const cells = [];
    for (let m = 0; m < 12; m++) {
        const days = new Date(Date.UTC(y.year, m + 1, 0)).getUTCDate();
        for (let d = 1; d <= days; d++) {
            const n = raced[m + '-' + d] || 0;
            const x = margin + m * (w + gx);
            const top = margin + (d - 1) * (h + gy);
            const opacity = n ? Math.min(0.3, 0.16 + 0.07 * (n - 1)) : 0.035;
            cells.push(`<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="5" fill="#ffffff" fill-opacity="${opacity}"/>`);
        }
    }
    return cells.join('');
}

// A member's bio photo (the whole picture on their page), blown up and
// blurred to fill the square: their background when they pick it. Their
// thumbnail when the photo cannot be had. A JPEG data URI, or null.
async function photoBackdrop(member) {
    let source = null;
    if (member && member.pictureLink) {
        try {
            source = await sharp(await profileThumbnails.fetchImageBuffer(member.pictureLink)).rotate().toBuffer();
        } catch (err) {
            source = null;
        }
    }
    if (!source && member) source = await profileThumbnails.readThumb(member._id).catch(() => null);
    if (!source) return null;
    try {
        const jpeg = await sharp(source).resize(SIZE, SIZE, { fit: 'cover', position: 'attention' })
            .blur(14).jpeg({ quality: 70 }).toBuffer();
        return 'data:image/jpeg;base64,' + jpeg.toString('base64');
    } catch (err) {
        return null;
    }
}

function svgFor(y, withPhoto, mosaic, backdrop) {
    const isMember = y.kind === 'member';
    const name = isMember ? (y.member.firstname + ' ' + y.member.lastname).trim() : 'MCRRC Racing Team';
    const figures = isMember ? memberFigures(y) : teamFigures(y);
    const C = SIZE / 2;
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = d => { const x = new Date(d); return MONTHS[x.getUTCMonth()] + ' ' + x.getUTCDate(); };

    // The year, and under it "so far" for this one (its own line: beside the
    // year it would run into the photo)
    const yearY = isMember ? 150 : 200;
    const soFar = y.partial
        ? `<text x="60" y="${yearY + (isMember ? 38 : 44)}" font-size="24" font-weight="600" fill="#9fd9ee">so far, to ${esc(day(new Date()))}</text>`
        : '';

    // The name, under the photo
    const nameY = isMember ? 410 : 330;
    const nameSize = fitSize(name, 60, 940);

    // Four figures, two by two (lower on a member's, to fit their best race)
    const top = nameY + 50;
    const race = isMember && y.fun ? y.fun.race : null;
    const tileH = race ? 112 : 130;
    const step = tileH + (race ? 12 : 16);
    const tiles = figures.map(([value, label], i) => {
        const x = 60 + (i % 2) * 490;
        const yy = top + Math.floor(i / 2) * step;
        const valueSize = fitSize(value, race ? 62 : 70, 400);
        return `<rect x="${x}" y="${yy}" width="470" height="${tileH}" rx="22" fill="#ffffff" fill-opacity="0.1"/>` +
            `<text x="${x + 30}" y="${yy + tileH * 0.55}" font-size="${valueSize}" font-weight="800" fill="#ffffff">${esc(value)}</text>` +
            `<text x="${x + 30}" y="${yy + tileH - 22}" font-size="22" font-weight="600" fill="#9fd9ee" letter-spacing="1.5">${esc(label.toUpperCase())}</text>`;
    }).join('');

    // Their best race, a section of its own: the race, its place and day,
    // and the time on the right
    let after = top + 2 * step;
    let raceBox = '';
    if (race) {
        const ry = after;
        const time = race.time ? clock(race.time) : '';
        const nameWidth = 880 - (time ? time.length * 34 + 30 : 0);
        raceBox = `<rect x="60" y="${ry}" width="960" height="128" rx="22" fill="#f06c0c" fill-opacity="0.22" stroke="#f06c0c" stroke-opacity="0.6" stroke-width="2"/>` +
            `<text x="92" y="${ry + 40}" font-size="21" font-weight="700" fill="#f6a35c" letter-spacing="1.5">BEST RACE</text>` +
            `<text x="92" y="${ry + 80}" font-size="32" font-weight="800" fill="#ffffff">${esc(clip(race.racename, 32, nameWidth))}</text>` +
            `<text x="92" y="${ry + 112}" font-size="22" font-weight="600" fill="#cde9f3">${esc(placeText(race, y.member.sex) + ' · ' + day(race.racedate))}</text>` +
            (time ? `<text x="988" y="${ry + 86}" font-size="58" font-weight="800" fill="#ffffff" text-anchor="end">${esc(time)}</text>` : '');
        after = ry + 128 + 12;
    }

    // The fun lines, in a band under the figures
    const lines = funLines(y);
    const bandY = after + (race ? 0 : 6);
    const band = lines.length
        ? `<rect x="60" y="${bandY}" width="960" height="${lines.length * 62 + 26}" rx="22" fill="#000000" fill-opacity="0.18"/>` +
          lines.map(([label, text], i) => {
              const ly = bandY + 54 + i * 62;
              return `<text x="92" y="${ly}" font-size="21" font-weight="700" fill="#f6a35c" letter-spacing="1.5">${esc(label.toUpperCase())}</text>` +
                  // up to the band's right edge, less its padding
                  `<text x="${92 + label.length * 15 + 26}" y="${ly}" font-size="27" font-weight="600" fill="#ffffff">${esc(clip(text, 27, 988 - (92 + label.length * 15 + 26)))}</text>`;
          }).join('')
        : '';

    const photoRing = isMember && withPhoto
        ? `<circle cx="${C}" cy="${PHOTO_Y}" r="${PHOTO_D / 2 + 6}" fill="none" stroke="#f06c0c" stroke-width="8"/>`
        : '';
    const initials = isMember && !withPhoto
        ? `<circle cx="${C}" cy="${PHOTO_Y}" r="${PHOTO_D / 2}" fill="#ffffff" fill-opacity="0.12" stroke="#f06c0c" stroke-width="8"/>` +
          `<text x="${C}" y="${PHOTO_Y + 32}" font-size="88" font-weight="800" fill="#ffffff" text-anchor="middle">${esc(((y.member.firstname || '')[0] || '') + ((y.member.lastname || '')[0] || ''))}</text>`
        : '';

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" font-family="${FONT}">` +
        '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="#00384d"/><stop offset="1" stop-color="#006687"/></linearGradient></defs>' +
        `<rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>` +
        // The team's: its faces; a member's: their racing calendar, or their
        // photo blurred under the blue
        (mosaic ? `<image href="${mosaic}" x="0" y="0" width="${SIZE}" height="${SIZE}" opacity="0.14" preserveAspectRatio="xMidYMid slice"/>` +
            `<rect width="${SIZE}" height="${SIZE}" fill="url(#bg)" opacity="0.35"/>`
            : backdrop ? `<image href="${backdrop}" x="0" y="0" width="${SIZE}" height="${SIZE}" opacity="0.55" preserveAspectRatio="xMidYMid slice"/>` +
                `<rect width="${SIZE}" height="${SIZE}" fill="url(#bg)" opacity="0.6"/>`
                : (y.fun && y.fun.background === 'plain' ? '' : raceCalendar(y))) +
        // The banner badge's slant, in the corner, the logo on it (render())
        `<polygon points="${logoBox(y.kind).points.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')}" fill="#f06c0c" opacity="0.9"/>` +
        `<text x="60" y="88" font-size="28" font-weight="700" fill="#9fd9ee" letter-spacing="4">YEAR IN REVIEW</text>` +
        `<text x="60" y="${yearY}" font-size="${isMember ? 64 : 120}" font-weight="800" fill="#ffffff">${y.year}</text>` + soFar +
        photoRing + initials +
        `<text x="${C}" y="${nameY}" font-size="${nameSize}" font-weight="800" fill="#ffffff" text-anchor="middle">${esc(name)}</text>` +
        tiles + raceBox + band +
        `<text x="${C}" y="${SIZE - 30}" font-size="22" font-weight="600" fill="#9fd9ee" text-anchor="middle">MCRRC Racing Team · raceteam.mcrrc.org</text>` +
        '</svg>';
}

// The member's photo as a circle: their profile thumbnail, cut around
// their face (app/profileThumbnails.js); null when they have none
async function photoCircle(member) {
    const thumb = member ? await profileThumbnails.readThumb(member._id).catch(() => null) : null;
    if (!thumb) return null;
    const d = PHOTO_D;
    const mask = Buffer.from(`<svg width="${d}" height="${d}"><circle cx="${d / 2}" cy="${d / 2}" r="${d / 2}" fill="#fff"/></svg>`);
    try {
        return await sharp(thumb).resize(d, d, { fit: 'cover', kernel: 'lanczos3' })
            .composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
    } catch (err) {
        return null;
    }
}

/**
 * The PNG for a year (memberYear or teamYear's result); member: the member
 * document (_id, pictureLink) for a member's year; faces: the team's thumbnails
 * (Buffers) for the team's.
 */
async function render(y, member, faces) {
    const photo = y.kind === 'member' && member ? await photoCircle(member) : null;
    const layers = [];
    if (photo) {
        layers.push({ input: photo, left: Math.round(SIZE / 2 - PHOTO_D / 2), top: Math.round(PHOTO_Y - PHOTO_D / 2) });
    }
    const box = logoBox(y.kind);
    const logo = await sharp(LOGO).resize(box.size, box.size).png().toBuffer();
    layers.push(y.kind === 'member'
        ? { input: logo, left: Math.round(box.cx - box.size / 2), top: Math.round(box.cy - box.size / 2) }
        : { input: logo, left: Math.round(box.cx - box.size / 2), top: Math.round(box.cy - box.size / 2) });

    const mosaic = y.kind === 'team' ? await facesMosaic(faces) : null;
    const backdrop = y.kind === 'member' && y.fun && y.fun.background === 'photo' ? await photoBackdrop(member) : null;
    const rgba = await sharp(Buffer.from(svgFor(y, !!photo, mosaic, backdrop))).composite(layers).png().toBuffer();
    // The image is fully opaque: without its alpha channel the same pixels
    // take 12-35% fewer bytes. A second pass, as sharp applies removeAlpha
    // before compositing. (The page shows a WebP made from this PNG: see
    // app/yearInReviewRoutes.js.)
    return sharp(rgba).removeAlpha().png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
}

module.exports = { render, svgFor, placeText };
