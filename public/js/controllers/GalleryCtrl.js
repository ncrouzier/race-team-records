angular.module('mcrrcApp.members').controller('GalleryController', ['$scope', '$filter', 'AuthService', 'ResultsService', function($scope, $filter, AuthService, ResultsService) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function(user) {
        $scope.user = user;
    });









}]);
