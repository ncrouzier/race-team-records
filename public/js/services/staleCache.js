// One cached data set (the race list, the series index...) that answers at
// once from what this browser already has, even when it is out of date, and
// replaces it in the background. The next page to ask gets the new copy.
//
// The cache knows nothing about where things are kept or fetched from; the
// service using it passes those in, as functions returning promises:
//
//   readStamp()      the server's current version stamp for this data
//   readStore()      the copy kept in the browser, { stamp, data }, or null
//   writeStore(e)    keep { stamp, data } in the browser
//   fetchFresh()     download the data
//
// There is never more than one download, or one stamp check, in flight:
// callers asking at the same time share it. After this browser saves an edit,
// recheck() makes callers wait for the new copy instead.
//
// Plain JavaScript (window.StaleCache in the bundle), so tests/staleCache.test.js
// can run it under Node.
/* global module */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.StaleCache = factory();
}(this, function () {
    'use strict';

    function stampText(stamp) {
        return stamp === null || stamp === undefined ? null : String(stamp);
    }

    function create(options) {
        var memory = null;          // { stamp, data }: what the cache answers with
        var loading = null;         // the first answer, from the browser or the server
        var checking = null;        // a background stamp check in flight
        var waiting = null;         // a recheck callers wait for (recheck)
        var fetching = null;        // a download in flight
        var fetchingStamp = null;   // ...and the stamp it was started for
        var generation = 0;         // only the latest download may replace the data

        function report(error) {
            if (options.onError) options.onError(error);
        }

        function save(entry) {
            try {
                Promise.resolve(options.writeStore(entry)).catch(report);
            } catch (e) {
                report(e);
            }
        }

        function currentStamp() {
            return Promise.resolve().then(options.readStamp).catch(function (e) {
                report(e);
                return null;
            });
        }

        function readStored() {
            return Promise.resolve().then(options.readStore).catch(function (e) {
                report(e);
                return null;
            });
        }

        // force: start over even when a download is already running (its
        // stamp is out of date); the running one's result is then thrown away
        function download(stampPromise, force) {
            if (fetching && !force) return fetching;
            var mine = ++generation;
            var job = Promise.resolve(stampPromise).then(function (stamp) {
                if (mine === generation) fetchingStamp = stampText(stamp);
                return Promise.resolve().then(options.fetchFresh).then(function (data) {
                    var entry = { stamp: stampText(stamp), data: data };
                    if (mine !== generation) return fetching || memory || entry;
                    memory = entry;
                    save(entry);
                    return entry;
                });
            });
            fetching = job;
            job.then(function () {
                if (fetching === job) fetching = null;
            }, function () {
                if (fetching === job) fetching = null;
            });
            return job;
        }

        // Given the server's stamp: downloads when what is held (or being
        // downloaded) is for another one. Resolves once the data is current.
        function catchUp(stamp) {
            if (stamp === null || !memory) return Promise.resolve(memory);
            var text = stampText(stamp);
            if (text === (fetching ? fetchingStamp : memory.stamp)) return fetching || Promise.resolve(memory);
            return download(text, !!fetching);
        }

        // In the background, after answering with what is held
        function revalidate() {
            if (checking || fetching || waiting) return;
            checking = currentStamp().then(function (stamp) {
                checking = null;
                return catchUp(stamp).catch(report);
            });
        }

        // A copy kept in the browser becomes the one held
        function adopt(stored) {
            if (memory) return memory;      // a download finished meanwhile
            if (!stored || stored.data === undefined) return null;
            memory = { stamp: stampText(stored.stamp), data: stored.data };
            revalidate();
            return memory;
        }

        // Resolves with { stamp, data }: whatever is held, at once
        function entry() {
            if (waiting) return waiting.then(function () { return memory || entry(); });
            if (memory) {
                revalidate();
                return Promise.resolve(memory);
            }
            if (loading) return loading;
            loading = readStored().then(function (stored) {
                return adopt(stored) || download(currentStamp());
            });
            loading.then(function () { loading = null; }, function () { loading = null; });
            return loading;
        }

        // What is held or kept in the browser, or null; never downloads
        function cached() {
            if (waiting) return waiting.then(function () { return memory; });
            if (memory) {
                revalidate();
                return Promise.resolve(memory);
            }
            if (loading) return loading;
            return readStored().then(adopt);
        }

        // The data may just have changed (this browser saved an edit): check
        // the stamp now, and have callers wait for the outcome, and for the
        // new copy when there is one, rather than answer with the old one.
        // Nothing is downloaded for data this browser does not hold.
        // after: a promise to wait for first (more edits may be on their way)
        function recheck(after) {
            var job = Promise.resolve(after)
                .then(function () { return memory || readStored().then(adopt); })
                .then(currentStamp)
                .then(catchUp)
                .then(function () { return memory; }, function (e) {
                    report(e);
                    return memory;
                });
            waiting = job;
            job.then(function () {
                if (waiting === job) waiting = null;
            });
            return job;
        }

        return {
            entry: entry,
            get: function () {
                return entry().then(function (e) { return e.data; });
            },
            cached: cached,
            recheck: recheck,
            // What is held in memory, without going anywhere for it
            peek: function () {
                return memory;
            }
        };
    }

    return { create: create };
}));
