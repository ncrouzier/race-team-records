var app = angular.module('mcrrcApp', ['mcrrcApp.members','mcrrcApp.results','mcrrcApp.authentication','restangular', 'ui.bootstrap','ui.grid','ui.select','ngSanitize', 'ui.router', 'appRoutes']);

var membersModule = angular.module('mcrrcApp.members',[]);
var resultsModule = angular.module('mcrrcApp.results',[]);
var authenticationModule = angular.module('mcrrcApp.authentication',[]);
// var services = angular.module('mcrrcApp.services',[]);
// var controllers = angular.module('mcrrcApp.controllers',[]);


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



angular.module('mcrrcApp.results').controller('MainController',[ '$scope', 'AuthService', function($scope,AuthService) {

    
}]);
