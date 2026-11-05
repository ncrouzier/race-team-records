angular.module('mcrrcApp.authentication').controller('SignUpController', ['$scope', '$http', '$state', 'Analytics', function($scope, $http, $state, Analytics) {

    $scope.success = false;

    $scope.signup = function(user) {
        $http.post("/api/signup", user).success(function(data) {
            $scope.message = '';
            $scope.success = true;
            $scope.successMessage = data.message;
            // Same event as the race form page's sign-up
            Analytics.event('sign_up', { method: 'password', page: 'signup' });
        }).error(function(data) {
            $scope.message = data[0] || (data && data.message) || 'An error occurred.';
            $scope.success = false;
        });
    };

}]);