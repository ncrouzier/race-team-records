const { hashSource, needsGeneration, toBuffer, toDataUri, computeFaceCropRegion, cropToRegion, cropFor } = require('../app/profileThumbnails');

describe('hashSource', () => {
    test('the same link hashes the same way every time', () => {
        expect(hashSource('https://example.com/photo.jpg')).toBe(hashSource('https://example.com/photo.jpg'));
    });

    test('different links hash differently', () => {
        expect(hashSource('https://example.com/a.jpg')).not.toBe(hashSource('https://example.com/b.jpg'));
    });

    test('a missing link does not throw', () => {
        expect(() => hashSource(undefined)).not.toThrow();
        expect(hashSource(undefined)).toBe(hashSource(''));
    });
});

describe('needsGeneration', () => {
    const link = 'https://example.com/photo.jpg';
    const hash = hashSource(link);

    test('no pictureLink at all: nothing to generate', () => {
        expect(needsGeneration({ pictureLink: '' })).toBe(false);
        expect(needsGeneration({})).toBe(false);
    });

    test('a pictureLink with no thumbnail yet: needs one', () => {
        expect(needsGeneration({ pictureLink: link })).toBe(true);
    });

    test('a thumbnail already matching the current link: done', () => {
        expect(needsGeneration({
            pictureLink: link,
            profileThumb: { data: Buffer.from('x'), sourceHash: hash }
        })).toBe(false);
    });

    test('the link changed since the thumbnail was made: needs a new one', () => {
        expect(needsGeneration({
            pictureLink: 'https://example.com/new-photo.jpg',
            profileThumb: { data: Buffer.from('x'), sourceHash: hash }
        })).toBe(true);
    });

    test('the same broken link that already failed: do not retry forever', () => {
        expect(needsGeneration({
            pictureLink: link,
            profileThumb: { error: 'Not an image', sourceHash: hash }
        })).toBe(false);
    });

    test('a different link than the one that previously failed: try the new one', () => {
        expect(needsGeneration({
            pictureLink: 'https://example.com/different.jpg',
            profileThumb: { error: 'Not an image', sourceHash: hash }
        })).toBe(true);
    });

    test('hash matches but no data was actually saved (defensive case): needs one', () => {
        expect(needsGeneration({
            pictureLink: link,
            profileThumb: { sourceHash: hash }
        })).toBe(true);
    });
});

describe('toBuffer', () => {
    test('a real Buffer passes through unchanged', () => {
        const buf = Buffer.from('hello');
        expect(toBuffer(buf)).toBe(buf);
    });

    test('a BSON Binary-shaped object (what .lean() actually returns) converts correctly', () => {
        // The Mongo driver's Binary wrapper, not a real Buffer: {buffer, sub_type, position}
        const binary = { buffer: Buffer.from('hello'), sub_type: 0, position: 5 };
        expect(toBuffer(binary)).toEqual(Buffer.from('hello'));
    });

    test('nothing in, nothing out', () => {
        expect(toBuffer(null)).toBeNull();
        expect(toBuffer(undefined)).toBeNull();
    });
});

describe('toDataUri', () => {
    test('builds a usable data: URI from a thumbnail', () => {
        const uri = toDataUri({ data: Buffer.from('abc'), contentType: 'image/jpeg' });
        expect(uri).toBe('data:image/jpeg;base64,' + Buffer.from('abc').toString('base64'));
    });

    test('defaults to image/jpeg when contentType is missing', () => {
        expect(toDataUri({ data: Buffer.from('abc') })).toMatch(/^data:image\/jpeg;base64,/);
    });

    test('no thumbnail, or one with no data (a stored failure): nothing to embed', () => {
        expect(toDataUri(null)).toBeNull();
        expect(toDataUri({ error: 'Not an image' })).toBeNull();
    });
});

describe('computeFaceCropRegion', () => {
    test('a face centered in the image: square centered on it, margin applied', () => {
        const region = computeFaceCropRegion({ x: 400, y: 400, width: 200, height: 200 }, 1000, 1000, 2);
        // center (500,500), size = 200*2 = 400 -> left/top = 500 - 200
        expect(region).toEqual({ left: 300, top: 300, size: 400 });
    });

    test('a face near the top-left edge: crop clamped to stay inside the image', () => {
        const region = computeFaceCropRegion({ x: 0, y: 0, width: 100, height: 100 }, 1000, 1000, 2);
        expect(region.left).toBeGreaterThanOrEqual(0);
        expect(region.top).toBeGreaterThanOrEqual(0);
        expect(region.left + region.size).toBeLessThanOrEqual(1000);
        expect(region.top + region.size).toBeLessThanOrEqual(1000);
    });

    test('a face near the bottom-right edge: crop clamped to stay inside the image', () => {
        const region = computeFaceCropRegion({ x: 900, y: 900, width: 100, height: 100 }, 1000, 1000, 2);
        expect(region.left + region.size).toBeLessThanOrEqual(1000);
        expect(region.top + region.size).toBeLessThanOrEqual(1000);
    });

    test('a face larger than the image itself: crop capped to the image bounds', () => {
        const region = computeFaceCropRegion({ x: 0, y: 0, width: 2000, height: 2000 }, 500, 800, 2);
        // size capped to the narrower dimension (500); face center (1000,1000)
        // clamped into bounds on both axes
        expect(region).toEqual({ left: 0, top: 300, size: 500 });
    });

    test('a zero-size face: still returns a valid, non-degenerate region', () => {
        const region = computeFaceCropRegion({ x: 50, y: 50, width: 0, height: 0 }, 200, 200, 2);
        expect(region.size).toBeGreaterThanOrEqual(1);
        expect(region.left).toBeGreaterThanOrEqual(0);
        expect(region.top).toBeGreaterThanOrEqual(0);
    });

    test('no margin passed: falls back to the module default (still inside the image)', () => {
        const region = computeFaceCropRegion({ x: 400, y: 400, width: 100, height: 100 }, 1000, 1000);
        expect(region.size).toBeGreaterThan(100);
        expect(region.left + region.size).toBeLessThanOrEqual(1000);
        expect(region.top + region.size).toBeLessThanOrEqual(1000);
    });
});

describe('cropToRegion', () => {
    test('fractions of the photo become pixels', () => {
        // 1000x800: size is a fraction of the shorter side (800)
        expect(cropToRegion({ left: 0.1, top: 0.25, size: 0.5 }, 1000, 800)).toEqual({ left: 100, top: 200, size: 400 });
    });

    test('a square past the right or bottom edge is pulled back inside', () => {
        const region = cropToRegion({ left: 0.9, top: 0.9, size: 0.5 }, 1000, 800);
        expect(region.left + region.size).toBeLessThanOrEqual(1000);
        expect(region.top + region.size).toBeLessThanOrEqual(800);
    });

    test('a square bigger than the photo is capped at its shorter side', () => {
        expect(cropToRegion({ left: 0, top: 0, size: 2 }, 600, 900).size).toBe(600);
    });
});

describe('cropFor', () => {
    const link = 'https://example.com/photo.jpg';
    const crop = { left: 0.1, top: 0.2, size: 0.5, sourceHash: hashSource(link) };

    test('a crop chosen on the current photo is used', () => {
        expect(cropFor({ profileThumbCrop: crop }, link)).toBe(crop);
    });

    test('a crop chosen on an older photo is ignored: the new photo starts automatic', () => {
        expect(cropFor({ profileThumbCrop: crop }, 'https://example.com/new.jpg')).toBeNull();
    });

    test('no crop, or a damaged one, means automatic', () => {
        expect(cropFor({}, link)).toBeNull();
        expect(cropFor({ profileThumbCrop: Object.assign({}, crop, { size: 'big' }) }, link)).toBeNull();
    });
});
