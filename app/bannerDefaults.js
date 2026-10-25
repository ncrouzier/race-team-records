// Starting values for a new banner's database entry: which side the title
// goes, read from the banner scripts' files in public/images/banners/source/.
// Used by the Banners admin page (adding new images) and
// scripts/seed-banners.js, so both agree. Everything else about a banner —
// tagged members, photo credit, pinned, disabled — is set on the Banners page only.
const fs = require('fs');
const path = require('path');

const bannersDir = path.join(__dirname, '..', 'public', 'images', 'banners');
const sourceDir = path.join(bannersDir, 'source');

function readJson(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
        if (err.code === 'ENOENT') return {};
        throw err;
    }
}

// The three files, read fresh each time: they change whenever the scripts run
function loadSources() {
    return {
        crop: readJson(path.join(sourceDir, 'banners.config.json')),
        detected: readJson(path.join(sourceDir, 'slant-banners.detected.json')),
        slant: readJson(path.join(sourceDir, 'slant-banners.config.json'))
    };
}

// The source photo a banner was made from: same name, any extension
function sourceNameFor(filename, sources) {
    const base = path.basename(filename, path.extname(filename));
    return Object.keys(sources.crop).concat(Object.keys(sources.detected))
        .find((name) => path.basename(name, path.extname(name)) === base) || null;
}

// Whether scripts/slant-banners.mjs makes this photo's banner, by the same
// rule it uses (makesBanner in scripts/lib/slant-banners-core.mjs): a crop
// set by hand always does; otherwise a single runner on the left, with a face
function slantMakes(sourceName, sources) {
    if (!sources.detected[sourceName]) return false;
    const p = Object.assign({}, sources.detected[sourceName], (sources.slant.images || {})[sourceName]);
    return !p.skip && (!!p.crop || (p.kind === 'runner-left' && !!p.face));
}

// The title goes on the side away from the runner. Slant banners always have
// it on the right — their fade is drawn for it. Otherwise, from the old crop:
// a single runner on one side ('placement', default left), or a group shot
// ('full'), which gets a centred title.
function titlePositionFor(sourceName, sources) {
    if (sourceName && slantMakes(sourceName, sources)) return 'right';
    const crop = sources.crop[sourceName];
    if (crop) {
        const params = Object.assign({}, crop, crop.userOverrides || {});
        if (params.mode === 'full') return 'center';
        return params.placement === 'right' ? 'left' : 'right';
    }
    const detected = sources.detected[sourceName];
    if (detected && detected.kind === 'group') return 'center';
    if (detected && detected.kind === 'runner-right') return 'left';
    return 'right';
}

// Defaults for the banner image `filename` (e.g. "jamesJ.jpg")
function bannerDefaults(filename, sources = loadSources()) {
    const sourceName = sourceNameFor(filename, sources);
    return {
        titlePosition: titlePositionFor(sourceName, sources),
        slant: !!sourceName && slantMakes(sourceName, sources)
    };
}

// Banner images on disk: .jpg files directly in public/images/banners
// (not the source/ or old/ folders)
function bannerImageFiles() {
    return fs.readdirSync(bannersDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && /\.jpe?g$/i.test(entry.name))
        .map((entry) => entry.name)
        .sort();
}

module.exports = { bannerDefaults, bannerImageFiles, loadSources };
