angular.module('mcrrcApp.controllers').controller('TeamController', ['$scope', '$http', '$modal', 'Restangular', 'AuthService', 'UtilsService', function($scope, $http, $modal, Restangular, AuthService, UtilsService) {

    $scope.user = AuthService.isLoggedIn();

    var members = Restangular.all('members');

    $scope.membersList = [];


    // =====================================
    // FILTER PARAMS CONFIG ==================
    // =====================================
    $scope.paramModel ={};
    $scope.paramModel.sex = '.*';
    $scope.paramModel.category = '.*';

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
                templateUrl: 'memberModal.html',
                controller: 'MemberModalInstanceCtrl',
                size: 'lg',
                resolve: {
                    member: function() {
                        return member;
                    }
                }
            });

            modalInstance.result.then(function(member) {
                $scope.editMember(member);
            }, function() {
                //cancel
            });
        }
    };

    $scope.showAddMemberModal = function() {
        var modalInstance = $modal.open({
            templateUrl: 'memberModal.html',
            controller: 'MemberModalInstanceCtrl',
            size: 'lg',
            resolve: {
                member: false
            }
        });

        modalInstance.result.then(function(member) {
            $scope.createMember(member);
        }, function() {
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

    // get all members
    $scope.getMembers = function() {
        var params = {
        "filters[sex]": $scope.paramModel.sex,
        "filters[category]": $scope.paramModel.category,
        limit: 10
        };
        members.getList(params).then(function(members) {
            $scope.membersList =  members;
        });
    };


    var defaultParams = {
        "filters[sex]": $scope.paramModel.sex,
        "filters[category]": $scope.paramModel.category,
        limit: 10
    };

    members.getList(defaultParams).then(function(members) {
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
                $scope.membersList.push(member);
            },
            function(res) {
                console.log('Error: ' + res.status);
            });
    };

    // when submitting the add form, send the text to the node API
    $scope.editMember = function(member) {
        member.save();
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


angular.module('mcrrcApp.controllers').controller('MemberModalInstanceCtrl', ['$scope', '$modalInstance', 'member', function($scope, $modalInstance, member) {
    $scope.editmode = false;
    if (member) {
        $scope.formData = member;
        $scope.editmode = true;
    } else {
        $scope.formData = {};
        $scope.editmode = false;
        $scope.formData.dateofbirth = new Date();
    }


    $scope.addMember = function() {
        $modalInstance.close($scope.formData);
    };

    $scope.editMember = function() {
        $modalInstance.close($scope.formData);
    };

    $scope.cancel = function() {
        $modalInstance.dismiss('cancel');
    };

    // =====================================
    // DATE PICKER CONFIG ==================
    // =====================================
    $scope.open = function($event) {
        $event.preventDefault();
        $event.stopPropagation();

        $scope.opened = true;
    };

}]);
