// Homepage banners: the public pick, the Banners admin page, and making a
// banner on the site — upload a photo, frame it in the editor, save.
// Files: app/bannerFiles.js; the framing and render: app/bannerRender.js.
const express = require('express');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const service = require('./service');
const Banner = require('./models/banner');
const bannerFiles = require('./bannerFiles');
const bannerRender = require('./bannerRender');

// Face detection and renders, one at a time: each holds a decoded photo, and
// the droplet has 2 GB for everything
let queue = Promise.resolve();
function serial(fn) {
    const run = queue.then(fn, fn);
    queue = run.catch(() => { });
    return run;
}

function perUserLimiter(prefix, max, message) {
    return rateLimit({
        windowMs: 60 * 60 * 1000,
        max,
        keyGenerator: (req) => prefix + ':' + String(req.user._id),
        message: { error: message },
        standardHeaders: true,
        legacyHeaders: false,
        validate: { keyGeneratorIpFallback: false }
    });
}

function baseName(filename) {
    return String(filename || '').replace(/\.jpg$/i, '');
}

// These routes are for admins: an unexpected error says what it was (a
// folder that cannot be written, say), so it can be fixed from the message
function sendError(res, err, fallback) {
    if (err && err.bannerError) return res.status(err.status || 400).json({ error: err.message });
    console.error(fallback + ':', err);
    let detail = (err && (err.code || err.message)) || 'unknown error';
    if (err && (err.code === 'EACCES' || err.code === 'EROFS')) {
        detail += ': the server cannot write to the banners folder (' + bannerFiles.BANNER_DIR + '). See deploy/update.sh';
    }
    res.status(500).json({ error: fallback + ' (' + String(detail).slice(0, 300) + ').' });
}

module.exports = function (app) {

    const uploadLimiter = perUserLimiter('banner-upload', 40, 'Too many banner photos uploaded. Try again in an hour.');
    const renderLimiter = perUserLimiter('banner-render', 600, 'Too many banner previews. Try again in an hour.');
    const readPhotoBody = express.raw({ type: bannerFiles.ACCEPTED_TYPES, limit: bannerFiles.MAX_UPLOAD_BYTES });
    const overlay = bannerRender.fadeOverlay();

    // ---- Public ----

    // The banner for the homepage. Priority: birthday banners > pinned >
    // all (a random pick from the pool). Disabled banners are never picked.
    app.get('/api/banners', async function (req, res) {
        try {
            const banners = await Banner.find({ disabled: { $ne: true } }).populate('members', 'dateofbirth').lean();
            if (!banners.length) return res.json([]);

            const now = req.query.date ? new Date(req.query.date) : new Date();
            const todayMonth = now.getUTCMonth();
            const todayDay = now.getUTCDate();

            const hasBirthdayToday = (banner) =>
                (banner.members || []).some((m) => {
                    if (!m.dateofbirth) return false;
                    const dob = new Date(m.dateofbirth);
                    return dob.getUTCMonth() === todayMonth && dob.getUTCDate() === todayDay;
                });

            const toResponse = (b) => ({
                url: bannerFiles.urlFor(b.filename, b.version),
                titlePosition: b.titlePosition || 'right',
                pinned: !!b.pinned,
                copyright: b.copyright || null,
            });

            const birthdayBanners = banners.filter(hasBirthdayToday);
            if (birthdayBanners.length) {
                const pick = birthdayBanners[Math.floor(Math.random() * birthdayBanners.length)];
                return res.json([toResponse(pick)]);
            }

            const pinnedBanners = banners.filter((b) => b.pinned);
            const pool = pinnedBanners.length ? pinnedBanners : banners;
            const pick = pool[Math.floor(Math.random() * pool.length)];
            res.json([toResponse(pick)]);
        } catch (err) {
            res.status(500).json({ error: 'Could not load banners' });
        }
    });

    // A banner file. Not express.static: only a banner name maps to a file,
    // so no listing, no draft, no temporary file is reachable.
    app.get('/uploads/banners/:file', function (req, res) {
        const m = bannerFiles.FILE_PATTERN.exec(req.params.file);
        if (!m) return res.status(404).end();
        res.set({
            'X-Content-Type-Options': 'nosniff',
            'Content-Security-Policy': "default-src 'none'",
            'Cache-Control': req.query.v ? 'public, max-age=31536000, immutable' : 'public, max-age=300'
        });
        res.sendFile(bannerFiles.fileFor(m[1]), { dotfiles: 'deny', headers: { 'Content-Type': 'image/jpeg' } }, function (err) {
            if (err && !res.headersSent) {
                res.removeHeader('Cache-Control');
                res.status(err.status === 404 || err.code === 'ENOENT' ? 404 : 500).end();
            }
        });
    });

    // ---- Banners page ----

    function adminView(b, files) {
        return Object.assign({}, b, {
            url: bannerFiles.urlFor(b.filename, b.version),
            fileMissing: !files.has(b.filename)
        });
    }

    app.get('/api/admin/banners', service.isAdminLoggedIn, async function (req, res) {
        try {
            const banners = await Banner.find().populate('members', 'firstname lastname memberStatus').sort('filename').lean();
            const files = new Set(bannerFiles.listFiles());
            res.json(banners.map((b) => adminView(b, files)));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Whether a name is free for a new banner, or for `bannerId` to take
    app.get('/api/admin/banners/name-available', service.isAdminLoggedIn, async function (req, res) {
        try {
            const name = bannerFiles.cleanName(req.query.name);
            if (!name) return res.json({ name, available: false, reason: 'Give it a name with letters or digits.' });
            const own = mongoose.isValidObjectId(req.query.bannerId)
                ? await Banner.findById(req.query.bannerId).select('filename').lean() : null;
            const others = (await Banner.find(own ? { _id: { $ne: own._id } } : {}).select('filename').lean()).map((b) => b.filename);
            const taken = bannerFiles.nameTaken(name, others, own && own.filename);
            res.json({ name, available: !taken, reason: taken ? 'Another banner is already called "' + name + '".' : null });
        } catch (err) {
            sendError(res, err, 'Could not check the name');
        }
    });

    // Tags, credit, pin, shown/disabled, title side; and `name` renames the
    // banner and its file
    app.put('/api/admin/banners/:id', service.isAdminLoggedIn, async function (req, res) {
        try {
            if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Banner not found' });
            const banner = await Banner.findById(req.params.id);
            if (!banner) return res.status(404).json({ error: 'Banner not found' });
            const { members, pinned, disabled, titlePosition, copyright, name } = req.body;

            const oldFilename = banner.filename;
            if (name !== undefined) {
                const wanted = bannerFiles.cleanName(name);
                if (!wanted) return res.status(400).json({ error: 'Give it a name with letters or digits.' });
                if (wanted + '.jpg' !== oldFilename) {
                    const others = (await Banner.find({ _id: { $ne: banner._id } }).select('filename').lean()).map((b) => b.filename);
                    if (bannerFiles.nameTaken(wanted, others, oldFilename)) {
                        return res.status(409).json({ error: 'Another banner is already called "' + wanted + '".' });
                    }
                    await bannerFiles.renameBanner(baseName(oldFilename), wanted);
                    banner.filename = wanted + '.jpg';
                }
            }
            // Only what was sent: a rename alone leaves the rest as it is
            const fields = { members, pinned, disabled: disabled === undefined ? undefined : !!disabled, titlePosition, copyright };
            Object.keys(fields).forEach((k) => { if (fields[k] !== undefined) banner[k] = fields[k]; });
            try {
                await banner.save();
            } catch (err) {
                // Put the file back under its old name, so entry and file agree
                if (banner.filename !== oldFilename) {
                    await bannerFiles.renameBanner(baseName(banner.filename), baseName(oldFilename)).catch(() => { });
                }
                throw err;
            }
            if (banner.filename !== oldFilename) {
                service.logActivity({
                    userId: req.user._id, username: req.user.username,
                    action: 'banner_renamed', description: 'Renamed banner ' + oldFilename + ' to ' + banner.filename,
                    targetType: 'banner', targetId: String(banner._id), targetName: banner.filename,
                    metadata: { oldValue: oldFilename, newValue: banner.filename }, ipAddress: req.ip
                });
            }
            await banner.populate('members', 'firstname lastname memberStatus');
            res.json(adminView(banner.toObject(), new Set(bannerFiles.listFiles())));
        } catch (err) {
            sendError(res, err, 'Could not save the banner');
        }
    });

    // The entry and its file. Disabling is the way to hide one and keep it.
    app.delete('/api/admin/banners/:id', service.isAdminLoggedIn, async function (req, res) {
        try {
            if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Banner not found' });
            const deleted = await Banner.findByIdAndDelete(req.params.id);
            if (!deleted) return res.status(404).json({ error: 'Banner not found' });
            await bannerFiles.deleteBanner(baseName(deleted.filename));
            service.logActivity({
                userId: req.user._id, username: req.user.username,
                action: 'banner_deleted', description: 'Deleted banner ' + deleted.filename,
                targetType: 'banner', targetId: String(deleted._id), targetName: deleted.filename, ipAddress: req.ip
            });
            res.json({ ok: true });
        } catch (err) {
            sendError(res, err, 'Could not delete the banner');
        }
    });

    // ---- Making a banner ----

    // What the editor needs about a draft
    function describeDraft(id, detected, suggestedName) {
        const p = bannerRender.photoSettings(detected);
        const crop = bannerRender.automaticCrop(p, overlay);
        let notice = null;
        if (detected.detectionFailed) notice = 'Face detection is not working on the server right now: the framing starts from the whole width. Frame it by hand.';
        else if (detected.kind === 'no-face') notice = 'No face was found in this photo: the framing starts from the whole width. Move it so the runner is on the left.';
        else if (detected.kind === 'group') notice = 'This looks like a group photo: check the framing, the title sits on the right.';
        else if (detected.kind === 'runner-right') notice = 'The runner seems to be on the right, behind the title: move the photo so they are on the left.';
        return {
            draftId: id,
            suggestedName: suggestedName || '',
            width: detected.width,
            height: detected.height,
            kind: detected.kind,
            faceCount: detected.faceCount,
            crop,
            autoCrop: crop,
            limits: bannerRender.cropLimits(p, overlay),
            layout: { width: bannerRender.OUT_W, height: bannerRender.OUT_H, wideVisible: bannerRender.WIDE_VISIBLE },
            photoUrl: '/api/admin/banner-drafts/' + id + '/photo.jpg',
            notice
        };
    }

    // Upload a photo: the file is the body, its name in ?name= (only to
    // suggest the banner's name). Checked, stored as a draft, the runner found.
    app.post('/api/admin/banner-drafts', service.isAdminLoggedIn, function (req, res, next) {
        if (!req.is(bannerFiles.ACCEPTED_TYPES)) {
            return res.status(415).json({ error: 'Only JPEG, PNG or WebP photos are accepted (iPhone HEIC photos are not).' });
        }
        next();
    }, uploadLimiter, function (req, res, next) {
        readPhotoBody(req, res, function (err) {
            if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'The file is over 20 MB.' });
            if (err) return res.status(400).json({ error: 'The upload could not be read.' });
            next();
        });
    }, async function (req, res) {
        try {
            const draft = await serial(() => bannerFiles.createDraft(req.body, bannerRender.analyse));
            res.json(describeDraft(draft.id, draft.detected, bannerFiles.cleanName(req.query.name)));
        } catch (err) {
            sendError(res, err, 'The photo could not be read');
        }
    });

    app.get('/api/admin/banner-drafts/:id/photo.jpg', service.isAdminLoggedIn, function (req, res) {
        let file;
        try { file = bannerFiles.draftPhotoPath(req.params.id); } catch (e) { return res.status(404).end(); }
        res.set({ 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' });
        res.sendFile(file, { dotfiles: 'allow', headers: { 'Content-Type': 'image/jpeg' } }, function (err) {
            if (err && !res.headersSent) res.status(404).end();
        });
    });

    // The fade drawn over the window in the editor
    app.get('/api/admin/banner-fade.svg', service.isAdminLoggedIn, function (req, res) {
        res.set('Cache-Control', 'private, max-age=3600');
        res.type('image/svg+xml').send(overlay.svg);
    });

    // The banner as it would be saved, at half size
    app.post('/api/admin/banner-drafts/:id/preview', service.isAdminLoggedIn, renderLimiter, async function (req, res) {
        try {
            const draft = await bannerFiles.readDraft(req.params.id);
            const p = bannerRender.photoSettings(draft.detected);
            const crop = bannerRender.clampCrop(p, (req.body && req.body.crop) || {}, overlay);
            const jpeg = await serial(async () => {
                const full = await bannerRender.renderBanner(draft.photo, p, crop, overlay);
                return require('sharp')(full).resize({ width: 1100 }).jpeg({ quality: 82 }).toBuffer();
            });
            res.set('Cache-Control', 'no-store').type('image/jpeg').send(jpeg);
        } catch (err) {
            sendError(res, err, 'Could not make the preview');
        }
    });

    // Save: render the banner, store it under its name, create the entry (or
    // update `bannerId`'s, for "Replace photo"), then delete the draft
    app.post('/api/admin/banner-drafts/:id/save', service.isAdminLoggedIn, renderLimiter, async function (req, res) {
        try {
            const body = req.body || {};
            const name = bannerFiles.cleanName(body.name);
            if (!name) return res.status(400).json({ error: 'Give the banner a name with letters or digits.' });

            let banner = null;
            if (body.bannerId) {
                if (!mongoose.isValidObjectId(body.bannerId) || !(banner = await Banner.findById(body.bannerId))) {
                    return res.status(404).json({ error: 'The banner being replaced is gone.' });
                }
            }
            const oldFilename = banner ? banner.filename : null;
            const others = (await Banner.find(banner ? { _id: { $ne: banner._id } } : {}).select('filename').lean()).map((b) => b.filename);
            if (bannerFiles.nameTaken(name, others, oldFilename)) {
                return res.status(409).json({ error: 'Another banner is already called "' + name + '". Pick another name.' });
            }

            const draft = await bannerFiles.readDraft(req.params.id);
            const p = bannerRender.photoSettings(draft.detected);
            const crop = bannerRender.clampCrop(p, body.crop || {}, overlay);
            const jpeg = await serial(() => bannerRender.renderBanner(draft.photo, p, crop, overlay));
            const version = bannerFiles.versionOf(jpeg);
            const filename = name + '.jpg';

            if (!banner) {
                await bannerFiles.createBanner(name, jpeg);
                try {
                    banner = await Banner.create({ filename, members: [], pinned: false, titlePosition: 'right', version });
                } catch (err) {
                    await bannerFiles.deleteBanner(name).catch(() => { });
                    throw err;
                }
            } else {
                const oldBase = baseName(oldFilename);
                if (oldBase === name) {
                    await bannerFiles.replaceBanner(name, jpeg);
                } else if (oldBase.toLowerCase() === name.toLowerCase()) {
                    await bannerFiles.replaceBanner(oldBase, jpeg);
                    await bannerFiles.renameBanner(oldBase, name);
                } else {
                    await bannerFiles.createBanner(name, jpeg);
                    await bannerFiles.deleteBanner(oldBase);
                }
                banner.filename = filename;
                banner.version = version;
                banner.titlePosition = 'right';
                await banner.save();
            }
            await bannerFiles.deleteDraft(req.params.id);

            service.logActivity({
                userId: req.user._id, username: req.user.username,
                action: oldFilename ? 'banner_replaced' : 'banner_created',
                description: (oldFilename ? 'Replaced the photo of banner ' + oldFilename + (oldFilename !== filename ? ' (now ' + filename + ')' : '') : 'Created banner ' + filename),
                targetType: 'banner', targetId: String(banner._id), targetName: filename,
                metadata: { crop, oldValue: oldFilename, newValue: filename }, ipAddress: req.ip
            });

            await banner.populate('members', 'firstname lastname memberStatus');
            res.json(adminView(banner.toObject(), new Set(bannerFiles.listFiles())));
        } catch (err) {
            sendError(res, err, 'The banner could not be saved');
        }
    });

    app.delete('/api/admin/banner-drafts/:id', service.isAdminLoggedIn, async function (req, res) {
        try {
            await bannerFiles.deleteDraft(req.params.id);
            res.json({ ok: true });
        } catch (err) {
            sendError(res, err, 'Could not discard the photo');
        }
    });
};
