var app = angular.module('mcrrcApp', [ 'mcrrcApp.services','mcrrcApp.controllers','restangular', 'ui.bootstrap','ui.grid','ui.select','ngSanitize', 'ui.router', 'appRoutes']);

var services = angular.module('mcrrcApp.services',[]);
var controllers = angular.module('mcrrcApp.controllers',[]);

app.run(['$http', 'AuthService','Restangular', function($http, AuthService,Restangular) {
    Restangular.setBaseUrl('/api/');
    Restangular.setRestangularFields({
      id: "_id"
    });

    $http.get("/api/login").success(function(data, status) {
        AuthService.setUser(data.user);
    }).error(function(data) {
        $scope.message = data[0];
        $state.go('/login');
    });
}]);


