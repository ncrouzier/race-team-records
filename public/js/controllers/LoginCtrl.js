angular.module('LoginCtrl', []).controller('LoginController', function($scope,$http,$state) {

	$scope.tagline = 'Nothing beats a pocket protector!';	
    $http({
        url: '/api/login', 
        method: 'GET', 
    }).success(function(data) {
		$scope.message = data.message;
    });

	$scope.login = function (user) {
		$http.post("/api/login", user).success(function (data, status) {
			window.location.href = '/';
      }).error(function (data) {
			$scope.message = data[0];
			$state.go('/login'); 
      });
  };



    // action="/api/login" method="post"

});