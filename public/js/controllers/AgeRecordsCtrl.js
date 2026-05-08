angular.module('mcrrcApp.results').controller('AgeRecordsController', ['$scope', 'AuthService', 'ResultsService', 'RecordsGridService', function ($scope, AuthService, ResultsService, RecordsGridService) {
    $scope.openRecordModal = function (record) {
        if (record && record.raceid) ResultsService.showRaceFromResultModal(record.raceid);
    };

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function (user) {
        $scope.user = user;
        $scope.loggedInMemberId = user && user.member ? (user.member._id || user.member).toString() : null;
    });

    // ── Mode-specific config ──────────────────────────────────────────────────

    var LS_DISTANCES = 'mcrrcApp.ageRecords.customDistances';
    var LS_SURFACE   = 'mcrrcApp.ageRecords.surfaceFilter';
    var LS_COLLAPSED = 'mcrrcApp.ageRecords.customFilterCollapsed';
    var LS_SEX       = 'mcrrcApp.ageRecords.sexFilter';
    var LS_VALUEMODE = 'mcrrcApp.ageRecords.valueMode';

    var GRID_OPTS = {
        getRowKey: function (race, member) {
            return RecordsGridService.calculateAgeAtDate(member.dateofbirth, race.racedate);
        },
        requireDateOfBirth: true,
        rowSort: function (a, b) { return a - b; }   // ascending
    };

    // ── Shared setup (delegates to service) ──────────────────────────────────

    var allRecordsByTime     = {};
    var allRecordsByAgeGrade = {};
    var allDistances = {};
    var customDistancesLoaded = false;

    $scope.loading             = true;
    $scope.sexFilter           = 'Both';
    $scope.surfaceFilter       = 'Road';
    $scope.valueMode           = 'time';
    $scope.customDistanceSelection = {};
    $scope.customFilterCollapsed   = false;
    $scope.selectedMemberKey       = null;
    $scope.ages = [];

    loadPreferences();

    function loadPreferences() {
        try {
            var s = localStorage.getItem(LS_SURFACE);
            if (s && RecordsGridService.SURFACE_GROUPS[s]) $scope.surfaceFilter = s;

            var x = localStorage.getItem(LS_SEX);
            if (x === 'Men' || x === 'Women' || x === 'Both') $scope.sexFilter = x;

            var v = localStorage.getItem(LS_VALUEMODE);
            if (v === 'time' || v === 'agegrade') $scope.valueMode = v;

            var c = localStorage.getItem(LS_COLLAPSED);
            if (c !== null) $scope.customFilterCollapsed = JSON.parse(c);

            var d = localStorage.getItem(LS_DISTANCES);
            if (d !== null) {
                customDistancesLoaded = true;
                JSON.parse(d).forEach(function (k) { $scope.customDistanceSelection[k] = true; });
            }
        } catch (e) {}
    }

    function saveCustomDistances() {
        try {
            var selected = Object.keys($scope.customDistanceSelection)
                .filter(function (k) { return $scope.customDistanceSelection[k]; });
            localStorage.setItem(LS_DISTANCES, JSON.stringify(selected));
        } catch (e) {}
    }

    function applyGridResult(result) {
        $scope.ages              = result.rows;
        $scope.distances         = result.distances;
        $scope.allDistanceGroups = result.allDistanceGroups;
        $scope.grid              = result.grid;
        $scope.allTimeRow        = result.allTimeRow;
        $scope.totalCustomDistances = result.totalCustomDistances;
        $scope.memberColors      = result.memberColors;
        $scope.memberNames       = result.memberNames;
        $scope.tooltips          = result.tooltips;
        $scope.allTimeTooltips   = result.allTimeTooltips;
        $scope.memberList        = result.memberList;

        if (result.didInitCustomDistances) {
            $scope.customDistanceSelection = result.customDistanceSelection;
            saveCustomDistances();
            customDistancesLoaded = true;
        }
    }

    function buildGrid() {
        var records = $scope.valueMode === 'agegrade' ? allRecordsByAgeGrade : allRecordsByTime;
        applyGridResult(RecordsGridService.buildGrid(records, allDistances, {
            surfaceFilter:           $scope.surfaceFilter,
            sexFilter:               $scope.sexFilter,
            customDistanceSelection: $scope.customDistanceSelection,
            customDistancesLoaded:   customDistancesLoaded,
            rowSort:                 GRID_OPTS.rowSort,
            valueMode:               $scope.valueMode
        }));
    }

    ResultsService.getRaceResultsWithCacheSupport({ sort: '-racedate -order racename', preload: false })
        .then(function (races) {
            var processed        = RecordsGridService.processRaces(races, GRID_OPTS);
            allRecordsByTime     = processed.allRecordsByTime;
            allRecordsByAgeGrade = processed.allRecordsByAgeGrade;
            allDistances         = processed.allDistances;
            buildGrid();
            $scope.loading = false;
            if (!$scope.$$phase) $scope.$apply();
        });

    // ── Scope methods ─────────────────────────────────────────────────────────

    $scope.getInitials       = RecordsGridService.getInitials;
    $scope.getMemberKey      = RecordsGridService.getMemberKey;
    $scope.getMemberColor    = function (member) { return $scope.memberColors[RecordsGridService.getMemberKey(member)] || '#999'; };
    $scope.getMemberColorByKey = function (key)  { return $scope.memberColors[key] || '#999'; };
    $scope.formatTime        = function (cs)     { return secondsToTimeString(cs); };
    $scope.formatCellValue   = function (record) {
        if ($scope.valueMode === 'agegrade') return record && record.agegrade ? record.agegrade.toFixed(1) + '%' : '';
        return record ? secondsToTimeString(record.time) : '';
    };

    $scope.onValueModeChange = function () {
        try { localStorage.setItem(LS_VALUEMODE, $scope.valueMode); } catch (e) {}
        buildGrid();
    };

    $scope.toggleMemberHighlight = function (key) {
        $scope.selectedMemberKey = ($scope.selectedMemberKey === key) ? null : key;
    };

    $scope.onFilterChange = function () {
        $scope.selectedMemberKey = null;
        try {
            localStorage.setItem(LS_SURFACE, $scope.surfaceFilter);
            localStorage.setItem(LS_SEX, $scope.sexFilter);
        } catch (e) {}
        buildGrid();
    };

    $scope.toggleCustomFilter = function () {
        $scope.customFilterCollapsed = !$scope.customFilterCollapsed;
        try { localStorage.setItem(LS_COLLAPSED, JSON.stringify($scope.customFilterCollapsed)); } catch (e) {}
    };

    $scope.onCustomDistanceChange = function () { saveCustomDistances(); buildGrid(); };

    $scope.selectAllDistances = function () {
        $scope.allDistanceGroups.forEach(function (g) {
            g.distances.forEach(function (d) { $scope.customDistanceSelection[d.key] = true; });
        });
        $scope.onCustomDistanceChange();
    };

    $scope.clearAllDistances = function () {
        $scope.customDistanceSelection = {};
        $scope.onCustomDistanceChange();
    };

    $scope.selectGroupDistances = function (group) {
        group.distances.forEach(function (d) { $scope.customDistanceSelection[d.key] = true; });
        $scope.onCustomDistanceChange();
    };

    $scope.clearGroupDistances = function (group) {
        group.distances.forEach(function (d) { $scope.customDistanceSelection[d.key] = false; });
        $scope.onCustomDistanceChange();
    };
}]);
