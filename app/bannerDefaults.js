// Starting values for a new banner's database entry: which side the title
// goes, from the banner scripts' files in config/banners/. Used by the
// Banners admin page (adding new images) and scripts/seed-banners.js, so both
// agree. Everything else about a banner — tagged members, photo credit,
// pinned, disabled — is set on the Banners page only.
const fs = require('fs');
const path = require('path');

const bannersDir = path.join(__dirname, '..', 'public', 'images', 'banners');
const configDir = path.join(__dirname, '..', 'config', 'banners');

function readJson(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
        if (err.code === 'ENOENT') return {};
        throw err;
    }
}

// The two files, read fresh each time: they change whenever the scripts run
function loadSources() {
    return {
        detected: readJson(path.join(configDir, 'slant-banners.detected.json')),
        slant: readJson(path.join(configDir, 'slant-banners.config.json'))
    };
}

// The source photo a banner was made from: same name, any extension
function sourceNameFor(filename, sources) {
    const base = path.basename(filename, path.extname(filename));
    return Object.keys(sources.detected).find((name) => path.basename(name, path.extname(name)) === base) || null;
}

// A photo's settings: what was detected, then its entry in the config
function photoSettings(sourceName, sources) {
    return Object.assign({}, sources.detected[sourceName], (sources.slant.images || {})[sourceName]);
}

// Whether scripts/slant-banners.mjs makes this photo's banner, by the same
// rule it uses (makesBanner in scripts/lib/slant-banners-core.mjs): a crop
// set by hand always does; otherwise a single runner on the left, with a face
function slantMakes(sourceName, sources) {
    if (!sourceName || !sources.detected[sourceName]) return false;
    const p = photoSettings(sourceName, sources);
    return !p.skip && (!!p.crop || (p.kind === 'runner-left' && !!p.face));
}

// The title goes on the side away from the runner. Slant banners always have
// it on the right — their fade is drawn for it. Otherwise from the photo's
// kind: centred over a group shot, on the left for a runner on the right.
function titlePositionFor(sourceName, sources) {
    if (slantMakes(sourceName, sources)) return 'right';
    const kind = sourceName ? photoSettings(sourceName, sources).kind : null;
    if (kind === 'group') return 'center';
    if (kind === 'runner-right') return 'left';
    return 'right';
}

// Defaults for the banner image `filename` (e.g. "jamesJ.jpg")
function bannerDefaults(filename, sources = loadSources()) {
    const sourceName = sourceNameFor(filename, sources);
    return {
        titlePosition: titlePositionFor(sourceName, sources),
        slant: slantMakes(sourceName, sources)
    };
}

// Banner images on disk: .jpg files directly in public/images/banners
// (not those in source/)
function bannerImageFiles() {
    return fs.readdirSync(bannersDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && /\.jpe?g$/i.test(entry.name))
        .map((entry) => entry.name)
        .sort();
}

module.exports = { bannerDefaults, bannerImageFiles, loadSources };
