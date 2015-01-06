angular.module('TeamCtrl', []).controller('TeamController', ['$scope', '$http', 'Restangular', function($scope, $http, Restangular) {

    Restangular.setBaseUrl('/api/');
    var members = Restangular.all('members');

    $scope.formData = {};
    $scope.membersList = [];

    // =====================================
    // ADMIN CONFIG ==================
    // =====================================
    $scope.adminDivisCollapsed = true;
    $scope.adminEditMode = false; //edit or add

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
    // ADMIN OPTIONS ====================
    // =====================================

    // select a member after checking it
    $scope.retrieveMemberForEdit = function(id) {
        $http.get('/api/members/' + id)
            .success(function(member) {
                if (member) {
                    $scope.formData = member;
                    $scope.adminEditMode = true;
                    $scope.adminDivisCollapsed = false;
                }
            })
            .error(function(data) {
                console.log('Error: ' + data);
            });
    };


    // set the current member to the display panel
    $scope.setMember = function(member) {
        $scope.currentMember = member;
        $scope.getMember(member._id);
    };

    // =====================================
    // MEMBER API CALLS ====================
    // =====================================

    $scope.user = data.user;
    // when landing on the page, get all members and show them
    Restangular.all('members').getList().then(function(members) {
        $scope.membersList = members;
    });

    // select a member after checking it
    $scope.getMember = function(id) {
        return Restangular.one('members', id).get().then(
            function(member) {
                return member;
            },
            function(res) {
                console.log('Error: ' + res.status);
            });
    };

    // when submitting the add form, send the text to the node API
    $scope.createMember = function() {
        members.post($scope.formData);

        // $http.post('/api/members', $scope.formData)
        //     .success(function(data) {
        //         $scope.formData = {}; // clear the form so our user is ready to enter another
        //         $scope.members = data;
        //         console.log(data);
        //     })
        //     .error(function(data) {
        //         console.log('Error: ' + data);
        //     });
        //$scope.formData.$save();
    };

    // when submitting the add form, send the text to the node API
    $scope.editMember = function() {
        console.log($scope.formData);
        // $http.post('/api/members', $scope.formData)
        //     .success(function(data) {
        //         $scope.formData = {}; // clear the form so our user is ready to enter another
        //         $scope.members = data;
        //         console.log(data);
        //     })
        //     .error(function(data) {
        //         console.log('Error: ' + data);
        //     });
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




}]);
