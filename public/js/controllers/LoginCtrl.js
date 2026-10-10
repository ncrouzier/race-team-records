angular.module('mcrrcApp.authentication').controller('LoginController',['$scope','$http','$state','AuthService','localStorageService','Analytics','$location', function($scope, $http, $state, AuthService,localStorageService,Analytics,$location) {

    $http({
        url: '/api/login',
        method: 'GET',
    }).success(function(data) {
        $scope.message = data.message;
    });

    // Where to go after logging in, e.g. /login?returnTo=/pages/handbook when a
    // members-only page sent the visitor here. Only a path on this site (not
    // "//elsewhere.com"), as with the email login link.
    var returnTo = $location.search().returnTo;
    if (typeof returnTo !== 'string' || !/^\/(?!\/)/.test(returnTo)) returnTo = null;
    // The email-link option keeps the same destination
    $scope.emailLoginHref = '/email-login' + (returnTo ? '?returnTo=' + encodeURIComponent(returnTo) : '');

    $scope.login = function(user) {
        $http.post("/api/login", user).success(function(data, status) {
            AuthService.setUser(data.user);
            Analytics.eventThen('login', { method: 'password' }, function() {
                window.location.href = returnTo || '/';
            });
        }).error(function(data) {
            $scope.message = data[0];
            $state.go('/login');
        });
    };



    // action="/api/login" method="post"

}]);
