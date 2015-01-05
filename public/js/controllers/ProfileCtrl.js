angular.module('ProfileCtrl', []).controller('ProfileController', function($scope,$http,$state) {

	$scope.tagline = 'Nothing beats a pocket protector!';	

    $http({
        url: '/api/profile', 
        method: 'GET', 
    }).success(function(data) {
      console.log(data);
		  $scope.user = data.user;
    });

	$scope.login = function (user) {
		console.log(user);
		$http.post("/api/login", user).success(function (data, status) {
          console.log('Successful login.');
          console.log('data = ' + data); 
          console.log('status = ' + status); 
          $state.go('/profile'); // 
      }).error(function (data) {
          console.log('Error: ' + data);
          $state.go('/login'); 
      });
  };


  
    // action="/api/login" method="post"

});