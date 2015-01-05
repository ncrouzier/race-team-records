angular.module('SignUpCtrl', []).controller('SignUpController', function($scope,$http) {

	$scope.tagline = 'Nothing beats a pocket protector!';	
    $http({
        url: '/api/signup', 
        method: 'GET', 
    }).success(function(data) {
		$scope.message = data.message;
        console.log(data.message);
    });

});