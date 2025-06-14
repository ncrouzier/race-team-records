angular.module('mcrrcApp.results').controller('HomeController', ['$scope', 'AuthService', 'ResultsService', 'dialogs', function($scope, AuthService, ResultsService, dialogs) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function(user) {
        $scope.user = user;
    });

    $scope.resultsList = [];
    $scope.expandedRaces = {};  // Object to track expanded races by ID

    ResultsService.getRacesInfos({
        "filters": {
            "dateFrom": new Date().setDate((new Date()).getDate() - 31)
        },
        "sort": '-racedate -order racename'
    }).then(function(races) {
        $scope.racesList = races;
    });

    $scope.expand = function(raceinfo) {
        if (raceinfo) {
            // Toggle the expanded state for this race
            $scope.expandedRaces[raceinfo._id] = !$scope.expandedRaces[raceinfo._id];
        }
    };

    $scope.showRaceModal = function(raceinfo) {
        if (raceinfo) {
            ResultsService.showRaceModal(raceinfo).then(function() {});           
        }
    };


    $scope.isRaceExpanded = function(raceId) {
        return $scope.expandedRaces[raceId] === true;
    };

    $scope.expandAll = function() {
        $scope.racesList.forEach(function(race) {
            $scope.expandedRaces[race._id] = true;
        });
    };

    $scope.collapseAll = function() {
        $scope.expandedRaces = {};
    };

    $scope.getRaceTypeClass = function(surface) {
        switch(surface) {
            case 'track': return 'tracksurface';
            case 'cross country': return 'xcsurface';
            case 'road': return 'roadsurface';
            case 'ultra': return 'ultrasurface';
            case 'other': return 'othersurface';
            default: return '';
        }
    };

}]);
