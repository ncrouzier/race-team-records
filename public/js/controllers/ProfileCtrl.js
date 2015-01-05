angular.module('ProfileCtrl', []).controller('ProfileController', function($scope,$http,$state) {


    $http({
        url: '/api/profile', 
        method: 'GET', 
    }).success(function(data) {
		  $scope.user = data.user;
    });



  
    // action="/api/login" method="post"

});