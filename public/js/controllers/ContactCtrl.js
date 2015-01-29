angular.module('mcrrcApp.admin').controller('ContactController', ['$scope', '$http','AuthService', function($scope, $http, AuthService) {
    $scope.success = false;
    $scope.error = false;
    $scope.send = function() {

        $http({
            url: 'sendEmail',
            method: 'POST',
            data: {
                'name': $scope.user.name,
                'from': $scope.user.email,
                'body': $scope.user.email +'  '+$scope.user.body,
                'subject': 'MCRRC race team contact'
            }
        }).
        success(function(data) {
            $scope.success = true;
        }).
        error(function(data) {
            $scope.error = true;
        });
    };

}]);
