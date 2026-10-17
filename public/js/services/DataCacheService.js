// The big data sets this browser keeps (the race list, members, series,
// volunteer jobs): each one a StaleCache (staleCache.js), which answers at
// once with the copy already here and replaces it in the background.
//
// After this browser saves something (app.js, any successful write to /api),
// every cache is out of date: nothing is downloaded then, however many saves
// follow (a run of results in the add-result modal), but the next page that
// needs the data waits for it as it is now. Pages that can ask the server for
// one race or result do that meanwhile (ResultsService.peekCachedRaceList).
// The time of the last edit is kept in localStorage, so a reload or a cache
// not created yet starts out of date too.
angular.module('mcrrcApp').factory('DataCacheService', ['$q', '$timeout', 'SystemService', function ($q, $timeout, SystemService) {

    var factory = {};
    var caches = [];

    // When this browser last saved an edit, and when each cache last caught up
    var EDITED_KEY = 'mcrrcDataEditedAt';
    var FRESH_KEY = 'mcrrcDataFreshAt:';
    function readTime(key) {
        try { return Number(window.localStorage.getItem(key)) || 0; } catch (e) { return 0; }
    }
    function writeTime(key, time) {
        try { window.localStorage.setItem(key, String(time)); } catch (e) { /* private mode */ }
    }

    // An ISO date, comparable as text, for a SystemInfo field
    function stampOf(value) {
        if (!value) return null;
        var date = new Date(value);
        return isNaN(date.getTime()) ? null : date.toISOString();
    }
    factory.stampOf = stampOf;

    // What the race list (every race with its results and runners) follows:
    // not volunteer jobs, which the overall update also counts, so a
    // volunteer edit does not send everyone the whole race list again
    factory.RACE_DATA = ['resultUpdate', 'raceUpdate', 'racetypeUpdate', 'memberUpdate'];

    // The newest of some SystemInfo fields, as a stamp
    function newestStamp(info, fields) {
        var newest = null;
        fields.forEach(function (field) {
            var stamp = info ? stampOf(info[field]) : null;
            if (stamp && (!newest || stamp > newest)) newest = stamp;
        });
        return newest;
    }
    factory.newestStamp = newestStamp;

    // options: as StaleCache.create, with stampFields (the SystemInfo fields
    // its data follows) in place of readStamp
    factory.create = function (options) {
        var freshKey = FRESH_KEY + (options.name || '');
        var cache = window.StaleCache.create(angular.extend({
            outOfDate: readTime(EDITED_KEY) > readTime(freshKey),
            onFresh: function () { writeTime(freshKey, Date.now()); },
            readStamp: function () {
                return SystemService.getSystemInfo('mcrrc').then(function (info) {
                    return newestStamp(info, options.stampFields);
                });
            },
            onError: function (error) {
                console.warn('Cache ' + (options.name || '') + ':', error && error.message ? error.message : error);
            }
        }, options));
        caches.push(cache);
        // Answers in a digest, like any $q promise
        return {
            get: function () { return $q.when(cache.get()); },
            entry: function () { return $q.when(cache.entry()); },
            cached: function () { return $q.when(cache.cached()); },
            peek: cache.peek
        };
    };

    // Saving often comes in bursts (a race and its results): the check waits
    // until nothing has been saved for QUIET_MS, and runs once
    var QUIET_MS = 400;
    var quiet = null;       // { timer, deferred }: the wait in progress
    factory.localEdit = function () {
        writeTime(EDITED_KEY, Date.now());
        if (quiet) {
            $timeout.cancel(quiet.timer);
        } else {
            quiet = { deferred: $q.defer() };
            var after = quiet.deferred.promise;
            caches.forEach(function (cache) { cache.invalidate(after); });
        }
        var current = quiet;
        current.timer = $timeout(function () {
            quiet = null;
            SystemService.forget();
            current.deferred.resolve();
        }, QUIET_MS, false);
    };

    return factory;
}]);
