angular.module('mcrrcApp.members').controller('MembersController', ['$scope', '$http', 'AuthService', 'MembersService', 'ResultsService', 'dialogs', function($scope, $http, AuthService, MembersService, ResultsService, dialogs) {

    $scope.user = AuthService.isLoggedIn();

    // var members = Restangular.all('members');

    $scope.membersList = [];
    $scope.query = "";

    // =====================================
    // FILTER PARAMS CONFIG ================
    // =====================================
    $scope.paramModel = {};
    $scope.paramModel.sex = '.*';
    $scope.paramModel.category = '.*';
    $scope.paramModel.limit = '';
    $scope.paramModel.memberStatus = 'current';

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

    $scope.showAddMemberModal = function() {
        MembersService.showAddMemberModal().then(function(member) {
            if (member !== null) {
                $scope.membersList.push(member);
            }
        });
    };

    // select a member after checking it
    $scope.retrieveMemberForEdit = function(member) {
        MembersService.retrieveMemberForEdit(member).then(function() {});
    };


    $scope.removeMember = function(member) {
        var dlg = dialogs.confirm();
        dlg.result.then(function(btn) {
            MembersService.deleteMember(member).then(function() {
                var index = $scope.membersList.indexOf(member);
                if (index > -1) $scope.membersList.splice(index, 1);
            });
        }, function(btn) {});
    };

    // set the current member to the display panel
    $scope.setMember = function(member) {
        ResultsService.getResults({
            limit: 20,
            sort: '-racedate',
            member: member
        }).then(function(results) {
            $scope.currentMemberResultList = results;
        });
        $scope.currentMember = member;

    };

    $scope.getMembers = function() {
        var params = {
            "filters[sex]": $scope.paramModel.sex,
            "filters[category]": $scope.paramModel.category,
            "filters[memberStatus]": $scope.paramModel.memberStatus,
            limit: $scope.paramModel.limit
        };

        MembersService.getMembers(params).then(function(members) {
            $scope.membersList = members;
        });
    };

    $scope.retrieveResultForEdit = function(result) {
        ResultsService.retrieveResultForEdit(result).then(function(result) {});
    };




    // =====================================
    // MEMBER API CALLS ====================
    // =====================================

    // $scope.user = data.user;
    // when landing on the page, get all members and show them

    // get all members
    var defaultParams = {
        "filters[sex]": $scope.paramModel.sex,
        "filters[category]": $scope.paramModel.category,
        "filters[memberStatus]": $scope.paramModel.memberStatus,
        limit: $scope.paramModel.limit
    };

    MembersService.getMembers(defaultParams).then(function(members) {
        $scope.membersList = members;
    });



}]);


angular.module('mcrrcApp.members').controller('MemberModalInstanceController', ['$scope', '$modalInstance', 'member', function($scope, $modalInstance, member) {
    $scope.editmode = false;
    if (member) {
        $scope.formData = member;
        $scope.editmode = true;
    } else {
        $scope.formData = {memberStatus:true};
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
