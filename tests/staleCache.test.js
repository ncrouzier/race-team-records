const StaleCache = require('../public/js/services/staleCache');

// A promise the test settles by hand
function deferred() {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
}

// Lets every pending promise callback run
const settle = () => new Promise(resolve => setImmediate(resolve));

// A cache over fake storage, stamp and server. Each piece can be swapped for
// a test's own.
function setup(overrides) {
    const world = {
        stamp: 's1',
        stored: null,
        served: 'v1',
        fetches: 0,
        writes: []
    };
    const options = Object.assign({
        readStamp: () => Promise.resolve(world.stamp),
        readStore: () => Promise.resolve(world.stored),
        writeStore: entry => { world.writes.push(entry); world.stored = entry; return Promise.resolve(); },
        fetchFresh: () => { world.fetches++; return Promise.resolve(world.served); }
    }, overrides);
    return { world, cache: StaleCache.create(options) };
}

describe('StaleCache', () => {
    test('with nothing stored, downloads, answers with it and stores it with its stamp', async () => {
        const { world, cache } = setup();
        expect(await cache.get()).toBe('v1');
        expect(world.fetches).toBe(1);
        expect(world.writes).toEqual([{ stamp: 's1', data: 'v1' }]);
    });

    test('a stored copy answers without waiting for the stamp check', async () => {
        // The stamp check never answers (a slow network)
        const never = deferred();
        const { world, cache } = setup({ readStamp: () => never.promise });
        world.stored = { stamp: 's0', data: 'old' };
        expect(await cache.get()).toBe('old');
    });

    test('an outdated stored copy answers at once, then is replaced in the background', async () => {
        const { world, cache } = setup();
        world.stored = { stamp: 's0', data: 'old' };
        world.served = 'new';
        expect(await cache.get()).toBe('old');
        await settle();
        expect(world.fetches).toBe(1);
        expect(world.stored).toEqual({ stamp: 's1', data: 'new' });
        expect(await cache.get()).toBe('new');
    });

    test('a current stored copy is not downloaded again', async () => {
        const { world, cache } = setup();
        world.stored = { stamp: 's1', data: 'v1' };
        expect(await cache.get()).toBe('v1');
        await settle();
        expect(await cache.get()).toBe('v1');
        await settle();
        expect(world.fetches).toBe(0);
    });

    test('the stamp check after an edit replaces the copy held in memory', async () => {
        const { world, cache } = setup();
        await cache.get();
        world.stamp = 's2';
        world.served = 'v2';
        expect(await cache.get()).toBe('v1');
        await settle();
        expect(await cache.get()).toBe('v2');
        expect(world.fetches).toBe(2);
    });

    test('callers asking at the same time with nothing stored share one download', async () => {
        const download = deferred();
        let fetches = 0;
        const { cache } = setup({ fetchFresh: () => { fetches++; return download.promise; } });
        const answers = Promise.all([cache.get(), cache.get(), cache.get()]);
        await settle();
        download.resolve('v1');
        expect(await answers).toEqual(['v1', 'v1', 'v1']);
        expect(fetches).toBe(1);
    });

    test('callers asking during a background refresh share one download', async () => {
        const download = deferred();
        let fetches = 0;
        const { world, cache } = setup({ fetchFresh: () => { fetches++; return download.promise; } });
        world.stored = { stamp: 's0', data: 'old' };
        await Promise.all([cache.get(), cache.get()]);
        await settle();
        await cache.get();
        await settle();
        expect(fetches).toBe(1);
        download.resolve('new');
        await settle();
        expect(await cache.get()).toBe('new');
    });

    test('cached answers with what is held or stored, never downloading', async () => {
        const { world, cache } = setup();
        expect(await cache.cached()).toBeNull();
        expect(world.fetches).toBe(0);
        world.stored = { stamp: 's1', data: 'v1' };
        expect(await cache.cached()).toEqual({ stamp: 's1', data: 'v1' });
        expect(world.fetches).toBe(0);
    });

    test('cached starts the background check like any other answer', async () => {
        const { world, cache } = setup();
        world.stored = { stamp: 's0', data: 'old' };
        world.served = 'new';
        expect((await cache.cached()).data).toBe('old');
        await settle();
        expect((await cache.cached()).data).toBe('new');
    });

    test('a failing store read falls back to downloading', async () => {
        const { world, cache } = setup({ readStore: () => Promise.reject(new Error('no IndexedDB')) });
        expect(await cache.get()).toBe('v1');
        expect(world.fetches).toBe(1);
    });

    test('a failing store write still answers', async () => {
        const { cache } = setup({ writeStore: () => Promise.reject(new Error('quota')) });
        expect(await cache.get()).toBe('v1');
    });

    test('a failing background download keeps the old copy and is tried again later', async () => {
        let fail = true;
        const { world, cache } = setup({
            fetchFresh: () => fail ? Promise.reject(new Error('offline')) : Promise.resolve('new')
        });
        world.stored = { stamp: 's0', data: 'old' };
        expect(await cache.get()).toBe('old');
        await settle();
        expect(await cache.get()).toBe('old');
        await settle();             // that call's retry fails too
        fail = false;
        // The next call still answers with the old copy, and tries again
        expect(await cache.get()).toBe('old');
        await settle();
        expect(await cache.get()).toBe('new');
    });

    test('a failing first download rejects, and the next call tries again', async () => {
        let fail = true;
        const { cache } = setup({
            fetchFresh: () => fail ? Promise.reject(new Error('offline')) : Promise.resolve('v1')
        });
        await expect(cache.get()).rejects.toThrow('offline');
        fail = false;
        expect(await cache.get()).toBe('v1');
    });

    test('entry tells which stamp the answer belongs to', async () => {
        const { world, cache } = setup();
        world.stored = { stamp: 's0', data: 'old' };
        expect(await cache.entry()).toEqual({ stamp: 's0', data: 'old' });
        await settle();
        expect(await cache.entry()).toEqual({ stamp: 's1', data: 'v1' });
    });

    test('peek answers from memory only, never downloading', async () => {
        const { world, cache } = setup();
        expect(cache.peek()).toBeNull();
        await cache.get();
        expect(cache.peek()).toEqual({ stamp: 's1', data: 'v1' });
        expect(world.fetches).toBe(1);
    });
});

// After this browser saves an edit: nothing is downloaded until a page asks,
// and that page waits for the data as it is now
describe('StaleCache.invalidate', () => {
    test('downloads nothing until asked', async () => {
        const { world, cache } = setup();
        await cache.get();
        world.stamp = 's2';
        world.served = 'v2';
        cache.invalidate();
        await settle();
        expect(world.fetches).toBe(1);
    });

    test('the next caller waits for the new copy', async () => {
        const { world, cache } = setup();
        await cache.get();
        world.stamp = 's2';
        world.served = 'v2';
        cache.invalidate();
        expect(await cache.get()).toBe('v2');
        expect(world.fetches).toBe(2);
    });

    test('a stamp that did not move means no download (an edit to other data)', async () => {
        const { world, cache } = setup();
        await cache.get();
        cache.invalidate();
        expect(await cache.get()).toBe('v1');
        expect(world.fetches).toBe(1);
    });

    test('several edits in a row cost one download, on the next use', async () => {
        const { world, cache } = setup();
        await cache.get();
        for (let i = 2; i <= 6; i++) {
            world.stamp = 's' + i;
            world.served = 'v' + i;
            cache.invalidate();
            await settle();
        }
        expect(world.fetches).toBe(1);
        expect(await cache.get()).toBe('v6');
        expect(world.fetches).toBe(2);
    });

    test('meanwhile, nothing is offered as held (pages that can ask the server for less do)', async () => {
        const { world, cache } = setup();
        await cache.get();
        world.stamp = 's2';
        cache.invalidate();
        expect(cache.peek()).toBeNull();
        expect(await cache.cached()).toBeNull();
        expect(world.fetches).toBe(1);
        await cache.get();
        expect(cache.peek().stamp).toBe('s2');
    });

    test('callers during the wait for more edits wait with it', async () => {
        const quiet = deferred();
        const { world, cache } = setup();
        await cache.get();
        cache.invalidate(quiet.promise);
        world.stamp = 's2';
        world.served = 'v2';
        const answer = cache.get();
        await settle();
        expect(world.fetches).toBe(1);
        quiet.resolve();
        expect(await answer).toBe('v2');
    });

    test('an edit during an older download: the caller gets a new one, and the older cannot overwrite it', async () => {
        const first = deferred(), second = deferred();
        const downloads = [first, second];
        const { world, cache } = setup({ fetchFresh: () => downloads.shift().promise });
        world.stored = { stamp: 's0', data: 'old' };
        await cache.get();              // background download #1, for s1
        await settle();
        world.stamp = 's2';             // an edit lands while it runs
        cache.invalidate();
        const answer = cache.get();
        await settle();
        second.resolve('after-edit');
        expect(await answer).toBe('after-edit');
        first.resolve('before-edit');
        await settle();
        expect(await cache.get()).toBe('after-edit');
        expect(world.stored).toEqual({ stamp: 's2', data: 'after-edit' });
    });

    test('an edit while catching up after an earlier one: the next caller still gets the newest', async () => {
        const first = deferred();
        let fetches = 0;
        const { world, cache } = setup({ fetchFresh: () => { fetches++; return fetches === 2 ? first.promise : Promise.resolve(world.served); } });
        await cache.get();                      // v1
        world.stamp = 's2'; world.served = 'v2';
        cache.invalidate();
        const catching = cache.get();           // catch-up download for s2 starts
        await settle();
        world.stamp = 's3'; world.served = 'v3';
        cache.invalidate();                     // another save while it runs
        first.resolve('v2');
        expect(await catching).toBe('v2');
        expect(await cache.get()).toBe('v3');
    });

    test('a caller asking while that older catch-up still runs also gets the newest', async () => {
        const first = deferred();
        let fetches = 0;
        const { world, cache } = setup({ fetchFresh: () => { fetches++; return fetches === 2 ? first.promise : Promise.resolve(world.served); } });
        await cache.get();
        world.stamp = 's2'; world.served = 'v2';
        cache.invalidate();
        cache.get();                            // catch-up for s2 starts
        await settle();
        world.stamp = 's3'; world.served = 'v3';
        cache.invalidate();
        const later = cache.get();              // asks before the s2 download is done
        await settle();
        first.resolve('v2');
        expect(await later).toBe('v3');
    });

    test('a cache created out of date (an edit before a reload) behaves the same, and says when it is fresh', async () => {
        let fresh = 0;
        const { world, cache } = setup({ outOfDate: true, onFresh: () => { fresh++; } });
        world.stored = { stamp: 's0', data: 'old' };
        expect(await cache.cached()).toBeNull();
        expect(await cache.get()).toBe('v1');
        expect(fresh).toBe(1);
        expect(world.fetches).toBe(1);
    });
});
