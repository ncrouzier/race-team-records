angular.module('mcrrcApp.results').controller('StatsController', ['$scope', 'AuthService', 'ResultsService', 'dialogs', function($scope, AuthService, ResultsService, dialogs) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function(user) {
        $scope.user = user;
    });

    ResultsService.getBestRaceShowing({
        limit: 10,
        sort: '-count',
        resultId: '5640bee05ebb2faf19fa9c1b'
    }).then(function(races) {
        $scope.bestRaceShowingList = races;
    });

    


}]);
