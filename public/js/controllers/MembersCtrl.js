angular.module('mcrrcApp.members').controller('MembersController', ['$scope', '$http', '$analytics', 'AuthService', 'MembersService', 'ResultsService', 'dialogs', function($scope, $http, $analytics, AuthService, MembersService, ResultsService, dialogs) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function(user) {
        $scope.user = user;
    });
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
        var dlg = dialogs.confirm("Remove Member?", "Are you sure you want to remove this member?");
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

        MembersService.getMemberPbs(member).then(function(results) {
            $scope.currentMemberPbsList = results;
        });

        $analytics.eventTrack('viewMember', {
            category: 'Member',
            label: 'viewing member ' + member.firstname + ' ' + member.lastname
        });
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


angular.module('mcrrcApp.members').controller('MemberModalInstanceController', ['$scope', '$modalInstance', '$filter', 'member', function($scope, $modalInstance, $filter, member) {
    $scope.editmode = false;
    if (member) {
        $scope.formData = member;
        $scope.editmode = true;
    } else {
        $scope.formData = {
            memberStatus: true
        };
        $scope.editmode = false;
        $scope.formData.dateofbirth = new Date();
    }

    // make sure dates are always UTC
    $scope.$watch('formData.dateofbirth ', function(date) {
        $scope.formData.dateofbirth = $filter('date')(member.dateofbirth, 'MM/dd/yyyy', 'UTC');
    });

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
