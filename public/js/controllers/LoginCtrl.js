angular.module('mcrrcApp.authentication').controller('LoginController',['$scope','$http','$state','AuthService','localStorageService', function($scope, $http, $state, AuthService,localStorageService) {

    $http({
        url: '/api/login',
        method: 'GET',
    }).success(function(data) {
        $scope.message = data.message;
    });

    $scope.login = function(user) {
        $http.post("/api/login", user).success(function(data, status) {
            AuthService.setUser(data.user);
            window.location.href = '/';
        }).error(function(data) {
            $scope.message = data[0];
            $state.go('/login');
        });
    };



    // action="/api/login" method="post"

}]);
