#!/usr/bin/env node
//
// Visual editor for the homepage banners: add or pick a source photo, drag
// and zoom it behind the real title badge and fade, save. Saving writes the photo's
// "crop" into config/banners/slant-banners.config.json and
// regenerates its banner, exactly as `npm run banners` would.
//
// Local only: it edits files in this repo, to commit and deploy as usual.
//
// Usage: npm run banners:edit     (then open http://localhost:8095)
//
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import express from 'express';
import sharp from 'sharp';
import {
    repoRoot, sourceDir, OUT_W, OUT_H, WIDE_VISIBLE,
    loadConfig, saveConfig, loadDetected, saveDetected, updateDetected, listSources, photoSettings, makesBanner, bannerFileName,
    fadeOverlay, cropLimits, clampCrop, placementFor, cropOfPlacement, renderBanner
} from './lib/slant-banners-core.mjs';

const PORT = Number(process.env.BANNER_EDITOR_PORT) || 8095;
const app = express();
app.use(express.json());

// The site's files, for the generated banners and the badge's fonts
app.use('/site', express.static(path.join(repoRoot, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(repoRoot, 'scripts/banner-editor.html')));

// A photo name from the URL, only if it's one of the source photos
async function sourceName(req, res) {
    const name = req.params.name;
    if ((await listSources()).includes(name)) return name;
    res.status(404).json({ error: 'No such source photo: ' + name });
    return null;
}

// Everything the page needs about one photo
function describe(name, detected, settings, overlay) {
    const p = photoSettings(name, detected, settings);
    const info = {
        name,
        width: p.width,
        height: p.height,
        kind: p.kind,
        skip: !!p.skip,
        makes: makesBanner(p),
        handCrop: !!p.crop,
        note: p.note || '',
        // This photo's own settings that a saved crop replaces
        replaces: Object.keys((settings.images || {})[name] || {}).filter((k) => k !== 'note' && k !== 'crop'),
        limits: cropLimits(p, overlay),
        banner: '/site/' + path.relative(path.join(repoRoot, 'public'), path.join(repoRoot, settings.outDir, bannerFileName(name))).split(path.sep).join('/')
    };
    // Where the banner frames it now: the hand-set crop, or the automatic
    // framing as a crop to start from (or the whole width, with neither)
    try {
        info.crop = p.crop ? clampCrop(p, p.crop, overlay)
            : p.face ? cropOfPlacement(placementFor(p, overlay))
                : clampCrop(p, { x: 0, y: 0, width: 0 }, overlay);
    } catch (err) {
        info.crop = clampCrop(p, { x: 0, y: 0, width: 0 }, overlay);
    }
    return info;
}

app.get('/api/photos', async (req, res, next) => {
    try {
        const settings = await loadConfig();
        const detected = await updateDetected({ log: (line) => console.log(line) });
        const overlay = fadeOverlay(settings.fade);
        res.json({
            out: { width: OUT_W, height: OUT_H, wideVisible: WIDE_VISIBLE },
            photos: Object.keys(detected).sort().map((name) => describe(name, detected, settings, overlay))
        });
    } catch (err) {
        next(err);
    }
});

app.get('/api/fade.svg', async (req, res, next) => {
    try {
        res.type('image/svg+xml').send(fadeOverlay((await loadConfig()).fade).svg);
    } catch (err) {
        next(err);
    }
});

// The photo, upright and at most 1600px across, to drag around: the banner
// itself is always made from the full-size original
const previews = new Map();
app.get('/photo/:name', async (req, res, next) => {
    try {
        const name = await sourceName(req, res);
        if (!name) return;
        const width = Math.min(1600, Math.max(100, Number(req.query.w) || 1600));
        const file = path.join(sourceDir, name);
        const key = `${name}:${width}:${(await fs.stat(file)).mtimeMs}`;
        if (!previews.has(key)) {
            previews.set(key, await sharp(file).rotate()
                .resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 80 }).toBuffer());
        }
        res.type('image/jpeg').send(previews.get(key));
    } catch (err) {
        next(err);
    }
});

// Add a photo to the source folder. The body is the file itself; the name
// comes in the query, cleaned to letters, digits, - and _. An existing photo
// is only replaced with replace=1. It's analysed (face detection) right away.
const UPLOAD_EXT = ['.jpg', '.jpeg', '.png', '.webp'];

// A filename's base cleaned to letters, digits, - and _ ('' if nothing's left)
function cleanBase(name) {
    return path.basename(name, path.extname(name)).replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
}

app.post('/api/upload', express.raw({ type: () => true, limit: '60mb' }), async (req, res, next) => {
    try {
        const original = path.basename(String(req.query.name || ''));
        const ext = path.extname(original).toLowerCase();
        if (!UPLOAD_EXT.includes(ext)) {
            return res.status(400).json({ error: 'Only .jpg, .png or .webp photos' });
        }
        const base = cleanBase(original);
        if (!base) return res.status(400).json({ error: 'That filename has no usable characters' });
        const name = base + (ext === '.jpeg' ? '.jpg' : ext);
        if (!req.body || !req.body.length) return res.status(400).json({ error: 'The file is empty' });

        // A real image, of a usable size
        let meta;
        try {
            meta = await sharp(req.body).metadata();
        } catch (err) {
            return res.status(400).json({ error: 'That file is not an image sharp can read' });
        }
        if (Math.min(meta.width, meta.height) < 400) {
            return res.status(400).json({ error: `Too small (${meta.width}×${meta.height}): use a photo at least 400px on each side` });
        }

        const file = path.join(sourceDir, name);
        const exists = await fs.access(file).then(() => true, () => false);
        if (exists && req.query.replace !== '1') {
            return res.status(409).json({ error: 'exists', name });
        }
        await fs.writeFile(file, req.body);
        console.log(`  + ${name} uploaded (${meta.width}×${meta.height})`);

        // Its automatic banner straight away, when it gets one, so there's a
        // banner to compare against while framing it
        const settings = await loadConfig();
        const detected = await updateDetected({ log: (line) => console.log(line) });
        await regenerate(name, settings, detected);
        res.json(describe(name, detected, settings, fadeOverlay(settings.fade)));
    } catch (err) {
        next(err);
    }
});

// Rename a source photo, and everything that goes by its name: its settings
// in the config, what was detected in it, and its generated banner. The
// extension stays. The site's database entry for the banner keeps the old
// name — the Banners page then lists the new image as new.
app.post('/api/photos/:name/rename', async (req, res, next) => {
    try {
        const name = await sourceName(req, res);
        if (!name) return;
        const ext = path.extname(name);
        const base = cleanBase(String((req.body || {}).name || ''));
        if (!base) return res.status(400).json({ error: 'Give a name with letters or digits' });
        const newName = base + ext;
        if (newName === name) return res.status(400).json({ error: 'That is already its name' });
        const sources = await listSources();
        if (sources.includes(newName)) return res.status(409).json({ error: newName + ' already exists' });

        const settings = await loadConfig();
        const outDir = path.join(repoRoot, settings.outDir);
        const oldBanner = path.join(outDir, bannerFileName(name));
        const newBanner = path.join(outDir, bannerFileName(newName));
        const exists = (f) => fs.access(f).then(() => true, () => false);
        // Two sources can't share a banner (x.jpg and x.png both make x.jpg)
        if (sources.some((s) => s !== name && bannerFileName(s) === bannerFileName(newName))) {
            return res.status(409).json({ error: 'Another photo already makes ' + bannerFileName(newName) });
        }

        await fs.rename(path.join(sourceDir, name), path.join(sourceDir, newName));
        if (settings.images && settings.images[name]) {
            settings.images[newName] = settings.images[name];
            delete settings.images[name];
            await saveConfig(settings);
        }
        const detected = await loadDetected();
        if (detected[name]) {
            detected[newName] = detected[name];
            delete detected[name];
            await saveDetected(detected);
        }
        if (await exists(oldBanner)) await fs.rename(oldBanner, newBanner);
        console.log(`  ~ ${name} renamed ${newName}`);

        const updated = await updateDetected();
        res.json(describe(newName, updated, settings, fadeOverlay(settings.fade)));
    } catch (err) {
        next(err);
    }
});

// Delete a source photo, with its settings, what was detected in it, and
// its generated banner
app.delete('/api/photos/:name', async (req, res, next) => {
    try {
        const name = await sourceName(req, res);
        if (!name) return;
        const settings = await loadConfig();
        await fs.unlink(path.join(sourceDir, name));
        if (settings.images && settings.images[name]) {
            delete settings.images[name];
            await saveConfig(settings);
        }
        const detected = await loadDetected();
        if (detected[name]) {
            delete detected[name];
            await saveDetected(detected);
        }
        await fs.unlink(path.join(repoRoot, settings.outDir, bannerFileName(name))).catch(() => {});
        console.log(`  - ${name} deleted, with its banner`);
        res.json({ deleted: name });
    } catch (err) {
        next(err);
    }
});

// Regenerate one photo's banner from the current config
async function regenerate(name, settings, detected) {
    const p = photoSettings(name, detected, settings);
    const outPath = path.join(repoRoot, settings.outDir, bannerFileName(name));
    if (!makesBanner(p)) return false;
    const overlay = fadeOverlay(settings.fade);
    const out = await renderBanner(path.join(sourceDir, name), p, placementFor(p, overlay), overlay, settings.quality);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, out);
    return true;
}

// Save a hand-set crop, within the limits, and regenerate the banner
app.post('/api/photos/:name/crop', async (req, res, next) => {
    try {
        const name = await sourceName(req, res);
        if (!name) return;
        const settings = await loadConfig();
        const detected = await updateDetected();
        const overlay = fadeOverlay(settings.fade);
        const crop = clampCrop(photoSettings(name, detected, settings), req.body || {}, overlay);

        // The crop replaces every other framing setting for the photo (zoom,
        // moves, face, crop percentages, kind, skip): drop them rather than
        // leave settings that no longer do anything. A note is kept.
        settings.images = settings.images || {};
        const previous = settings.images[name] || {};
        const removed = Object.keys(previous).filter((k) => k !== 'note' && k !== 'crop');
        settings.images[name] = previous.note ? { note: previous.note, crop } : { crop };
        await saveConfig(settings);
        await regenerate(name, settings, detected);
        console.log(`  ✓ ${name}: crop ${JSON.stringify(crop)}` + (removed.length ? ` (replaces ${removed.join(', ')})` : ''));
        res.json(describe(name, detected, settings, overlay));
    } catch (err) {
        next(err);
    }
});

// Back to automatic framing: drop the crop, keep any other settings
app.delete('/api/photos/:name/crop', async (req, res, next) => {
    try {
        const name = await sourceName(req, res);
        if (!name) return;
        const settings = await loadConfig();
        const detected = await updateDetected();
        const own = (settings.images || {})[name];
        if (own) {
            delete own.crop;
            if (!Object.keys(own).length) delete settings.images[name];
            await saveConfig(settings);
        }
        await regenerate(name, settings, detected);
        console.log(`  ✓ ${name}: back to automatic framing`);
        res.json(describe(name, detected, settings, fadeOverlay(settings.fade)));
    } catch (err) {
        next(err);
    }
});

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: err.message });
});

app.listen(PORT, '127.0.0.1', () => {
    const url = `http://localhost:${PORT}`;
    console.log(`Banner editor: ${url}   (Ctrl+C to stop)`);
    if (process.platform === 'darwin' && !process.env.NO_OPEN) spawn('open', [url], { stdio: 'ignore', detached: true }).unref();
});
