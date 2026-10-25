#!/usr/bin/env node
//
// Make homepage banners whose fade lines up with the title badge.
//
// For each single-runner source photo with the runner on the left, writes a
// banner where the photo is fully visible up to the badge's speed stripes,
// then fades to white along the same 12° slant as the badge, and is gone by
// the left edge of the navy "Montgomery County Road Runners" strip.
//
// Source photos are in public/images/banners/source/; two files in
// config/banners/ go with them:
//
//   slant-banners.detected.json   Written by this script — don't edit. What it
//                                 found in each photo: size, the main runner's
//                                 face, and the kind of photo. Only new or
//                                 changed photos are analysed (--reanalyze: all).
//
//   slant-banners.config.json     Yours. How every banner is framed, and
//                                 per-photo adjustments. Its "_guide" section
//                                 explains each setting; see also doc/BANNERS.md.
//                                 A photo's "crop" (set with the visual editor,
//                                 scripts/banner-editor.mjs) wins over the rest.
//
// A photo too small for the framing (too narrow to reach the end of the fade,
// or too short to cover the height) is zoomed in just enough to fill, and
// moves the runner only as far as the photo allows — each run prints the
// zoom and position actually used, and says when it couldn't do what was asked.
//
// The framing and rendering live in scripts/lib/slant-banners-core.mjs.
//
// Usage:
//   node scripts/slant-banners.mjs                    # every source photo
//   node scripts/slant-banners.mjs jamesJ.jpg ianM.jpg
//   node scripts/slant-banners.mjs --reanalyze        # detect faces again
//
import fs from 'node:fs/promises';
import path from 'node:path';
import {
    repoRoot, sourceDir, IMAGE_SETTINGS, OUT_W,
    loadConfig, updateDetected, photoSettings, makesBanner, bannerFileName,
    fadeOverlay, placementFor, renderBanner
} from './lib/slant-banners-core.mjs';

function parseArgs(argv) {
    const opts = { files: [], reanalyze: false };
    for (const arg of argv.slice(2)) {
        if (arg === '--reanalyze') opts.reanalyze = true;
        else if (arg.startsWith('--')) throw new Error(`Unknown flag: ${arg}`);
        else opts.files.push(path.basename(arg));
    }
    return opts;
}

async function main() {
    const opts = parseArgs(process.argv);
    const settings = await loadConfig();
    const overrides = settings.images || {};
    const detected = await updateDetected({ reanalyze: opts.reanalyze, log: (line) => console.log(line) });

    const outDir = path.resolve(repoRoot, settings.outDir);
    await fs.mkdir(outDir, { recursive: true });
    const overlay = fadeOverlay(settings.fade);

    const names = opts.files.length ? opts.files : Object.keys(detected).sort();
    let made = 0;
    let skipped = 0;
    for (const name of names) {
        if (!detected[name]) {
            console.log(`  ✗ ${name}: not in ${path.relative(repoRoot, sourceDir)}`);
            skipped++;
            continue;
        }
        const own = overrides[name] || {};
        const p = photoSettings(name, detected, settings);
        const unknown = Object.keys(own).filter((k) => !IMAGE_SETTINGS.includes(k));
        if (unknown.length) console.log(`  ! ${name}: unknown setting(s) ignored: ${unknown.join(', ')}`);
        if (!makesBanner(p)) {
            console.log(`  - ${name}: ${p.skip ? 'skip set in config' : p.kind + ', skipped'}`);
            skipped++;
            continue;
        }

        let pl, out;
        try {
            pl = placementFor(p, overlay);
            out = await renderBanner(path.join(sourceDir, name), p, pl, overlay, settings.quality);
        } catch (err) {
            console.log(`  ✗ ${name}: ${err.message}`);
            skipped++;
            continue;
        }
        await fs.writeFile(path.join(outDir, bannerFileName(name)), out);

        if (pl.mode === 'crop') {
            const moved = ['x', 'y', 'width'].some((k) => Math.abs(pl.crop[k] - own.crop[k]) > 1);
            console.log(`  ✓ ${name.padEnd(20)} hand-set crop, ${Math.round(OUT_W / pl.scale)}px of the photo wide` +
                (moved ? `   ! the crop went past the photo's limits; adjusted to ${JSON.stringify(pl.crop)}` : ''));
            made++;
            continue;
        }

        // What the banner ended up as, and anything this photo's settings asked
        // for that the photo couldn't do
        const { used, asked } = pl;
        const notes = [];
        if (own.zoom < 1) notes.push(`zoom ${own.zoom} asked, but 1 is already as wide as this photo goes`);
        if (own.moveRight && Math.abs(used.faceFromLeft - asked.faceFromLeft) > 1) {
            notes.push(`moveRight: the photo's edge stops the face at ${used.faceFromLeft}% across (asked ${asked.faceFromLeft}%)`);
        }
        if (own.moveDown && Math.abs(used.faceFromTop - asked.faceFromTop) > 1) {
            notes.push(`moveDown: the photo's edge stops the face at ${used.faceFromTop}% down (asked ${asked.faceFromTop}%)`);
        }
        console.log(`  ✓ ${name.padEnd(20)} zoom ${used.zoom.toFixed(2)}, face ${String(used.faceFromLeft).padStart(2)}% across, ${String(used.faceFromTop).padStart(2)}% down` +
            (notes.length ? `   ! ${notes.join('; ')}` : ''));
        made++;
    }
    console.log(`\nDone. ${made} made, ${skipped} skipped.`);
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
