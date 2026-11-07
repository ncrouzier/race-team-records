const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');

const BANNER_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'banners-'));
process.env.BANNER_DIR = BANNER_DIR;
const bannerFiles = require('../app/bannerFiles');
const bannerRender = require('../app/bannerRender');

afterAll(() => fs.rmSync(BANNER_DIR, { recursive: true, force: true }));

function clearDir() {
    for (const f of fs.readdirSync(BANNER_DIR)) fs.rmSync(path.join(BANNER_DIR, f), { recursive: true, force: true });
}

// A photo-like test image
function photo(width, height, format) {
    return sharp({ create: { width, height, channels: 3, background: '#3a7bd5' } })
        .composite([{ input: Buffer.from(`<svg width="${width}" height="${height}"><circle cx="${width * 0.25}" cy="${height * 0.3}" r="${height * 0.08}" fill="#f2c18d"/></svg>`) }])
        .toFormat(format || 'jpeg').toBuffer();
}

// What analyse() would find in it: a face on the left
function detectedFor(width, height) {
    return { width, height, kind: 'runner-left', face: { x: Math.round(width * 0.2), y: Math.round(height * 0.22), width: Math.round(height * 0.16), height: Math.round(height * 0.16) }, otherFaces: [], faceCount: 1 };
}

describe('bannerRender', () => {
    const overlay = bannerRender.fadeOverlay();

    test('a banner is a 2200x572 JPEG', async () => {
        const buf = await photo(2400, 1600);
        const p = bannerRender.photoSettings(detectedFor(2400, 1600));
        const crop = bannerRender.automaticCrop(p, overlay);
        const out = await bannerRender.renderBanner(buf, p, crop, overlay);
        const meta = await sharp(out).metadata();
        expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', 2200, 572]);
    });

    test('the right of the banner fades to white', async () => {
        const buf = await photo(2400, 1600);
        const p = bannerRender.photoSettings(detectedFor(2400, 1600));
        const out = await bannerRender.renderBanner(buf, p, bannerRender.automaticCrop(p, overlay), overlay);
        const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
        const px = (x, y) => Array.from(data.slice((y * info.width + x) * 3, (y * info.width + x) * 3 + 3));
        expect(px(2150, 300).every((v) => v > 245)).toBe(true);   // white past the fade
        expect(px(100, 500)[2]).toBeGreaterThan(px(100, 500)[0]); // the (blue) photo on the left
    });

    test('crops are kept within the limits: all photo top to bottom and up to the fade', () => {
        const p = bannerRender.photoSettings(detectedFor(2400, 1600));
        const L = bannerRender.cropLimits(p, overlay);
        const tooWide = bannerRender.clampCrop(p, { x: 0, y: 0, width: 99999 }, overlay);
        expect(tooWide.width).toBe(Math.round(L.maxWidth));
        const tooClose = bannerRender.clampCrop(p, { x: 0, y: 0, width: 10 }, overlay);
        expect(tooClose.width).toBe(Math.round(L.minWidth));
        const offEdge = bannerRender.clampCrop(p, { x: 99999, y: 99999, width: 1000 }, overlay);
        expect(offEdge.x + L.reachShare * 1000).toBeLessThanOrEqual(2400 + 1);
        expect(offEdge.y + 1000 * 572 / 2200).toBeLessThanOrEqual(1600 + 1);
        const negative = bannerRender.clampCrop(p, { x: -50, y: -50, width: 1000 }, overlay);
        expect([negative.x, negative.y]).toEqual([0, 0]);
    });

    test('the automatic crop is recognised, a moved one is not', () => {
        const p = bannerRender.photoSettings(detectedFor(2400, 1600));
        const auto = bannerRender.automaticCrop(p, overlay);
        expect(bannerRender.isAutomaticCrop(p, auto, overlay)).toBe(true);
        expect(bannerRender.isAutomaticCrop(p, Object.assign({}, auto, { x: auto.x + 40 }), overlay)).toBe(false);
    });

    test('with no face, framing starts from the whole width', () => {
        const p = bannerRender.photoSettings({ width: 2400, height: 1600, kind: 'no-face', face: null });
        const crop = bannerRender.automaticCrop(p, overlay);
        expect(crop).toEqual(bannerRender.clampCrop(p, { x: 0, y: 0, width: 0 }, overlay));
    });
});

describe('banner names', () => {
    beforeEach(clearDir);

    test.each([
        ['Kristen K at Parks Half.JPG', 'Kristen-K-at-Parks-Half'],
        ['aaronA', 'aaronA'],
        ['adrianS_sweat.jpg', 'adrianS_sweat'],
        ['../../etc/passwd', 'etc-passwd'],
        ['  ***  ', ''],
        ['é là', 'e-la'],
        ['Jérôme Lefèvre', 'Jerome-Lefevre']
    ])('cleanName(%j) is %j', (raw, clean) => {
        expect(bannerFiles.cleanName(raw)).toBe(clean);
    });

    test('names are at most 60 characters', () => {
        expect(bannerFiles.cleanName('x'.repeat(100)).length).toBe(60);
    });

    test('a name is taken by an entry or a file, ignoring case; its own banner may keep it', () => {
        fs.writeFileSync(path.join(BANNER_DIR, 'onDisk.jpg'), 'x');
        expect(bannerFiles.nameTaken('ONDISK', [], null)).toBe(true);
        expect(bannerFiles.nameTaken('jimD', ['JIMD.jpg'], null)).toBe(true);
        expect(bannerFiles.nameTaken('free', ['jimD.jpg'], null)).toBe(false);
        expect(bannerFiles.nameTaken('onDisk', [], 'onDisk.jpg')).toBe(false);
    });

    test('only clean names map to files', () => {
        expect(bannerFiles.fileFor('aaronA')).toBe(path.join(BANNER_DIR, 'aaronA.jpg'));
        ['../x', 'a/b', '', 'a.b', 'x'.repeat(61)].forEach((bad) => expect(() => bannerFiles.fileFor(bad)).toThrow());
    });
});

describe('banner files', () => {
    beforeEach(clearDir);

    test('two saves of the same new name: one wins, the other is refused', async () => {
        const results = await Promise.allSettled([
            bannerFiles.createBanner('same', Buffer.from('one')),
            bannerFiles.createBanner('same', Buffer.from('two'))
        ]);
        expect(results.filter((r) => r.status === 'fulfilled').length).toBe(1);
        expect(results.find((r) => r.status === 'rejected').reason).toMatchObject({ status: 409 });
        expect(fs.readdirSync(BANNER_DIR).filter((f) => f.endsWith('.jpg'))).toEqual(['same.jpg']);
        expect(fs.readdirSync(BANNER_DIR).filter((f) => f.startsWith('.tmp-'))).toEqual([]);
    });

    test('replace keeps the name, rename moves the file, a case-only rename works', async () => {
        await bannerFiles.createBanner('one', Buffer.from('v1'));
        await bannerFiles.replaceBanner('one', Buffer.from('v2'));
        expect(fs.readFileSync(path.join(BANNER_DIR, 'one.jpg'), 'utf8')).toBe('v2');
        await bannerFiles.renameBanner('one', 'two');
        expect(bannerFiles.listFiles()).toEqual(['two.jpg']);
        await bannerFiles.renameBanner('two', 'Two');
        expect(bannerFiles.listFiles()).toEqual(['Two.jpg']);
        await bannerFiles.createBanner('three', Buffer.from('x'));
        await expect(bannerFiles.renameBanner('Two', 'three')).rejects.toMatchObject({ status: 409 });
        await bannerFiles.deleteBanner('Two');
        expect(bannerFiles.listFiles()).toEqual(['three.jpg']);
    });

    test('urls carry the version', () => {
        expect(bannerFiles.urlFor('aaronA.jpg', 'abc')).toBe('/uploads/banners/aaronA.jpg?v=abc');
    });
});

describe('drafts', () => {
    beforeEach(clearDir);
    const analyse = async (buf) => {
        const m = await sharp(buf).metadata();
        return detectedFor(m.width, m.height);
    };

    test('the upload is kept as it is; the editor gets a small copy without metadata', async () => {
        const big = await sharp(await photo(4000, 3000)).withMetadata({ exif: { IFD0: { Make: 'Cam' } } }).jpeg({ quality: 97 }).toBuffer();
        const { id, detected } = await bannerFiles.createDraft(big, analyse);
        expect([detected.width, detected.height]).toEqual([4000, 3000]);
        const draft = await bannerFiles.readDraft(id);
        expect(draft.photo.equals(big)).toBe(true);
        const preview = await sharp(fs.readFileSync(bannerFiles.draftPhotoPath(id))).metadata();
        expect([preview.width, preview.height, preview.exif]).toEqual([1600, 1200, undefined]);
        await bannerFiles.deleteDraft(id);
        await expect(bannerFiles.readDraft(id)).rejects.toMatchObject({ status: 404 });
        expect(fs.readdirSync(bannerFiles.DRAFT_DIR)).toEqual([]);
    });

    test('a phone photo taken sideways is measured and rendered upright', async () => {
        // Stored 3000x2000 with EXIF orientation 6: upright, it is 2000x3000
        const sideways = await sharp(await photo(3000, 2000)).withMetadata({ orientation: 6 }).jpeg().toBuffer();
        const { id, detected } = await bannerFiles.createDraft(sideways, (buf) => bannerRender.analyse(buf).catch(() => ({ width: 2000, height: 3000, kind: 'no-face' })));
        expect([detected.width, detected.height]).toEqual([2000, 3000]);
        const preview = await sharp(fs.readFileSync(bannerFiles.draftPhotoPath(id))).metadata();
        expect([preview.width, preview.height]).toEqual([1067, 1600]);
        const draft = await bannerFiles.readDraft(id);
        const p = bannerRender.photoSettings({ width: 2000, height: 3000, kind: 'no-face', face: null });
        const overlay = bannerRender.fadeOverlay();
        const out = await bannerRender.renderBanner(draft.photo, p, bannerRender.automaticCrop(p, overlay), overlay);
        expect(await sharp(out).metadata()).toMatchObject({ width: 2200, height: 572 });
    });

    test('a huge photo is scaled down to 8000 px first', async () => {
        const huge = await sharp({ create: { width: 9000, height: 5000, channels: 3, background: '#3a7bd5' } }).jpeg().toBuffer();
        const { detected } = await bannerFiles.createDraft(huge, analyse);
        expect(Math.max(detected.width, detected.height)).toBe(8000);
    });

    test.each([
        ['an HTML page', () => Buffer.from('<html>hi</html>'), /not an image/],
        ['a GIF', () => sharp({ create: { width: 500, height: 500, channels: 3, background: '#fff' } }).gif().toBuffer(), /JPEG, PNG or WebP/],
        ['a small photo', () => photo(600, 300), /at least 400px/],
        ['an empty body', () => Buffer.alloc(0), /No file/]
    ])('%s is refused', async (label, make, message) => {
        await expect(bannerFiles.createDraft(await make(), analyse)).rejects.toThrow(message);
        expect(fs.existsSync(bannerFiles.DRAFT_DIR) ? fs.readdirSync(bannerFiles.DRAFT_DIR) : []).toEqual([]);
    });

    test('a face detector that fails still gives a draft, framed by hand', async () => {
        const spy = jest.spyOn(console, 'error').mockImplementation(() => { });
        const { id, detected } = await bannerFiles.createDraft(await photo(900, 600), async () => { throw new Error('model missing'); });
        spy.mockRestore();
        expect(detected).toMatchObject({ width: 900, height: 600, kind: 'no-face', face: null, detectionFailed: true });
        await expect(bannerFiles.readDraft(id)).resolves.toBeTruthy();
    });

    test('only draft ids name drafts', async () => {
        await expect(bannerFiles.readDraft('../../x')).rejects.toMatchObject({ status: 404 });
    });

    test('old drafts and temporary files are swept, new ones and banners stay', async () => {
        const { id } = await bannerFiles.createDraft(await photo(800, 600), analyse);
        await bannerFiles.createBanner('keep', Buffer.from('x'));
        fs.writeFileSync(path.join(BANNER_DIR, '.tmp-old'), 'x');
        const old = new Date(Date.now() - 2 * bannerFiles.DRAFT_MAX_AGE_MS);
        fs.utimesSync(path.join(BANNER_DIR, '.tmp-old'), old, old);
        expect(await bannerFiles.sweepDrafts()).toBe(1);
        expect(await bannerFiles.sweepDrafts(0)).toBe(3); // the fresh draft: original, editor copy, detection
        expect(bannerFiles.listFiles()).toEqual(['keep.jpg']);
        await expect(bannerFiles.readDraft(id)).rejects.toMatchObject({ status: 404 });
    });
});
