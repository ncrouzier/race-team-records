angular.module('mcrrcApp.authentication').controller('SignUpController', function($scope,$http,$state) {

	$scope.signup = function (user) {

		$http.post("/api/signup", user).success(function (data, status) {
			window.location.href = '/';
		}).error(function (data) {
			$scope.message = data[0];
			$state.go('/signup'); 
		});
	};
});