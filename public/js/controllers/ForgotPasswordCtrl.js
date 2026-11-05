angular.module('mcrrcApp.authentication').controller('ForgotPasswordController', ['$scope', '$http', 'Analytics', function($scope, $http, Analytics) {

    $scope.success = false;

    $scope.requestReset = function(email) {
        $http.post('/api/forgot', { email: email }).success(function(data) {
            $scope.message = data.message;
            $scope.success = true;
            Analytics.event('password_reset_request');
        }).error(function(data) {
            $scope.message = (data && data.message) || 'An error occurred. Please try again.';
            $scope.success = false;
        });
    };

}]);
