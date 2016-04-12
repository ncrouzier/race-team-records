angular.module('mcrrcApp.results').controller('StatsController', ['$scope', 'AuthService', 'ResultsService', 'dialogs', function($scope, AuthService, ResultsService, dialogs) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function(user) {
        $scope.user = user;
    });

    $scope.raceStats = {};
    $scope.raceStats.year = "All Time";

    $scope.miscStats = {};
    $scope.miscStats.year = "All Time";

    var currentYear = new Date().getFullYear();
    $scope.yearsList = ['All Time'];
    for (i = currentYear; i >= 2013; i--) {
        $scope.yearsList.push(i);
    }


    $scope.getRacesStats = function() {
        var fromDate = new Date(Date.UTC(2013, 0, 1)).getTime();
        var toDate = new Date().getTime();
        if ($scope.raceStats.year !== "All Time") {
            fromDate = new Date(Date.UTC($scope.raceStats.year, 0, 1)).getTime();
            toDate = new Date(Date.UTC($scope.raceStats.year + 1, 0, 1)).getTime();
        }

        ResultsService.getRacesInfos({
            "limit": 10,
            "sort": '-count',
            "filters": {
                "dateFrom": fromDate,
                "dateTo": toDate
            }
        }).then(function(races) {
            $scope.racesList = races;
        });
    };

    $scope.getMiscStats = function() {
        var fromDate = new Date(Date.UTC(2013, 0, 1)).getTime();
        var toDate = new Date().getTime();
        if ($scope.miscStats.year !== "All Time") {
            fromDate = new Date(Date.UTC($scope.miscStats.year, 0, 1)).getTime();
            toDate = new Date(Date.UTC($scope.miscStats.year + 1, 0, 1)).getTime();
        }
        ResultsService.getMilesRaced({
            "filters": {
                "dateFrom": fromDate,
                "dateTo": toDate
            }
        }).then(function(result) {
            $scope.miscStats.milesRaced = parseFloat(result.milesRaced).toFixed(2);
            $scope.miscStats.resultsCount = parseFloat(result.resultsCount);
        });
    };


    $scope.showRaceModal = function(raceinfo) {
        if (raceinfo) {
            ResultsService.showRaceModal(raceinfo).then(function() {});
        }
    };


    $scope.getRacesStats();
    $scope.getMiscStats();





}]);
