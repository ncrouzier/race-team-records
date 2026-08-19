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

// The server piggybacks the current unseen-activity-log count onto every
// /api/* response for a logged-in admin, as an X-Unseen-Activity-Count
// header (see server.js) — this interceptor is what actually keeps
// $rootScope.unseenActivityCount live from that, no matter which request
// happened to carry it.
app.config(['$httpProvider', function($httpProvider) {
    $httpProvider.interceptors.push(['$rootScope', function($rootScope) {
        return {
            response: function(response) {
                var header = response.headers('X-Unseen-Activity-Count');
                if (header !== null && header !== undefined) {
                    $rootScope.unseenActivityCount = parseInt(header, 10) || 0;
                }
                return response;
            }
        };
    }]);
}]);

app.run(['$http', '$rootScope', '$interval', 'AuthService', 'Restangular', '$transitions', 'ActivityLogService', function($http, $rootScope, $interval, AuthService, Restangular, $transitions, ActivityLogService) {
    Restangular.setBaseUrl('/api/');
    Restangular.setRestangularFields({
        id: "_id"
    });

    // Lives on $rootScope (rather than a per-controller $scope) so the nav
    // badge and the Activity Log page itself share one live value — marking
    // logs as seen from either place clears the dot everywhere immediately.
    $rootScope.unseenActivityCount = 0;

    $rootScope.markActivityLogsSeen = function() {
        ActivityLogService.markAllSeen().then(function() {
            $rootScope.unseenActivityCount = 0;
        });
    };

    $http.get("/api/login").success(function(data, status) {
        AuthService.setUser(data.user);
    }).error(function(data) {
        $scope.message = data[0];
        $state.go('/login');
    });

    function pingHeartbeat() {
        if (AuthService.isLoggedIn()) {
            $http.post('/api/heartbeat');
        }
    }

    // Track user activity on page navigation — also doubles as the ambient
    // carrier for the unseen-activity header above.
    $transitions.onSuccess({}, pingHeartbeat);

    // An admin who stays on one page for a while won't trigger a
    // navigation-driven heartbeat, so ping periodically too — same purpose
    // as before, just no longer a dedicated count-fetching endpoint.
    $interval(pingHeartbeat, 60000);
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
