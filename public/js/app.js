var app = angular.module('mcrrcApp', ['mcrrcApp.members', 'mcrrcApp.results', 'mcrrcApp.admin', 'mcrrcApp.authentication', 'restangular', 'dialogs.main', 'ui.bootstrap', 'ui.select', 'ngSanitize', 'ui.router', 'appRoutes', 'angular-loading-bar', 'angularUtils.directives.dirPagination', 'angulartics', 'angulartics.google.analytics', 'LocalStorageModule']);

var membersModule = angular.module('mcrrcApp.members', []);
var resultsModule = angular.module('mcrrcApp.results', []);
var adminModule = angular.module('mcrrcApp.admin', []);
var authenticationModule = angular.module('mcrrcApp.authentication', []);

app.config(function(paginationTemplateProvider) {
    paginationTemplateProvider.setPath('views/templates/dirPagination.tpl.html');

});

app.config(function(localStorageServiceProvider) {
    localStorageServiceProvider.setPrefix('mcrrcApp');
});

app.run(['$http', 'AuthService', 'Restangular', function($http, AuthService, Restangular) {
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

app.factory('MyCachingRestService', function(Restangular) {
    return Restangular.withConfig(function(RestangularConfigurer) {
        RestangularConfigurer.setDefaultHttpFields({cache: true});
    });
});


angular.module('mcrrcApp.results').controller('MainController', ['$scope', 'AuthService', '$state', 'ResultsService', function($scope, AuthService, $state, ResultsService) {
    $scope.$state = $state;

    var navBackGround = ["navimg-2", "navimg-3"];
    var navBackGroundCR = ['<a href="http://www.mcrrcphotos.com/2017-Photos/Race-Photos/Piece-of-Cake-10K5K/Piece-of-Cake-10K5K-BButters/i-5hgMqmQ/A" target="_blank" title="Photo by B.Butters at Piece of Cake 10K 2017">© B.Butters</a>','<a href="https://www.facebook.com/pg/gburgmd/photos/?tab=album&album_id=10154376948800741" target="_blank" title="Photo by the City of Gaithersburg at La Milla de Mayo 2017">© City of Gaithersburg</a>'];
    var random = Math.floor(Math.random() * navBackGround.length );
    $scope.getbg = navBackGround[random];
    $scope.getcr = navBackGroundCR[random];


    var currentYear = new Date().getFullYear();
    var fromDate = new Date(Date.UTC(currentYear, 0, 1)).getTime();
    var toDate = new Date().getTime();

    ResultsService.getMilesRaced({
        "filters": {
            "dateFrom": fromDate,
            "dateTo": toDate
        }
    }).then(function(result) {
        $scope.milesRaced = parseFloat(result.milesRaced).toFixed(2);
        $scope.currentYear = new Date().getFullYear();
    });

    //load result in cache
    ResultsService.getResultsWithCacheSupport({
        "sort": '-race.racedate race.racename time'
    }).then(function(results) {});


}]);
