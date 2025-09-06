angular.module('mcrrcApp.members').controller('MemberStatsController', ['$scope', '$location','$timeout','$state','$stateParams','$http', '$analytics', 'AuthService', 'MembersService', 'ResultsService', 'dialogs','$filter', 'localStorageService', 'UtilsService', function($scope, $location,$timeout, $state, $stateParams, $http, $analytics, AuthService, MembersService, ResultsService, dialogs, $filter, localStorageService, UtilsService) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function(user) {
        $scope.user = user;
    });

    $scope.currentMember = null;
    $scope.memberStats = null;
    $scope.loading = true;
    if (!$scope.$$phase) {
        $scope.$apply();
    }
    // Navigate back to member list
    $scope.goToMemberList = function() {
        $state.go('/members');
    };

    // Get current year for dynamic year filtering
    $scope.getCurrentYear = function() {
        return new Date().getFullYear();
    };

    

    // Load member data for stats
    $scope.loadMemberStats = async function(member_param) { 
        if (member_param === undefined) return;

        //load the race list
        var raceList = [];
        raceList = await ResultsService.getRaceResultsWithCacheSupport({
            "sort": '-racedate -order racename',
            "preload": false
        });

        $scope.currentMember = null;
        $scope.memberStats = null;
        $scope.loading = true;
        if (!$scope.$$phase) {
            $scope.$apply();
        }

        // get the member details if this is just a "light member object"
        let fullMember;
        if (member_param.bio === undefined) {
            fullMember = await MembersService.getMember(member_param._id); 
        } else {
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
            
            $scope.currentMember = fullMember;           

            const results = $scope.currentMemberResultList; 

            // get racetypes from these results
            $scope.racetypesList = Object.values($scope.currentMemberResultList.reduce((racetypes, result) => {
                const { _id, race } = result;
                if (!racetypes[race.racetype._id]) {
                    racetypes[race.racetype._id] = race.racetype;
                }
                return racetypes;
            }, {})).sort((a, b) => a.meters - b.meters);

            // Calculate member statistics
            $scope.calculateMemberStats(results,raceList);
            $scope.loading = false;
            if (!$scope.$$phase) {
                $scope.$apply();
            }

            $analytics.eventTrack('viewMemberStats', {
                category: 'Member',
                label: 'viewing member stats ' + $scope.currentMember.firstname + ' ' + $scope.currentMember.lastname
            });
        });
    };

    // Calculate comprehensive statistics for the current member
    $scope.calculateMemberStats = function(results,raceList) {
        if (!$scope.currentMember || !results) {
            return;
        }

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
            bestAgeGradeRace: null,
            avgAgeGrade: 0,
            lastRaceDate: null,
            lastRaceName: '',
            raceTypeBreakdown: [],
            locationBreakdown: []
        };

        // Track years and race types
        const years = new Set();
        const raceTypes = {};
        const yearlyBreakdown = {};
        const locations = {};
        let totalAgeGrade = 0;
        let ageGradeCount = 0;
        let bestAgeGrade = 0;
        let bestAgeGradeRace = null;

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
            // if (result.members && result.members.length > 1) {
            //     category = 'other';
            //     name = 'Other';
            // } else if (raceType.isVariable) {
            //     category = 'other';
            //     name = 'Other';
            // }
            // Categorize by race type name
             if (raceType.surface === 'road' || raceType.surface === 'track' || raceType.surface === 'trail' || raceType.surface === 'ultra') {
                // Check if race type is variable distance
                if (raceType.isVariable) {
                    category = 'other';
                    name = 'Other';
                } else {
                    // Special handling for metric track distances
                    if (raceType.name === '5000m') {
                        category = '5k';
                        name = '5k';
                    } else if (raceType.name === '10000m') {
                        category = '10k';
                        name = '10k';
                    } else {
                        // Use the racetype name for categorization
                        category = raceType.name;
                        name = raceType.name;
                    }
                }
            } else {
                // Non-running races (other surfaces, etc.)
                category = 'other';
                name = 'Other';
            }
            
            const key = category + '|' + name;
            raceTypes[key] = raceTypes[key] || { category: category, name: name, count: 0 };
            raceTypes[key].count++;

            // Add to yearly breakdown for chart
            if (!yearlyBreakdown[raceYear]) {
                yearlyBreakdown[raceYear] = {};
            }
            if (!yearlyBreakdown[raceYear][category]) {
                yearlyBreakdown[raceYear][category] = { results: [] };
            }
            yearlyBreakdown[raceYear][category].results.push(result);

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
                if (result.ranking.overallrank && result.ranking.overallrank === 1 || result.ranking.genderrank && result.ranking.genderrank === 1) {
                    $scope.memberStats.wins++;
                }
                if (result.ranking.agerank && result.ranking.agerank === 1) {
                    $scope.memberStats.ageGroupWins++;
                }
                if (result.ranking.overallrank && result.ranking.overallrank <= 3 || result.ranking.genderrank && result.ranking.genderrank  <=3) {
                    $scope.memberStats.top3Finishes++;
                }
            }

            // Track age grades
            if (result.agegrade) {
                totalAgeGrade += result.agegrade;
                ageGradeCount++;
                if (result.agegrade > bestAgeGrade) {
                    bestAgeGrade = result.agegrade;
                    bestAgeGradeRace = result.race;
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
        var raceTypeBreakdownArray = Object.values(raceTypes).map(type => ({
            category: type.category,
            name: type.name,
            count: type.count,
            percentage: Math.round((type.count / results.length) * 100)
        })).sort((a, b) => b.count - a.count);

        // Create race type breakdown object with yearly data for charts
        $scope.memberStats.raceTypeBreakdown = {
            categories: raceTypeBreakdownArray,
            yearly: yearlyBreakdown
        };

        // Add colors for D3 pie chart
        const colors = ['#007bff', '#28a745', '#ffc107', '#fd7e14', '#e83e8c', '#dc3545', '#6f42c1', '#6c757d'];
        
        $scope.memberStats.raceTypeBreakdown.categories.forEach((type, index) => {
            type.color = colors[index % colors.length];
        });
        

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
        })).sort((a, b) => b.count - a.count);

        // Calculate top team members raced with
        $scope.calculateTopTeamMembers = function(results, raceList) {
            const startTime = performance.now();
            const teamMemberCounts = {};
            const currentMemberId = $scope.currentMember._id;

            // Go through all races to find team members
            raceList.forEach(race => {
                if (!race.results || race.results.length === 0) {
                    return; // Skip races with no results
                }

                // Early exit: Check if current member participated in this race
                let currentMemberInRace = false;
                for (let i = 0; i < race.results.length; i++) {
                    const result = race.results[i];
                    if (result.members) {
                        for (let j = 0; j < result.members.length; j++) {
                            if (result.members[j]._id === currentMemberId) {
                                currentMemberInRace = true;
                                break; // Found current member, no need to check further
                            }
                        }
                        if (currentMemberInRace) break; // Exit outer loop too
                    }
                }

                // Skip this race entirely if current member didn't participate
                if (!currentMemberInRace) {
                    return;
                }

                // Count all other team members in this race
                race.results.forEach(result => {
                    if (result.members) {
                        result.members.forEach(member => {
                            if (member._id !== currentMemberId) {
                                if (!teamMemberCounts[member._id]) {
                                    teamMemberCounts[member._id] = {
                                        _id: member._id,
                                        firstname: member.firstname,
                                        lastname: member.lastname,
                                        username: member.username,
                                        count: 0
                                    };
                                }
                                teamMemberCounts[member._id].count++;
                            }
                        });
                    }
                });
            });

            // Convert to array and sort by count
            $scope.memberStats.topTeamMembers = Object.values(teamMemberCounts)
                .sort((a, b) => b.count - a.count);
                 // Top 10

            const endTime = performance.now();
            const duration = endTime - startTime;
           
        };

        // Calculate top team members
        $scope.calculateTopTeamMembers(results, raceList);
    };
    
    // Navigation functions for stats links
    $scope.goToResultsWithQuery = function(query) {
        if (query && (query.members || query.distance || query.year)) {
            $state.go('/results', { search: JSON.stringify(query) });
        }
    };

    $scope.goToResultsWithLocationQuery = function(members, countries, states) {
        if (members && (countries || states)) {
            var queryParams = { members: members };
            if (countries) queryParams.countries = countries;
            if (states) queryParams.states = states;
            $scope.goToResultsWithQuery(queryParams);
        }
    };

    // Admin functions
    $scope.retrieveMemberForEdit = function(member) {
        MembersService.retrieveMemberForEdit(member).then(function() {});
    };

    $scope.removeMember = function(member) {
        var dlg = dialogs.confirm("Remove Member?", "Are you sure you want to remove this member?");
        dlg.result.then(function(btn) {
            MembersService.deleteMember(member).then(function() {
                $state.go('/members');
            });
        }, function(btn) {});
    };

    $scope.showRaceModal = function(race) {
        ResultsService.showRaceFromRaceIdModal(race._id);
    };

    // Initial load
    async function initialLoad() {
        if ($stateParams.member) {
            try {
                // Load all members with cache support
                const allMembers = await MembersService.getMembersWithCacheSupport();
                
                // Find the current member
                const member = allMembers.find(m => m.username === $stateParams.member);
                if (member) {
                    $scope.loadMemberStats(member);
                } else {
                    $state.go('/members');
                }
            } catch (error) {
                console.error('Error loading member:', error);
                $state.go('/members');
            }
        }
    }

    initialLoad();
}]); 