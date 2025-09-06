angular.module('mcrrcApp.members').controller('MembersController', ['$scope', '$location','$timeout','$state','$stateParams','$http', '$analytics', 'AuthService', 'MembersService', 'ResultsService', 'dialogs','$filter', 'localStorageService', 'UtilsService', function($scope, $location,$timeout, $state, $stateParams, $http, $analytics, AuthService, MembersService, ResultsService, dialogs, $filter, localStorageService, UtilsService) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function(user) {
        $scope.user = user;
    });

    $scope.$watch('paramModel', function (user) {
        localStorageService.set('members.options', $scope.paramModel);
    },true);

    $scope.sortBy = function (criteria) {
        if ($scope.sortCriteria === criteria) {
            $scope.sortDirection = $scope.sortDirection === true ? false : true;
        } else {
            $scope.sortCriteria = criteria;
            $scope.sortDirection = true;
        }
        //sortDirection true = asc, false = desc
        $scope.currentMemberResultList.sort(customResultSort($scope.currentMemberResultList, $scope.sortCriteria, $scope.sortDirection));
    };

    function customResultSort(arr, field, order) {
        return (result1, result2) => {
            if (field === 'race.racedate') {
                if (result1.race.racedate < result2.race.racedate) {
                    return order === true ? -1 : 1;
                } else if (result1.race.racedate > result2.race.racedate) {
                    return order === true ? 1 : -1;
                }

                if (result1.race.order < result2.race.order) {
                    return order === true ? -1 : 1;
                } else if (result1.race.order > result2.race.order) {
                    return order === true ? 1 : -1;
                }

                if (result1.race.racename < result2.race.racename) {
                    return order === true ? -1 : 1;
                } else if (result1.race.racename > result2.race.racename) {
                    return order === true ? 1 : -1;
                }

                if (result1.time < result2.time) {
                    return order === true ? -1 : 1;
                } else if (result1.time > result2.time) {
                    return order === true ? 1 : -1;
                }

                return 0;
            }

            if (field === 'pace') {
                //if result is multisport, put at the end
                if (result1.race.isMultisport) {
                    return 1;
                }
                if (result2.race.isMultisport) {
                    return -1;
                }
                if (result1.time / result1.race.racetype.miles < result2.time / result2.race.racetype.miles) {
                    return order === true ? -1 : 1;
                } else if (result1.time / result1.race.racetype.miles > result2.time / result2.race.racetype.miles) {
                    return order === true ? 1 : -1;
                }
                return 0;
            }

            if (field === 'time') {
                if (result1.time < result2.time) {
                    return order === true ? -1 : 1;
                } else if (result1.time > result2.time) {
                    return order === true ? 1 : -1;
                }
                return 0;
            }

            if (field === 'agegrade') {
                //if result has no agegrade, put at the end    
                if (result1.agegrade === undefined) {
                    return 1;
                }
                if (result2.agegrade === undefined) {
                    return -1;
                }
                if (result1.agegrade < result2.agegrade) {
                    return order === true ? -1 : 1;
                } else if (result1.agegrade > result2.agegrade) {
                    return order === true ? 1 : -1;
                }
                return 0;
            }
        };
    }

    $scope.membersList = [];
    $scope.query = "";

    // =====================================
    // FILTER PARAMS CONFIG ================
    // =====================================
   
    if (localStorageService.get('members.options')){
        $scope.paramModel = localStorageService.get('members.options');
    }else{
        $scope.paramModel = {};
        $scope.paramModel.sex = '.*';
        $scope.paramModel.category = '.*';
        // $scope.paramModel.limit = '';
        $scope.paramModel.memberStatus = 'current';
    }

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
 
    $scope.getRaceTypeClass = function(s){
        if (s !== undefined){
            return s.replace(/ /g, '')+'-col';
        }
    };

    $scope.filterRaceType = function() {
        // console.log("call");
    };

    $scope.imageLoaded = function() {
        $scope.imageLoading = false;
      };

    // set the current member to the display panel
    $scope.setMember = async function(member_param) { 
       if (member_param === undefined) return;

       $scope.currentMember = null;
       $scope.imageLoading = true;

       $scope.sortCriteria = "race.racedate";
       $scope.sortDirection = '-';

       //reset resultpage to 1
       $scope.pagination = {
            current: 1
       };  
       //reset race type selection
       $scope.paramModelMember = {};

        // get the member details if this is just a "light member object"
        let fullMember;
        if (member_param.bio === undefined) {
            fullMember = await MembersService.getMember(member_param._id); 
        }else{
            fullMember = member_param;
        }
           

        // Use cached race results and extract member results
        ResultsService.getRaceResultsWithCacheSupport({
            "sort": '-racedate -order racename',
            "preload": false
        }).then(function(raceList) {
            // Extract results for the current member from the cached race data
            $scope.currentMemberResultList = [];
            
            raceList.forEach(race => {
                if (race.results && race.results.length > 0) {
                    race.results.forEach(result => {
                        if (result.members) {
                            result.members.forEach(member => {
                                if (member._id === fullMember._id) {
                                    $scope.currentMemberResultList.push({
                                        ...result,
                                        race: race
                                    });
                                }
                            });
                        }
                    });
                }
            });
            
            // Sort by race date
            $scope.currentMemberResultList.sort((a, b) => new Date(b.race.racedate) - new Date(a.race.racedate)); 

            // get racetypes from these results
            $scope.racetypesList = Object.values($scope.currentMemberResultList.reduce((racetypes, result) => {
                const { _id, race } = result;
                if (!racetypes[race.racetype._id]) {
                    racetypes[race.racetype._id] = race.racetype;
                }
                return racetypes;
            }, {})).sort((a, b) => a.meters - b.meters);
            
            $scope.currentMember = fullMember;

            // Navigate to member detail page (bio tab by default)
            $state.go('/members/member/bio', { member: $scope.currentMember.username });

            $analytics.eventTrack('viewMember', {
                category: 'Member',
                label: 'viewing member ' + $scope.currentMember.firstname + ' ' + $scope.currentMember.lastname
            });
        });
        if (!$scope.$$phase) {
            $scope.$apply();
        }
    };

    // Navigate back to member list
    $scope.goToMemberList = function() {
        $state.go('/members');
    };

    // Load member data without navigation (for direct URL access)
    $scope.loadMemberData = async function(member_param) { 
       if (member_param === undefined) return;

       $scope.currentMember = null;
       $scope.imageLoading = true;

       $scope.sortCriteria = "race.racedate";
       $scope.sortDirection = '-';

       //reset resultpage to 1
       $scope.pagination = {
            current: 1
       };  
       //reset race type selection
       $scope.paramModelMember = {};

        // get the member details if this is just a "light member object"
        let fullMember;
        if (member_param.bio === undefined) {
            fullMember = await MembersService.getMember(member_param._id); 
        }else{
            fullMember = member_param;
        }
           

        // Use cached race results and extract member results
        ResultsService.getRaceResultsWithCacheSupport({
            "sort": '-racedate -order racename',
            "preload": false
        }).then(function(raceList) {
            // Extract results for the current member from the cached race data
            $scope.currentMemberResultList = [];
            
            raceList.forEach(race => {
                if (race.results && race.results.length > 0) {
                    race.results.forEach(result => {
                        if (result.members) {
                            result.members.forEach(member => {
                                if (member._id === fullMember._id) {
                                    $scope.currentMemberResultList.push({
                                        ...result,
                                        race: race
                                    });
                                }
                            });
                        }
                    });
                }
            });
            
            // Sort by race date
            $scope.currentMemberResultList.sort((a, b) => new Date(b.race.racedate) - new Date(a.race.racedate)); 

            // get racetypes from these results
            $scope.racetypesList = Object.values($scope.currentMemberResultList.reduce((racetypes, result) => {
                const { _id, race } = result;
                if (!racetypes[race.racetype._id]) {
                    racetypes[race.racetype._id] = race.racetype;
                }
                return racetypes;
            }, {})).sort((a, b) => a.meters - b.meters);
            
            $scope.currentMember = fullMember;

            if (!$scope.$$phase) {
                $scope.$apply();
            }
            $analytics.eventTrack('viewMember', {
                category: 'Member',
                label: 'viewing member ' + $scope.currentMember.firstname + ' ' + $scope.currentMember.lastname
            });
        });
    };



    function getCatergory(dob){
        return $filter('categoryFilter')(dob);
    }

    $scope.memberListcolumns = [];
   
    function getMemberListColumnIndexForType(member) {        
        if (member.sex === 'Male' && getCatergory(member.dateofbirth) === 'Open'){
            return 0;
        }else if (member.sex === 'Female' && getCatergory(member.dateofbirth) === 'Open'){
            return 1;
        }else if (member.sex === 'Male' && getCatergory(member.dateofbirth) === 'Master'){
            return 2;
        }else if (member.sex === 'Female' && getCatergory(member.dateofbirth) === 'Master'){
            return 3;
        }    
      }

    $scope.getMembers = async function(params_) {
        var params;
        if (params_ === undefined) {
            params = {
                "filters[sex]": $scope.paramModel.sex,
                "filters[category]": $scope.paramModel.category,
                "filters[memberStatus]": $scope.paramModel.memberStatus,
                select: '-bio -personalBests',
                sort: 'firstname'
                // limit: $scope.paramModel.limit
            };
        } else {
            params = {
                "filters[sex]": params_.sex,
                "filters[category]": params_.category,
                "filters[memberStatus]": params_.memberStatus,
                select: '-bio -personalBests',
                sort: 'firstname'
            };
        }

        await MembersService.getMembersWithCacheSupport(params).then(function(members) {
            $scope.membersList = members;
            $scope.memberListcolumns = [];
            for (var i = 0; i < 4; i++) {
                $scope.memberListcolumns.push([]);
            }
            $scope.membersList.forEach(function(person) {
                var columnIndex = getMemberListColumnIndexForType(person);
                $scope.memberListcolumns[columnIndex].push(person);
              });              
        });

        
    };

    $scope.getMaxColumnSize = function() {
        var maxColumnSize = 0;   
      
        $scope.memberListcolumns.forEach(function(column) {
          if (column.length > maxColumnSize) {
            maxColumnSize = column.length;
          }
        }); 
        return maxColumnSize;
      };

    $scope.retrieveResultForEdit = function(result) {
        ResultsService.retrieveResultForEdit(result).then(function(result) {});
    };


    $scope.hasTeamRequirementFulfilled = function(member){
        if (member.teamRequirementStats && member.teamRequirementStats.raceCount >= 8 && member.teamRequirementStats.maxAgeGrade >= 70) {
            return true;
        } else {
           return false;
        }
    };

    $scope.getListOfMembersWithRequirementFulfilled = function(list){
        if(list){
            return list.filter(member => $scope.hasTeamRequirementFulfilled(member));
        }
    };

    $scope.getMemberHeaderTooltip = function(list){
        if(list){
          return  (list.filter(member => $scope.hasTeamRequirementFulfilled(member)).length*100/ list.length).toFixed(2) +"%" + " have all of team requirements fulfilled";
        }
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


    // $scope.defaultPBdistances = ["1 mile","5k", "10k", "10 miles", "Half Marathon","Marathon"];
    
    // $scope.pbTableProperties = {};
    // $scope.pbTableProperties.surface = "road";
    // $scope.surfaceTypes = ["road", "track","cross country", "ultra"];
    // $scope.isAllDistancesPresent = () => {
    // return $scope.currentMember.personalBests.every(pb => $scope.defaultPBdistances.includes(pb.name));
    // };
    
    
    // =====================================
    // MEMBER API CALLS ====================
    // =====================================

    // $scope.user = data.user;
    // when landing on the page, get all members and show them



    // Set the active view based on the current route
    if($state.current.name === '/members/member/bio') {
        $scope.activeMemberView = 'bio';
    } else if($state.current.name === '/members/member/stats') {
        $scope.activeMemberView = 'stats';
    } else {
        $scope.activeMemberView = 'bio'; // default
    }

    // var defaultParams = {
    //     "filters[sex]": $scope.paramModel.sex,
    //     "filters[category]": $scope.paramModel.category,
    //     "filters[memberStatus]": $scope.paramModel.memberStatus,
    //     select: '-bio -personalBests',
    //     sort: 'firstname',
    //     limit: $scope.paramModel.limit
    //     };

    async function initialLoad(){
        // wait for async call to finish       
        await $scope.getMembers( $scope.paramModel);

        if($stateParams.member && $stateParams.member.trim() !== ''){
            MembersService.getMembersWithCacheSupport().then(function(allMembers) {                
                // Find the current member
                const member = allMembers.find(m => m.username === $stateParams.member);
                if (member){
                    // Load member data without navigating
                    $scope.loadMemberData(member);
                    
                    // Set the correct view based on the current route
                    if($state.current.name === '/members/member/bio') {
                        $scope.activeMemberView = 'bio';
                    } else if($state.current.name === '/members/member/stats') {
                        $scope.activeMemberView = 'stats';
                    } else {
                        $scope.activeMemberView = 'bio'; // default
                    }
                } else {
                }
            }).catch(function(error) {
                console.error('Error loading member:', error);
            });
        } else {
        }
    }

    $scope.showRaceModal = function(race) {
        if(race){
            ResultsService.showRaceFromResultModal(race._id).then(function(result) {                
            });
        }
    };

    $scope.showResultDetailsModal = function(result) {
        ResultsService.showResultDetailsModal(result).then(function(result) {});
    };

    $scope.goToResultsWithQuery = function(queryParams) {
        // Remove null, undefined, or empty string values
        var cleanedParams = {};
        Object.keys(queryParams).forEach(function(key) {
            var value = queryParams[key];
            if (value !== null && value !== undefined && value !== '') {
                cleanedParams[key] = value;
            }
        });
        
        // Only navigate if we have valid parameters
        if (Object.keys(cleanedParams).length > 0) {
            var searchQuery = JSON.stringify(cleanedParams);
            $state.go('/results', { search: searchQuery });
        }
    };

    $scope.goToResultsWithLocationQuery = function(members, countries, states) {
        // Only navigate if we have at least a racername and either country or state
        if (members && (countries || states)) {
            var queryParams = { members: members };
            if (countries) queryParams.countries = countries;
            if (states) queryParams.states = states;
            $scope.goToResultsWithQuery(queryParams);
        }
    };

    initialLoad();

    // Switch between bio and statistics views (for programmatic use)
    $scope.setActiveMemberView = function(view) {
        $scope.activeMemberView = view;
    };

}]);


angular.module('mcrrcApp.members').controller('MemberModalInstanceController', ['$scope', '$uibModalInstance', '$filter', 'member', function($scope, $uibModalInstance, $filter, member) {

    // make sure dates are always UTC
    // $scope.$watch('formData.dateofbirth ', function(date) {
    //   $scope.formData.dateofbirth = $filter('date')($scope.formData.dateofbirth, 'yyyy-MM-dd', 'UTC');
    // });

    // $scope.$watch('formData.addMembershipDates', function(date) {
    //   if ($scope.formData.membershipDates){
    //     for (i=0;i<$scope.formData.membershipDates.length;i++) {
    //         $scope.formData.membershipDates[i].start = $filter('date')($scope.formData.membershipDates[i].start, 'yyyy-MM-dd', 'UTC');
    //         $scope.formData.membershipDates[i].end = $filter('date')($scope.formData.membershipDates[i].end, 'yyyy-MM-dd', 'UTC');
    //     }
    //   }
    // });



    $scope.editmode = false;
    if (member) {
        $scope.formData = member; 
        $scope.formData.dateofbirth = new Date(member.dateofbirth); 
        $scope.editmode = true;
        for (i=0;i<$scope.formData.membershipDates.length;i++) {
            if ($scope.formData.membershipDates[i].start !== undefined){
                $scope.formData.membershipDates[i].start = new Date($scope.formData.membershipDates[i].start);
            }
            if ($scope.formData.membershipDates[i].end !== undefined){
                $scope.formData.membershipDates[i].end = new Date($scope.formData.membershipDates[i].end);
            }
        }
       
    } else {
        $scope.formData = {};
        $scope.formData.memberStatus = 'current';
        $scope.formData.dateofbirth = new Date($filter('date')(new Date().setHours(0,0,0,0), 'yyyy-MM-dd', 'UTC'));
        $scope.formData.membershipDates = [];
        $scope.formData.membershipDates.push({
            start: new Date($filter('date')(new Date().setHours(0,0,0,0), "yyyy-MM-dd", 'UTC')),
            end: undefined
        });
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

    $scope.newAlternateName = '';

    $scope.addAlternateName = function () {
        if ($scope.newAlternateName && $scope.newAlternateName.trim()) {
            if (!$scope.formData.alternateFullNames) {
                $scope.formData.alternateFullNames = [];
            }
            $scope.formData.alternateFullNames.push($scope.newAlternateName.trim());
            $scope.newAlternateName = '';
        }
    };

    $scope.removeAlternateName = function (index) {
        $scope.formData.alternateFullNames.splice(index, 1);
    };

    // Initialize alternateFullNames array if it doesn't exist
    if (!$scope.formData.alternateFullNames) {
        $scope.formData.alternateFullNames = [];
    } 

}]);
