angular.module('mcrrcApp.admin').controller('ContactController', ['$scope', '$http', function ($scope, $http) {
    $scope.success = false;
    $scope.error = false;
    $scope.sending = false;
    $scope.send = function () {
        $scope.success = false;
        $scope.error = false;
        $scope.sending = true;
        $http.post('sendEmail', {
            name: $scope.user.name,
            from: $scope.user.email,
            body: $scope.user.body
        }).then(function () {
            $scope.success = true;
            $scope.user = {};
            $scope.contactForm.$setPristine();
        }, function () {
            $scope.error = true;
        }).finally(function () {
            $scope.sending = false;
        });
    };
}]);
