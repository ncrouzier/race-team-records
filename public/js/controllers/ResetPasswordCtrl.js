angular.module('mcrrcApp.authentication').controller('ResetPasswordController', ['$scope', '$http', '$stateParams', 'Analytics', function($scope, $http, $stateParams, Analytics) {

    $scope.success = false;
    $scope.tokenExpired = false;
    var token = $stateParams.token;

    // Validate token on page load
    $http.get('/api/reset/' + token).success(function(data) {
        // Token is valid, show the form
    }).error(function(data) {
        $scope.tokenExpired = true;
        $scope.message = (data && data.message) || 'Invalid or expired token.';
        Analytics.event('password_reset', { status: 'link_invalid' });
    });

    $scope.resetPassword = function() {
        if ($scope.newPassword !== $scope.confirmPassword) {
            $scope.message = 'Passwords do not match.';
            return;
        }

        $http.post('/api/reset/' + token, { password: $scope.newPassword }).success(function(data) {
            $scope.message = data.message;
            $scope.success = true;
            Analytics.event('password_reset', { status: 'done' });
        }).error(function(data) {
            $scope.message = (data && data.message) || 'An error occurred. Please try again.';
            if (data && data.message && data.message.indexOf('expired') !== -1) {
                $scope.tokenExpired = true;
            }
        });
    };

}]);
