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
// callers asking at the same time share it.
//
// After this browser saves an edit, invalidate(): nothing is downloaded then,
// however many edits follow; the next caller checks the stamp and waits for
// the data as it is now, downloading only if it changed. Until then nothing
// is offered as held (cached(), peek()), so a page that can ask the server
// for less does. options.outOfDate starts a cache that way (an edit made
// before the page reloaded); options.onFresh says when it no longer is.
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
        var gate = null;            // more edits may follow: callers wait for it
        var outOfDate = !!options.outOfDate;    // this browser edited the data
        var refreshing = null;      // the out-of-date catch-up in flight
        var refreshingFor = 0;      // ...and the invalidation it answers
        var edits = 0;              // invalidations so far: a catch-up started
                                    // before the latest one does not clear it
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
            if (checking || fetching || gate || outOfDate) return;
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

        // Out of date after an edit: check the stamp now, and download when it
        // moved (or when nothing is held). Every caller meanwhile shares it.
        function catchUpNow() {
            // One started before the latest save is not enough: wait for it,
            // then catch up again
            if (refreshing && refreshingFor !== edits) {
                return refreshing.then(catchUpNow, catchUpNow);
            }
            if (refreshing) return refreshing;
            var edit = refreshingFor = edits;
            refreshing = (memory ? Promise.resolve(memory) : readStored().then(adopt))
                .then(currentStamp)
                .then(function (stamp) {
                    if (!memory || stamp === null) return download(stamp, !!fetching);
                    return catchUp(stamp);
                })
                .then(function (entry) {
                    refreshing = null;
                    if (edit === edits) {
                        outOfDate = false;
                        if (options.onFresh) options.onFresh();
                    }
                    return entry || memory;
                }, function (e) {
                    // Still out of date: the next caller tries again. This one
                    // gets what is held, if anything, rather than nothing.
                    refreshing = null;
                    report(e);
                    if (memory) return memory;
                    throw e;
                });
            return refreshing;
        }

        function afterGate(then) {
            var g = gate;
            return g.then(function () {
                if (gate === g) gate = null;
                return then();
            });
        }

        // Resolves with { stamp, data }: whatever is held, at once (or, after
        // an edit in this browser, the data as it is now)
        function entry() {
            if (gate) return afterGate(entry);
            if (outOfDate) return catchUpNow();
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

        // What is held or kept in the browser, or null; never downloads.
        // Null too while out of date after an edit.
        function cached() {
            if (gate || outOfDate) return Promise.resolve(null);
            if (memory) {
                revalidate();
                return Promise.resolve(memory);
            }
            if (loading) return loading;
            return readStored().then(adopt);
        }

        // This browser saved an edit. after: a promise to wait for first
        // (more edits may be on their way); callers asking meanwhile wait too.
        function invalidate(after) {
            edits++;
            outOfDate = true;
            gate = Promise.resolve(after);
        }

        return {
            entry: entry,
            get: function () {
                return entry().then(function (e) { return e.data; });
            },
            cached: cached,
            invalidate: invalidate,
            // What is held in memory, without going anywhere for it; null
            // while out of date after an edit
            peek: function () {
                return outOfDate ? null : memory;
            }
        };
    }

    return { create: create };
}));
