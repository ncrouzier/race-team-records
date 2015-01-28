var app = angular.module('mcrrcApp', ['mcrrcApp.members','mcrrcApp.results','mcrrcApp.authentication','restangular','dialogs.main', 'ui.bootstrap','ui.select','ngSanitize', 'ui.router', 'appRoutes' ,'angular-loading-bar','angularUtils.directives.dirPagination','angulartics', 'angulartics.google.analytics']);

var membersModule = angular.module('mcrrcApp.members',[]);
var resultsModule = angular.module('mcrrcApp.results',[]);
var authenticationModule = angular.module('mcrrcApp.authentication',[]);

app.config(function(paginationTemplateProvider) {
    paginationTemplateProvider.setPath('views/templates/dirPagination.tpl.html');

});


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
