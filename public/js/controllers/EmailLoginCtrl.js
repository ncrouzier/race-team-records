angular.module('mcrrcApp.authentication').controller('EmailLoginController', ['$scope', '$http', '$location', function ($scope, $http, $location) {

    $scope.success = false;

    // Set when arriving via a link like /email-login?returnTo=/form/xyz (e.g.
    // an expired comp-form magic link) so the reissued link sends the user
    // back to where they started instead of the homepage.
    var returnTo = $location.search().returnTo || null;

    $scope.requestLink = function (email) {
        $http.post('/api/login/magic', { email: email, returnTo: returnTo }).success(function (data) {
            $scope.message = data.message;
            $scope.success = true;
        }).error(function (data) {
            $scope.message = (data && data.message) || 'An error occurred. Please try again.';
            $scope.success = false;
        });
    };

}]);
