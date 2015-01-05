angular.module('TeamCtrl', []).controller('TeamController', function($scope, $http) {

	$scope.formData = {};


	// =====================================
    // DATE PICKER CONFIG ==================
    // =====================================
	$scope.today = function() {
		$scope.formData.dateofbirth = new Date();
	};
	$scope.today();

	$scope.open = function($event) {
		$event.preventDefault();
		$event.stopPropagation();
		$scope.opened = true;
	};


	// =====================================
	// MEMBER API CALLS ====================
	// =====================================
    // when landing on the page, get all members and show them
    $http.get('/api/members')
        .success(function(data) {
            $scope.members = data.members;
            $scope.user = data.user;
            console.log(data);
        })
        .error(function(data) {
            console.log('Error: ' + data);
        });

    // when submitting the add form, send the text to the node API
    $scope.createMember = function() {
        $http.post('/api/members', $scope.formData)
            .success(function(data) {
                $scope.formData = {}; // clear the form so our user is ready to enter another
                $scope.members = data;
                console.log(data);
            })
            .error(function(data) {
                console.log('Error: ' + data);
            });
    };

    // delete a member after checking it
    $scope.deleteMember = function(id) {
        $http.delete('/api/members/' + id)
            .success(function(data) {
                $scope.members = data;
                console.log(data);
            })
            .error(function(data) {
                console.log('Error: ' + data);
            });
    };

    // delete a member after checking it
    $scope.setMember = function(member) {
        $scope.currentMember = member;
    };
	
});