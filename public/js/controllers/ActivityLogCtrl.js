angular.module('mcrrcApp.admin').controller('ActivityLogController', [
    '$scope', 'AuthService', 'ActivityLogService', '$uibModal', 'dialogs',
    function ($scope, AuthService, ActivityLogService, $uibModal, dialogs) {

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

        // View log detail
        $scope.viewLogDetail = function (log) {
            $uibModal.open({
                templateUrl: 'views/modals/activityLogDetailModal.html',
                controller: 'ActivityLogDetailModalInstanceController',
                size: 'lg',
                resolve: {
                    log: function () { return log; }
                }
            });
        };

    }]);

angular.module('mcrrcApp.admin').controller('ActivityLogDetailModalInstanceController', ['$scope', '$uibModalInstance', 'log', function ($scope, $uibModalInstance, log) {
    $scope.log = log;

    $scope.close = function () {
        $uibModalInstance.close();
    };
}]);
