angular.module('mcrrcApp.authentication').controller('ForgotPasswordController', ['$scope', '$http', function($scope, $http) {

    $scope.success = false;

    $scope.requestReset = function(email) {
        $http.post('/api/forgot', { email: email }).success(function(data) {
            $scope.message = data.message;
            $scope.success = true;
        }).error(function(data) {
            $scope.message = (data && data.message) || 'An error occurred. Please try again.';
            $scope.success = false;
        });
    };

}]);
