const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');

const PHOTO_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'member-photos-'));
process.env.PHOTO_DIR = PHOTO_DIR;
const memberPhotos = require('../app/memberPhotos');

const ID = '0123456789abcdef01234567';

// A noisy photo-like image: random pixels compress badly, the worst case for
// the 200 KB target
function noisyImage(width, height, format, options) {
    const data = Buffer.alloc(width * height * 3);
    for (let i = 0; i < data.length; i++) data[i] = (i * 7919 + (i >> 5) * 104729) % 256;
    let img = sharp(data, { raw: { width, height, channels: 3 } });
    if (options && options.exif) img = img.withMetadata({ exif: { IFD0: { Make: 'TestCam', Copyright: 'secret' } } });
    return img.toFormat(format, format === 'jpeg' ? { quality: 85 } : {}).toBuffer();
}

afterAll(() => fs.rmSync(PHOTO_DIR, { recursive: true, force: true }));

describe('processPhoto', () => {
    test('a large photo comes out a JPEG of at most 1000 px, full colour resolution', async () => {
        const input = await noisyImage(2400, 3200, 'jpeg');
        expect(input.length).toBeLessThan(10 * 1024 * 1024);
        const out = await memberPhotos.processPhoto(input);
        const meta = await sharp(out).metadata();
        expect(meta.format).toBe('jpeg');
        expect(Math.max(meta.width, meta.height)).toBe(1000);
        expect(meta.width).toBe(750);
        expect(meta.chromaSubsampling).toBe('4:4:4');
    });

    test('a small photo is not enlarged', async () => {
        const meta = await sharp(await memberPhotos.processPhoto(await noisyImage(400, 300, 'png'))).metadata();
        expect([meta.width, meta.height]).toEqual([400, 300]);
    });

    test('the photo is kept at high quality, whatever its size', async () => {
        // Photo-like detail: noise softened as a camera would, not pure noise
        const input = await sharp(await noisyImage(800, 600, 'png')).blur(1.2).png().toBuffer();
        const out = await memberPhotos.processPhoto(input);
        const a = await sharp(input).raw().toBuffer(), b = await sharp(out).raw().toBuffer();
        let sq = 0;
        for (let i = 0; i < a.length; i++) sq += (a[i] - b[i]) * (a[i] - b[i]);
        const psnr = 10 * Math.log10(255 * 255 / (sq / a.length));
        expect(psnr).toBeGreaterThan(40);
    });

    test('metadata (EXIF, GPS...) is removed', async () => {
        const input = await noisyImage(800, 600, 'jpeg', { exif: true });
        expect((await sharp(input).metadata()).exif).toBeDefined();
        const meta = await sharp(await memberPhotos.processPhoto(input)).metadata();
        expect(meta.exif).toBeUndefined();
        expect(meta.icc).toBeUndefined();
    });

    test('WebP and PNG with transparency are accepted (flattened on white)', async () => {
        const png = await sharp({ create: { width: 300, height: 300, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
        const out = await memberPhotos.processPhoto(png);
        const { data } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
        expect(data[0]).toBeGreaterThan(240);
        await expect(memberPhotos.processPhoto(await noisyImage(300, 300, 'webp'))).resolves.toBeInstanceOf(Buffer);
    });

    test.each([
        ['an HTML page', Buffer.from('<html><script>alert(1)</script></html>')],
        ['an SVG', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200"/></svg>')],
        ['a renamed executable', Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff', 'binary')],
        ['an empty body', Buffer.alloc(0)]
    ])('%s is refused', async (label, buffer) => {
        await expect(memberPhotos.processPhoto(buffer)).rejects.toMatchObject({ photoError: true });
    });

    test('GIF and TIFF are refused even though sharp reads them', async () => {
        const gif = await sharp({ create: { width: 200, height: 200, channels: 3, background: '#fff' } }).gif().toBuffer();
        const tiff = await sharp({ create: { width: 200, height: 200, channels: 3, background: '#fff' } }).tiff().toBuffer();
        await expect(memberPhotos.processPhoto(gif)).rejects.toThrow(/JPEG, PNG or WebP/);
        await expect(memberPhotos.processPhoto(tiff)).rejects.toThrow(/JPEG, PNG or WebP/);
    });

    test('a tiny image is refused', async () => {
        await expect(memberPhotos.processPhoto(await noisyImage(60, 60, 'png'))).rejects.toThrow(/too small/);
    });

    test('a file over 10 MB is refused before decoding', async () => {
        await expect(memberPhotos.processPhoto(Buffer.alloc(10 * 1024 * 1024 + 1))).rejects.toMatchObject({ status: 413 });
    });

    test('an image declaring a huge size (decompression bomb) is refused', async () => {
        // A small PNG file (flat colour compresses to almost nothing) that
        // decodes to 120 megapixels
        const bomb = await sharp({ create: { width: 20000, height: 6000, channels: 3, background: '#000' } }).png({ compressionLevel: 9 }).toBuffer();
        expect(bomb.length).toBeLessThan(2 * 1024 * 1024);
        await expect(memberPhotos.processPhoto(bomb)).rejects.toMatchObject({ photoError: true });
    });
});

describe('file names', () => {
    test('only a member id names a file, inside PHOTO_DIR', () => {
        expect(memberPhotos.fileFor(ID)).toBe(path.join(PHOTO_DIR, ID + '.jpg'));
        ['../etc/passwd', ID + '/../x', 'abc', ID.toUpperCase(), ''].forEach(bad => {
            expect(() => memberPhotos.fileFor(bad)).toThrow();
        });
    });

    test('localPhotoId recognises our links only', () => {
        expect(memberPhotos.localPhotoId('/uploads/photos/' + ID + '.jpg?v=abc123')).toBe(ID);
        expect(memberPhotos.localPhotoId('/uploads/photos/' + ID + '.jpg')).toBe(ID);
        expect(memberPhotos.localPhotoId('https://res.cloudinary.com/x/' + ID + '.jpg')).toBeNull();
        expect(memberPhotos.localPhotoId('/uploads/photos/../' + ID + '.jpg')).toBeNull();
        expect(memberPhotos.localPhotoId('')).toBeNull();
    });
});

describe('savePhoto / deletePhoto', () => {
    test('stores the file under the member id, replaces it, leaves no temporary file', async () => {
        const first = await memberPhotos.savePhoto(ID, await noisyImage(500, 500, 'jpeg'));
        expect(first).toMatch(new RegExp('^/uploads/photos/' + ID + '\\.jpg\\?v=[a-f0-9]{12}$'));
        const second = await memberPhotos.savePhoto(ID, await noisyImage(600, 400, 'png'));
        expect(second).not.toBe(first);
        expect(fs.readdirSync(PHOTO_DIR)).toEqual([ID + '.jpg']);
        expect((await sharp(fs.readFileSync(memberPhotos.fileFor(ID))).metadata()).width).toBe(600);

        await memberPhotos.deletePhoto(ID);
        expect(fs.readdirSync(PHOTO_DIR)).toEqual([]);
        await expect(memberPhotos.deletePhoto(ID)).resolves.toBeUndefined();
    });

    test('a refused upload leaves the current photo in place', async () => {
        await memberPhotos.savePhoto(ID, await noisyImage(500, 500, 'jpeg'));
        const before = fs.readFileSync(memberPhotos.fileFor(ID));
        await expect(memberPhotos.savePhoto(ID, Buffer.from('not an image'))).rejects.toMatchObject({ photoError: true });
        expect(fs.readFileSync(memberPhotos.fileFor(ID)).equals(before)).toBe(true);
        expect(fs.readdirSync(PHOTO_DIR)).toEqual([ID + '.jpg']);
    });
});
