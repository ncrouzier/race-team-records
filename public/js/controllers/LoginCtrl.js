angular.module('mcrrcApp.authentication').controller('LoginController',['$scope','$http','$state','AuthService','localStorageService','Analytics', function($scope, $http, $state, AuthService,localStorageService,Analytics) {

    $http({
        url: '/api/login',
        method: 'GET',
    }).success(function(data) {
        $scope.message = data.message;
    });

    $scope.login = function(user) {
        $http.post("/api/login", user).success(function(data, status) {
            AuthService.setUser(data.user);
            Analytics.eventThen('login', { method: 'password' }, function() {
                window.location.href = '/';
            });
        }).error(function(data) {
            $scope.message = data[0];
            $state.go('/login');
        });
    };



    // action="/api/login" method="post"

}]);
