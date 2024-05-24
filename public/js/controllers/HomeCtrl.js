angular.module('mcrrcApp.results').controller('HomeController', ['$scope', 'AuthService', 'ResultsService', 'dialogs', function($scope, AuthService, ResultsService, dialogs) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function(user) {
        $scope.user = user;
    });


    $scope.resultsList = [];


    ResultsService.getRacesInfos({
        "filters": {
            "dateFrom": new Date().setDate((new Date()).getDate() - 31)
        },
        "sort": '-race.racedate -race.order race.racename'
    }).then(function(races) {
        $scope.racesList = races;
    });



    $scope.showRaceModal = function(raceinfo) {
        if (raceinfo) {
            ResultsService.showRaceModal(raceinfo).then(function() {});
        }
    };

}]);
