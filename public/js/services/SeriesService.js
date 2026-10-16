// Race series from cached data. The series index (which races are editions of
// what) is cached like the race list, until SystemInfo.seriesUpdate moves; joined
// with the cached race list, it gives every public series page what the
// /api/series endpoints compute, through the same shared code
// (app/raceSeriesStats.js, app/memberRaceCounts.js, in the bundle as
// window.RaceSeriesStats and window.MemberRaceCounts).
//
// Each method answers in the shape of the endpoint it stands in for, so pages
// switch over without changing what they render, and falls back to that endpoint
// when the race list is not already cached: one page is never worth downloading
// the whole list for (ResultsService.peekCachedRaceList).
angular.module('mcrrcApp').factory('SeriesService', ['$http', '$q', 'SystemService', 'ResultsService', 'DexieService',
    function ($http, $q, SystemService, ResultsService, DexieService) {

    var MIN_PUBLIC_EDITIONS = 2;

    var factory = {};
    var memory = { stamp: null, index: null };
    var indexInFlight = null;

    // ---- The series index -------------------------------------------------

    function stampOf(sysinfo) {
        return (sysinfo && sysinfo.seriesUpdate) || 'none';
    }

    // The index, from memory, then IndexedDB, then the network
    factory.getIndex = function () {
        if (indexInFlight) return indexInFlight;
        indexInFlight = $q.when(SystemService.getSystemInfo('mcrrc')).then(function (sysinfo) {
            var stamp = stampOf(sysinfo);
            if (memory.index && memory.stamp === stamp) return memory.index;
            return $q.when(DexieService.open().then(function () {
                return DexieService.series.get('index');
            })).catch(function () {
                return null;
            }).then(function (stored) {
                if (stored && stored.stamp === stamp) return JSON.parse(stored.data);
                return $http.get('/api/series/index').then(function (res) {
                    // Storing is a bonus: a browser without IndexedDB (private
                    // mode) still gets the index, just fetched each visit
                    try {
                        $q.when(DexieService.series.put({ instance: 'index', stamp: stamp, data: JSON.stringify(res.data) }))
                            .catch(angular.noop);
                    } catch (e) { /* no IndexedDB */ }
                    return res.data;
                });
            }).then(function (index) {
                memory = { stamp: stamp, index: index };
                return index;
            });
        }).finally(function () {
            indexInFlight = null;
        });
        return indexInFlight;
    };

    // ---- Index + race list, joined ----------------------------------------

    function context() {
        // The race list first: without it there is nothing to join, and no
        // reason to fetch the index either
        return $q.when(ResultsService.peekCachedRaceList()).then(function (races) {
            if (!races || !races.length) return $q.reject('nothing cached');
            return $q.all([factory.getIndex(), races]);
        }).then(function (both) {
            var index = both[0], races = both[1];
            if (!index) return $q.reject('no index');
            var raceById = {};
            races.forEach(function (r) { raceById[r._id] = r; });
            var seriesOfRace = {};
            index.forEach(function (s) {
                s.editions.forEach(function (e) { seriesOfRace[e.raceId] = s; });
            });
            return { index: index, races: races, raceById: raceById, seriesOfRace: seriesOfRace };
        });
    }

    // Uses the cached data when there is some, else asks the endpoint
    function withFallback(compute, url, params) {
        return context().then(compute).catch(function () {
            return $http.get(url, { params: params || {} }).then(function (res) { return res.data; });
        });
    }

    function editionRaces(series, ctx) {
        return series.editions.map(function (e) { return ctx.raceById[e.raceId]; }).filter(Boolean);
    }

    function allClubRaces(races) {
        return races.length > 0 && races.every(function (r) { return r.clubRace; });
    }

    function year(race) {
        return new Date(race.racedate).getUTCFullYear();
    }

    function publicRace(race) {
        var type = race.racetype;
        return {
            _id: race._id, racename: race.racename, racedate: race.racedate,
            distanceName: race.distanceName, isMultisport: race.isMultisport,
            racetype: type ? { name: type.name, surface: type.surface, isVariable: type.isVariable, miles: type.miles } : null,
            location: race.location ? { country: race.location.country, state: race.location.state } : null,
            clubRace: !!race.clubRace
        };
    }

    // A race's results as the shared stats read them: the race they belong to,
    // with its distance, on each
    function resultsOf(race) {
        var type = race.racetype || {};
        return (race.results || []).map(function (r) {
            return {
                _id: r._id, time: r.time, agegrade: r.agegrade, ranking: r.ranking, members: r.members || [],
                race: { _id: race._id, racetype: { name: type.name, surface: type.surface } }
            };
        });
    }

    // ---- What each page needs ---------------------------------------------

    // GET /api/series
    factory.getList = function () {
        return withFallback(function (ctx) {
            return ctx.index.map(function (s) {
                var races = editionRaces(s, ctx);
                var years = races.map(year);
                return {
                    _id: s._id, name: s.name, clubRace: allClubRaces(races),
                    racetype: s.racetype ? s.racetype.name : '',
                    editions: races.length,
                    firstYear: years.length ? Math.min.apply(null, years) : null,
                    lastYear: years.length ? Math.max.apply(null, years) : null,
                    location: window.RaceSeriesStats.mainLocation(races),
                    results: races.reduce(function (n, r) { return n + (r.results || []).length; }, 0)
                };
            }).filter(function (s) { return s.editions >= MIN_PUBLIC_EDITIONS; })
                .sort(function (a, b) { return a.name.localeCompare(b.name); });
        }, '/api/series');
    };

    // GET /api/series/:id
    factory.getSeries = function (seriesId) {
        return context().then(function (ctx) {
            var series = ctx.index.filter(function (s) { return s._id === seriesId; })[0];
            var races = series ? editionRaces(series, ctx) : [];
            if (races.length < MIN_PUBLIC_EDITIONS) return $q.reject('not found');
            var offDistance = {};
            series.editions.forEach(function (e) { offDistance[e.raceId] = e.offDistance; });
            var inSeries = {};
            races.forEach(function (r) { inSeries[r._id] = true; });

            // Each member's usual age grade, from their solo results elsewhere,
            // per distance and surface, and per surface summed from those
            var S = window.RaceSeriesStats;
            var sums = {}, surfaceSums = {};
            ctx.races.forEach(function (race) {
                if (inSeries[race._id]) return;
                var type = race.racetype || {};
                (race.results || []).forEach(function (r) {
                    if (!r.members || r.members.length !== 1 || !(r.agegrade > 0)) return;
                    [[sums, S.distanceKey(r.members[0]._id, type)], [surfaceSums, S.surfaceKey(r.members[0]._id, type)]]
                        .forEach(function (pair) {
                            var t = pair[0][pair[1]] || (pair[0][pair[1]] = { sum: 0, n: 0 });
                            t.sum += r.agegrade;
                            t.n += 1;
                        });
                });
            });
            var toMap = function (obj) {
                return new Map(Object.keys(obj).map(function (k) { return [k, { avg: obj[k].sum / obj[k].n, n: obj[k].n }]; }));
            };

            return {
                _id: series._id, name: series.name, clubRace: allClubRaces(races),
                racetype: series.racetype,
                location: window.RaceSeriesStats.mainLocation(races),
                stats: S.seriesStats({
                    editions: races.map(function (r) { return { race: publicRace(r), offDistance: !!offDistance[r._id] }; }),
                    results: [].concat.apply([], races.map(resultsOf)),
                    usualAgeGrades: { byDistance: toMap(sums), bySurface: toMap(surfaceSums) }
                })
            };
        }).catch(function (reason) {
            // A series the index does not know may still exist (just confirmed,
            // say): the endpoint has the last word, 404 included
            return $http.get('/api/series/' + seriesId).then(function (res) { return res.data; });
        });
    };

    // GET /api/series/by-race/:raceId
    factory.getForRace = function (raceId) {
        return withFallback(function (ctx) {
            var series = ctx.seriesOfRace[raceId];
            if (!series) return null;
            var races = editionRaces(series, ctx).sort(function (a, b) {
                return new Date(a.racedate) - new Date(b.racedate) || (a.order || 0) - (b.order || 0);
            });
            if (races.length < MIN_PUBLIC_EDITIONS) return null;
            var at = races.map(function (r) { return r._id; }).indexOf(raceId);
            var edition = function (r) { return r ? { _id: r._id, racename: r.racename, racedate: r.racedate } : null; };
            return {
                _id: series._id, name: series.name, clubRace: allClubRaces(races), editions: races.length,
                previous: edition(races[at - 1]), next: edition(races[at + 1])
            };
        }, '/api/series/by-race/' + raceId);
    };

    // GET /api/series/stats (?parkrun=exclude)
    factory.getTeamStats = function (noParkrun) {
        return withFallback(function (ctx) {
            var seriesList = ctx.index.filter(function (s) { return !noParkrun || !s.parkrun; }).map(function (s) {
                return {
                    _id: s._id, name: s.name, racetype: s.racetype,
                    editions: s.editions.filter(function (e) { return ctx.raceById[e.raceId]; }).map(function (e) {
                        return { raceId: e.raceId, year: year(ctx.raceById[e.raceId]), offDistance: e.offDistance };
                    })
                };
            });
            return window.RaceSeriesStats.teamSeriesStats({
                seriesList: seriesList,
                results: [].concat.apply([], ctx.races.map(resultsOf))
            });
        }, '/api/series/stats', noParkrun ? { parkrun: 'exclude' } : {});
    };

    // GET /api/series/club-participation (?year=): races marked as MCRRC club
    // races are on the race list itself, so the series index is not needed
    factory.getClubParticipation = function (yearOrAll) {
        var y = parseInt(yearOrAll, 10);
        return $q.when(ResultsService.peekCachedRaceList()).then(function (races) {
            if (!races || !races.length) return $q.reject('nothing cached');
            var byMember = {}, clubRaces = {};
            races.forEach(function (race) {
                if (!race.clubRace || (y > 1900 && year(race) !== y)) return;
                (race.results || []).forEach(function (r) {
                    clubRaces[race._id] = true;
                    (r.members || []).forEach(function (m) {
                        var entry = byMember[m._id] || (byMember[m._id] = {
                            member: { _id: m._id, firstname: m.firstname, lastname: m.lastname, username: m.username }, races: {}
                        });
                        entry.races[race._id] = true;
                    });
                });
            });
            var members = Object.keys(byMember).map(function (id) {
                return { member: byMember[id].member, races: Object.keys(byMember[id].races).length };
            }).sort(function (a, b) {
                return b.races - a.races || (a.member.lastname || '').localeCompare(b.member.lastname || '');
            });
            return { clubRaces: Object.keys(clubRaces).length, runners: members.length, members: members.slice(0, 10) };
        }).catch(function () {
            return $http.get('/api/series/club-participation', { params: y > 1900 ? { year: y } : {} })
                .then(function (res) { return res.data; });
        });
    };

    // The race count tiles of a result page (the detail endpoint's memberCounts),
    // or null when there is nothing cached to work from
    factory.memberCounts = function (result) {
        return context().then(function (ctx) {
            var raceId = result.race && result.race._id;
            var series = ctx.seriesOfRace[raceId];
            var seriesArg = series && series.editions.length >= MIN_PUBLIC_EDITIONS ? {
                _id: series._id, name: series.name,
                raceIds: new Set(series.editions.map(function (e) { return e.raceId; }))
            } : null;
            return (result.members || []).map(function (m) {
                var history = [];
                ctx.races.forEach(function (race) {
                    (race.results || []).forEach(function (r) {
                        if ((r.members || []).some(function (x) { return x._id === m._id; })) {
                            history.push({
                                _id: r._id,
                                race: {
                                    _id: race._id, racename: race.racename, racedate: race.racedate, order: race.order,
                                    racetype: race.racetype, isMultisport: race.isMultisport
                                }
                            });
                        }
                    });
                });
                var counts = window.MemberRaceCounts.memberRaceCounts({ result: result, history: history, series: seriesArg });
                return counts ? {
                    member: { _id: m._id, firstname: m.firstname, lastname: m.lastname, username: m.username },
                    counts: counts
                } : null;
            }).filter(Boolean);
        }).catch(function () {
            return null;
        });
    };

    return factory;
}]);
