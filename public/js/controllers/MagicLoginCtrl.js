angular.module('mcrrcApp.authentication').controller('MagicLoginController', ['$scope', '$http', '$location', '$stateParams', 'AuthService', function ($scope, $http, $location, $stateParams, AuthService) {

    // Deliberately does NOT auto-submit on load — the token is single-use, and
    // an email-security link scanner that pre-fetches this page would burn it
    // before the real user clicks. Logging in requires an explicit click.
    $scope.token = $stateParams.token;
    $scope.working = false;
    $scope.failed = false;
    $scope.message = '';
    // Carried through to the "request a new link" fallback so an expired
    // link doesn't strand the user away from wherever they started.
    $scope.returnTo = $location.search().returnTo || '';

    // Only a same-site relative path is trusted here, same rule the server
    // applies when it builds the emailed link — a query param is user
    // input, so re-validate before using it to redirect.
    function isSafeReturnPath(path) {
        return typeof path === 'string' && /^\/(?!\/)/.test(path);
    }

    $scope.completeLogin = function () {
        $scope.working = true;
        $http.post('/api/login/magic/' + $scope.token).success(function (data) {
            AuthService.setUser(data.user);
            var returnTo = $location.search().returnTo;
            window.location.href = isSafeReturnPath(returnTo) ? returnTo : '/';
        }).error(function (data) {
            $scope.working = false;
            $scope.failed = true;
            $scope.message = (data && data.message) || 'This login link is invalid or has expired.';
        });
    };

}]);
