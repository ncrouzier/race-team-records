angular.module('mcrrcApp.admin').controller('ActivityLogController', [
    '$scope', '$rootScope', 'AuthService', 'ActivityLogService', '$uibModal', 'dialogs',
    function ($scope, $rootScope, AuthService, ActivityLogService, $uibModal, dialogs) {

        $scope.authService = AuthService;
        $scope.$watch('authService.isLoggedIn()', function (user) {
            $scope.user = user;
        });

        // Filters
        $scope.searchQuery = '';
        $scope.actionFilter = 'All';
        $scope.actionsList = ['All'];

        // Pagination
        $scope.currentPage = 1;
        $scope.itemsPerPage = 50;
        $scope.totalItems = 0;
        $scope.totalPages = 0;

        // Load action types for dropdown
        ActivityLogService.getActionTypes().then(function (actions) {
            $scope.actionsList = ['All'].concat(actions || []);
        });

        // Load logs
        $scope.loadLogs = function () {
            var params = {
                page: $scope.currentPage,
                limit: $scope.itemsPerPage
            };
            if ($scope.actionFilter !== 'All') {
                params.action = $scope.actionFilter;
            }
            if ($scope.searchQuery) {
                params.username = $scope.searchQuery;
            }

            ActivityLogService.getLogs(params).then(function (response) {
                if (response) {
                    $scope.logsList = response.logs;
                    $scope.totalItems = response.total;
                    $scope.totalPages = response.pages;
                    $scope.currentPage = response.page;
                }
            });
        };

        // Initial load
        $scope.loadLogs();

        // Watch filters and reload
        $scope.$watch('actionFilter', function (newVal, oldVal) {
            if (newVal !== oldVal) {
                $scope.currentPage = 1;
                $scope.loadLogs();
            }
        });

        $scope.$watch('searchQuery', function (newVal, oldVal) {
            if (newVal !== oldVal) {
                $scope.currentPage = 1;
                $scope.loadLogs();
            }
        });

        // Pagination
        $scope.nextPage = function () {
            if ($scope.currentPage < $scope.totalPages) {
                $scope.currentPage++;
                $scope.loadLogs();
            }
        };

        $scope.prevPage = function () {
            if ($scope.currentPage > 1) {
                $scope.currentPage--;
                $scope.loadLogs();
            }
        };

        // Delete log entry
        $scope.deleteLog = function (log) {
            var dlg = dialogs.confirm("Delete Log Entry?", "Are you sure you want to delete this activity log entry?");
            dlg.result.then(function () {
                ActivityLogService.deleteLog(log._id).then(function () {
                    var index = $scope.logsList.indexOf(log);
                    if (index > -1) {
                        $scope.logsList.splice(index, 1);
                        $scope.totalItems--;
                    }
                });
            }, function () {
                // User cancelled
            });
        };

        // View log detail — opening an entry marks it seen
        $scope.viewLogDetail = function (log) {
            $uibModal.open({
                templateUrl: 'views/modals/activityLogDetailModal.html',
                controller: 'ActivityLogDetailModalInstanceController',
                size: 'lg',
                resolve: {
                    log: function () { return log; }
                }
            });

            if (log.unseen) {
                log.unseen = false;
                ActivityLogService.markSeen(log._id).then(function () {
                    ActivityLogService.getUnseenCount().then(function (count) {
                        $rootScope.unseenActivityCount = count || 0;
                    });
                });
            }
        };

    }]);

// Field lists for the two structured (object oldValue/newValue) diff types,
// each entry as [dot-path into the snapshot, display label, formatter].
var COMPRACE_RESPONSE_FIELDS = [
    ['recentResult.racename', 'Recent race', null],
    ['recentResult.racedate', 'Recent race date', 'date'],
    ['recentResult.time', 'Recent race time', 'centis'],
    ['recentResult.agegrade', 'Recent race age grade', 'agegrade'],
    ['recentResult.isManual', 'Recent race entered manually', 'bool'],
    ['projectedTimeCentiseconds', 'Projected time', 'centis'],
    ['comments', 'Comments', null]
];

var COMPRACE_FORM_FIELDS = [
    ['title', 'Title', null],
    ['description', 'Description', null],
    ['race.racename', 'Race name', null],
    ['race.racedate', 'Race date', 'date'],
    ['race.racetype', 'Race type', null],
    ['isOpen', 'Open', 'bool'],
    ['closesAt', 'Closes at', 'date'],
    ['numComps', 'Comps offered', null],
    ['numCompsMale', 'Comps (M)', null],
    ['numCompsFemale', 'Comps (F)', null],
    ['numDiscounts', 'Discount codes', null],
    ['numDiscountsMale', 'Discounts (M)', null],
    ['numDiscountsFemale', 'Discounts (F)', null],
    ['splitCompsByGender', 'Split comps by gender', 'bool'],
    ['splitDiscountsByGender', 'Split discounts by gender', 'bool'],
    ['resultsLookbackMonths', 'Results look-back (months)', null],
    ['uniqueId', 'Form URL ID', null],
    ['bannerImageUrl', 'Banner image URL', null]
];

angular.module('mcrrcApp.admin').controller('ActivityLogDetailModalInstanceController', ['$scope', '$uibModalInstance', 'log', 'DiffService', function ($scope, $uibModalInstance, log, DiffService) {
    $scope.log = log;

    function get(obj, path) {
        return path.split('.').reduce(function (o, key) { return (o == null) ? undefined : o[key]; }, obj);
    }

    function formatValue(value, formatter) {
        if (value === undefined || value === null || value === '') return '—';
        if (formatter === 'bool') return value ? 'Yes' : 'No';
        if (formatter === 'date') return new Date(value).toLocaleDateString();
        if (formatter === 'agegrade') return Number(value).toFixed(1) + '%';
        if (formatter === 'centis') {
            var totalSec = Math.floor(value / 100);
            var h = Math.floor(totalSec / 3600), m = Math.floor((totalSec % 3600) / 60), s = totalSec % 60;
            var pad = function (n) { return String(n).padStart(2, '0'); };
            return h > 0 ? (h + ':' + pad(m) + ':' + pad(s)) : (m + ':' + pad(s));
        }
        return String(value);
    }

    // Only the fields that actually changed, each as {label, oldDisplay, newDisplay}.
    function buildFieldDiffs(fieldDefs, oldObj, newObj) {
        var rows = [];
        fieldDefs.forEach(function (def) {
            var path = def[0], label = def[1], formatter = def[2];
            var oldVal = get(oldObj, path);
            var newVal = get(newObj, path);
            if (JSON.stringify(oldVal) === JSON.stringify(newVal)) return;
            rows.push({
                label: label,
                oldDisplay: formatValue(oldVal, formatter),
                newDisplay: formatValue(newVal, formatter)
            });
        });
        return rows;
    }

    if (log.action === 'bio_edit' && log.metadata) {
        // Keeps bold/links/paragraphs intact rather than diffing stripped
        // plain text — bound via ng-bind-html + the `unsafe` filter.
        $scope.bioDiffHtml = DiffService.htmlDiff(log.metadata.oldValue, log.metadata.newValue);
    }

    if (log.action === 'comprace_response_edit' && log.metadata) {
        $scope.fieldDiffs = buildFieldDiffs(COMPRACE_RESPONSE_FIELDS, log.metadata.oldValue, log.metadata.newValue);
        $scope.commentsDiff = DiffService.wordDiff(
            (log.metadata.oldValue && log.metadata.oldValue.comments) || '',
            (log.metadata.newValue && log.metadata.newValue.comments) || ''
        );
    }

    if (log.action === 'comprace_form_edit' && log.metadata) {
        $scope.fieldDiffs = buildFieldDiffs(COMPRACE_FORM_FIELDS, log.metadata.oldValue, log.metadata.newValue);
    }

    // Create/submit events have no "old" side — just list what was set.
    function buildValueRows(fieldDefs, obj) {
        return fieldDefs
            .map(function (def) {
                var value = get(obj, def[0]);
                if (value === undefined || value === null || value === '') return null;
                return { label: def[1], display: formatValue(value, def[2]) };
            })
            .filter(Boolean);
    }

    if (log.action === 'comprace_response_submit' && log.metadata) {
        $scope.valueRows = buildValueRows(COMPRACE_RESPONSE_FIELDS, log.metadata.newValue);
    }

    if (log.action === 'comprace_form_create' && log.metadata) {
        $scope.valueRows = buildValueRows(COMPRACE_FORM_FIELDS, log.metadata.newValue);
    }

    $scope.close = function () {
        $uibModalInstance.close();
    };
}]);
