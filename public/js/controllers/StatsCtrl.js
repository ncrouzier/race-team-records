angular.module('mcrrcApp.results').controller('StatsController', ['$scope', 'AuthService', 'ResultsService', 'MembersService','UtilsService', 'dialogs','$filter', '$state', function($scope, AuthService, ResultsService, MembersService, UtilsService, dialogs,$filter, $state) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function(user) {
        $scope.user = user;
    });

    $scope.raceStats = {};
    $scope.raceStats.year = "All Time";

    $scope.miscStats = {};
    $scope.miscStats.year = "All Time";

    $scope.attendanceStats = {};
    $scope.attendanceStats.selectedAttendanceRaces = [];
    $scope.attendanceStats.year = "All Time";

    // Loading states
    $scope.loadingStates = {
        raceStats: false,
        miscStats: false,
        attendanceStats: false,
        participationStats: false
    };

    $scope.field = 'firstname';

    $scope.current = {memberStatus:"current"};
    $scope.past = {memberStatus:"past"};
    $scope.none = {};

    $scope.statusChoice =$scope.current;
    $scope.reverseSort = false; 
    $scope.reverseSortParticipation = false;

    var currentYear = new Date().getFullYear();
    $scope.yearsList = ['All Time'];
    for (i = currentYear; i >= 2013; i--) {
        $scope.yearsList.push(i);
    }

    $scope.participationStats = {};

    $scope.getMapStats = function() {

    };


    $scope.partdates = {};
    var start = new Date(Date.UTC(new Date().getFullYear(),0,1,0,0,0,0));
    // start.setFullYear(new Date().getFullYear(), 0, 1);
    // start.setHours(0, 0, 0, 0);
    var end = new Date(Date.UTC(new Date().getFullYear(),new Date().getMonth(),new Date().getDate(),0,0,0,0));
    // end.setUTCFullYear(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    // end.setUTCHours(0, 0, 0, 0);    
    $scope.partdates.participationStatsStart =  start;
    $scope.partdates.participationStatsEnd = end;
    // make sure dates are always UTC
    // $scope.$watch('partdates.participationStatsStart ', function (date) {
    //     $scope.partdates.participationStatsStart = $filter('date')($scope.partdates.participationStatsStart, 'yyyy-MM-dd', 'UTC');
    // });
    // $scope.$watch('partdates.participationStatsEnd ', function (date) {
    //     $scope.partdates.participationStatsEnd = $filter('date')($scope.partdates.participationStatsEnd, 'yyyy-MM-dd', 'UTC');        
    // });

    $scope.participationStatsStartPicker = {};
    $scope.openParticipationStatsStartPicker = function($event) {
        $event.preventDefault();
        $event.stopPropagation();
        $scope.participationStatsStartPicker.opened = true;
    };

    
    $scope.participationStatsEndPicker = {};
    $scope.openParticipationStatsEndPicker = function($event) {
        $event.preventDefault();
        $event.stopPropagation();
        $scope.participationStatsEndPicker.opened = true;
    };
    
    $scope.selectDate= function () {
       $scope.getParticipationStats();
    };

    $scope.getParticipationStats = function () {
        $scope.loadingStates.participationStats = true;
        
        MembersService.getParticipation({
            "startdate": new Date($scope.partdates.participationStatsStart).getTime(),
            "enddate": new Date($scope.partdates.participationStatsEnd).getTime()
        }).then(function (stats) {
            $scope.participationStats = stats;
            $scope.loadingStates.participationStats = false;
        }).catch(function(error) {
            $scope.loadingStates.participationStats = false;
        });
    };


    $scope.getRacesStats = function() {
        $scope.loadingStates.raceStats = true;

        var fromDate = new Date(Date.UTC(2013, 0, 1)).getTime();
        var toDate = new Date().getTime();
        if ($scope.raceStats.year !== "All Time") {
            fromDate = new Date(Date.UTC($scope.raceStats.year, 0, 1)).getTime();
            toDate = new Date(Date.UTC($scope.raceStats.year + 1, 0, 1)).getTime();
        }

        ResultsService.getRacesInfos({
            "limit": 10,
            "sort": '-count',
            "filters": {
                "dateFrom": fromDate,
                "dateTo": toDate-1
            }
        }).then(function(races) {
            $scope.racesList = races;
            $scope.loadingStates.raceStats = false;
        }).catch(function(error) {
            $scope.loadingStates.raceStats = false;
        });
    };

    $scope.getMiscStats = function() {
        $scope.loadingStates.miscStats = true;
        
        var fromDate = new Date(Date.UTC(2013, 0, 1)).getTime();
        var toDate = new Date().getTime();
        if ($scope.miscStats.year !== "All Time") {
            fromDate = new Date(Date.UTC($scope.miscStats.year, 0, 1)).getTime();
            toDate = new Date(Date.UTC($scope.miscStats.year + 1, 0, 1)).getTime();
        }
        
        // Get basic stats
        ResultsService.getMilesRaced({
            "filters": {
                "dateFrom": fromDate,
                "dateTo": toDate-1
            }
        }).then(function(result) {
            $scope.miscStats.milesRaced = parseFloat(result.milesRaced).toFixed(2);
            $scope.miscStats.resultsCount = parseFloat(result.resultsCount);
            $scope.miscStats.raceWon = parseInt(result.raceWon);
        });

        // Get all race data with results (cached) and filter on client side
        ResultsService.getRaceResultsWithCacheSupport({
            "sort": '-racedate -order racename',
            "preload": false
        }).then(function(races) {
            // Filter races by date on client side since cache doesn't respect server filters
            var filteredRaces = races.filter(function(race) {
                var raceDate = new Date(race.racedate).getTime();
                return raceDate >= fromDate && raceDate < toDate;
            });
            
            $scope.calculateTeamMemberStats(filteredRaces);
            $scope.calculateGeneralStats(filteredRaces);
            $scope.loadingStates.miscStats = false;
        }).catch(function(error) {
            $scope.loadingStates.miscStats = false;
        });
    };

    $scope.calculateTeamMemberStats = function(races) {
        var memberStats = {};
        var memberLocations = {};
        var memberRaceCounts = {};
        var memberMiles = {};
        var memberWins = {};
        var memberAgeGrades = {};
        var memberYears = {};
        var raceTurnout = {};

        // Process all races and results
        races.forEach(function(race) {
            if (race.results && race.results.length > 0) {
                // Count unique team members for this race
                var uniqueMembers = new Set();
                race.results.forEach(function(result) {
                    result.members.forEach(function(member) {
                        uniqueMembers.add(member._id);
                    });
                });
                
                raceTurnout[race._id] = {
                    _id: race._id,
                    racename: race.racename,
                    racedate: race.racedate,
                    racetype: race.racetype,
                    location: race.location,
                    teamMembers: uniqueMembers.size
                };
                
                race.results.forEach(function(result) {
                    result.members.forEach(function(member) {
                        var memberId = member._id;
                        
                        // Initialize member stats if not exists
                        if (!memberStats[memberId]) {
                            memberStats[memberId] = {
                                firstname: member.firstname,
                                lastname: member.lastname,
                                races: 0,
                                miles: 0,
                                wins: 0,
                                totalAgeGrade: 0,
                                ageGradeCount: 0,
                                bestAgeGrade: 0,
                                bestAgeGradeRace: '',
                                years: new Set(),
                                locations: new Set(),
                                states: new Set(),
                                countries: new Set()
                            };
                        }

                        // Count races
                        memberStats[memberId].races++;
                        memberRaceCounts[memberId] = (memberRaceCounts[memberId] || 0) + 1;

                        // Count parkrun races
                        if (race.racename && race.racename.toLowerCase().includes('parkrun')) {
                            memberStats[memberId].parkrunRaces = (memberStats[memberId].parkrunRaces || 0) + 1;
                        }

                        // Count miles (for non-multisport races)
                        if (!race.isMultisport && race.racetype && race.racetype.miles) {
                            memberStats[memberId].miles += race.racetype.miles;
                            memberMiles[memberId] = (memberMiles[memberId] || 0) + race.racetype.miles;
                        }

                        // Count wins
                        if (result.ranking && (result.ranking.overallrank === 1 || result.ranking.genderrank === 1)) {
                            memberStats[memberId].wins++;
                            memberWins[memberId] = (memberWins[memberId] || 0) + 1;
                        }

                        // Track age grades
                        if (result.agegrade) {
                            memberStats[memberId].totalAgeGrade += result.agegrade;
                            memberStats[memberId].ageGradeCount++;
                            if (result.agegrade > memberStats[memberId].bestAgeGrade) {
                                memberStats[memberId].bestAgeGrade = result.agegrade;
                                memberStats[memberId].bestAgeGradeRace = race;
                            }
                        }

                        // Track years
                        var raceYear = new Date(race.racedate).getFullYear();
                        memberStats[memberId].years.add(raceYear);
                        memberYears[memberId] = (memberYears[memberId] || new Set()).add(raceYear);

                        // Track locations
                        var locationKey = race.location.country + (race.location.state ? ' - ' + race.location.state : '');
                        memberStats[memberId].locations.add(locationKey);
                        memberStats[memberId].states.add(race.location.state || '');
                        memberStats[memberId].countries.add(race.location.country);
                        
                        if (!memberLocations[memberId]) {
                            memberLocations[memberId] = new Set();
                        }
                        memberLocations[memberId].add(locationKey);
                    });
                });
            }
        });

        // Convert to arrays and sort
        var memberStatsArray = Object.keys(memberStats).map(function(memberId) {
            var stats = memberStats[memberId];
            return {
                id: memberId,
                name: stats.firstname + ' ' + stats.lastname,
                link: stats.firstname +stats.lastname,
                races: stats.races,
                miles: Math.round(stats.miles * 100) / 100,
                wins: stats.wins,
                avgAgeGrade: stats.ageGradeCount > 0 ? Math.round((stats.totalAgeGrade / stats.ageGradeCount) * 100) / 100 : 0,
                bestAgeGrade: Math.round(stats.bestAgeGrade * 100) / 100,
                bestAgeGradeRace: stats.bestAgeGradeRace,
                yearsRacing: stats.years.size,
                uniqueLocations: stats.locations.size,
                uniqueStates: stats.states.size,
                uniqueCountries: stats.countries.size,
                avgRacesPerYear: Math.round((stats.races / stats.years.size) * 100) / 100,
                avgMilesPerRace: stats.races > 0 ? Math.round((stats.miles / stats.races) * 100) / 100 : 0,
                parkrunRaces: stats.parkrunRaces || 0
            };
        });

        // Sort by different criteria
        $scope.miscStats.mostRaces = memberStatsArray
            .sort(function(a, b) { return b.races - a.races; })
            .slice(0, 10);

        $scope.miscStats.mostMiles = memberStatsArray
            .sort(function(a, b) { return b.miles - a.miles; })
            .slice(0, 10);

        $scope.miscStats.mostWins = memberStatsArray
            .filter(function(member) { return member.wins > 0; })
            .sort(function(a, b) { return b.wins - a.wins; })
            .slice(0, 10);

        $scope.miscStats.mostTraveled = memberStatsArray
            .sort(function(a, b) { return b.uniqueLocations - a.uniqueLocations; })
            .slice(0, 10);

        $scope.miscStats.mostCountries = memberStatsArray
            .sort(function(a, b) { return b.uniqueCountries - a.uniqueCountries; })
            .slice(0, 10);

        $scope.miscStats.bestAgeGrades = memberStatsArray
            .filter(function(member) { return member.bestAgeGrade > 0; })
            .sort(function(a, b) { return b.bestAgeGrade - a.bestAgeGrade; })
            .slice(0, 10);

        $scope.miscStats.mostConsistent = memberStatsArray
            .filter(function(member) { return member.yearsRacing > 1; })
            .sort(function(a, b) { return b.avgRacesPerYear - a.avgRacesPerYear; })
            .slice(0, 10);

        // Calculate best turnout races
        var raceTurnoutArray = Object.keys(raceTurnout).map(function(raceId) {
            return raceTurnout[raceId];
        });
        
        $scope.miscStats.bestTurnout = raceTurnoutArray
            .sort(function(a, b) { return b.teamMembers - a.teamMembers; })
            .slice(0, 10);

        // Overall team stats
        $scope.miscStats.totalMembers = memberStatsArray.length;
        $scope.miscStats.avgRacesPerMember = memberStatsArray.length > 0 ? 
            Math.round((memberStatsArray.reduce(function(sum, member) { return sum + member.races; }, 0) / memberStatsArray.length) * 100) / 100 : 0;
        $scope.miscStats.avgMilesPerMember = memberStatsArray.length > 0 ? 
            Math.round((memberStatsArray.reduce(function(sum, member) { return sum + member.miles; }, 0) / memberStatsArray.length) * 100) / 100 : 0;
    };

    $scope.calculateGeneralStats = function(races) {
        // Calculate most popular race distance
        var raceTypeCounts = {};
        var raceTypeNames = {};
        
        races.forEach(function(race) {
            if (race.racetype && race.racetype.name) {
                var raceTypeName = race.racetype.name;
                if (!raceTypeCounts[raceTypeName]) {
                    raceTypeCounts[raceTypeName] = 0;
                    raceTypeNames[raceTypeName] = raceTypeName;
                }
                raceTypeCounts[raceTypeName]++;
            }
        });
        
        // Find the most popular race type
        var mostPopularRaceType = '';
        var maxCount = 0;
        Object.keys(raceTypeCounts).forEach(function(raceType) {
            if (raceTypeCounts[raceType] > maxCount) {
                maxCount = raceTypeCounts[raceType];
                mostPopularRaceType = raceType;
            }
        });
        
        $scope.miscStats.mostPopularRaceDistance = mostPopularRaceType;
        $scope.miscStats.mostPopularRaceCount = maxCount;
    };

    $scope.getAttendanceStats = function() {
        $scope.loadingStates.attendanceStats = true;
        
        ResultsService.getRaces({
            sort: '-racedate'
        }).then(function(races) {
            $scope.attendanceRacesList = races;
        });


        MembersService.getMembers({
            // "filters[memberStatus]": "current",
            sort: 'firstname',
            select: '-bio -personalBests',
        }).then(function(members) {
          var now = new Date();
          var nowUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),0,0,0);
          var nowUTCDate = new Date(nowUTC);
          members.forEach(function(m){
            var date = new Date($filter('date')(m.dateofbirth, 'yyyy-MM-dd', 'UTC'));
            var currentYear = new Date().getUTCFullYear();
            var birthdayDate =  new Date(Date.UTC(currentYear, date.getUTCMonth(), date.getUTCDate(),0,0,0));

             if (birthdayDate.getTime() < nowUTCDate.getTime()){
                 birthdayDate.setUTCFullYear(currentYear+1);
             }
             m.fromNow = birthdayDate.getTime() - nowUTCDate.getTime();
          });

            $scope.membersList = members;
            $scope.loadingStates.attendanceStats = false;
        }).catch(function(error) {
            $scope.loadingStates.attendanceStats = false;
        });
    };


    $scope.getAttendanceStatsByYear = function(){
        var fromDate = new Date(Date.UTC(2013, 0, 1)).getTime();
        var toDate = new Date().getTime();
        if ($scope.attendanceStats.year !== "All Time") {
            fromDate = new Date(Date.UTC($scope.attendanceStats.year, 0, 1)).getTime();
            toDate = new Date(Date.UTC($scope.attendanceStats.year + 1, 0, 1)).getTime();
        }

        ResultsService.getRaces({
            sort: '-racedate',
            "filters": {
                "dateFrom": fromDate,
                "dateTo": toDate-1
            }
        }).then(function(races) {
            if (races !== undefined && races.length >0){
                $scope.attendanceStats.selectedAttendanceRaces = [];
                $scope.attendanceStats.racedRaces = new Array($scope.membersList.length).fill(0);
                for (i =0;i<races.length;i++){
                    $scope.onSelectRace(races[i]);
                }
            }
        });
    };

    $scope.onSelectRace = function(item, model) {
        ResultsService.getResults({
                "sort": 'members.firstname',
                "filters": {
                    "raceid": item._id
                }
            }).then(function(results) {
                resultarray = [];
                numberOfRacer = new Array($scope.membersList.length).fill(0);
                if($scope.attendanceStats.selectedAttendanceRaces.length===0){
                    $scope.attendanceStats.racedRaces = new Array($scope.membersList.length).fill(0);
                }
                foundRunners = 0;
                for (i =0;i<$scope.membersList.length;i++){
                    found =false;
                    for (j =0;j<results.length;j++){
                        for(k=0;k<results[j].members.length;k++){

                            if($scope.membersList[i]._id === results[j].members[k]._id){
                                found = results[j];
                            }
                        }
                    }
                    if(found){
                        found.text = "y";
                        foundRunners++;
                        $scope.attendanceStats.racedRaces[i]++;
                        numberOfRacer[i]++;
                        resultarray.push(found);
                    }else{
                        found = {};
                        found.text = "n";
                        resultarray.push(found);
                    }
                }
                $scope.attendanceStats.selectedAttendanceRaces.push([item.racename,resultarray,foundRunners,numberOfRacer]);

            });
    };
    $scope.getRaceTypeClass = function(s) {
        if (s !== undefined) {
            return s.replace(/ /g, '') + '-col';
        }
    };

    $scope.removeRace = function(index){
        for (i =0;i<$scope.attendanceStats.selectedAttendanceRaces[index][3].length;i++){
            $scope.attendanceStats.racedRaces[i] = $scope.attendanceStats.racedRaces[i]-$scope.attendanceStats.selectedAttendanceRaces[index][3][i];
        }
        $scope.attendanceStats.selectedAttendanceRaces.splice(index, 1);
    };


    $scope.showRaceModal = function(raceinfo) {
        if (raceinfo) {
            ResultsService.showRaceModal(raceinfo).then(function() {});
        }
    };

    $scope.showRaceFromRaceIdModal = function(raceId) {
        if (raceId) {
            ResultsService.showRaceFromRaceIdModal(raceId).then(function() {});
        }
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

    $scope.getRacesStats();
    $scope.getMiscStats();
    $scope.getAttendanceStats();
    $scope.getParticipationStats();
  



}]);
