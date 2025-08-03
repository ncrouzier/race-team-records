angular.module('mcrrcApp.results').controller('StatsController', ['$scope', 'AuthService', 'ResultsService', 'MembersService','UtilsService', 'StatsService', 'dialogs','$filter', '$state', 'MemoryCacheService', function($scope, AuthService, ResultsService, MembersService, UtilsService, StatsService, dialogs,$filter, $state, MemoryCacheService) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function(user) {
        $scope.user = user;
        // Re-initialize stats when user changes to load participation stats if needed
        if ($scope.statsInitialized) {
            $scope.initializeStats();
        }
    });

    $scope.raceStats = {};
    $scope.raceStats.year = "All Time";

    $scope.miscStats = {};
    $scope.miscStats.year = "All Time";

    $scope.attendanceStats = {};
    $scope.attendanceStats.selectedAttendanceRaces = [];
    $scope.attendanceStats.year = "All Time";

    // Loading states for better UX
    $scope.loadingStates = {
        raceStats: false,
        miscStats: false,
        attendanceStats: false,
        participationStats: false,
        preloadingYears: false
    };

    $scope.field = 'firstname';

    $scope.current = {memberStatus:"current"};
    
    $scope.past = {memberStatus:"past"};

    $scope.statusChoice =$scope.current;
    $scope.reverseSort = false; 
    $scope.reverseSortParticipation = false;

    var currentYear = new Date().getFullYear();
    $scope.yearsList = ['All Time'];
    for (i = currentYear; i >= 2013; i--) {
        $scope.yearsList.push(i);
    }

    $scope.participationStats = {};

    $scope.partdates = {};
    var start = new Date(Date.UTC(new Date().getFullYear(),0,1,0,0,0,0));
    var end = new Date(Date.UTC(new Date().getFullYear(),new Date().getMonth(),new Date().getDate(),0,0,0,0));
    $scope.partdates.participationStatsStart =  start;
    $scope.partdates.participationStatsEnd = end;

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
        
        return StatsService.getParticipationStats(
            $scope.partdates.participationStatsStart,
            $scope.partdates.participationStatsEnd
        ).then(function (stats) {
            $scope.participationStats = stats;
            $scope.loadingStates.participationStats = false;
            return stats;
        }).catch(function(error) {
            $scope.loadingStates.participationStats = false;
            throw error;
        });
    };


    $scope.getRacesStats = function() {
        $scope.loadingStates.raceStats = true;

        var fromDate = new Date(Date.UTC(2013, 0, 1)).getTime();
        var now = new Date();
        var toDate = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0);
        if ($scope.raceStats.year !== "All Time") {
            fromDate = new Date(Date.UTC($scope.raceStats.year, 0, 1)).getTime();
            toDate = Date.UTC($scope.raceStats.year + 1, 0, 1, 0, 0, 0, 0);
        }

        return StatsService.getRacesInfos({
            "limit": 10,
            "sort": '-count',
            "filters": {
                "dateFrom": fromDate,
                "dateTo": toDate-1
            }
        }).then(function(races) {
            // For consistency, also filter on client side using year-based logic
            if ($scope.raceStats.year !== "All Time") {
                races = races.filter(function(race) {
                    var raceDate = new Date(race.racedate);
                    var raceYear = raceDate.getUTCFullYear();
                    return raceYear === parseInt($scope.raceStats.year);
                });
            }
            
            $scope.racesList = races;
            $scope.loadingStates.raceStats = false;
            return races;
        }).catch(function(error) {
            $scope.loadingStates.raceStats = false;
            throw error;
        });
    };

    $scope.getMiscStats = function() {
        $scope.loadingStates.miscStats = true;
        
        StatsService.getStats($scope.miscStats.year).then(function(stats) {
            // Update scope with stats from service
            $scope.miscStats = {
                year: $scope.miscStats.year,
                ...stats.basicStats,
                ...stats.generalStats,
                ...stats.teamMemberStats
            };
            $scope.teamRaceTypeBreakdown = stats.teamRaceTypeBreakdown;
            $scope.stateStats = stats.stateStats;
            $scope.countryStats = stats.countryStats;
            
            // Reset loading state
            $scope.loadingStates.miscStats = false;
            
            // Force digest cycle to update UI
            if (!$scope.$$phase) {
                $scope.$apply();
            }
            
            return stats;
        }).catch(function(error) {
            $scope.loadingStates.miscStats = false;
            
            // Force digest cycle to update UI
            if (!$scope.$$phase) {
                $scope.$apply();
            }
            
            throw error;
        });
    };

    $scope.getAttendanceStats = function() {
        $scope.loadingStates.attendanceStats = true;
        
        return StatsService.getAttendanceStats().then(function(data) {
            $scope.attendanceRacesList = data.races;
            
            var now = new Date();
            var nowUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),0,0,0);
            var nowUTCDate = new Date(nowUTC);
            data.members.forEach(function(m){
                var date = new Date($filter('date')(m.dateofbirth, 'yyyy-MM-dd', 'UTC'));
                var currentYear = new Date().getUTCFullYear();
                var birthdayDate =  new Date(Date.UTC(currentYear, date.getUTCMonth(), date.getUTCDate(),0,0,0));

                 if (birthdayDate.getTime() < nowUTCDate.getTime()){
                     birthdayDate.setUTCFullYear(currentYear+1);
                 }
                 m.fromNow = birthdayDate.getTime() - nowUTCDate.getTime();
            });

            $scope.membersList = data.members;
            $scope.loadingStates.attendanceStats = false;
            return data;
        }).catch(function(error) {
            $scope.loadingStates.attendanceStats = false;
            throw error;
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

   
  
    // Pre-load all years in the cache for faster year switching
    $scope.preloadAllYears = function() {
        $scope.loadingStates.preloadingYears = true;
        
        // Get all years except "All Time" (which is already loaded)
        var yearsToPreload = $scope.yearsList.filter(function(year) {
            return year !== "All Time";
        });
        
        // Pre-load each year with a small delay to avoid overwhelming the system
        var preloadPromises = yearsToPreload.map(function(year, index) {
            return new Promise(function(resolve) {
                // Add a small delay between requests to be more user-friendly
                setTimeout(function() {
                    StatsService.getStats(year).then(function(stats) {
                        resolve({ year: year, stats: stats });
                    }).catch(function(error) {
                        console.error(`[StatsCtrl] Error pre-loading year ${year}:`, error);
                        resolve({ year: year, error: error });
                    });
                }, index * 100); // 100ms delay between each request
            });
        });
        
        // Wait for all pre-loads to complete
        Promise.all(preloadPromises).then(function(results) {
            var successCount = results.filter(function(result) {
                return !result.error;
            }).length;
            $scope.loadingStates.preloadingYears = false;
            if (!$scope.$$phase) {
                $scope.$apply();
            }
        }).catch(function(error) {
            console.error('[StatsCtrl] Error pre-loading years:', error);            
            $scope.loadingStates.preloadingYears = false;
            if (!$scope.$$phase) {
                $scope.$apply();
            }
        });
    };

    // On controller load, check for DB updates and clear caches if needed
    // Use Promise-based loading to avoid race conditions and ensure proper timing
    $scope.initializeStats = function() {
        // Create array of promises for stats loading
        var statsPromises = [
            $scope.getRacesStats(),
            $scope.getMiscStats(),
            $scope.getAttendanceStats()
        ];
        
        // Only load participation stats if user is logged in as user or admin
        if ($scope.user && ($scope.user.role === 'user' || $scope.user.role === 'admin')) {
            statsPromises.push($scope.getParticipationStats());
        }
        
        // Start all stats loading in parallel and wait for all to complete
        Promise.all(statsPromises).then(function(results) {
            // Trigger a digest cycle to ensure UI updates
            if (!$scope.$$phase) {
                $scope.$apply();
            }
            
            // Pre-load all years after main stats are loaded
            $scope.preloadAllYears();
            if (!$scope.$$phase) {
                $scope.$apply();
            }
        }).catch(function(error) {
            console.error('[StatsCtrl] Error loading stats:', error);
        });
    };
    
    // Initialize stats when controller loads
    $scope.statsInitialized = true;
    $scope.initializeStats();
    


}]);
