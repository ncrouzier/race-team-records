const zlib = require('zlib');
const { encode, accepts, createUpgrader } = require('../app/raceInfosEncoding');

// A race-list-like JSON text of about n KB
function listJson(kb) {
    const races = [];
    for (let i = 0, length = 2; length < kb * 1024; i++) {
        const race = { _id: 'race' + i, racename: 'Race ' + (i % 97), results: [{ time: i * 1000 + (i * 7919) % 1000, members: [{ username: 'runner' + (i % 185) }] }] };
        races.push(race);
        length += JSON.stringify(race).length + 1;
    }
    return JSON.stringify(races);
}

describe('encode', () => {
    test('gives gzip and Brotli copies of the same text', async () => {
        const json = listJson(50);
        const out = await encode(json);
        expect(zlib.gunzipSync(out.gzip).toString()).toBe(json);
        expect(zlib.brotliDecompressSync(out.br).toString()).toBe(json);
        expect(out.br.length).toBeLessThan(out.gzip.length);
    });
});

describe('accepts', () => {
    test.each([
        ['gzip, deflate, br, zstd', 'br', true],
        ['gzip, deflate, br, zstd', 'gzip', true],
        ['gzip, deflate', 'br', false],
        ['br;q=0, gzip', 'br', false],
        ['br;q=0.5', 'br', true],
        ['BR', 'br', true],
        ['brotli', 'br', false],
        [undefined, 'gzip', false],
    ])('%s accepts %s: %s', (header, name, expected) => {
        expect(accepts(header, name)).toBe(expected);
    });
});

describe('createUpgrader', () => {
    // A few hundred KB at the background quality
    const json = listJson(600);

    test('replaces the entry\'s Brotli copy with a smaller one of the same text', async () => {
        const entry = { br: zlib.brotliCompressSync(json, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 1 } }) };
        const before = entry.br.length;
        const done = await createUpgrader().start('k', entry, json, () => true);
        expect(done).toBe(true);
        expect(zlib.brotliDecompressSync(entry.br).toString()).toBe(json);
        expect(entry.br.length).toBeLessThan(before);
    });

    test('a data change in the middle keeps the quick copy, and stops the work', async () => {
        // Several seconds of work in all
        const big = listJson(4000);
        const upgrader = createUpgrader();
        const entry = { br: 'quick' };
        const job = upgrader.start('k', entry, big, () => true);
        await new Promise(resolve => setTimeout(resolve, 100));
        upgrader.cancelAll();
        expect(await job).toBe(false);
        expect(entry.br).toBe('quick');
        expect(upgrader.running()).toBe(0);
        // The compression itself stops (within a slice), not just the promise
        const cpu = process.cpuUsage();
        await new Promise(resolve => setTimeout(resolve, 1000));
        const used = process.cpuUsage(cpu);
        expect((used.user + used.system) / 1000).toBeLessThan(500);
    });

    test('work started after the data change still counts', async () => {
        const upgrader = createUpgrader();
        upgrader.cancelAll();
        const entry = { br: 'quick' };
        expect(await upgrader.start('k', entry, json, () => true)).toBe(true);
        expect(zlib.brotliDecompressSync(entry.br).toString()).toBe(json);
    });

    test('an entry no longer served when the work ends keeps its quick copy', async () => {
        const entry = { br: 'quick' };
        expect(await createUpgrader().start('k', entry, json, () => false)).toBe(false);
        expect(entry.br).toBe('quick');
    });

    test('a newer list for the same key replaces the older one\'s work', async () => {
        const upgrader = createUpgrader();
        const older = { br: 'old quick' }, newer = { br: 'new quick' };
        const olderJob = upgrader.start('k', older, json, () => true);
        const newerJob = upgrader.start('k', newer, json, () => true);
        expect(await olderJob).toBe(false);
        expect(older.br).toBe('old quick');
        expect(await newerJob).toBe(true);
        expect(zlib.brotliDecompressSync(newer.br).toString()).toBe(json);
    });

    test('small texts are left as they are', async () => {
        const entry = { br: 'quick' };
        expect(await createUpgrader({ minBytes: 1024 * 1024 }).start('k', entry, json, () => true)).toBe(false);
        expect(entry.br).toBe('quick');
    });
});
