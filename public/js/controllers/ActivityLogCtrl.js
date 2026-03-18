angular.module('mcrrcApp.admin').controller('ActivityLogController', [
    '$scope', 'AuthService', 'ActivityLogService',
    function($scope, AuthService, ActivityLogService) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function(user) {
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
    ActivityLogService.getActionTypes().then(function(actions) {
        $scope.actionsList = ['All'].concat(actions || []);
    });

    // Load logs
    $scope.loadLogs = function() {
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

        ActivityLogService.getLogs(params).then(function(response) {
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
    $scope.$watch('actionFilter', function(newVal, oldVal) {
        if (newVal !== oldVal) {
            $scope.currentPage = 1;
            $scope.loadLogs();
        }
    });

    $scope.$watch('searchQuery', function(newVal, oldVal) {
        if (newVal !== oldVal) {
            $scope.currentPage = 1;
            $scope.loadLogs();
        }
    });

    // Pagination
    $scope.nextPage = function() {
        if ($scope.currentPage < $scope.totalPages) {
            $scope.currentPage++;
            $scope.loadLogs();
        }
    };

    $scope.prevPage = function() {
        if ($scope.currentPage > 1) {
            $scope.currentPage--;
            $scope.loadLogs();
        }
    };

}]);
