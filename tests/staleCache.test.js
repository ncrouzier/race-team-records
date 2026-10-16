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

    test('after a recheck, callers wait for the new copy instead of getting the old one', async () => {
        const { world, cache } = setup();
        await cache.get();
        world.stamp = 's2';             // this browser just saved an edit
        world.served = 'v2';
        cache.recheck();
        expect(await cache.get()).toBe('v2');
        expect(world.fetches).toBe(2);
    });

    test('a recheck that finds the same stamp does not download', async () => {
        const { world, cache } = setup();
        await cache.get();
        await cache.recheck();
        expect(await cache.get()).toBe('v1');
        expect(world.fetches).toBe(1);
    });

    test('a recheck during an older download starts a new one, and the older one cannot overwrite it', async () => {
        const first = deferred(), second = deferred();
        const downloads = [first, second];
        const { world, cache } = setup({ fetchFresh: () => downloads.shift().promise });
        world.stored = { stamp: 's0', data: 'old' };
        await cache.get();              // background download #1, for s1
        await settle();
        world.stamp = 's2';             // an edit lands while it runs
        cache.recheck();
        const answer = cache.get();
        await settle();
        second.resolve('after-edit');
        expect(await answer).toBe('after-edit');
        first.resolve('before-edit');
        await settle();
        expect(await cache.get()).toBe('after-edit');
        expect(world.stored).toEqual({ stamp: 's2', data: 'after-edit' });
    });

    test('a recheck can wait for a signal (more edits coming), and callers wait with it', async () => {
        const quiet = deferred();
        const { world, cache } = setup();
        await cache.get();
        cache.recheck(quiet.promise);
        world.stamp = 's2';             // a second edit, still inside the wait
        world.served = 'v2';
        const answer = cache.get();
        await settle();
        expect(world.fetches).toBe(1);  // nothing checked yet
        quiet.resolve();
        expect(await answer).toBe('v2');
        expect(world.fetches).toBe(2);
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
