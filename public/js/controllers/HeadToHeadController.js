angular.module('mcrrcApp').controller('HeadToHeadController', ['$scope', '$stateParams', '$state', 'MembersService', 'ResultsService', 'StatsService', 'UtilsService', '$analytics', 'dialogs', '$filter', function($scope, $stateParams, $state, MembersService, ResultsService, StatsService, UtilsService, $analytics, dialogs, $filter) {
    
    $scope.loading = true;
    $scope.member1 = null;
    $scope.member2 = null;
    $scope.member1Results = [];
    $scope.member2Results = [];
    $scope.sharedRaces = [];
    $scope.comparisonStats = {};
    $scope.headToHeadRecord = { member1Wins: 0, member2Wins: 0, ties: 0 };
    
    // Mode variables
    $scope.isTabMode = false;
    $scope.topTeamMembers = [];
    $scope.selectedComparisonMember = null;

    // Sorting variables for team members table
    $scope.teamMemberSortCriteria = 'wins';
    $scope.teamMemberSortDirection = false; // false = desc, true = asc
    $scope.sortedTeamMembers = [];
    
    // Gender filter for team members table
    $scope.teamMemberGenderFilter = null; // null = all, 'Male' = male only, 'Female' = female only
    
    // Load head-to-head data
    $scope.loadHeadToHeadData = async function() {
        // Check if we're in tab mode (member detail page)
        if ($stateParams.member) {
            $scope.isTabMode = true;
            if ($stateParams.member2) {
                // Tab mode with member2 - direct comparison
                await $scope.loadTabComparisonModeData();
            } else {
                // Tab mode - member detail page (selection mode)
                await $scope.loadTabModeData();
            }
        } else {
            $state.go('/members');
            return;
        }
    };

    // Load data for tab mode (member detail page)
    $scope.loadTabModeData = async function() {
        if (!$stateParams.member) {
            $state.go('/members');
            return;
        }

        // Set loading state early
        $scope.loading = true;
        if (!$scope.$$phase) {
            $scope.$apply();
        }

        try {
            // Load all members with cache support
            const allMembers = await MembersService.getMembersWithCacheSupport();
            
            // Find the current member
            const currentMember = allMembers.find(m => m.username === $stateParams.member);
            if (!currentMember) {
                $state.go('/members');
                return;
            }

            $scope.member1 = currentMember;

            // Load race data to calculate team members
            const raceList = await ResultsService.getRaceResultsWithCacheSupport({
                "sort": '-racedate -order racename',
                "preload": false
            });

            // Calculate top team members
            $scope.calculateTopTeamMembers(raceList);

            $scope.loading = false;
            
            // Force digest cycle to update UI
            if (!$scope.$$phase) {
                $scope.$apply();
            }
            
            $analytics.eventTrack('viewMemberHeadToHead', {
                category: 'Member',
                label: 'viewing member head-to-head tab ' + currentMember.firstname + ' ' + currentMember.lastname
            });

        } catch (error) {
            console.error('Error loading member head-to-head data:', error);
            $scope.loading = false;
            if (!$scope.$$phase) {
                $scope.$apply();
            }
            $state.go('/members');
        }
    };

    // Load data for tab comparison mode (member detail page with member2)
    $scope.loadTabComparisonModeData = async function() {
        if (!$stateParams.member || !$stateParams.member2) {
            $state.go('/members');
            return;
        }

        try {
            // Set loading state early to prevent UI issues
            $scope.loading = true;
            
            // Add timeout safeguard to prevent infinite loading
            const timeoutId = setTimeout(() => {
                console.warn('Head-to-head data loading timeout, clearing loading state');
                $scope.loading = false;
                if (!$scope.$$phase) {
                    $scope.$apply();
                }
            }, 30000); // 30 second timeout
            
            // Load all members with cache support
            const allMembers = await MembersService.getMembersWithCacheSupport();
            
            // Find the specific members we need
            const member1 = allMembers.find(m => m.username === $stateParams.member);
            const member2 = allMembers.find(m => m.username === $stateParams.member2);

            if (!member1 || !member2) {
                $state.go('/members');
                return;
            }

            $scope.member1 = member1;
            $scope.member2 = member2;
            
            // Load race data to calculate team members for the dropdown
            const raceList = await ResultsService.getRaceResultsWithCacheSupport({
                "sort": '-racedate -order racename',
                "preload": false
            });
            
            $scope.calculateTopTeamMembers(raceList);
            
            // Set the selected comparison member for the dropdown (find the one with count property)
            $scope.selectedComparisonMember = $scope.topTeamMembers.find(tm => tm.username === member2.username) || member2;

            // Use the cached full race results instead of loading individual member results
            // Extract results for both members from the full races data
            $scope.member1Results = [];
            $scope.member2Results = [];
            
            raceList.forEach(race => {
                if (race.results && race.results.length > 0) {
                    race.results.forEach(result => {
                        if (result.members) {
                            result.members.forEach(member => {
                                if (member._id === member1._id) {
                                    $scope.member1Results.push({
                                        ...result,
                                        race: race
                                    });
                                }
                                if (member._id === member2._id) {
                                    $scope.member2Results.push({
                                        ...result,
                                        race: race
                                    });
                                }
                            });
                        }
                    });
                }
            });

            // Calculate comparison statistics
            $scope.comparisonStats = $scope.calculateComparisonStats($scope.member1Results, $scope.member2Results);
            $scope.sharedRaces = $scope.findSharedRaces($scope.member1Results, $scope.member2Results);
            $scope.calculateHeadToHeadRecord();

            // Clear the timeout since we completed successfully
            clearTimeout(timeoutId);
            
            // Ensure loading is set to false
            $scope.loading = false;
            
            // Force a digest cycle to update the UI
            if (!$scope.$$phase) {
                $scope.$apply();
            }

            $analytics.eventTrack('viewHeadToHead', {
                category: 'Member',
                label: 'viewing head-to-head tab ' + member1.firstname + ' ' + member1.lastname + ' vs ' + member2.firstname + ' ' + member2.lastname
            });

        } catch (error) {
            console.error('Error loading head-to-head data:', error);
            // Clear timeout and ensure loading is cleared on error
            clearTimeout(timeoutId);
            $scope.loading = false;
            if (!$scope.$$phase) {
                $scope.$apply();
            }
            $state.go('/members');
        }
    };


    // Calculate comprehensive comparison statistics
    $scope.calculateComparisonStats = function(member1Results, member2Results) {
        // Use provided results or fall back to scope variables
        const results1 = member1Results || $scope.member1Results;
        const results2 = member2Results || $scope.member2Results;
        
        const stats1 = $scope.calculateMemberStats(results1);
        const stats2 = $scope.calculateMemberStats(results2);

   
        const comparisonStats = {
            member1: stats1,
            member2: stats2,
            comparison: {
                totalRaces: { member1: stats1.totalRaces, member2: stats2.totalRaces },
                yearsRacing: { member1: stats1.yearsRacing, member2: stats2.yearsRacing },
                avgRacesPerYear: { member1: stats1.avgRacesPerYear, member2: stats2.avgRacesPerYear },
                wins: { member1: stats1.wins, member2: stats2.wins },
                top3Finishes: { member1: stats1.top3Finishes, member2: stats2.top3Finishes },
                bestAgeGrade: { member1: stats1.bestAgeGrade, member1Race: stats1.bestAgeGradeRace, member2: stats2.bestAgeGrade, member2Race: stats2.bestAgeGradeRace },
                avgAgeGrade: { member1: stats1.avgAgeGrade, member2: stats2.avgAgeGrade },
                totalMiles: { member1: stats1.totalMiles, member2: stats2.totalMiles },
                uniqueLocations: { member1: stats1.uniqueLocations, member2: stats2.uniqueLocations },
                uniqueStates: { member1: stats1.uniqueStates, member2: stats2.uniqueStates },
                uniqueCountries: { member1: stats1.uniqueCountries, member2: stats2.uniqueCountries }
            }
        };
       

        // Update scope variable for comparison mode
        if (!member1Results && !member2Results) {
            $scope.comparisonStats = comparisonStats;
        }

        return comparisonStats;
    };

    // Calculate individual member statistics
    $scope.calculateMemberStats = function(results) {
        const stats = {
            totalRaces: results.length,
            yearsRacing: 0,
            avgRacesPerYear: 0,
            wins: 0,
            top3Finishes: 0,
            bestAgeGrade: 0,
            bestAgeGradeRace: null,
            avgAgeGrade: 0,
            totalMiles: 0,
            uniqueLocations: new Set(),
            uniqueStates: new Set(),
            uniqueCountries: new Set(),
            raceTypeBreakdown: {},
            locationBreakdown: {}
        };

        const years = new Set();
        let totalAgeGrade = 0;
        let ageGradeCount = 0;

        results.forEach(result => {
            // Track years
            const raceYear = new Date(result.race.racedate).getUTCFullYear();
            years.add(raceYear);

            // Track locations
            if (result.race.location) {
                const locationKey = result.race.location.country + (result.race.location.state ? ' - ' + result.race.location.state : '');
                stats.uniqueLocations.add(locationKey);
                stats.uniqueStates.add(result.race.location.state || '');
                stats.uniqueCountries.add(result.race.location.country);
            }

            // Track race types
            if (result.race.racetype) {
                const raceTypeName = result.race.racetype.name;
                stats.raceTypeBreakdown[raceTypeName] = (stats.raceTypeBreakdown[raceTypeName] || 0) + 1;
            }

            // Track miles
            if (!result.race.isMultisport && result.race.racetype && result.race.racetype.miles) {
                stats.totalMiles += result.race.racetype.miles;
            }

            // Track rankings
            if (result.ranking) {
                if (result.ranking.overallrank && result.ranking.overallrank === 1 || result.ranking.genderrank && result.ranking.genderrank === 1) {
                    stats.wins++;
                }
                if (result.ranking.overallrank && result.ranking.overallrank <= 3 || result.ranking.genderrank && result.ranking.genderrank <= 3) {
                    stats.top3Finishes++;
                }
            }

            // Track age grades
            if (result.agegrade) {
                totalAgeGrade += result.agegrade;
                ageGradeCount++;
                if (result.agegrade > stats.bestAgeGrade) {
                    stats.bestAgeGrade = result.agegrade;
                    stats.bestAgeGradeRace = result.race;
                }
            }
        });

        // Calculate derived stats
        stats.yearsRacing = years.size;
        stats.avgRacesPerYear = results.length / years.size;
        stats.avgAgeGrade = ageGradeCount > 0 ? totalAgeGrade / ageGradeCount : 0;
        stats.uniqueLocations = stats.uniqueLocations.size;
        stats.uniqueStates = stats.uniqueStates.size;
        stats.uniqueCountries = stats.uniqueCountries.size;

        return stats;
    };

    // Find races where both members participated
    $scope.findSharedRaces = function(member1Results, member2Results) {
        // Use provided results or fall back to scope variables
        const results1 = member1Results || $scope.member1Results;
        const results2 = member2Results || $scope.member2Results;
        
        const member1RaceIds = new Set(results1.map(r => r.race._id));
        const member2RaceIds = new Set(results2.map(r => r.race._id));
        
        // Find intersection of race IDs
        const sharedRaceIds = new Set([...member1RaceIds].filter(id => member2RaceIds.has(id)));
        
        const sharedRaces = [];
        
        sharedRaceIds.forEach(raceId => {
            const member1Result = results1.find(r => r.race._id === raceId);
            const member2Result = results2.find(r => r.race._id === raceId);
            
            // Skip if both members are in the same result (same _id)
            if (member1Result && member2Result && member1Result._id !== member2Result._id) {
                const isTie = member1Result.time === member2Result.time;
                sharedRaces.push({
                    race: member1Result.race,
                    member1Result: member1Result,
                    member2Result: member2Result,
                    timeDifference: isTie ? 0 : Math.abs(member1Result.time - member2Result.time),
                    winner: isTie ? null : (member1Result.time < member2Result.time ? 'member1' : 'member2'),
                    isTie: isTie
                });
            }
        });

        // Sort by date (most recent first) and return
        return sharedRaces.sort((a, b) => new Date(b.race.racedate) - new Date(a.race.racedate));
    };

    // Calculate head-to-head record
    $scope.calculateHeadToHeadRecord = function() {
        $scope.headToHeadRecord = { member1Wins: 0, member2Wins: 0, ties: 0 };
        
        $scope.sharedRaces.forEach(race => {
            if (race.isTie) {
                $scope.headToHeadRecord.ties++;
            } else if (race.winner === 'member1') {
                $scope.headToHeadRecord.member1Wins++;
            } else {
                $scope.headToHeadRecord.member2Wins++;
            }
        });
    };

    // Selection mode functions
    // Calculate top team members (for selection mode)
    $scope.calculateTopTeamMembers = function(raceList) {
        const teamMemberCounts = {};
        const currentMemberId = $scope.member1._id;

        // Go through all races to find team members and calculate head-to-head records
        raceList.forEach(race => {
            if (!race.results || race.results.length === 0) {
                return;
            }

            // Find current member's result in this race
            let currentMemberResult = null;
            let currentMemberInRace = false;
            
            for (let i = 0; i < race.results.length; i++) {
                const result = race.results[i];
                if (result.members) {
                    for (let j = 0; j < result.members.length; j++) {
                        if (result.members[j]._id === currentMemberId) {
                            currentMemberResult = result;
                            currentMemberInRace = true;
                            break;
                        }
                    }
                    if (currentMemberInRace) break;
                }
            }

            // Skip this race if current member didn't participate
            if (!currentMemberInRace || !currentMemberResult) {
                return;
            }

            // Count all other team members in this race and calculate head-to-head
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
                                    sex: member.sex,
                                    count: 0,
                                    headToHeadRecord: {
                                        wins: 0,
                                        losses: 0,
                                        ties: 0,
                                        winRate: 0
                                    }
                                };
                            }
                            teamMemberCounts[member._id].count++;

                            // Calculate head-to-head result for this race
                            // Skip if both members are in the same result (same _id)
                            if (currentMemberResult._id !== result._id) {
                                const currentMemberTime = currentMemberResult.time;
                                const otherMemberTime = result.time;
                                
                                if (currentMemberTime === otherMemberTime) {
                                    // Tie
                                    teamMemberCounts[member._id].headToHeadRecord.ties++;
                                } else if (currentMemberTime < otherMemberTime) {
                                    // Current member wins (faster time)
                                    teamMemberCounts[member._id].headToHeadRecord.wins++;
                                } else {
                                    // Other member wins (faster time)
                                    teamMemberCounts[member._id].headToHeadRecord.losses++;
                                }
                            }
                        }
                    });
                }
            });
        });

        // Calculate win rates and convert to array
        $scope.topTeamMembers = Object.values(teamMemberCounts).map(member => {
            const totalRaces = member.headToHeadRecord.wins + member.headToHeadRecord.losses + member.headToHeadRecord.ties;
            member.headToHeadRecord.winRate = totalRaces > 0 ? (member.headToHeadRecord.wins / totalRaces) * 100 : 0;
            return member;
        });

        // Initialize sorted array with default sort (by wins descending)
        $scope.sortTeamMembers();
    };

    // Sort team members function
    $scope.sortTeamMembersBy = function(criteria) {
        if ($scope.teamMemberSortCriteria === criteria) {
            $scope.teamMemberSortDirection = !$scope.teamMemberSortDirection;
        } else {
            $scope.teamMemberSortCriteria = criteria;
            $scope.teamMemberSortDirection = false; // Default to descending
        }
        $scope.sortTeamMembers();
    };

    // Apply sorting to team members
    $scope.sortTeamMembers = function() {
        if (!$scope.topTeamMembers || $scope.topTeamMembers.length === 0) {
            $scope.sortedTeamMembers = [];
            return;
        }

        $scope.sortedTeamMembers = $scope.topTeamMembers.slice().sort((a, b) => {
            let aValue, bValue;

            switch ($scope.teamMemberSortCriteria) {
                case 'firstname':
                    aValue = a.firstname + ' ' + a.lastname;
                    bValue = b.firstname + ' ' + b.lastname;
                    break;
                case 'count':
                    aValue = a.count;
                    bValue = b.count;
                    break;
                case 'wins':
                    aValue = a.headToHeadRecord.wins;
                    bValue = b.headToHeadRecord.wins;
                    break;
                case 'losses':
                    aValue = a.headToHeadRecord.losses;
                    bValue = b.headToHeadRecord.losses;
                    break;
                case 'ties':
                    aValue = a.headToHeadRecord.ties;
                    bValue = b.headToHeadRecord.ties;
                    break;
                case 'winRate':
                    aValue = a.headToHeadRecord.winRate;
                    bValue = b.headToHeadRecord.winRate;
                    break;
                default:
                    aValue = a.headToHeadRecord.wins;
                    bValue = b.headToHeadRecord.wins;
            }

            if (typeof aValue === 'string') {
                return $scope.teamMemberSortDirection ? 
                    aValue.localeCompare(bValue) : 
                    bValue.localeCompare(aValue);
            } else {
                return $scope.teamMemberSortDirection ? 
                    aValue - bValue : 
                    bValue - aValue;
            }
        });
    };

    

    // Load comparison data for selected member (for selection mode)
    $scope.loadComparison = async function(teamMember) {
        if (!teamMember) return;

        // Always navigate to the comparison URL when a member is selected
        // This works whether we're in selection mode or already in comparison mode
        $state.transitionTo('/members/member/head-to-head-compare', {
            member: $scope.member1.username,
            member2: teamMember.username
        });
    };

    // Navigation functions
    $scope.goToMemberStats = function(member) {
        $state.go('/members/member/stats', { member: member.username });
    };

    $scope.goToMemberDetail = function(member) {
        $state.go('/members/member/bio', { member: member.username });
    };

    $scope.showTeamMembersList = function(member) {
        $state.go('/members/member/head-to-head', { member: member.username});
    };

    $scope.goToResultsWithQuery = function(query) {
        if (query && (query.members || query.distance || query.year)) {
            $state.go('/results', { search: JSON.stringify(query) });
        }
    };

    // Show race modal for race details
    $scope.showRaceModal = function(race) {
        console.log('showRaceModal', race);
        if (race) {
            ResultsService.showRaceModal(race).then(function() {});
        }
    };

    $scope.formatTime = function(timeInCentiseconds) {
        return $filter('secondsToTimeString')(timeInCentiseconds);
    };

    $scope.formatDate = function(date) {
        return new Date(date).toLocaleDateString();
    };

    // Gender filter functions for team members table
    $scope.setTeamMemberGenderFilter = function(gender) {
        $scope.teamMemberGenderFilter = gender;
        // Re-sort the filtered results
        $scope.sortTeamMembers();
    };

    $scope.getFilteredTeamMembers = function() {
        if (!$scope.sortedTeamMembers || $scope.sortedTeamMembers.length === 0) {
            return [];
        }

        if (!$scope.teamMemberGenderFilter) {
            return $scope.sortedTeamMembers;
        }

        return $scope.sortedTeamMembers.filter(function(member) {
            return member.sex === $scope.teamMemberGenderFilter;
        });
    };

    // Get team members for dropdown, ordered by number of races together (count)
    $scope.getTeamMembersForDropdown = function() {
        if (!$scope.topTeamMembers || $scope.topTeamMembers.length === 0) {
            return [];
        }

        // Sort by count (number of races together) in descending order
        return $scope.topTeamMembers.slice().sort(function(a, b) {
            return b.count - a.count;
        });
    };

    // Initialize
    $scope.loadHeadToHeadData();
}]);

