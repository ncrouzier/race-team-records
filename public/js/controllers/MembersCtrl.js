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
           

        ResultsService.getResults({
            sort: '-race.racedate -race.order',
            member: {_id :fullMember._id}
        }).then(function(results) {
            $scope.currentMemberResultList = results; 

            // get racetypes from these results
            $scope.racetypesList = Object.values($scope.currentMemberResultList.reduce((racetypes, result) => {
                const { _id, race } = result;
                if (!racetypes[race.racetype._id]) {
                    racetypes[race.racetype._id] = race.racetype;
                }
                return racetypes;
            }, {})).sort((a, b) => a.meters - b.meters);
            // console.log($scope.racetypesList);
            $scope.currentMember = fullMember;
            $scope.activeTab = 1;

            // Set default view to bio
            $scope.activeMemberView = 'bio';

            // Calculate member statistics
            $scope.calculateMemberStats();

            $state.current.reloadOnSearch = false;
            $location.search('member', $scope.currentMember.firstname + $scope.currentMember.lastname);
            $timeout(function () {
             $state.current.reloadOnSearch = undefined;
            });

            $analytics.eventTrack('viewMember', {
                category: 'Member',
                label: 'viewing member ' + $scope.currentMember.firstname + ' ' + $scope.currentMember.lastname
            });
        });
        
       
        
    };

    // Calculate comprehensive statistics for the current member
    $scope.calculateMemberStats = function() {
        if (!$scope.currentMember || !$scope.currentMemberResultList) {
            return;
        }

        const results = $scope.currentMemberResultList;
        const currentYear = new Date().getFullYear();
        
        // Initialize stats object
        $scope.memberStats = {
            totalRaces: results.length,
            racesThisYear: 0,
            yearsRacing: 0,
            avgRacesPerYear: 0,
            personalBests: $scope.currentMember.personalBests ? $scope.currentMember.personalBests.length : 0,
            top3Finishes: 0,
            wins: 0,
            ageGroupWins: 0,
            bestAgeGrade: 0,
            bestAgeGradeRace: '',
            avgAgeGrade: 0,
            lastRaceDate: null,
            lastRaceName: '',
            raceTypeBreakdown: [],
            locationBreakdown: []
        };

        // Track years and race types
        const years = new Set();
        const raceTypes = {};
        const locations = {};
        let totalAgeGrade = 0;
        let ageGradeCount = 0;
        let bestAgeGrade = 0;
        let bestAgeGradeRace = '';

        results.forEach(result => {
            // Count races this year
            const raceYear = new Date(result.race.racedate).getUTCFullYear();
            if (raceYear === currentYear) {
                $scope.memberStats.racesThisYear++;
            }
            years.add(raceYear);

            // Track race types by name
            const raceType = result.race.racetype;
            let category = 'other';
            let name = 'Other';
            
            // Check if result has multiple members
            if (result.members && result.members.length > 1) {
                category = 'other';
                name = 'Other';
            }else if      (raceType.isVariable) {
                    category = 'other';
                    name = 'Other';
                
            }
            // Categorize by race type name
            else if (raceType.surface === 'road' || raceType.surface === 'track' || raceType.surface === 'cross country' || raceType.surface === 'ultra') {
                // Check if race type is variable distance
                if (raceType.isVariable) {
                    category = 'other';
                    name = 'Other';
                } else {
                    // Use the racetype name for categorization
                    category = raceType.name;
                    name = raceType.name;
                }
            } else {
                // Non-running races (other surfaces, etc.)
                category = 'other';
                name = 'Other';
            }
            
            const key = category + '|' + name;
            raceTypes[key] = raceTypes[key] || { category: category, name: name, count: 0 };
            raceTypes[key].count++;

            // Track locations
            const location = result.race.location.state || result.race.location.country;
            if (location) {
                if (!locations[location]) {
                    var stateName = result.race.location.state ? UtilsService.getStateNameFromCode(result.race.location.state) : null;
                    var countryName = result.race.location.country ? UtilsService.getCountryNameFromCode(result.race.location.country) : null;
                    var stateFlag = result.race.location.state ? UtilsService.getStateFlag(result.race.location.state) : '';
                    var countryFlag = result.race.location.country ? UtilsService.getCountryFlag(result.race.location.country) : '';
                    
                    locations[location] = {
                        count: 0,
                        state: result.race.location.state,
                        country: result.race.location.country,
                        stateName: stateName,
                        countryName: countryName,
                        stateFlag: stateFlag,
                        countryFlag: countryFlag,
                        displayName: stateName || countryName || location,
                        displayFlag: stateFlag || countryFlag
                    };
                }
                locations[location].count++;
            }

            // Track rankings
            if (result.ranking) {
                if (result.ranking.overallrank === 1 || result.ranking.genderrank === 1) {
                    $scope.memberStats.wins++;
                }
                if (result.ranking.agerank === 1) {
                    $scope.memberStats.ageGroupWins++;
                }
                if (result.ranking.overallrank <= 3 || result.ranking.genderrank  <=3) {
                    $scope.memberStats.top3Finishes++;
                }
            }

            // Track age grades
            if (result.agegrade) {
                totalAgeGrade += result.agegrade;
                ageGradeCount++;
                if (result.agegrade > bestAgeGrade) {
                    bestAgeGrade = result.agegrade;
                    bestAgeGradeRace = result.race.racename;
                }
            }

            // Track most recent race
            if (!$scope.memberStats.lastRaceDate || new Date(result.race.racedate) > new Date($scope.memberStats.lastRaceDate)) {
                $scope.memberStats.lastRaceDate = result.race.racedate;
                $scope.memberStats.lastRaceName = result.race.racename;
            }
        });

        // Calculate derived stats
        $scope.memberStats.yearsRacing = years.size;
        $scope.memberStats.avgRacesPerYear = results.length / years.size;
        $scope.memberStats.bestAgeGrade = bestAgeGrade;
        $scope.memberStats.bestAgeGradeRace = bestAgeGradeRace;
        $scope.memberStats.avgAgeGrade = ageGradeCount > 0 ? totalAgeGrade / ageGradeCount : 0;

        // Create race type breakdown
        $scope.memberStats.raceTypeBreakdown = Object.values(raceTypes).map(type => ({
            category: type.category,
            name: type.name,
            count: type.count,
            percentage: Math.round((type.count / results.length) * 100)
        })).sort((a, b) => b.count - a.count);

        // Calculate pie chart angles and add colors
        let currentAngle = 0;
        const colors = ['#007bff', '#28a745', '#ffc107', '#fd7e14', '#e83e8c', '#dc3545', '#6f42c1', '#6c757d'];
        
        $scope.memberStats.raceTypeBreakdown.forEach((type, index) => {
            const sliceAngle = (type.percentage / 100) * 360;
            const endAngle = currentAngle + sliceAngle;
            
            // Calculate end coordinates for the slice
            const endRadians = (endAngle * Math.PI) / 180;
            const endX = 50 + 50 * Math.cos(endRadians);
            const endY = 50 - 50 * Math.sin(endRadians);
            
            type.startAngle = currentAngle;
            type.endAngle = endAngle;
            type.endX = endX;
            type.endY = endY;
            type.color = colors[index % colors.length];
            
            currentAngle = endAngle;
        });

        // Generate conic-gradient CSS for pie chart
        let gradientParts = [];
        currentAngle = 0;
        
        $scope.memberStats.raceTypeBreakdown.forEach((type, index) => {
            const sliceAngle = (type.percentage / 100) * 360;
            const endAngle = currentAngle + sliceAngle;
            
            gradientParts.push(`${type.color} ${currentAngle}deg ${endAngle}deg`);
            currentAngle = endAngle;
        });
        
        $scope.memberStats.pieChartGradient = `conic-gradient(${gradientParts.join(', ')})`;

        // Create location breakdown
        $scope.memberStats.locationBreakdown = Object.values(locations).map(location => ({
            state: location.state,
            country: location.country,
            stateName: location.stateName,
            countryName: location.countryName,
            stateFlag: location.stateFlag,
            countryFlag: location.countryFlag,
            displayName: location.displayName,
            displayFlag: location.displayFlag,
            count: location.count
        })).sort((a, b) => b.count - a.count).slice(0, 10); // Top 10 locations
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

        await MembersService.getMembers(params).then(function(members) {
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

    // get all members if we have a member in the url
    if($stateParams.member){
        // $scope.paramModel.memberStatus = 'all';
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

        if($stateParams.member){
            MembersService.getMembers({"filters[name]": $stateParams.member}).then(function(members) {                
                if (members[0]){
                    $scope.setMember(members[0]);     
                }
            });
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
        
        var searchQuery = JSON.stringify(cleanedParams);
        $state.go('/results', { search: searchQuery });
    };

    initialLoad();

    // Switch between bio and statistics views
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
