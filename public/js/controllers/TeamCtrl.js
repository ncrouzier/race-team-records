


angular.module('TeamCtrl',[]).controller('TeamController', ['$scope', '$http', '$modal', 'Restangular', 'AuthService', function($scope, $http, $modal, Restangular, AuthService) {


    $scope.user = AuthService.isLoggedIn();


    var members = Restangular.all('members');



    
    $scope.membersList = [];

    // =====================================
    // ADMIN CONFIG ==================
    // =====================================
    $scope.adminDivisCollapsed = true;
    $scope.adminEditMode = false; //edit or add



    $scope.open = function($event) {
        $event.preventDefault();
        $event.stopPropagation();
        $scope.opened = true;
    };


    // =====================================
    // ADMIN OPTIONS ====================
    // =====================================

    // select a member after checking it
    $scope.retrieveMemberForEdit = function(member) {

        if (member) {
            var modalInstance = $modal.open({
              templateUrl: 'myModalContent.html',
              controller: 'ModalInstanceCtrl',
              size: 'lg',
              resolve: {
                member: function () {
                  return member;
                }
              }
            });

            modalInstance.result.then(function (member) {
                $scope.editMember(member);
            }, function () {
                //cancel
            });     
        }
    };

    $scope.showAddMemberModal = function() {
        var modalInstance = $modal.open({
          templateUrl: 'myModalContent.html',
          controller: 'ModalInstanceCtrl',
          size: 'lg',
          resolve: {
            member: false
          }
        });

        modalInstance.result.then(function (member) {
            $scope.createMember(member);
        }, function () {
            //cancel
        });     
    };


    // set the current member to the display panel
    $scope.setMember = function(member) {
        $scope.currentMember = member;
    };

    // =====================================
    // MEMBER API CALLS ====================
    // =====================================

    // $scope.user = data.user;
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
    $scope.createMember = function(member) {
        members.post(member).then(
            function(members) {
                $scope.membersList = members;
            },
            function(res) {
                console.log('Error: ' + res.status);
            });

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
    $scope.editMember = function(member) {
        member.save();
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
    $scope.deleteMember = function(member) {
        member.remove().then(
            function() {
                var index = $scope.membersList.indexOf(member);
                if (index > -1) $scope.membersList.splice(index, 1);
            },
            function(res) {
                console.log('Error: ' + res.status);
            });
    };


}]);


angular.module('TeamCtrl').controller('ModalInstanceCtrl', ['$scope', '$modalInstance', 'member',  function($scope, $modalInstance, member) {
    $scope.editmode =false;
    if (member){
       $scope.formData = member; 
       $scope.editmode = true;
    }else{
        $scope.formData = {};
        $scope.editmode = false;
    }
    

    // =====================================
    // DATE PICKER CONFIG ==================
    // =====================================
    $scope.today = function() {
       $scope.formData.dateofbirth = new Date();
    };
    $scope.today();

    $scope.addMember = function () {
        $modalInstance.close($scope.formData);
    };

    $scope.editMember = function () {
        $modalInstance.close($scope.formData);
    };

    $scope.cancel = function () {
        $modalInstance.dismiss('cancel');
    };
}]);
