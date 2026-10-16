// Public race series pages: the same race across editions (the series list, and
// one series with its history). Only links an admin confirmed show here; the
// admin side is RaceSeriesCtrl.js. API: app/raceSeriesRoutes.js.
// The list is laid out like Individual Results (individualResults.html): the same
// search bar, sortable headings, numbered rows and pager.
angular.module('mcrrcApp.results').controller('SeriesListController', ['$scope', '$state', 'PageTitleService', 'SeriesService', 'Analytics',
    function ($scope, $state, PageTitleService, SeriesService, Analytics) {

    PageTitleService.set($scope, 'Race Series');
    $scope.PAGE_SIZE = 50;
    $scope.pagination = { current: 1 };
    $scope.loading = true;
    $scope.filters = { text: '', clubOnly: false, sort: 'editions', desc: true };
    $scope.rows = [];

    // Each column's first click direction, and what breaks its ties
    var SORTS = {
        name: { desc: false, value: function (s) { return s.name.toLowerCase(); } },
        distance: { desc: false, value: function (s) { return (s.racetype || '').toLowerCase(); } },
        years: { desc: true, value: function (s) { return s.lastYear * 10000 + (s.lastYear - s.firstYear); } },
        editions: { desc: true, value: function (s) { return s.editions; } },
        results: { desc: true, value: function (s) { return s.results; } }
    };

    // Built when the filters change, not in a getter
    function refresh() {
        var f = $scope.filters;
        var text = f.text.trim().toLowerCase();
        var value = SORTS[f.sort].value;
        var dir = f.desc ? -1 : 1;
        $scope.rows = ($scope.series || []).filter(function (s) {
            return (!f.clubOnly || s.clubRace) && (!text || s.name.toLowerCase().indexOf(text) !== -1);
        }).sort(function (a, b) {
            var va = value(a), vb = value(b);
            if (va !== vb) return (va < vb ? -1 : 1) * dir;
            return b.results - a.results || a.name.localeCompare(b.name);
        });
        $scope.pagination.current = 1;
    }

    // From the cached race list and series index when there are some
    SeriesService.getList().then(function (list) {
        $scope.series = list;
        refresh();
    }, function () {
        $scope.loadError = true;
    }).finally(function () {
        $scope.loading = false;
    });

    $scope.$watchGroup(['filters.text', 'filters.clubOnly', 'filters.sort', 'filters.desc'], function (now, before) {
        if (now !== before) refresh();
    });

    $scope.$watch('filters.text', function (now, before) {
        if (now === before) return;
        Analytics.eventSoon('search:race_series', 'search', function () {
            var text = ($scope.filters.text || '').trim();
            if (text.length < 2) return null;
            return { list: 'race_series', search_term: text, result_count: $scope.rows.length };
        });
    });

    $scope.$watch('filters.clubOnly', function (now, before) {
        if (now === before) return;
        Analytics.event(now ? 'filter_apply' : 'filter_clear', { list: 'race_series', filter_type: 'club_race' });
    });

    $scope.sortBy = function (column) {
        var f = $scope.filters;
        if (f.sort === column) {
            f.desc = !f.desc;
        } else {
            f.sort = column;
            f.desc = SORTS[column].desc;
        }
        Analytics.event('sort_list', { list: 'race_series', column: column, direction: f.desc ? 'desc' : 'asc' });
    };

    $scope.sortIcon = function (column) {
        if ($scope.filters.sort !== column) return 'fa-sort ir-sort-idle';
        return $scope.filters.desc ? 'fa-sort-desc' : 'fa-sort-asc';
    };

    // A row clicked, or its name (the link: track-event in the template)
    $scope.open = function (s) {
        Analytics.event('select_content', { content_type: 'series', item_id: s._id, source: 'series_list_row' });
        $state.go('/series-detail', { seriesId: s._id });
    };

    $scope.pageEnd = function () {
        return Math.min($scope.pagination.current * $scope.PAGE_SIZE, $scope.rows.length);
    };

    $scope.years = function (s) {
        return s.firstYear === s.lastYear ? String(s.firstYear) : s.firstYear + '–' + s.lastYear;
    };
}]);

angular.module('mcrrcApp.results').controller('SeriesDetailController', ['$scope', '$stateParams', '$filter', 'PageTitleService', 'UtilsService', 'AuthService', 'SeriesService', 'Analytics',
    function ($scope, $stateParams, $filter, PageTitleService, UtilsService, AuthService, SeriesService, Analytics) {

    // For the admin's edit button
    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function (user) {
        $scope.user = user;
    });

    $scope.loading = true;
    $scope.memberFilter = { text: '' };
    $scope.memberSort = { key: 'count', desc: true };
    $scope.memberPage = { current: 1 };
    $scope.memberRows = [];
    $scope.open = {};

    // Members table: each column's first click direction and value; members
    // with nothing in that column go last, whichever the direction
    var MEMBER_SORTS = {
        name: { desc: false, value: function (m) { return ((m.member.lastname || '') + ' ' + (m.member.firstname || '')).toLowerCase(); } },
        count: { desc: true, value: function (m) { return m.count; } },
        years: { desc: true, value: function (m) { return m.lastYear * 10000 + m.firstYear; } },
        best: { desc: false, value: function (m) { return m.best ? m.best.time : null; } },
        ageGrade: { desc: true, value: function (m) { return m.bestAgeGrade || null; } }
    };

    // Built when the filter or sort changes, not in a getter
    function refreshMembers() {
        if (!$scope.stats) return;
        var text = $scope.memberFilter.text.trim().toLowerCase();
        var sort = MEMBER_SORTS[$scope.memberSort.key];
        var dir = $scope.memberSort.desc ? -1 : 1;
        $scope.memberRows = $scope.stats.members.filter(function (m) {
            return !text || (m.member.firstname + ' ' + m.member.lastname).toLowerCase().indexOf(text) !== -1;
        }).sort(function (a, b) {
            var va = sort.value(a), vb = sort.value(b);
            if (va === null && vb !== null) return 1;
            if (vb === null && va !== null) return -1;
            if (va !== vb) return (va < vb ? -1 : 1) * dir;
            return b.count - a.count || MEMBER_SORTS.name.value(a).localeCompare(MEMBER_SORTS.name.value(b));
        });
        $scope.memberPage.current = 1;
    }

    $scope.$watchGroup(['memberFilter.text', 'memberSort.key', 'memberSort.desc'], refreshMembers);

    $scope.sortMembers = function (key) {
        if ($scope.memberSort.key === key) {
            $scope.memberSort.desc = !$scope.memberSort.desc;
        } else {
            $scope.memberSort.key = key;
            $scope.memberSort.desc = MEMBER_SORTS[key].desc;
        }
        Analytics.event('sort_list', { list: 'series_members', column: key, direction: $scope.memberSort.desc ? 'desc' : 'asc' });
    };

    // What is typed is a runner's name: only that the box was used
    $scope.$watch('memberFilter.text', function (now, before) {
        if (now === before) return;
        Analytics.eventSoon('search:series_members', 'search', function () {
            if (($scope.memberFilter.text || '').trim().length < 2) return null;
            return { list: 'series_members' };
        });
    });

    $scope.memberSortIcon = function (key) {
        if ($scope.memberSort.key !== key) return 'fa-sort sd-sort-idle';
        return $scope.memberSort.desc ? 'fa-sort-desc' : 'fa-sort-asc';
    };

    SeriesService.getSeries($stateParams.seriesId).then(function (series) {
        $scope.series = series;
        $scope.stats = series.stats;
        PageTitleService.set($scope, series.name);
        // Built once: a list written in the template is a new array every digest.
        // A distance with no age grading has no age grade list.
        // A relay series has a list of teams, and none of runners on their own
        var bests = $scope.stats.bests;
        $scope.bestLists = [];
        if (bests.men.length || bests.women.length || !bests.teams.length) {
            $scope.bestLists.push({ title: 'Fastest men', rows: bests.men, show: 'time' });
            $scope.bestLists.push({ title: 'Fastest women', rows: bests.women, show: 'time' });
        }
        if (bests.teams.length) {
            $scope.bestLists.push({ title: 'Fastest teams', rows: bests.teams, show: 'time', teams: true });
        }
        if ($scope.stats.summary.hasAgeGrades) {
            $scope.bestLists.push({ title: 'Best age grades', rows: bests.ageGrade, show: 'agegrade' });
        }
        refreshMembers();
        $scope.bestColumn = { 1: 'col-md-6', 2: 'col-md-6', 3: 'col-md-4', 4: 'col-md-3' }[$scope.bestLists.length];
    }, function (res) {
        if (res.status === 404) $scope.notFound = true;
        else $scope.loadError = true;
    }).finally(function () {
        $scope.loading = false;
    });

    $scope.editionWord = function (n) {
        return n === 1 ? 'edition' : 'editions';
    };

    $scope.years = function () {
        var s = $scope.stats.summary;
        return s.firstYear === s.lastYear ? String(s.firstYear) : s.firstYear + '–' + s.lastYear;
    };

    $scope.hasOffDistance = function () {
        return $scope.stats.editions.some(function (e) { return e.offDistance; });
    };

    $scope.getStateFlag = function (code) {
        return UtilsService.getStateFlag(code);
    };

    $scope.signed = function (n) {
        return (n > 0 ? '+' : '') + n.toFixed(1);
    };

    // What the course figure compares, and on how much
    $scope.courseTip = function () {
        var c = $scope.stats.course, rt = $scope.series.racetype || {};
        var parts = ["Members' age grade here against their usual age grade elsewhere."];
        if (c.sameDistance) {
            parts.push('At ' + rt.name + ' on ' + rt.surface + ': ' + $scope.signed(c.sameDistance.diff) +
                ' (' + c.sameDistance.results + ' results by ' + c.sameDistance.members + ' members).');
        }
        if (c.sameSurface) {
            parts.push('Any ' + rt.surface + ' race: ' + $scope.signed(c.sameSurface.diff) +
                ' (' + c.sameSurface.results + ' results by ' + c.sameSurface.members + ' members).');
        }
        parts.push('Above zero: members run better here than usual.');
        return parts.join(' ');
    };

    // Minutes per mile as "7:32", as Individual Results shows it
    $scope.paceText = function (perMile) {
        if (!perMile) return '';
        var m = Math.floor(perMile);
        var s = Math.round((perMile % 1) * 60);
        if (s === 60) { m += 1; s = 0; }
        return m + ':' + (s < 10 ? '0' + s : s);
    };

    // Every ranking a result has, for the place's tooltip
    $scope.placeTip = function (place) {
        var parts = [];
        if (place.overallrank) parts.push('Overall ' + place.overallrank + (place.overalltotal ? ' of ' + place.overalltotal : ''));
        if (place.genderrank) parts.push('Gender ' + place.genderrank + (place.gendertotal ? ' of ' + place.gendertotal : ''));
        if (place.agerank) parts.push('Age group ' + place.agerank + (place.agetotal ? ' of ' + place.agetotal : ''));
        return parts.join(' · ');
    };

    $scope.names = function (members) {
        return (members || []).map(function (m) { return m.firstname + ' ' + m.lastname; }).join(', ');
    };

    // A member who ran an edition more than once: what their other runs were
    $scope.otherRunsTip = function (h) {
        var times = (h.otherTimes || []).map(function (t) { return $filter('secondsToTimeString')(t); });
        return 'Ran it ' + h.runs + ' times; the best is shown' + (times.length ? '. Also: ' + times.join(', ') : '');
    };

    $scope.toggle = function (m) {
        $scope.open[m.member._id] = !$scope.open[m.member._id];
        if ($scope.open[m.member._id]) Analytics.event('expand_row', { list: 'series_members', runs: m.count });
    };
}]);

// Racing Stats tab: loyalty and course ratings across every race series
// (app/raceSeriesStats.js teamSeriesStats). Inside StatsController's page, so
// `user` (for highlighting your own rows) comes from there.
angular.module('mcrrcApp.results').controller('TeamSeriesStatsController', ['$scope', 'SeriesService',
    function ($scope, SeriesService) {

    $scope.courseView = 'fastest';
    // Each panel has its own "leave out parkruns"
    $scope.seriesFilter = { loyaltyNoParkrun: false, courseNoParkrun: false, recordNoParkrun: false };
    $scope.openRecords = {};
    $scope.recordSex = 'all';

    $scope.setRecordSex = function (sex) {
        $scope.recordSex = sex;
    };


    // The stats with and without parkruns, each fetched once, when first needed
    var loaded = {};
    var loading = {};
    function variant(noParkrun) {
        var key = noParkrun ? 'exclude' : 'include';
        if (!loaded[key] && !loading[key]) {
            loading[key] = true;
            SeriesService.getTeamStats(noParkrun).then(function (stats) {
                // Each holder's first few races, as one line
                ['all', 'men', 'women'].forEach(function (list) {
                    stats.recordHolders[list].forEach(function (h) {
                        h.preview = h.records.slice(0, 3).map(function (r) { return r.series.name; }).join(', ');
                    });
                });
                loaded[key] = stats;
            }, function () {
                $scope.seriesStatsError = true;
            });
        }
        return loaded[key] || null;
    }

    $scope.loyaltyStats = function () {
        return variant($scope.seriesFilter.loyaltyNoParkrun);
    };

    $scope.courseStats = function () {
        return variant($scope.seriesFilter.courseNoParkrun);
    };

    $scope.recordStats = function () {
        return variant($scope.seriesFilter.recordNoParkrun);
    };

    $scope.toggleRecords = function (row) {
        $scope.openRecords[row.member._id] = !$scope.openRecords[row.member._id];
    };

    // Club race participation follows the page's year (StatsController's
    // miscStats.year), each year fetched once
    var clubByYear = {};
    $scope.$watch('miscStats.year', function (year) {
        if (!year) return;
        var key = String(year);
        if (clubByYear[key]) {
            $scope.club = clubByYear[key];
            return;
        }
        $scope.club = null;
        SeriesService.getClubParticipation(year).then(function (club) {
            clubByYear[key] = club;
            if (String($scope.miscStats.year) === key) $scope.club = club;
        }, function () {
            $scope.clubError = true;
        });
    });

    $scope.setCourseView = function (view) {
        $scope.courseView = view;
    };

    $scope.signed = function (n) {
        return (n > 0 ? '+' : '') + n.toFixed(1);
    };
}]);
