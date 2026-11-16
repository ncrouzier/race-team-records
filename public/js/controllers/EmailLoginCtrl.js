angular.module('mcrrcApp.authentication').controller('EmailLoginController', ['$scope', '$http', '$location', 'AuthService', 'Analytics', function ($scope, $http, $location, AuthService, Analytics) {

    $scope.success = false;
    $scope.login = { email: '', code: '' };

    // Set when arriving via a link like /email-login?returnTo=/form/xyz (e.g.
    // an expired comp-form magic link) so the reissued link sends the user
    // back to where they started instead of the homepage.
    var returnTo = $location.search().returnTo || null;

    // Only a same-site relative path (as in MagicLoginCtrl.js)
    function isSafeReturnPath(path) {
        return typeof path === 'string' && /^\/(?!\/)/.test(path);
    }

    $scope.requestLink = function (email) {
        $http.post('/api/login/magic', { email: email, returnTo: returnTo }).success(function (data) {
            $scope.message = data.message;
            $scope.success = true;
            $scope.codeError = '';
        }).error(function (data) {
            $scope.message = (data && data.message) || 'An error occurred. Please try again.';
            $scope.success = false;
        });
    };

    // The code in the same email: for where the link would open in another
    // browser (the site saved to an iPhone's home screen), app/loginCodes.js
    $scope.submitCode = function () {
        $scope.codeError = '';
        $scope.checking = true;
        $http.post('/api/login/magic-code', { email: $scope.login.email, code: $scope.login.code }).success(function (data) {
            AuthService.setUser(data.user);
            Analytics.eventThen('login', { method: 'email_code' }, function () {
                window.location.href = isSafeReturnPath(returnTo) ? returnTo : '/';
            });
        }).error(function (data) {
            $scope.checking = false;
            $scope.codeError = (data && data.message) || 'This code did not work. Please try again.';
            // Cancelled after too many tries: back to asking for a new email
            if (data && data.cancelled) {
                $scope.success = false;
                $scope.message = '';
                $scope.login.code = '';
            }
        });
    };

}]);
