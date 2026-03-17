angular.module('mcrrcApp.authentication').controller('SignUpController', ['$scope', '$http', '$state', function($scope, $http, $state) {

    $scope.success = false;

    $scope.signup = function(user) {
        $http.post("/api/signup", user).success(function(data) {
            $scope.message = '';
            $scope.success = true;
            $scope.successMessage = data.message;
        }).error(function(data) {
            $scope.message = data[0] || (data && data.message) || 'An error occurred.';
            $scope.success = false;
        });
    };

}]);