angular.module('mcrrcApp.members').controller('GalleryController', ['$scope', 'Analytics', '$filter', 'AuthService', 'ResultsService', function($scope, Analytics, $filter, AuthService, ResultsService) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function(user) {
        $scope.user = user;
    });









}]);
