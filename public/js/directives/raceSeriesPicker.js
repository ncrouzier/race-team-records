// <race-series-picker race="..." choice="...">: on the add-result forms, once the
// race has a name and a distance, lists the race series it could belong to and
// lets the admin pick one, start one with earlier ungrouped editions, pick any
// other series from the full list, or say none. `choice` is what the add-result
// endpoints take as `seriesChoice` (app/raceSeriesSync.js); it stays null while
// nothing is picked, which leaves the automatic suggestion in place.
//
//   mode="edit"  in the race edit dialog: `race` has an _id, the current series
//                (even a confirmed one) can be changed, and nothing is sent unless
//                the admin changes something.
angular.module('mcrrcApp').directive('raceSeriesPicker', ['$http', '$timeout', function ($http, $timeout) {
    return {
        restrict: 'E',
        scope: { race: '<', choice: '=' },
        templateUrl: 'views/directives/raceSeriesPicker.html',
        link: function (scope, element, attrs) {
            scope.editMode = attrs.mode === 'edit';
            scope.data = null;
            scope.sel = { key: null, newName: '', other: null };
            // Every series, for "Another series": loaded once, when first needed
            scope.allSeries = null;
            function loadAllSeries() {
                if (scope.allSeries) return;
                scope.allSeries = [];
                $http.get('/api/race-series').then(function (res) {
                    scope.allSeries = res.data;
                }, function () {
                    scope.allSeries = null;
                });
            }
            var touched = false;
            var pending = null;
            var requestId = 0;

            // What identifies the race, as the endpoints match it
            function signature(race) {
                if (!race || !race.racename || !race.racetype || !race.racetype.name) return '';
                var loc = race.location || {};
                return [race._id, race.racename, race.racetype._id || race.racetype.name, race.racedate, loc.country, loc.state,
                    race.distanceName, race.isMultisport, race.order].join('|');
            }

            function offeredIds() {
                return ((scope.data && scope.data.candidates) || []).map(function (c) { return c._id; });
            }

            function updateChoice() {
                var key = scope.sel.key;
                if (!key || scope.locked() || (scope.editMode && !touched)) {
                    scope.choice = null;
                } else if (key === 'none') {
                    scope.choice = { none: true, declined: offeredIds() };
                } else if (key === 'other') {
                    scope.choice = scope.sel.other ? { seriesId: scope.sel.other._id } : null;
                } else if (key === 'new') {
                    scope.choice = {
                        newSeries: {
                            name: scope.sel.newName,
                            raceIds: scope.data.newSeries.races.map(function (r) { return r._id; })
                        }
                    };
                } else {
                    scope.choice = { seriesId: key };
                }
            }

            // Adding results: nothing to choose when the race already exists in a
            // confirmed series. Editing the race is where that can change.
            scope.locked = function () {
                if (scope.editMode) return false;
                var e = scope.data && scope.data.existing;
                return !!(e && e.series && e.series.status === 'confirmed');
            };

            // Editing shows where the race is now and preselects nothing else: an
            // edit sends only what the admin clicks
            function defaultKey(data) {
                var e = data.existing;
                if (e && e.series) return e.series._id;
                if (scope.editMode) return null;
                var exact = data.candidates.filter(function (c) { return c.match === 'exact'; });
                if (exact.length) return exact[0]._id;
                if (data.newSeries) return 'new';
                return data.candidates.length ? 'none' : null;
            }

            function stillOffered(key, data) {
                if (key === 'other') return !!scope.sel.other;
                if (key === 'none') return data.candidates.length || data.newSeries;
                if (key === 'new') return !!data.newSeries;
                return data.candidates.some(function (c) { return c._id === key; });
            }

            function fetch() {
                // Adding results, the race is found by its fields, as saving does:
                // a result copied from another keeps that race's _id even once
                // its date has changed. Only the edit dialog is about that race.
                var race = angular.copy(scope.race);
                if (!scope.editMode) delete race._id;
                var id = ++requestId;
                scope.loading = true;
                $http.post('/api/race-series/candidates', { race: race }).then(function (res) {
                    if (id !== requestId) return;
                    scope.data = res.data;
                    loadAllSeries();
                    if (res.data.newSeries && !scope.sel.newName) scope.sel.newName = res.data.newSeries.name;
                    // Keep what the admin picked if it is still on offer
                    if (!touched || !stillOffered(scope.sel.key, res.data)) {
                        scope.sel.key = defaultKey(res.data);
                        touched = false;
                    }
                    updateChoice();
                }, function () {
                    if (id !== requestId) return;
                    scope.data = null;
                    scope.choice = null;
                }).finally(function () {
                    if (id === requestId) scope.loading = false;
                });
            }

            scope.$watch(function () { return signature(scope.race); }, function (sig) {
                if (pending) $timeout.cancel(pending);
                if (!sig) {
                    requestId++;
                    scope.data = null;
                    scope.sel = { key: null, newName: '', other: null };
                    scope.choice = null;
                    return;
                }
                pending = $timeout(fetch, 400);
            });

            scope.pick = function () {
                touched = true;
                updateChoice();
            };

            scope.current = function () {
                return scope.data && scope.data.existing && scope.data.existing.series;
            };

            // Confirms the series the race is only suggested for
            scope.confirmCurrent = function () {
                scope.sel.key = scope.current()._id;
                scope.pick();
            };

            // Choosing from the list also selects its radio
            scope.pickOther = function () {
                scope.sel.key = 'other';
                scope.pick();
            };
        }
    };
}]);
