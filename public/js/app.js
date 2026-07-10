var app = angular.module('mcrrcApp', ['mcrrcApp.members', 'mcrrcApp.results', 'mcrrcApp.admin', 'mcrrcApp.authentication', 'mcrrcApp.tools', 'restangular', 'dialogs.main', 'ui.bootstrap', 'ui.select', 'ngSanitize', 'ui.router', 'appRoutes', 'angular-loading-bar', 'angularUtils.directives.dirPagination', 'angulartics', 'angulartics.google.analytics', 'LocalStorageModule','cgNotify']);

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

app.run(['$http', 'AuthService', 'Restangular', '$transitions', function($http, AuthService, Restangular, $transitions) {
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

    // Track user activity on page navigation
    $transitions.onSuccess({}, function() {
        if (AuthService.isLoggedIn()) {
            $http.post('/api/heartbeat');
        }
    });
}]); 

app.factory('MyCachingRestService', function(Restangular) {
    return Restangular.withConfig(function(RestangularConfigurer) {
        RestangularConfigurer.setDefaultHttpFields({cache: true});
    });
});


angular.module('mcrrcApp.results').controller('MainController', ['$scope', '$http', 'AuthService', '$state', 'ResultsService','MembersService','localStorageService', 'StatsService', function($scope, $http, AuthService, $state, ResultsService,MembersService,localStorageService, StatsService) {
    $scope.$state = $state;

    $scope.bannerStyle = {};
    $scope.bannerTitleStyle = {};
    $scope.bannerTitleTopStyle = {};
    $scope.bannerTitleBottomStyle = {};
    $scope.bannerTitleHidden = false;
    $scope.toggleBannerTitle = function() {
        $scope.bannerTitleHidden = !$scope.bannerTitleHidden;
    };
    function applyBanner(pick) {
        $scope.bannerStyle = { 'background-image': 'url("' + pick.url + '")' };
        if (pick.titleTheme) {
            var t = pick.titleTheme;
            $scope.bannerTitleStyle = {
                'background':              t.background     !== undefined ? t.background     : '',
                'backdrop-filter':         t.backdropFilter !== undefined ? t.backdropFilter : '',
                '-webkit-backdrop-filter': t.backdropFilter !== undefined ? t.backdropFilter : '',
            };
            $scope.bannerTitleTopStyle    = { 'color': t.topColor    || '', 'text-shadow': t.textShadow !== undefined ? t.textShadow : '' };
            $scope.bannerTitleBottomStyle = { 'color': t.bottomColor || '', 'text-shadow': t.textShadow !== undefined ? t.textShadow : '' };
        }
        $scope.bannerCopyright      = pick.copyright || null;
        $scope.bannerCopyrightStyle = (pick.copyright && pick.copyright.color) ? { color: pick.copyright.color } : {};
    }

    var _now = new Date();
    var _localDate = _now.getFullYear() + '-' + String(_now.getMonth() + 1).padStart(2, '0') + '-' + String(_now.getDate()).padStart(2, '0');
    $http.get('/api/banners', { params: { date: _localDate } }).then(function(resp) {
        var banners = resp.data || [];
        if (!banners.length) return;
        applyBanner(banners[0]);
    });

    $scope.$on('banner:preview', function(evt, pick) {
        applyBanner(pick);
    });


    $scope.currentYear = new Date().getFullYear();

    StatsService.getStats($scope.currentYear).then(function(stats) {
        $scope.milesRaced = stats.basicStats.milesRaced;
    });


        var birthdayParams = {
            "filters[dateofbirth]": moment().format('LLL'),//birthday today
            "filters[memberStatus]": 'current',
            sort: 'dateofbirth'
        };

        MembersService.getMembersWithCacheSupport(birthdayParams).then(function(members) {
            $scope.birthdays = members;
        });


    //load result in cache
    // ResultsService.getResultsWithCacheSupport({
    //     "sort": '-race.racedate -race.order race.racename time ranking.overallrank members.firstname',
    //     "preload":false
    // }).then(function(results) {
    //     // console.log('return res in app.js', results);
    // });

    $scope.logout = function() {
        window.location.href = '/logout';
    };

}]);
