angular.module('mcrrcApp.authentication').controller('ResetPasswordController', ['$scope', '$http', '$stateParams', function($scope, $http, $stateParams) {

    $scope.success = false;
    $scope.tokenExpired = false;
    var token = $stateParams.token;

    // Validate token on page load
    $http.get('/api/reset/' + token).success(function(data) {
        // Token is valid, show the form
    }).error(function(data) {
        $scope.tokenExpired = true;
        $scope.message = (data && data.message) || 'Invalid or expired token.';
    });

    $scope.resetPassword = function() {
        if ($scope.newPassword !== $scope.confirmPassword) {
            $scope.message = 'Passwords do not match.';
            return;
        }

        $http.post('/api/reset/' + token, { password: $scope.newPassword }).success(function(data) {
            $scope.message = data.message;
            $scope.success = true;
        }).error(function(data) {
            $scope.message = (data && data.message) || 'An error occurred. Please try again.';
            if (data && data.message && data.message.indexOf('expired') !== -1) {
                $scope.tokenExpired = true;
            }
        });
    };

}]);
