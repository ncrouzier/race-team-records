// Admin: race series, the same race across editions. The matcher only suggests
// links (app/raceSeriesMatcher.js); everything here is an admin confirming,
// rejecting or regrouping them (API: app/raceSeriesRoutes.js).
angular.module('mcrrcApp.admin').controller('RaceSeriesController', ['$scope', '$http', '$state', '$stateParams', 'dialogs',
    function ($scope, $http, $state, $stateParams, dialogs) {

    $scope.TABS = [
        { key: 'review', label: 'To review' },
        { key: 'all', label: 'All series' },
        { key: 'ungrouped', label: 'Ungrouped races' },
        { key: 'merges', label: 'Possible merges' }
    ];
    $scope.tab = $stateParams.tab || 'review';
    $scope.setTab = function (key) {
        $scope.tab = key;
        $state.go('.', { tab: key });
        if (key === 'merges' && !$scope.merges) loadMerges();
        if (key === 'ungrouped' && !$scope.ungrouped) loadUngrouped();
    };

    function errorOf(res, fallback) {
        return (res && res.data && res.data.error) || fallback;
    }

    // ---- Series (review and all) --------------------------------------------
    $scope.series = [];
    $scope.loading = true;
    $scope.filters = { text: '', onlyFlagged: false, allText: '', clubOnly: false };

    function loadSeries() {
        return $http.get('/api/race-series').then(function (res) {
            $scope.series = res.data;
        }, function () {
            $scope.loadError = true;
        }).finally(function () {
            $scope.loading = false;
        });
    }
    loadSeries();

    function matchesText(s, text) {
        if (!text) return true;
        text = text.toLowerCase();
        return s.name.toLowerCase().indexOf(text) !== -1 ||
            s.names.some(function (n) { return n.toLowerCase().indexOf(text) !== -1; });
    }

    $scope.toReview = function () {
        return $scope.series.filter(function (s) {
            return s.pending > 0 && (!$scope.filters.onlyFlagged || s.flagged > 0) && matchesText(s, $scope.filters.text);
        });
    };

    $scope.pendingTotal = function () {
        return $scope.series.filter(function (s) { return s.pending > 0; }).length;
    };

    $scope.allSeries = function () {
        return $scope.series.filter(function (s) {
            return (!$scope.filters.clubOnly || s.clubRace) && matchesText(s, $scope.filters.allText);
        });
    };

    $scope.years = function (s) {
        if (!s.firstDate) return '';
        var first = new Date(s.firstDate).getFullYear(), last = new Date(s.lastDate).getFullYear();
        return first === last ? String(first) : first + '–' + last;
    };

    // The checkbox in "All series" marks or unmarks every edition at once; it is
    // ticked only when all of them are club races
    $scope.setClubRace = function (s) {
        var value = !s.clubRace;
        s.busy = true;
        $http.post('/api/race-series/' + s._id + '/club-race', { clubRace: value }).then(function () {
            s.clubRace = value;
            s.clubRaces = value ? s.total : 0;
        }, function (res) {
            $scope.listError = errorOf(res, 'The races could not be updated.');
        }).finally(function () {
            s.busy = false;
        });
    };

    $scope.confirmAll = function (s) {
        s.busy = true;
        $http.post('/api/race-series/' + s._id + '/confirm', { all: true }).then(function () {
            s.pending = 0;
            s.flagged = 0;
        }, function (res) {
            $scope.listError = errorOf(res, 'The series could not be confirmed.');
        }).finally(function () {
            s.busy = false;
        });
    };

    // Confirms every listed series with no flagged suggestion: the bulk of the
    // backfill, where each edition has exactly the same name and distance.
    $scope.cleanToReview = function () {
        return $scope.toReview().filter(function (s) { return s.flagged === 0; });
    };

    $scope.confirmAllClean = function () {
        var clean = $scope.cleanToReview();
        var dlg = dialogs.confirm('Confirm series',
            'Confirm all suggestions in ' + clean.length + ' series? Every edition in these has the same name and distance.');
        dlg.result.then(function () {
            $scope.bulkBusy = true;
            $http.post('/api/race-series/confirm', {
                seriesIds: clean.map(function (s) { return s._id; })
            }).then(function () {
                clean.forEach(function (s) { s.pending = 0; });
            }, function (res) {
                $scope.listError = errorOf(res, 'The series could not be confirmed.');
            }).finally(function () {
                $scope.bulkBusy = false;
            });
        }, angular.noop);
    };

    // ---- Ungrouped races ----------------------------------------------------
    $scope.ungroupedQuery = { text: '' };
    $scope.selected = {};
    $scope.newSeries = { name: '' };
    $scope.addTarget = { series: null };

    function loadUngrouped() {
        $scope.ungroupedLoading = true;
        $http.get('/api/race-series/ungrouped', { params: { q: $scope.ungroupedQuery.text } }).then(function (res) {
            $scope.ungrouped = res.data;
        }).finally(function () {
            $scope.ungroupedLoading = false;
        });
    }
    $scope.loadUngrouped = loadUngrouped;
    if ($scope.tab === 'ungrouped') loadUngrouped();

    $scope.selectedIds = function () {
        return Object.keys($scope.selected).filter(function (id) { return $scope.selected[id]; });
    };

    // The first race picked suggests the series name
    $scope.toggleRace = function (race) {
        if ($scope.selected[race._id] && !$scope.newSeries.name) {
            $scope.newSeries.name = race.racename.replace(/\s*#\s*\d+/g, '').replace(/\b(19|20)\d{2}\b/g, '').replace(/\s+/g, ' ').trim();
        }
    };

    function afterGrouping() {
        $scope.selected = {};
        $scope.newSeries = { name: '' };
        $scope.addTarget = { series: null };
        loadUngrouped();
        loadSeries();
    }

    $scope.createSeries = function () {
        $scope.groupError = null;
        $http.post('/api/race-series', {
            name: $scope.newSeries.name, raceIds: $scope.selectedIds()
        }).then(afterGrouping, function (res) {
            $scope.groupError = errorOf(res, 'The series could not be created.');
        });
    };

    $scope.addToSeries = function () {
        $scope.groupError = null;
        $http.post('/api/race-series/' + $scope.addTarget.series._id + '/add', { raceIds: $scope.selectedIds() })
            .then(afterGrouping, function (res) {
                $scope.groupError = errorOf(res, 'The races could not be added.');
            });
    };

    // ---- Possible merges ----------------------------------------------------
    function loadMerges() {
        $scope.mergesLoading = true;
        $http.get('/api/race-series/possible-merges').then(function (res) {
            $scope.merges = res.data;
        }, function (res) {
            $scope.mergesError = errorOf(res, 'The possible merges could not be loaded.');
        }).finally(function () {
            $scope.mergesLoading = false;
        });
    }
    if ($scope.tab === 'merges') loadMerges();

    function dropPair(pair) {
        $scope.merges.splice($scope.merges.indexOf(pair), 1);
    }

    // Series + series: fold the second into the first. Series + race: add the race.
    $scope.mergePair = function (pair) {
        pair.busy = true;
        var url = '/api/race-series/' + pair.first._id;
        var request = pair.second.type === 'series' ?
            $http.post(url + '/merge', { sourceId: pair.second._id }) :
            $http.post(url + '/add', { raceIds: [pair.second._id] });
        request.then(function () {
            // The merged-away series may appear in other pairs; reload rather than guess
            if (pair.second.type === 'series') loadMerges();
            else dropPair(pair);
            loadSeries();
        }, function (res) {
            pair.busy = false;
            pair.error = errorOf(res, 'That could not be merged.');
        });
    };

    $scope.notSame = function (pair) {
        pair.busy = true;
        var url = '/api/race-series/' + pair.first._id;
        var request = pair.second.type === 'series' ?
            $http.post(url + '/distinct', { otherId: pair.second._id }) :
            $http.post(url + '/reject', { raceIds: [pair.second._id] });
        request.then(function () {
            dropPair(pair);
        }, function (res) {
            pair.busy = false;
            pair.error = errorOf(res, 'That could not be saved.');
        });
    };
}]);

angular.module('mcrrcApp.admin').controller('RaceSeriesDetailController', ['$scope', '$http', '$state', '$stateParams', 'dialogs',
    function ($scope, $http, $state, $stateParams, dialogs) {

    var id = $stateParams.seriesId;
    var url = '/api/race-series/' + id;

    $scope.selected = {};
    $scope.form = {};
    $scope.move = { target: null, newName: '' };
    $scope.merge = { source: null };
    $scope.add = { text: '', selected: {} };

    function errorOf(res, fallback) {
        return (res && res.data && res.data.error) || fallback;
    }

    function load() {
        return $http.get(url).then(function (res) {
            $scope.series = res.data;
            $scope.form = {
                name: res.data.name,
                racetypeId: res.data.racetype && res.data.racetype._id
            };
            $scope.selected = {};
        }, function (res) {
            $scope.loadError = res.status === 404 ? 'This series no longer exists.' : 'The series could not be loaded.';
        });
    }
    load();

    $http.get('/api/racetypes', { params: { sort: 'meters' } }).then(function (res) {
        $scope.racetypes = res.data;
    });
    $http.get('/api/race-series').then(function (res) {
        $scope.otherSeries = res.data.filter(function (s) { return s._id !== id; });
    });

    // A change that empties the series deletes it: back to the list
    function reloadOrLeave(res) {
        if (res && res.data && res.data.deleted) {
            $state.go('/race-series');
            return;
        }
        load();
    }

    function fail(fallback) {
        return function (res) {
            $scope.actionError = errorOf(res, fallback);
        };
    }

    $scope.counts = function () {
        var races = ($scope.series && $scope.series.races) || [];
        return {
            pending: races.filter(function (l) { return l.status === 'suggested'; }).length,
            results: races.reduce(function (n, l) { return n + l.results; }, 0)
        };
    };

    $scope.selectedIds = function () {
        return Object.keys($scope.selected).filter(function (rid) { return $scope.selected[rid]; });
    };

    $scope.clearSelection = function () {
        $scope.selected = {};
    };

    $scope.selectAll = function (status) {
        $scope.selected = {};
        $scope.series.races.forEach(function (l) {
            if (!status || l.status === status) $scope.selected[l.race._id] = true;
        });
    };

    $scope.saveDetails = function () {
        $scope.actionError = null;
        $scope.saved = false;
        $http.put(url, $scope.form).then(function () {
            $scope.saved = true;
            load();
        }, fail('The series could not be saved.'));
    };

    $scope.confirm = function (raceIds) {
        $scope.actionError = null;
        $http.post(url + '/confirm', { raceIds: raceIds }).then(load, fail('Those races could not be confirmed.'));
    };

    $scope.reject = function (raceIds) {
        $scope.actionError = null;
        $http.post(url + '/reject', { raceIds: raceIds }).then(reloadOrLeave, fail('Those races could not be removed.'));
    };

    $scope.allClub = function () {
        var races = ($scope.series && $scope.series.races) || [];
        return races.length > 0 && races.every(function (l) { return l.race.clubRace; });
    };

    // Saved at once, like off-distance; `raceIds` left out means every edition
    $scope.setClub = function (value, raceIds) {
        $scope.actionError = null;
        var body = { clubRace: value };
        if (raceIds) body.raceIds = raceIds;
        $http.post(url + '/club-race', body).then(load, fail('The club race mark could not be saved.'));
    };

    $scope.toggleOffDistance = function (link) {
        $http.put(url + '/races/' + link.race._id, { offDistance: !link.offDistance }).then(load, fail('That could not be changed.'));
    };

    $scope.moveSelected = function (toNew) {
        $scope.actionError = null;
        var body = { raceIds: $scope.selectedIds() };
        if (toNew) body.name = $scope.move.newName;
        else body.targetId = $scope.move.target && $scope.move.target._id;
        $http.post(url + '/move', body).then(function (res) {
            $scope.move = { target: null, newName: '' };
            if (res.data.deleted) $state.go('/race-series-detail', { seriesId: res.data.targetId });
            else load();
        }, fail('Those races could not be moved.'));
    };

    $scope.mergeIn = function () {
        var source = $scope.merge.source;
        var dlg = dialogs.confirm('Merge series',
            'Move all ' + source.total + ' races of "' + source.name + '" into this series and delete "' + source.name + '"?');
        dlg.result.then(function () {
            $http.post(url + '/merge', { sourceId: source._id }).then(function () {
                $scope.merge = { source: null };
                $scope.otherSeries = $scope.otherSeries.filter(function (s) { return s._id !== source._id; });
                load();
            }, fail('The series could not be merged.'));
        }, angular.noop);
    };

    $scope.searchUngrouped = function () {
        if (!$scope.add.text) {
            $scope.add.results = null;
            return;
        }
        $http.get('/api/race-series/ungrouped', { params: { q: $scope.add.text } }).then(function (res) {
            $scope.add.results = res.data;
        });
    };

    $scope.addSelected = function () {
        var raceIds = Object.keys($scope.add.selected).filter(function (rid) { return $scope.add.selected[rid]; });
        $http.post(url + '/add', { raceIds: raceIds }).then(function () {
            $scope.add = { text: '', selected: {} };
            load();
        }, fail('Those races could not be added.'));
    };

    $scope.deleteSeries = function () {
        var dlg = dialogs.confirm('Delete series',
            'Delete "' + $scope.series.name + '"? Its races stay as they are, just no longer grouped.');
        dlg.result.then(function () {
            $http.delete(url).then(function () {
                $state.go('/race-series', { tab: 'all' });
            }, fail('The series could not be deleted.'));
        }, angular.noop);
    };
}]);
