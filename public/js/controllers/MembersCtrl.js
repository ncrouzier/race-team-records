angular.module('mcrrcApp.members').controller('MembersController', ['$scope', '$location','$timeout','$state','$stateParams','$http', '$analytics', 'AuthService', 'MembersService', 'ResultsService', 'dialogs', function($scope, $location,$timeout, $state, $stateParams, $http, $analytics, AuthService, MembersService, ResultsService, dialogs) {

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

    $scope.showAddMemberModal = function(resultSource) {
        MembersService.showAddMemberModal(resultSource).then(function(member) {
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

    $scope.onSelectMember = function(item,model){
        $scope.setMember(model);
    };

    // set the current member to the display panel
    $scope.setMember = function(member) {
        ResultsService.getResults({
            sort: '-race.racedate',
            member: member
        }).then(function(results) {
            $scope.currentMemberResultList = results;
        });
        $scope.currentMember = member;

        MembersService.getMemberPbs(member).then(function(results) {
            $scope.currentMemberPbsList = results;
        });

        $state.current.reloadOnSearch = false;
        $location.search('member', member.firstname + member.lastname);
        $timeout(function () {
          $state.current.reloadOnSearch = undefined;
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
            sort: 'firstname',
            limit: $scope.paramModel.limit
        };

        MembersService.getMembers(params).then(function(members) {
            $scope.membersList = members;
        });
    };

    $scope.retrieveResultForEdit = function(result) {
        ResultsService.retrieveResultForEdit(result).then(function(result) {});
    };


    $scope.removeResult = function(result) {
        var dlg = dialogs.confirm("Remove Result?","Are you sure you want to remove this result?");
        dlg.result.then(function(btn) {
            ResultsService.deleteResult(result).then(function() {
                var index = $scope.currentMemberResultList.indexOf(result);
                if (index > -1) $scope.currentMemberResultList.splice(index, 1);
            });
        }, function(btn) {});
    };

    // =====================================
    // MEMBER API CALLS ====================
    // =====================================

    // $scope.user = data.user;
    // when landing on the page, get all members and show them

    // get all members
    if($stateParams.member){
        $scope.paramModel.memberStatus = 'all';
    }

    var defaultParams = {
        "filters[sex]": $scope.paramModel.sex,
        "filters[category]": $scope.paramModel.category,
        "filters[memberStatus]": $scope.paramModel.memberStatus,
        sort: 'firstname',
        limit: $scope.paramModel.limit
    };

    MembersService.getMembers(defaultParams).then(function(members) {
        $scope.membersList = members;

        if($stateParams.member){
            for (i = 0; i < $scope.membersList.length; i++) {
                if (($scope.membersList[i].firstname+$scope.membersList[i].lastname).toUpperCase() === ($stateParams.member).toUpperCase()){
                    $scope.setMember($scope.membersList[i]);
                }
            }
        }
    });

    $scope.showRaceModal = function(result) {
        ResultsService.showRaceFromResultModal(result).then(function(result) {
        });
    };

    $scope.showResultDetailsModal = function(result) {
        ResultsService.showResultDetailsModal(result).then(function(result) {});
    };

}]);


angular.module('mcrrcApp.members').controller('MemberModalInstanceController', ['$scope', '$uibModalInstance', '$filter', 'member', function($scope, $uibModalInstance, $filter, member) {

    // make sure dates are always UTC
    $scope.$watch('formData.dateofbirth ', function(date) {
      $scope.formData.dateofbirth = $filter('date')($scope.formData.dateofbirth, 'yyyy-MM-dd', 'UTC');
    });

    $scope.$watch('formData.addMembershipDates', function(date) {
      if ($scope.formData.membershipDates){
        for (i=0;i<$scope.formData.membershipDates.length;i++) {
            $scope.formData.membershipDates[i].start = $filter('date')($scope.formData.membershipDates[i].start, 'yyyy-MM-dd', 'UTC');
            $scope.formData.membershipDates[i].end = $filter('date')($scope.formData.membershipDates[i].end, 'yyyy-MM-dd', 'UTC');
        }
      }

    });



    $scope.editmode = false;
    if (member) {
        $scope.formData = member; 
        $scope.editmode = true;
    } else {
        $scope.formData = {};
        $scope.formData.memberStatus = 'current';
        $scope.formData.dateofbirth = new Date($filter('date')(new Date().setHours(0,0,0,0), 'yyyy-MM-dd', 'UTC'));
        $scope.editmode = false;
    }


    $scope.addMembershipDates = function(){
      if (!$scope.formData.membershipDates){
        $scope.formData.membershipDates = [];
      }
      $scope.formData.membershipDates.push({start:new Date($filter('date')(new Date().setHours(0,0,0,0), "yyyy-MM-dd", 'UTC')), end:new Date($filter('date')(new Date().setHours(0,0,0,0), "yyyy-MM-dd", 'UTC'))});
    };



    $scope.addMember = function() {
        $uibModalInstance.close($scope.formData);
    };

    $scope.editMember = function() {
        $uibModalInstance.close($scope.formData);
    };

    $scope.cancel = function() {
        $uibModalInstance.dismiss('cancel');
    };

    // =====================================
    // DATE PICKER CONFIG ==================
    // =====================================
    $scope.open = function($event) {
        $event.preventDefault();
        $event.stopPropagation();

        $scope.opened = true;
    };

    $scope.openedMembershipStartDatePickers = [];
    $scope.openStartDatePicker = function($event, index) {
        $event.preventDefault();
        $event.stopPropagation();

        for (i=0;i<$scope.openedMembershipStartDatePickers.length;i++) {
            $scope.openedMembershipStartDatePickers[i] = false;
        }
        $scope.openedMembershipStartDatePickers[index] = true;
    };

    $scope.openedMembershipEndDatePickers = [];
    $scope.openEndDatePicker = function($event, index) {
        $event.preventDefault();
        $event.stopPropagation();

        for (i=0;i<$scope.openedMembershipEndDatePickers.length;i++) {
            $scope.openedMembershipEndDatePickers[i] = false;
        }
        $scope.openedMembershipEndDatePickers[index] = true;
    };


}]);
