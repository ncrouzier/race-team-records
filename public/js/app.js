var app = angular.module('mcrrcApp', ['mcrrcApp.members', 'mcrrcApp.results', 'mcrrcApp.admin', 'mcrrcApp.authentication', 'mcrrcApp.tools', 'restangular', 'dialogs.main', 'ui.bootstrap', 'ui.select', 'ngSanitize', 'ui.router', 'appRoutes', 'angular-loading-bar', 'angularUtils.directives.dirPagination', 'angulartics', 'angulartics.google.analytics', 'LocalStorageModule']);

var membersModule = angular.module('mcrrcApp.members', []);
var resultsModule = angular.module('mcrrcApp.results', []);
var toolsModule = angular.module('mcrrcApp.tools', []);
var adminModule = angular.module('mcrrcApp.admin', []);
var authenticationModule = angular.module('mcrrcApp.authentication', []);

app.config(function(paginationTemplateProvider) {
    paginationTemplateProvider.setPath('views/templates/dirPagination.tpl.html');
});

app.config(function(localStorageServiceProvider) {
    localStorageServiceProvider.setStorageType('localStorage');
    localStorageServiceProvider.setDefaultToCookie(false);
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


angular.module('mcrrcApp.results').controller('MainController', ['$scope', 'AuthService', '$state', 'ResultsService','MembersService', function($scope, AuthService, $state, ResultsService,MembersService) {
    $scope.$state = $state;

    var navBackGround = ["navimg-2", "navimg-3","navimg-4","navimg-5","navimg-6","navimg-7","navimg-8" ];
    var navBackGroundCR = ['<a href="http://www.mcrrcphotos.com/2017-Photos/Race-Photos/Piece-of-Cake-10K5K/Piece-of-Cake-10K5K-BButters/i-5hgMqmQ/A" target="_blank" title="Photo by B.Butters at Piece of Cake 10K 2017">© B.Butters</a>',
    '<a href="https://www.facebook.com/pg/gburgmd/photos/?tab=album&album_id=10154376948800741" target="_blank" title="Photo by the City of Gaithersburg at La Milla de Mayo 2017">© City of Gaithersburg</a>',
    '<a href="https://www.mcrrcphotos.com/2019-Photos/Race-Photos/Going-Green-Track-Meet-/Going-Green-Track-Meet-DReichmann/i-MVnQgnh/A" target="_blank" title="Photo by D.Reichmann at Going Green Track Meet 2019">© D.Reichmann</a>',
    '<a href="https://www.mcrrcphotos.com/2018-Photos/Race-Photos/Midsummer-Nights-Mile-DReichmann/i-8rB2WKf/A" target="_blank" title="Photo by D.Reichmann at Midsummer Night\'s Mile 2018">© D.Reichmann</a>',
    '<a href="https://www.instagram.com/dwhitphoto/" target="_blank" title="Photo by Dustin Whitlow at Army 10 Miler 2018">© Dustin Whitlow</a>',
    '<a href="https://www.mcrrcphotos.com/2021-Photos/Race-Photos/Rileys-Rumble-Half-Marathon/Rileys-Rumble-Half-Marathon-DReichmann/i-w62wjJL/A" target="_blank" title="Photo by D.Reichmann at Riley\'s Rumble Half Marathon 2021">© D.Reichmann</a>',
    '<a href="https://www.mile90.com/Race-Photos/2021-Race-Events/Bighorn-Trail-Run-2021/On-Course/100-Mile/Dry-Fork-Inbound/i-S8WpdHd/buy" target="_blank" title="Photo by Mile 90 Photography at BigHorn 100 2021">© Mile 90 Photography</a>'];
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


        var birthdayParams = {
            "filters[dateofbirth]": moment().format('LLL'),//birthday today
            "filters[memberStatus]": 'current',
            sort: 'dateofbirth'
        };

        MembersService.getMembers(birthdayParams).then(function(members) {
            $scope.birthdays = members;
        });



    //load result in cache
    ResultsService.getResultsWithCacheSupport({
        "sort": '-race.racedate -race.order race.racename time members.firstname',
        "preload":false
    }).then(function(results) {
        // console.log('return res in app.js', results);
    });


}]);
