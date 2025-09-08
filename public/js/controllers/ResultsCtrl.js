angular.module('mcrrcApp.results').controller('ResultsController', ['$scope', '$analytics', 'AuthService', 'ResultsService', 'UtilsService', 'dialogs', 'localStorageService','$stateParams','$location', '$q', 'MembersService', '$timeout', function($scope, $analytics, AuthService, ResultsService, UtilsService, dialogs, localStorageService,$stateParams,$location, $q, MembersService, $timeout) {
    

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function(user) {
        $scope.user = user;
    });

    $scope.$watch('resultsTableProperties.pageSize', function(newVal, oldVal) {
        localStorageService.set('resultsPageSize', $scope.resultsTableProperties);
    });

    if (localStorageService.get('resultsPageSize')) {
        $scope.resultsTableProperties = localStorageService.get('resultsPageSize');
    } else {
        $scope.resultsTableProperties = {};
        $scope.resultsTableProperties.pageSize = 10;
    }

    // Initialize current page

    // Watch for page changes and clear expanded races
    $scope.pageChange = function (newPageNumber) {
            $scope.expandedRaces = {};
    };

    $scope.sortRaceBy = function (criteria) {
        if ($scope.sortCriteria === criteria) {
            $scope.sortDirection = $scope.sortDirection === true ? false : true;
        } else {
            $scope.sortCriteria = criteria;
            $scope.sortDirection = true;
        }
        //sortDirection true = asc, false = desc
        $scope.racesList.sort(customRaceSort($scope.racesList, $scope.sortCriteria, $scope.sortDirection));
    };

    // Helper function to check if a ranking is within a specified range
    function isRankingInRange(actualRank, rankingFilter) {
        if (!actualRank || !rankingFilter) {
            return false;
        }
        
        // Convert to string to handle both numbers and strings
        var filterStr = String(rankingFilter).trim();
        
        // Check if it's a range (contains dash)
        if (filterStr.includes('-')) {
            var parts = filterStr.split('-');
            if (parts.length === 2) {
                var minRank = parseInt(parts[0].trim());
                var maxRank = parseInt(parts[1].trim());
                
                // Validate the range
                if (!isNaN(minRank) && !isNaN(maxRank) && minRank <= maxRank) {
                    return actualRank >= minRank && actualRank <= maxRank;
                }
            }
        } else {
            // Single number comparison
            var targetRank = parseInt(filterStr);
            if (!isNaN(targetRank)) {
                return actualRank === targetRank;
            }
        }
        
        return false;
    }

    function customRaceSort(arr, field, order) {
        return (race1, race2) => {
           

            if (field === 'racedate') {
                if (race1.racedate < race2.racedate) {
                    return order === true ? -1 : 1;
                } else if (race1.racedate > race2.racedate) {
                    return order === true ? 1 : -1;
                }

                if (race1.order < race2.order) {
                    return order === true ? -1 : 1;
                } else if (race1.order > race2.order) {
                    return order === true ? 1 : -1;
                }

                if (race1.racename < race2.racename) {
                    return order === true ? -1 : 1;
                } else if (race1.racename > race2.racename) {
                    return order === true ? 1 : -1;
                }                                
                return 0;
            }

            if (field === 'distance') {
                // Always put multisport races at the end
                if (race1.isMultisport && race1.isMultisport === true) {
                    return 1;
                }
                if (race2.isMultisport && race2.isMultisport === true) {
                    return -1;
                }
                if (race1.racetype.miles > race2.racetype.miles) {
                    return order === true ? -1 : 1;
                } else if (race1.racetype.miles < race2.racetype.miles) {
                    return order === true ? 1 : -1;
                }
                return 0;
            }

            if (field === 'participation') {
                if (race1.results.length > race2.results.length) {
                    return order === true ? -1 : 1;
                } else if (race1.results.length < race2.results.length) {
                    return order === true ? 1 : -1;
                }
                return 0;
            }
        };
    }

    $scope.resultSize = [5, 10, 25, 50, 100];    

    // $scope.resultsList = [];
    // ResultsService.getResultsWithCacheSupport({
    //     "sort": '-race.racedate -race.order race.racename time ranking.overallrank members.firstname',
    //     "limit": 200,
    //     "preload":true
    // }).then(function(results) {
    //     $scope.resultsList = results;
    //     //now load the whole thing unless the initial call return the cache version (>200 res).
    //     if (results.length == 200){
    //         ResultsService.getResultsWithCacheSupport({
    //             "sort": '-race.racedate -race.order race.racename time ranking.overallrank members.firstname',
    //             "preload":false
    //         }).then(function(results) {
    //             $scope.resultsList = results;
    //         });
    //     }            
    // }); 

    $scope.racesList = [];
    $scope.expandedRaces = {}; 
    $scope.filteredRacesList = [];

    // Filter panel state
    $scope.filterPanelExpanded = false;
    $scope.showAdvancedFilters = false;

    // Filter options
    $scope.filters = {
        dateFrom: '',
        dateTo: '',
        distanceMin: 0,
        distanceMax: 100,
        raceTypes: [],
        countries: [],
        states: [],
        selectedMembers: []
    };

    // Distance range for slider
    $scope.distanceRange = {
        min: 0,
        max: 100
    };

    // Available filter options
    $scope.availableRaceTypes = [];
    $scope.availableCountries = [];
    $scope.availableStates = [];
    $scope.availableMembers = [];
    $scope.allMembers = [];
    
    // Initialize selection variables for dropdowns
    $scope.selectedCountry = null;
    $scope.selectedState = null;
    $scope.selectedMember = null;
    $scope.selectedRaceType = null;
    
    // Feedback states for visual confirmation
    $scope.showCountryFeedback = false;
    $scope.showStateFeedback = false;
    $scope.showMemberFeedback = false;
    $scope.showRaceTypeFeedback = false;

    // Loading states for better UX
    $scope.loadingStates = {
        races: false
    };
    
    // Error state
    $scope.loadingError = false;

    $scope.loadRaces = function() {
        $scope.loadingStates.races = true;
        $scope.loadingError = false; // Clear any previous error state
        
        // Add a timeout to prevent infinite loading
        var timeoutPromise = $q(function(resolve, reject) {
            setTimeout(function() {
                reject(new Error('Loading timeout - taking too long'));
            }, 30000); // 30 second timeout
        });
        
        var loadPromise = ResultsService.getRaceResultsWithCacheSupport({
            "limit": 100,
            "sort": '-racedate -order racename',
            "preload":true
        }).then(function(races) {
            $scope.racesList = races;        
            
            //now load the whole thing unless the initial call return the cache version (>200 res).
            if (races.length < 200){
                return ResultsService.getRaceResultsWithCacheSupport({
                    "sort": '-racedate -order racename',
                    "preload":false
                }).then(function(fullRaces) {
                    $scope.racesList = fullRaces;
                    return fullRaces;
                });
            } else {
                return races;
            }
        }).then(async function(finalRaces) {
            $scope.loadingStates.races = false;
            await $scope.populateFilterOptions();
            $scope.applyFilters();
            
            // Process state params after everything is loaded
            $scope.processStateParams();
            
            // Initialize the distance slider after data is loaded
            setTimeout(function() {
                $scope.initDistanceSlider();
            }, 100);
            
            return finalRaces;
        }).catch(function(error) {
            $scope.loadingStates.races = false;
            $scope.loadingError = true; // Set error state
            throw error;
        });
        
        // Race between the load promise and timeout
        return $q.race([loadPromise, timeoutPromise]).catch(function(error) {
            $scope.loadingStates.races = false;
            $scope.loadingError = true; // Set error state
            throw error;
        });
    };

    // Initialize races when controller loads
    $scope.loadRaces();

    // Filter functions
    $scope.toggleFilterPanel = function() {
        $scope.filterPanelExpanded = !$scope.filterPanelExpanded;
    };

    $scope.toggleAdvancedFilters = function() {
        $scope.showAdvancedFilters = !$scope.showAdvancedFilters;
        if ($scope.showAdvancedFilters) {
            $scope.filterPanelExpanded = true;
        }
    };

    $scope.clearAllFilters = function() {
        $scope.searchQuery = '';
        $scope.filters = {
            dateFrom: '',
            dateTo: '',
            distanceMin: 0,
            distanceMax: $scope.distanceRange.max,
            raceTypes: [],
            countries: [],
            states: [],
            selectedMembers: []
        };
        $scope.applyFilters();
    };



    $scope.clearDistanceFilter = function() {
        $scope.filters.distanceMin = 0;
        $scope.filters.distanceMax = $scope.distanceRange.max;
        
        // Reset the slider to default values
        var distanceSlider = document.getElementById('distance-slider');
        if (distanceSlider && distanceSlider.noUiSlider) {
            distanceSlider.noUiSlider.set([0, $scope.distanceRange.max]);
        }
        
        $scope.applyFilters();
    };

    $scope.onDistanceMinChange = function() {
        // Ensure min doesn't exceed max
        if ($scope.filters.distanceMin > $scope.filters.distanceMax) {
            $scope.filters.distanceMin = $scope.filters.distanceMax;
        }
        $scope.applyFilters();
    };

    $scope.onDistanceMaxChange = function() {
        // Ensure max doesn't go below min
        if ($scope.filters.distanceMax < $scope.filters.distanceMin) {
            $scope.filters.distanceMax = $scope.filters.distanceMin;
        }
        // Ensure max doesn't exceed the actual max distance
        if ($scope.filters.distanceMax > $scope.distanceRange.max) {
            $scope.filters.distanceMax = $scope.distanceRange.max;
        }
        $scope.applyFilters();
    };

    // Initialize noUiSlider
    $scope.initDistanceSlider = function() {
        if (typeof noUiSlider !== 'undefined') {
            var distanceSlider = document.getElementById('distance-slider');
            if (distanceSlider) {
                noUiSlider.create(distanceSlider, {
                    start: [$scope.filters.distanceMin, $scope.filters.distanceMax],
                    connect: true,
                    range: {
                        'min': $scope.distanceRange.min,
                        'max': $scope.distanceRange.max
                    },
                    step: 0.1,
                    format: {
                        to: function (value) {
                            return Math.round(value * 10) / 10;
                        },
                        from: function (value) {
                            return Math.round(value * 10) / 10;
                        }
                    }
                });

                // Update Angular model when slider changes (real-time updates)
                distanceSlider.noUiSlider.on('update', function (values, handle) {
                    if (!$scope.$$phase) {
                        $scope.$apply(function() {
                            $scope.filters.distanceMin = parseFloat(values[0]);
                            $scope.filters.distanceMax = parseFloat(values[1]);
                            $scope.applyFilters();
                        });
                    }
                });
            }
        }
    };

    // Update slider when input fields change
    $scope.updateSliderFromInputs = function() {
        var distanceSlider = document.getElementById('distance-slider');
        if (distanceSlider && distanceSlider.noUiSlider) {
            distanceSlider.noUiSlider.set([$scope.filters.distanceMin, $scope.filters.distanceMax]);
        }
    };

    // Handle min distance input change
    $scope.onDistanceMinInputChange = function() {
        // Ensure min doesn't exceed max
        if ($scope.filters.distanceMin > $scope.filters.distanceMax) {
            $scope.filters.distanceMin = $scope.filters.distanceMax;
        }
        // Ensure min is not negative
        if ($scope.filters.distanceMin < 0) {
            $scope.filters.distanceMin = 0;
        }
        $scope.updateSliderFromInputs();
        $scope.applyFilters();
    };

    // Handle max distance input change
    $scope.onDistanceMaxInputChange = function() {
        // Ensure max doesn't go below min
        if ($scope.filters.distanceMax < $scope.filters.distanceMin) {
            $scope.filters.distanceMax = $scope.filters.distanceMin;
        }
        // Ensure max doesn't exceed the actual max distance
        if ($scope.filters.distanceMax > $scope.distanceRange.max) {
            $scope.filters.distanceMax = $scope.distanceRange.max;
        }
        $scope.updateSliderFromInputs();
        $scope.applyFilters();
    };



    $scope.hasActiveFilters = function() {
        return $scope.filters.dateFrom || 
               $scope.filters.dateTo || 
               $scope.filters.distanceMin > 0 || 
               $scope.filters.distanceMax < $scope.distanceRange.max ||
               ($scope.filters.raceTypes && $scope.filters.raceTypes.length > 0) ||
               ($scope.filters.countries && $scope.filters.countries.length > 0) ||
               ($scope.filters.states && $scope.filters.states.length > 0) ||
               ($scope.filters.selectedMembers && $scope.filters.selectedMembers.length > 0);
    };

    $scope.getActiveFilterCount = function() {
        var count = 0;
        
        // Count date filters
        if ($scope.filters.dateFrom) count++;
        if ($scope.filters.dateTo) count++;
        
        // Count distance filter (only if not at default values)
        if ($scope.filters.distanceMin > 0 || $scope.filters.distanceMax < $scope.distanceRange.max) count++;
        
        // Count individual items in array filters
        if ($scope.filters.raceTypes && $scope.filters.raceTypes.length > 0) {
            count += $scope.filters.raceTypes.length;
        }
        if ($scope.filters.countries && $scope.filters.countries.length > 0) {
            count += $scope.filters.countries.length;
        }
        if ($scope.filters.states && $scope.filters.states.length > 0) {
            count += $scope.filters.states.length;
        }
        if ($scope.filters.selectedMembers && $scope.filters.selectedMembers.length > 0) {
            count += $scope.filters.selectedMembers.length;
        }
        
        return count;
    };

    $scope.getRaceTypeClass = function(s) {
        if (s !== undefined) {
            return s.replace(/ /g, '') + '-col';
        }
    };

    $scope.applyFilters = function() {
        // Validate distance range - ensure min doesn't exceed max
        if ($scope.filters.distanceMin > $scope.filters.distanceMax) {
            $scope.filters.distanceMin = $scope.filters.distanceMax;
        }
        
        if (!$scope.racesList || $scope.racesList.length === 0) {
            $scope.filteredRacesList = [];
            return;
        }

        $scope.filteredRacesList = $scope.racesList.filter(function(race) {
            // Original search query filter (always active)
            if ($scope.searchQuery) {
                var searchLower = $scope.searchQuery.toLowerCase();
                var raceMatches = race.racename.toLowerCase().includes(searchLower) ||
                                (race.location.country && race.location.country.toLowerCase().includes(searchLower)) ||
                                (race.location.state && race.location.state.toLowerCase().includes(searchLower)) ||
                                race.racetype.name.toLowerCase().includes(searchLower);
                
                var resultMatches = race.results.some(function(result) {
                    return result.members.some(function(member) {
                        return (member.firstname && member.firstname.toLowerCase().includes(searchLower)) ||
                               (member.lastname && member.lastname.toLowerCase().includes(searchLower)) ||
                               (member.username && member.username.toLowerCase().includes(searchLower));
                    });
                });
                
                if (!raceMatches && !resultMatches) {
                    return false;
                }
            }

            // Advanced filters (only if advanced filters are enabled)
            if ($scope.showAdvancedFilters) {
                // Date range filter
                var raceDate = new Date(race.racedate);
                
                if ($scope.filters.dateFrom) {
                    // Ensure dateFrom is treated as UTC (start of day)
                    var fromDate = new Date(Date.UTC(
                        new Date($scope.filters.dateFrom).getFullYear(),
                        new Date($scope.filters.dateFrom).getMonth(),
                        new Date($scope.filters.dateFrom).getDate()
                    ));
                    if (raceDate < fromDate) {
                        return false;
                    }
                }

                if ($scope.filters.dateTo) {
                    // Ensure dateTo is treated as UTC (end of day)
                    var toDate = new Date(Date.UTC(
                        new Date($scope.filters.dateTo).getFullYear(),
                        new Date($scope.filters.dateTo).getMonth(),
                        new Date($scope.filters.dateTo).getDate(),
                        23, 59, 59, 999
                    ));
                    if (raceDate > toDate) {
                        return false;
                    }
                }

                // Distance range filter
                var raceDistance = race.racetype.miles;
                if (raceDistance < $scope.filters.distanceMin || raceDistance > $scope.filters.distanceMax) {
                    return false;
                }

                // Race type filter - multiple race types
                if ($scope.filters.raceTypes && $scope.filters.raceTypes.length > 0) {
                    var raceTypeMatch = false;
                    for (var rt = 0; rt < $scope.filters.raceTypes.length; rt++) {
                        if (race.racetype._id === $scope.filters.raceTypes[rt]._id) {
                            raceTypeMatch = true;
                            break;
                        }
                    }
                    if (!raceTypeMatch) {
                        return false;
                    }
                }

                // Location filter - multiple countries
                if ($scope.filters.countries && $scope.filters.countries.length > 0 || $scope.filters.states && $scope.filters.states.length > 0) {
                    var countryMatch = false;
                    var stateMatch = false;
                    for (var c = 0; c < $scope.filters.countries.length; c++) {
                        if (race.location.country === $scope.filters.countries[c].code) {
                            countryMatch = true;
                            break;
                        }
                    }
                    for (var s = 0; s < $scope.filters.states.length; s++) {
                        if (race.location.country === 'USA' && race.location.state === $scope.filters.states[s].code) {
                            stateMatch = true;
                            break;
                        }
                    }
                    if (!countryMatch && !stateMatch) {
                        return false;
                    }
                }
                
                // // State filter - multiple states
                // if ($scope.filters.states && $scope.filters.states.length > 0) {
                //     var stateMatch = false;
                //     for (var s = 0; s < $scope.filters.states.length; s++) {
                //         if (race.location.country === 'USA' && race.location.state === $scope.filters.states[s].code) {
                //             stateMatch = true;
                //             break;
                //         }
                //     }
                //     if (!stateMatch) {
                //         return false;
                //     }
                // }

                // Member filter - must include ALL selected members with optional ranking requirements
                if ($scope.filters.selectedMembers && $scope.filters.selectedMembers.length > 0) {
                    // Create a map of race members for faster lookup
                    var raceMembersMap = {};
                    var raceResultsMap = {};
                    
                    if (race.results) {
                        race.results.forEach(function(result) {
                            if (result.members) {
                                result.members.forEach(function(member) {
                                    if (member._id) {
                                        raceMembersMap[member._id] = true;
                                        // Store result data for ranking checks
                                        if (!raceResultsMap[member._id]) {
                                            raceResultsMap[member._id] = [];
                                        }
                                        if (result.ranking){
                                            raceResultsMap[member._id].push({
                                                overallRank: result.ranking.overallrank,
                                                genderRank: result.ranking.genderrank
                                                });
                                        }
                                    }
                                });
                            }
                        });
                    }
                    
                    // Check if ALL selected members participated and meet ranking requirements
                    var allMembersValid = $scope.filters.selectedMembers.every(function(selectedMember) {
                        // First check if member participated
                        if (!raceMembersMap[selectedMember._id]) {
                            return false;
                        }
                        
                        // Then check ranking requirements if specified
                        if (selectedMember.ranking) {                      
                            var memberResults = raceResultsMap[selectedMember._id];
                            if (!memberResults) {
                                return false;
                            }
                            
                            // Check if any result meets the ranking requirement
                            return memberResults.some(function(result) {
                                return isRankingInRange(result.overallRank, selectedMember.ranking) || 
                                       isRankingInRange(result.genderRank, selectedMember.ranking);
                            });
                        }
                        
                        return true; // No ranking requirement, member participated
                    });
                    
                    if (!allMembersValid) {
                        return false;
                    }
                }
            }

            return true;
        });
    };

    // Watch for changes in search query and apply filters
    $scope.$watch('searchQuery', function() {
        $scope.applyFilters();
    });

    // Populate available filter options
    $scope.populateFilterOptions = async function() {
        if (!$scope.racesList || $scope.racesList.length === 0) {
            return;
        }

         $scope.allMembers = await MembersService.getMembersWithCacheSupport({
                sort: 'memberStatus firstname',
                select: '-bio -personalBests -teamRequirementStats'
            });

        // Get unique race types and calculate distance range
        var raceTypes = {};
        var countries = {};
        var states = {};
        var members = {};
        var maxDistance = 0;

        $scope.racesList.forEach(function(race) {
            // Race types
            if (race.racetype && race.racetype._id) {
                raceTypes[race.racetype._id] = race.racetype;
            }

            // Countries and States
            if (race.location) {
                if (race.location.country) {
                    countries[race.location.country] = true;
                }
                if (race.location.state) {
                    states[race.location.state] = true;
                }
            }

            // Members
            if (race.results) {
                race.results.forEach(function(result) {
                    if (result.members) {
                        result.members.forEach(function(member) {
                            if (member._id) {
                                members[member._id] = {
                                    _id: member._id,
                                    firstname: member.firstname,
                                    lastname: member.lastname,
                                    username: member.username
                                };
                            }
                        });
                    }
                });
            }

            // Calculate max distance
            if (race.racetype && race.racetype.miles && race.racetype.miles > maxDistance) {
                maxDistance = race.racetype.miles;
            }
        });

        // Update distance range
        $scope.distanceRange.max = Math.ceil(maxDistance);
        
        // Update filter max if it's currently set to the old max
        if ($scope.filters.distanceMax === 100) {
            $scope.filters.distanceMax = $scope.distanceRange.max;
        }

        // Count occurrences of race types
        var raceTypeCounts = {};
        
        $scope.racesList.forEach(function(race) {
            if (race.racetype && race.racetype._id) {
                raceTypeCounts[race.racetype._id] = (raceTypeCounts[race.racetype._id] || 0) + 1;
            }
        });
        
        $scope.availableRaceTypes = Object.keys(raceTypes).map(function(key) {
            var raceType = raceTypes[key];
            return {
                _id: raceType._id,
                name: raceType.name,
                surface: raceType.surface,
                miles: raceType.miles,
                isVariable: raceType.isVariable,
                count: raceTypeCounts[raceType._id] || 0
            };
        }).sort(function(a, b) {
            // Put special race types at the end
            var specialTypes = ['swim', 'cycling', 'multisport', 'odd trail distance', 'odd road distance', 'odd track distance', 'odd ultra distance'];
            var runningTypes = ['odd trail distance', 'odd road distance', 'odd track distance', 'odd ultra distance'];
            var aIsSpecial = specialTypes.some(function(type) {
                return a.name.toLowerCase().includes(type);
            });
            var bIsSpecial = specialTypes.some(function(type) {
                return b.name.toLowerCase().includes(type);
            });
            
            if (aIsSpecial && !bIsSpecial) return 1;
            if (!aIsSpecial && bIsSpecial) return -1;
            if (aIsSpecial && bIsSpecial) {
                // If one is running and other isn't, put running first
                var aIsRunning = runningTypes.some(function(type) {
                    return a.name.toLowerCase().includes(type);
                });

                var bIsRunning = runningTypes.some(function(type) {
                    return b.name.toLowerCase().includes(type);
                });

                if (aIsRunning && !bIsRunning) return -1;
                if (!aIsRunning && bIsRunning) return 1;
                
                // Otherwise sort by count (descending), then by name
                if (b.count !== a.count) {
                    return b.count - a.count;
                }
                return a.name.localeCompare(b.name);
            }
            
            // Regular race types: sort by distance (ascending), then by count (descending), then by name
            if (a.miles !== b.miles) {
                return a.miles - b.miles;
            }
            if (b.count !== a.count) {
                return b.count - a.count;
            }
            return a.name.localeCompare(b.name);
        });
        
        // Count occurrences of countries and states
        var countryCounts = {};
        var stateCounts = {};
        
        $scope.racesList.forEach(function(race) {
            if (race.location) {
                if (race.location.country) {
                    countryCounts[race.location.country] = (countryCounts[race.location.country] || 0) + 1;
                }
                if (race.location.state) {
                    stateCounts[race.location.state] = (stateCounts[race.location.state] || 0) + 1;
                }
            }
        });
        
        // Get countries and states from UtilsService with counts
        $scope.availableCountries = UtilsService.countries.filter(function(country) {
            return Object.keys(countries).indexOf(country.code) !== -1;
        }).map(function(country) {
            return {
                name: country.name,
                code: country.code,
                count: countryCounts[country.code] || 0
            };
        }).sort(function(a, b) {
            // Sort alphabetically by name
            return a.name.localeCompare(b.name);
        });
        
        $scope.availableStates = UtilsService.states.filter(function(state) {
            return Object.keys(states).indexOf(state.code) !== -1;
        }).map(function(state) {
            return {
                name: state.name,
                code: state.code,
                count: stateCounts[state.code] || 0
            };
        }).sort(function(a, b) {
            // Sort alphabetically by name
            return a.name.localeCompare(b.name);
        });
        
        $scope.availableMembers = Object.keys(members).map(function(key) {
            return members[key];
        }).sort(function(a, b) {
            return a.firstname.localeCompare(b.firstname) || a.lastname.localeCompare(b.lastname);
        });
        
        // Also populate allMembers for the dropdown
        // $scope.allMembers = $scope.availableMembers;
             
    };

    // Add country to filter list
    $scope.addCountryToFilter = function(selectedCountry) {
        if (selectedCountry && selectedCountry.code) {
            // Check if country is already in the list
            var exists = $scope.filters.countries.some(function(country) {
                return country.code === selectedCountry.code;
            });
            
            if (!exists) {
                $scope.filters.countries.push(selectedCountry);
                $scope.applyFilters();
                
                // Show visual feedback
                $scope.showCountryFeedback = true;
                $timeout(function() {
                    $scope.showCountryFeedback = false;
                }, 1500);
            } else {
                // Show feedback even if already exists
                $scope.showCountryFeedback = true;
                $timeout(function() {
                    $scope.showCountryFeedback = false;
                }, 1500);
            }
        }
    };

    // Remove country from filter list
    $scope.removeCountryFromFilter = function(countryCode) {
        $scope.filters.countries = $scope.filters.countries.filter(function(country) {
            return country.code !== countryCode;
        });
        $scope.applyFilters();
    };

    // Add state to filter list
    $scope.addStateToFilter = function(selectedState) {
        if (selectedState && selectedState.code) {
            // Check if state is already in the list
            var exists = $scope.filters.states.some(function(state) {
                return state.code === selectedState.code;
            });
            
            if (!exists) {
                $scope.filters.states.push(selectedState);
                $scope.applyFilters();
                
                // Show visual feedback
                $scope.showStateFeedback = true;
                $timeout(function() {
                    $scope.showStateFeedback = false;
                }, 1500);
            } else {
                // Show feedback even if already exists
                $scope.showStateFeedback = true;
                $timeout(function() {
                    $scope.showStateFeedback = false;
                }, 1500);
            }
            
            // Clear the selection to revert to placeholder
            $scope.selectedState = null;
        }
    };

    // Remove state from filter list
    $scope.removeStateFromFilter = function(stateCode) {
        $scope.filters.states = $scope.filters.states.filter(function(state) {
            return state.code !== stateCode;
        });
        $scope.applyFilters();
    };

    // Add race type to filter list
    $scope.addRaceTypeToFilter = function(selectedRaceType) {
        if (selectedRaceType && selectedRaceType.name) {
            // Check if race type is already in the list
            var exists = $scope.filters.raceTypes.some(function(raceType) {
                return raceType.name === selectedRaceType.name && raceType.surface === selectedRaceType.surface;
            });
            
            if (!exists) {
                $scope.filters.raceTypes.push(selectedRaceType);
                $scope.applyFilters();
                
                // Show visual feedback
                $scope.showRaceTypeFeedback = true;
                $timeout(function() {
                    $scope.showRaceTypeFeedback = false;
                }, 1500);
            } else {
                // Show feedback even if already exists
                $scope.showRaceTypeFeedback = true;
                $timeout(function() {
                    $scope.showRaceTypeFeedback = false;
                }, 1500);
            }
        }
    };

    // Remove race type from filter list
    $scope.removeRaceTypeFromFilter = function(raceTypeToRemove) {
        $scope.filters.raceTypes = $scope.filters.raceTypes.filter(function(raceType) {
            return !(raceType.name === raceTypeToRemove.name && raceType.surface == raceTypeToRemove.surface);
        });
        $scope.applyFilters();
    };

    // Add member to filter list
    $scope.addMemberToFilter = function(selectedMember) {
        if (selectedMember && selectedMember._id) {
            // Check if member is already in the list
            var exists = $scope.filters.selectedMembers.some(function(member) {
                return member._id === selectedMember._id;
            });
            
            if (!exists) {
                $scope.filters.selectedMembers.push(selectedMember);
                $scope.applyFilters();
                
                // Show visual feedback
                $scope.showMemberFeedback = true;
                $timeout(function() {
                    $scope.showMemberFeedback = false;
                }, 1500);
            } else {
                // Show feedback even if already exists
                $scope.showMemberFeedback = true;
                $timeout(function() {
                    $scope.showMemberFeedback = false;
                }, 1500);
            }
        }
    };

    // Remove member from filter list
    $scope.removeMemberFromFilter = function(memberId) {
        $scope.filters.selectedMembers = $scope.filters.selectedMembers.filter(function(member) {
            return member._id !== memberId;
        });
        $scope.applyFilters();
    };

    $scope.expand = function(raceinfo) {
        if (raceinfo) {
            // Toggle the expanded state for this race
            $scope.expandedRaces[raceinfo._id] = !$scope.expandedRaces[raceinfo._id];
        }
    };

    $scope.isRaceExpanded = function(raceId) {
        return $scope.expandedRaces[raceId] === true;
    };

    $scope.expandAll = function() {
        $scope.racesList.forEach(function(race) {
            $scope.expandedRaces[race._id] = true;
        });
    };

    $scope.collapseAll = function() {
        $scope.expandedRaces = {};
    };

    $scope.removeRace = function(race) {
        var dlg = dialogs.confirm("Delete Race", "Are you sure you want to delete this race and all its results? This action cannot be undone.");
        dlg.result.then(function(btn) {
            ResultsService.deleteRace(race._id).then(function() {
                // Remove the race from the list
                var index = $scope.racesList.findIndex(function(r) {
                    return r._id === race._id;
                });
                if (index > -1) {
                    $scope.racesList.splice(index, 1);
                }
            });
        });
    };

    $scope.showAddResultModal = function() {
        var onResultCreated = function(result) {
            if (result !== null) {
                var existingRaceIndex = $scope.racesList.findIndex(function(race) {
                    return race._id === result.race._id;
                });

                if (existingRaceIndex === -1) {
                    var newRace = JSON.parse(JSON.stringify(result.race));
                    newRace.results = [result];
                    $scope.racesList.unshift(newRace);
                } else {
                    $scope.racesList[existingRaceIndex].results.unshift(result);
                }
            }
        };

        ResultsService.showAddResultModal(null, onResultCreated).then(function(result) {
            // This will only be called when the modal is finally closed with the "Save and Close" button
            onResultCreated(result);
        }, 
        // 2. Rejection Callback (for .dismiss())
        function() {});
    };

    $scope.retrieveResultForEdit =  function(resultSource) {
        ResultsService.retrieveResultForEdit(resultSource).then(function(editedResult) {
            if (editedResult) {
                // Find the race in the main list
                var raceIndex = $scope.racesList.findIndex(function(race) {
                    return race._id === editedResult.race._id;
                });

                if (raceIndex > -1) {
                    // Find the result within that race's results array
                    var resultIndex = $scope.racesList[raceIndex].results.findIndex(function(res) {
                        return res._id === editedResult._id;
                    });

                    if (resultIndex > -1) {
                        // Replace the old result with the edited one
                        $scope.racesList[raceIndex].results[resultIndex] = editedResult;
                    }
                }

            }
        });
    };

    $scope.findResultIndexById = (id) => $scope.resultsList.findIndex(result => result._id === id);



    $scope.removeResult = function(result) {
        var dlg = dialogs.confirm("Remove Result?", "Are you sure you want to remove this result?");
        dlg.result.then(function(btn) {
            ResultsService.deleteResult(result).then(function() {
                var index = $scope.resultsList.indexOf(result);
                if (index > -1) $scope.resultsList.splice(index, 1);
            });
        }, function(btn) {});
    };

    $scope.showRaceModal = function(race,fromStateParams) {
        if(race){
            ResultsService.showRaceFromResultModal(race._id,fromStateParams).then(function(result) {                
            });
        }
    };


    $scope.showResultDetailsModal = function(result,race) {
        ResultsService.showResultDetailsModal(result,race).then(function(result) {});
    };

    // Process state parameters after all data is loaded
    $scope.processStateParams = function() {
        if($stateParams.raceId){
            $scope.showRaceModal({_id:$stateParams.raceId},true);
        }

        if($stateParams.search){
            // $scope.searchQuery = $stateParams.search;
            
            if (isJson($stateParams.search)) {
                let searchParams = JSON.parse($stateParams.search);
                // Update advanced filters based on search parameters
                if (searchParams.countries && Array.isArray(searchParams.countries)) {
                    searchParams.countries.forEach(function(country) {
                        let foundCountry = $scope.availableCountries.find(c => c.code === country);
                        if (foundCountry) {
                            $scope.filters.countries.push(foundCountry);
                        }
                    });
                }
                if (searchParams.states && Array.isArray(searchParams.states)) {
                    searchParams.states.forEach(function(state) {
                        let foundState = $scope.availableStates.find(s => s.code === state);
                        if (foundState) {
                            $scope.filters.states.push(foundState);
                        }
                    });
                }
                if (searchParams.members && Array.isArray(searchParams.members)) {
                    searchParams.members.forEach(function(member) {
                        let foundMember = $scope.allMembers.find(m => 
                            m.username && m.username.toLowerCase() === member.username.toLowerCase()
                        );
                        if (foundMember) {
                            // Create a copy to avoid modifying the original member object
                            let memberWithRanking = Object.assign({}, foundMember);
                            if (member.ranking) {
                                memberWithRanking.ranking = member.ranking;
                            }
                            $scope.filters.selectedMembers.push(memberWithRanking);
                        }
                    });                    
                }

                if (searchParams.distance) {

                    if (searchParams.distance.toLowerCase() === 'other'){
                        // Add all "other" race types based on StatsService logic
                        $scope.availableRaceTypes.forEach(raceType => {
                            let isOther = false;                            
                            // Check if race type is variable                            
                            if (raceType.isVariable ) {                   
                                isOther = true;
                            }
                            // Check if surface is not road, track, trail, or ultra
                            else if (raceType.surface !== 'road' && raceType.surface !== 'track' && 
                                     raceType.surface !== 'trail' && raceType.surface !== 'ultra') {
                                isOther = true;
                            }
                            
                            if (isOther) {
                                $scope.filters.raceTypes.push(raceType);
                            }
                        });
                    } else {
                        let matchingRaceTypes = $scope.availableRaceTypes.filter(rt => {
                            // Handle metric distance matching
                            if (searchParams.distance === '5k' && rt.name === '5000m') {
                                return true;
                            } else if (searchParams.distance === '10k' && rt.name === '10000m') {
                                return true;
                            } else {
                                return rt.name === searchParams.distance;
                            }
                        });
                        matchingRaceTypes.forEach(raceType => {
                            $scope.filters.raceTypes.push(raceType);
                        });
                    }
                    
                   
                }
                if (searchParams.year) {
                    // Create Date objects in local timezone for proper display in date inputs
                    $scope.filters.dateFrom = new Date(searchParams.year, 0, 1); // January 1st
                    $scope.filters.dateTo = new Date(searchParams.year, 11, 31); // December 31st
                }
                
                // Show advanced filters panel since we're using advanced search
                $scope.filterPanelExpanded = true;
                $scope.showAdvancedFilters = true;
                
                // Apply filters after setting up state params
                $scope.applyFilters();
            }
        }
    };
    

   
}]);

angular.module('mcrrcApp.results').controller('ResultModalInstanceController', ['$scope', '$uibModalInstance', '$filter', 'editmode', 'result', 'MembersService', 'ResultsService', 'localStorageService','UtilsService','$timeout', 'onResultCreated', function($scope, $uibModalInstance, $filter,editmode, result, MembersService, ResultsService, localStorageService,UtilsService,$timeout, onResultCreated) {

    
    $scope.isOlderDateCheck = function(date){       
        if (date !== undefined && date !== null){
            var today = new Date();
            var oldDate = new Date().setDate(today.getDate() - 30); 
            var raceDate = new Date(date);
            return raceDate < oldDate;
        }
    };

    var deleteIdFromSubdocs = function (obj, isRoot) {
      for (var key in obj) {
          if (isRoot === false && key === "_id") {
              delete obj[key];
          } else if (typeof obj[key] === "object") {
              deleteIdFromSubdocs(obj[key], false);
          }
      }
      return obj;
    };

    $scope.autoconvert = true;
    MembersService.getMembers({
        sort: 'memberStatus firstname',
        select: '-bio -personalBests -teamRequirementStats'
    }).then(function(members) {
        $scope.membersList = members;

    });

    ResultsService.getRaceTypes({
        sort: 'meters'
    }).then(function(racetypes) {
        $scope.racetypesList = racetypes;

        racetypes.forEach(function(r) {
            if (r.name === 'Multisport'){//this needs to be added to racetypes
                $scope.multisportRacetype = r;
            }
        });
    });

    $scope.sportList = ['swim','bike','run'];
    $scope.states = UtilsService.states;
    $scope.countries = UtilsService.countries;





    // make sure dates are always UTC
    // $scope.$watch('formData.race.racedate ', function(date) {
    //   if($scope.formData.race !== undefined){
    //     $scope.formData.race.racedate = $filter('date')($scope.formData.race.racedate, 'yyyy-MM-dd', 'UTC');
    //   }
    // });

    $scope.$watch('formData.race.location.country', function(country) {
      if($scope.formData.race !== undefined && country !== 'USA'){
        $scope.formData.race.location.state = null;
      }
    });


    if (editmode){
      if (result) {
          $scope.editmode = true;

          $scope.formData = result;

          $scope.formData.race.racedate = new Date($scope.formData.race.racedate);
          if ($scope.formData.race.location === undefined){ $scope.formData.race.location = {};}

          $scope.nbOfMembers = result.members.length;
          $scope.time = {};

          $scope.time.hours = Math.floor($scope.formData.time / 360000);
          $scope.time.minutes = Math.floor((($scope.formData.time % 8640000) % 360000) / 6000);
          $scope.time.seconds = Math.floor(((($scope.formData.time % 8640000) % 360000) % 6000) / 100);
          $scope.time.centiseconds = Math.floor(((($scope.formData.time % 8640000) % 360000) % 6000) % 100);

          if( $scope.formData.legs !== null && $scope.formData.legs !== undefined){
              $scope.formData.legs.forEach(function(l) {
                  l.timeExp = {};
                  l.timeExp.hours = Math.floor(l.time / 360000);
                  l.timeExp.minutes = Math.floor(((l.time % 8640000) % 360000) / 6000);
                  l.timeExp.seconds = Math.floor((((l.time % 8640000) % 360000) % 6000) / 100);
                  l.timeExp.centiseconds = Math.floor((((l.time % 8640000) % 360000) % 6000) % 100);
              });
          }

          if (result.customOptions !== undefined){
            $scope.customOptionsString = JSON.stringify(deleteIdFromSubdocs(result.customOptions,true));
          }
          if ($scope.formData.isRecordEligible === false || ($scope.customOptionsString !== undefined && $scope.customOptionsString !== "[]")){
            $scope.showMore = true;
          }

      }else{}
    }else{        
      //new result
      $scope.editmode = false;
      if (result){ //duplicated result
        const originalResult = JSON.parse(JSON.stringify(result));   
        $scope.formData = {};
        $scope.formData.isRecordEligible = originalResult.isRecordEligible;        
        $scope.formData.race = originalResult.race;
        $scope.formData.race.location.country = originalResult.race.location.country;
        $scope.formData.race.location.state = originalResult.race.location.state;
        $scope.formData.race.racedate = new Date(originalResult.race.racedate);
        $scope.formData.race.order = originalResult.race.order;
        $scope.formData.ranking = {};
        $scope.formData.members = [];
        $scope.formData.members[0] = {};        
        $scope.nbOfMembers = 1;
        $scope.formData.legs = originalResult.legs;   
        if( $scope.formData.legs !== null && $scope.formData.legs !== undefined){
            //we clear all the leg times for the new race
            $scope.formData.legs.forEach(function(l) {
                l.timeExp = {};              
            });
        }     
        $scope.time = {};
        if ($scope.formData.isRecordEligible === false || ($scope.customOptionsString !== undefined && $scope.customOptionsString !== "[]")){
            $scope.showMore = true;
        }
      }else{
        
        $scope.formData = {};
        $scope.formData.isRecordEligible = true;
        if(localStorageService.get('race') !== null){
            $scope.formData.race = localStorageService.get('race');
            $scope.formData.race.racedate = new Date($scope.formData.race.racedate);
        }else{
            $scope.formData.race = {};
            // $scope.formData.race.racedate = new Date($filter('date')(new Date().setHours(0,0,0,0), 'yyyy-MM-dd', 'UTC'));
            $scope.formData.race.racedate = new Date(Date.UTC(new Date().getFullYear(),new Date().getMonth(),new Date().getDate(),0,0,0,0));
        }



        $scope.formData.race.location = {};
        if (localStorageService.get('country') !== null){
          $scope.formData.race.location.country=localStorageService.get('country');
        }else{
          //default country
          $scope.formData.race.location.country="USA";
        }
        if(localStorageService.get('state') !== null){
          $scope.formData.race.location.state=localStorageService.get('state');
        }else{
          // default state
          $scope.formData.race.location.state="MD";
        }


        $scope.formData.resultlink = localStorageService.get('resultLink');
        $scope.formData.ranking = {};
        $scope.formData.ranking.agetotal = localStorageService.get('agetotal');
        $scope.formData.ranking.gendertotal = localStorageService.get('gendertotal');
        $scope.formData.ranking.overalltotal = localStorageService.get('overalltotal');


        $scope.formData.members = [];
        $scope.formData.members[0] = {};
        $scope.nbOfMembers = 1;
        $scope.time = {};


        //Multisports
        if ($scope.formData.race.isMultisport){            
            $scope.formData.legs = [];
            $scope.formData.legs[0] = {};
            $scope.formData.legs = localStorageService.get('legs');
            if( $scope.formData.legs !== null && $scope.formData.legs !== undefined){
                //we clear all the leg times for the new race
                $scope.formData.legs.forEach(function(l) {
                    l.timeExp = {};              
                });
            }     
        }
      }


    }




    $scope.addResult = function(addAnother) {
        if ($scope.time.hours === null || $scope.time.hours === undefined || $scope.time.hours === "") $scope.time.hours = 0;
        if ($scope.time.minutes === null || $scope.time.minutes === undefined || $scope.time.minutes === "") $scope.time.minutes = 0;
        if ($scope.time.seconds === null || $scope.time.seconds === undefined || $scope.time.seconds === "") $scope.time.seconds = 0;
        if ($scope.time.centiseconds === null || $scope.time.centiseconds === undefined || $scope.time.centiseconds === "") $scope.time.centiseconds = 0;

        $scope.formData.time = $scope.time.hours * 360000 + $scope.time.minutes * 6000 + $scope.time.seconds * 100 + $scope.time.centiseconds;

        var r = $scope.formData.ranking;
        if ((r === null || r === undefined || r === "") || (r.agerank === null || r.agerank === undefined || r.agerank === "") && (r.agetotal === null || r.agetotal === undefined || r.agetotal === "") && (r.genderrank === null || r.genderrank === undefined || r.genderrank === "") && (r.gendertotal === null || r.gendertotal === undefined || r.gendertotal === "") && (r.overallrank === null || r.overallrank === undefined || r.overallrank === "") && (r.overalltotal === null || r.overalltotal === undefined || r.overalltotal === "")) {
            $scope.formData.ranking = {};
        }

        var members = $.map($scope.formData.members, function(value, index) {
            return [value];
        });

        if( $scope.formData.legs !== null && $scope.formData.legs !== undefined){
            $scope.formData.legs.forEach(function(l,i) {
                l.order = i;
                if (l.timeExp === undefined){l.timeExp ={};}
                if (l.timeExp.hours === null || l.timeExp.hours === undefined || l.timeExp.hours === "") l.timeExp.hours = 0;
                if (l.timeExp.minutes === null || l.timeExp.minutes === undefined || l.timeExp.minutes === "") l.timeExp.minutes = 0;
                if (l.timeExp.seconds === null || l.timeExp.seconds === undefined || l.timeExp.seconds === "") l.timeExp.seconds = 0;
                if (l.timeExp.centiseconds === null || l.timeExp.centiseconds === undefined || l.timeExp.centiseconds === "") l.timeExp.centiseconds = 0;
                l.time = l.timeExp.hours * 360000 + l.timeExp.minutes * 6000 + l.timeExp.seconds * 100 + l.timeExp.centiseconds;
            });
        }



        //save race related info for futur addition
        localStorageService.set('race', $scope.formData.race);
        localStorageService.set('resultLink', $scope.formData.resultlink);
        localStorageService.set('agetotal', $scope.formData.ranking.agetotal);
        localStorageService.set('gendertotal', $scope.formData.ranking.gendertotal);
        localStorageService.set('overalltotal', $scope.formData.ranking.overalltotal);
        localStorageService.set('country',$scope.formData.race.location.country);
        localStorageService.set('state',$scope.formData.race.location.state);
        localStorageService.set('legs', $scope.formData.legs);


        if ($scope.formData.race.isMultisport === undefined){
            $scope.formData.race.isMultisport = false;
        }

        if (!$scope.formData.race.isMultisport && $scope.formData.race.racetype.isVariable === false){
            $scope.formData.race.distanceName = undefined;
        }

        if ($scope.formData.race.racetype.surface === 'multiple'){
            $scope.formData.race.racetype.meters = 0;
            $scope.formData.race.racetype.miles = 0;
        }


        if ($scope.customOptionsString !== undefined){
          $scope.formData.customOptions = JSON.parse($scope.customOptionsString);
        }

        $scope.isSaving = true;
        ResultsService.createResult($scope.formData).then(function(savedResult) {
            if (!savedResult) return; // Or handle error

            if (addAnother) {
                if (onResultCreated) {
                    onResultCreated(savedResult);
                }
                // Clear form for next entry
                $scope.formData.members = [{}];
                $scope.time = {};
                $scope.formData.ranking.agerank = null;
                $scope.formData.ranking.genderrank = null;
                $scope.formData.ranking.overallrank = null;
                $scope.formData.comments = undefined;
            } else {
                $uibModalInstance.close(savedResult);
            }
        }).finally(function() {
            $scope.isSaving = false;
        });
    };

    $scope.clearForm = function() {
        $scope.formData = {};
        $scope.formData.members = [{}];
        $scope.formData.isRecordEligible = true;
        $scope.nbOfMembers = 1;
        
        localStorageService.remove('race');
        localStorageService.remove('resultLink');
        localStorageService.remove('agetotal');
        localStorageService.remove('gendertotal');
        localStorageService.remove('overalltotal');
        localStorageService.remove('legs');
    };

    $scope.editResult = function() {
        if ($scope.time.hours === null || $scope.time.hours === undefined || $scope.time.hours === "") $scope.time.hours = 0;
        if ($scope.time.minutes === null || $scope.time.minutes === undefined || $scope.time.minutes === "") $scope.time.minutes = 0;
        if ($scope.time.seconds === null || $scope.time.seconds === undefined || $scope.time.seconds === "") $scope.time.seconds = 0;
        if ($scope.time.centiseconds === null || $scope.time.centiseconds === undefined || $scope.time.centiseconds === "") $scope.time.centiseconds = 0;

        $scope.formData.time = $scope.time.hours * 360000 + $scope.time.minutes * 6000 + $scope.time.seconds * 100 + $scope.time.centiseconds;
        var r = $scope.formData.ranking;
        if ((r === null || r === undefined || r === "") || (r.agerank === null || r.agerank === undefined || r.agerank === "") && (r.agetotal === null || r.agetotal === undefined || r.agetotal === "") && (r.genderrank === null || r.genderrank === undefined || r.genderrank === "") && (r.gendertotal === null || r.gendertotal === undefined || r.gendertotal === "") && (r.overallrank === null || r.overallrank === undefined || r.overallrank === "") && (r.overalltotal === null || r.overalltotal === undefined || r.overalltotal === "")) {
            $scope.formData.ranking = undefined;
        }

        if( $scope.formData.legs !== null && $scope.formData.legs !== undefined){
            $scope.formData.legs.forEach(function(l,i) {
                l.order = i;
                if (l.timeExp === undefined){l.timeExp ={};}
                if (l.timeExp.hours === null || l.timeExp.hours === undefined || l.timeExp.hours === "") l.timeExp.hours = 0;
                if (l.timeExp.minutes === null || l.timeExp.minutes === undefined || l.timeExp.minutes === "") l.timeExp.minutes = 0;
                if (l.timeExp.seconds === null || l.timeExp.seconds === undefined || l.timeExp.seconds === "") l.timeExp.seconds = 0;
                if (l.timeExp.centiseconds === null || l.timeExp.centiseconds === undefined || l.timeExp.centiseconds === "") l.timeExp.centiseconds = 0;
                l.time = l.timeExp.hours * 360000 + l.timeExp.minutes * 6000 + l.timeExp.seconds * 100 + l.timeExp.centiseconds;
            });
        }
        if ($scope.formData.race.isMultisport === undefined){
            $scope.formData.race.isMultisport = false;
        }

        if (!$scope.formData.race.isMultisport && $scope.formData.race.racetype.isVariable === false){
            $scope.formData.race.distanceName = undefined;
        }

        if ($scope.formData.race.racetype.surface === 'multiple'){
            $scope.formData.race.racetype.meters = 0;
            $scope.formData.race.racetype.miles = 0;
        }

        if ($scope.customOptionsString !== undefined){
          $scope.formData.customOptions = JSON.parse($scope.customOptionsString);
        }

        $scope.isSaving = true;
        ResultsService.editResult($scope.formData).then(function(savedResult) {
            $uibModalInstance.close(savedResult);
        }).finally(function() {
            $scope.isSaving = false;
        });
    };

    $scope.cancel = function() {
        $uibModalInstance.dismiss('cancel');
    };

    $scope.addNbMembers = function() {
        $scope.nbOfMembers = $scope.formData.members.length + 1;
        $scope.updateNbMembers();
    };

    $scope.updateNbMembers = function() {
        var num = $scope.nbOfMembers;
        var size = $scope.formData.members.length;
        if (num > size) {
            for (i = 0; i < num - size; i++) {
                $scope.formData.members.push({});
            }
        } else {
            $scope.formData.members.splice($scope.nbOfMembers, size - $scope.nbOfMembers);
        }
    };

    $scope.checkMembers = function() {
        var res = true;
        $scope.formData.members.forEach(function(m) {
            if (m._id === undefined) {
                res = false;
            }
        });
        return res;
    };

    $scope.getRaceTypeClass = function(s) {
        if (s !== undefined) {
            return s.replace(/ /g, '') + '-col';
        }
    };
    $scope.getSurfaceClass = function(surfaceName) {
        if (!surfaceName) return '';
        // Convert to lowercase and replace spaces with hyphens
        return 'surface-' + surfaceName.toLowerCase().replace(/\s+/g, '-');
    };

    $scope.onMetersChange = function() {
        if ($scope.autoconvert) {
            $scope.formData.race.racetype.miles = parseFloat($scope.formData.race.racetype.meters) * 0.000621371;
        }
    };

    $scope.onMilesChange = function() {
        if ($scope.autoconvert) {
            $scope.formData.race.racetype.meters = parseFloat($scope.formData.race.racetype.miles) * 1609.3440;
        }
    };

    $scope.updateMeters = function(leg){
        leg.meters = leg.miles * 1609.3440;
    };

    $scope.updateMiles = function(leg){
        leg.miles = leg.meters * 0.000621371;
    };

    $scope.toggleIsMultisport = function() {
        if ($scope.formData.race.isMultisport) {
            $scope.formData.legs = [];
            $scope.formData.legs[0] = {};
            $scope.formData.race.racetype = $scope.multisportRacetype;
        }else{
            $scope.formData.legs = null;
        }
    };

    $scope.createTriTemplate = function() {
        if ($scope.formData.race.isMultisport) {
            $scope.formData.race.racetype = $scope.multisportRacetype;
            $scope.formData.legs = [];
            $scope.formData.legs[0] = {};
            $scope.formData.legs[0].order=0;
            $scope.formData.legs[0].legName="Swim";
            $scope.formData.legs[0].legType="swim";
            $scope.formData.legs[1] = {};
            $scope.formData.legs[1].order=1;
            $scope.formData.legs[1].legName="Transition 1";
            $scope.formData.legs[1].isTransition=true;
            $scope.formData.legs[2] = {};
            $scope.formData.legs[2].order=2;
            $scope.formData.legs[2].legName="Bike";
            $scope.formData.legs[2].legType="bike";
            $scope.formData.legs[3] = {};
            $scope.formData.legs[3].order=3;
            $scope.formData.legs[3].legName="Transition 2";
            $scope.formData.legs[3].isTransition=true;
            $scope.formData.legs[4] = {};
            $scope.formData.legs[4].order=4;
            $scope.formData.legs[4].legName="Run";
            $scope.formData.legs[4].legType="run";            
        }
    };

    // =====================================
    // DATE PICKER CONFIG ==================
    // =====================================

    $scope.dateOptions = {
        formatDay: 'dd',
        formatMonth: 'MM',
        formatYear: 'yy',

        startingDay: 1
    };

    $scope.open = function($event) {
        $event.preventDefault();
        $event.stopPropagation();

        $scope.formData.opened = true;
    };

    //focus on racer if racename is already populated.
    $timeout(function() {       
        if ($scope.formData.race.racename !== undefined && $scope.formData.race.racename !== "") {
            $scope.$broadcast('memberFocus');
        }
    }, 400); //
    

}]);


angular.module('mcrrcApp.results').controller('RaceModalInstanceController', ['$scope', '$uibModalInstance', '$filter', 'raceinfo','fromStateParams', 'MembersService', 'ResultsService', 'localStorageService','$state','NotificationService', 'UtilsService', 'AuthService', function($scope, $uibModalInstance, $filter, raceinfo, fromStateParams,MembersService, ResultsService, localStorageService,$state,NotificationService, UtilsService, AuthService) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function(user) {
        $scope.user = user;
    });

    $scope.raceinfo = raceinfo;
    if (fromStateParams){
        $scope.fromStateParams = fromStateParams;
    }else{
        //default
        $scope.fromStateParams = false;
    }
   

    var sum = 0;
    var count = 0;
    for (i = 0; i < $scope.raceinfo.results.length; i++) {
        if ($scope.raceinfo.results[i].time !== 'undefined') {
            sum += $scope.raceinfo.results[i].time;
            count++;
        }
    }
    if (count !== 0) {
        $scope.avg = Math.ceil(sum / count);
    }

    // Calculate fastest time result
    $scope.fastestTimeResult = null;
    var fastestTime = Infinity;
    for (i = 0; i < $scope.raceinfo.results.length; i++) {
        if ($scope.raceinfo.results[i].time && $scope.raceinfo.results[i].time < fastestTime) {
            fastestTime = $scope.raceinfo.results[i].time;
            $scope.fastestTimeResult = $scope.raceinfo.results[i];
        }
    }

    // Calculate best age grade result
    $scope.bestAgeGradeResult = null;
    var bestAgeGrade = 0;
    for (i = 0; i < $scope.raceinfo.results.length; i++) {
        if ($scope.raceinfo.results[i].agegrade && $scope.raceinfo.results[i].agegrade > bestAgeGrade) {
            bestAgeGrade = $scope.raceinfo.results[i].agegrade;
            $scope.bestAgeGradeResult = $scope.raceinfo.results[i];
        }
    }

    $scope.cancel = function() {
        if($scope.fromStateParams){         
            $state.go('/results');
        }        
        $uibModalInstance.dismiss('cancel');        
    };

    $scope.getRaceTypeClass = function(s) {
        if (s !== undefined) {
            return s.replace(/ /g, '') + '-col';
        }
    };
    $scope.getSurfaceClass = function(surfaceName) {
        if (!surfaceName) return '';
        // Convert to lowercase and replace spaces with hyphens
        return 'surface-' + surfaceName.toLowerCase().replace(/\s+/g, '-');
    };

    $scope.getStateFlag = function(stateCode) {
        return UtilsService.getStateFlag(stateCode);
    };

    $scope.getCountryFlag = function(countryCode) {
        return UtilsService.getCountryFlag(countryCode);
    };

    $scope.showResultDetailsModal = function(result,race) {
        ResultsService.showResultDetailsModal(result,race).then(function(result) {});
    };

   
    
    $scope.sortBy = function (criteria) {
        if ($scope.sortCriteria === criteria) {
            $scope.sortDirection = $scope.sortDirection === true ? false : true;
        } else {
            $scope.sortCriteria = criteria;
            $scope.sortDirection = true;
        }
        //sortDirection true = asc, false = desc
        $scope.raceinfo.results.sort(customResultSort($scope.raceinfo.results, $scope.sortCriteria, $scope.sortDirection));
    };

    $scope.sortResultsBy = function (results,criteria) {
        if ($scope.sortCriteria === criteria) {
            $scope.sortDirection = $scope.sortDirection === true ? false : true;
        } else {
            $scope.sortCriteria = criteria;
            $scope.sortDirection = true;
        }
        //sortDirection true = asc, false = desc
        results.sort(customResultSort($scope.raceinfo.results, $scope.sortCriteria, $scope.sortDirection));
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

    $scope.copyRaceLinkToClipboard = function() {
        navigator.clipboard.writeText(window.location.origin+'/races/' + $scope.raceinfo._id)
          .then(() => {
            NotificationService.clipboardCopyNotifiction(true,window.location.origin+'/races/' + $scope.raceinfo._id);            
          })
          .catch(err => {
            NotificationService.clipboardCopyNotifiction(false,window.location.origin+'/races/' + $scope.raceinfo._id);     
            console.error('Failed to copy text: ', err);
          });
      };

    // Edit race functionality
    $scope.editRace = function() {
        if ($scope.user && $scope.user.role === 'admin') {
            ResultsService.showEditRaceModal($scope.raceinfo).then(function(updatedRace) {
                if (updatedRace) {
                    // Update the current race info
                    $scope.raceinfo = updatedRace;
                }
            });
        }
    };

    // Gender filter functionality
    $scope.genderFilter = null;

    $scope.setGenderFilter = function(gender) {
        $scope.genderFilter = gender;
    };

    $scope.getFilteredResults = function() {
        if (!$scope.genderFilter) {
            return $scope.raceinfo.results;
        }
        return $scope.raceinfo.results.filter(function(result) {
            // Check if any member in the result has the specified gender
            return result.members && result.members.some(function(member) {
                return member.sex === $scope.genderFilter;
            });
        });
    };



}]);


angular.module('mcrrcApp.results').controller('ResultDetailslInstanceController', ['$scope', '$uibModalInstance', '$filter', 'result','race', 'MembersService', 'ResultsService', 'localStorageService', function($scope, $uibModalInstance, $filter, result, race, MembersService, ResultsService, localStorageService) {

    $scope.result = result;
    $scope.race = race;
    // if (race !== null && race !== undefined){
    //     $scope.result.race = race;
    // }else{
    //     $scope.race = race;
    // }

    $scope.cancel = function() {
        $uibModalInstance.dismiss('cancel');
    };

    $scope.getRaceTypeClass = function(s) {
        if (s !== undefined) {
            return s.replace(/ /g, '') + '-col';
        }
    };
}]);

// Race Edit Modal Controller
angular.module('mcrrcApp.results').controller('RaceEditModalInstanceController', ['$scope', '$uibModalInstance', 'race', 'ResultsService', 'UtilsService', function($scope, $uibModalInstance, race, ResultsService, UtilsService) {
    

    
    // Create a deep copy of the race to avoid modifying the original
    $scope.race = JSON.parse(JSON.stringify(race));
    
    // Ensure achievements array exists and convert values to JSON strings for display
    if (!$scope.race.achievements) {
        $scope.race.achievements = [];
    } else {
        // Convert existing achievement values to JSON strings for display
        $scope.race.achievements.forEach(function(achievement) {
            if (achievement.value !== undefined && achievement.value !== null) {
                if (typeof achievement.value === 'object') {
                    achievement.valueString = JSON.stringify(achievement.value, null, 2);
                } else {
                    achievement.valueString = String(achievement.value);
                }
            } else {
                achievement.valueString = '';
            }
        });
    }
    
    // Ensure customOptions array exists and convert values to JSON strings for display
    if (!$scope.race.customOptions) {
        $scope.race.customOptions = [];
    } else {
        // Convert existing customOption values to JSON strings for display
        $scope.race.customOptions.forEach(function(option) {
            if (option.value !== undefined && option.value !== null) {
                if (typeof option.value === 'object') {
                    option.valueString = JSON.stringify(option.value, null, 2);
                } else {
                    option.valueString = String(option.value);
                }
            } else {
                option.valueString = '';
            }
        });
    }
    
    // Ensure location object exists
    if (!$scope.race.location) {
        $scope.race.location = { country: '', state: '' };
    }
    
    // Ensure racetype object exists
    if (!$scope.race.racetype) {
        $scope.race.racetype = {
            name: '',
            surface: 'road',
            miles: 0,
            isVariable: false
        };
    }
    
    // Convert date to Date object for the date picker
    if ($scope.race.racedate) {
        $scope.race.racedate = new Date($scope.race.racedate);
    }
    
    if($scope.race.isMultisport === undefined){
        $scope.race.isMultisport = false;
    }

    // Initialize data
    $scope.racetypesList = [];
    $scope.countries = [];
    $scope.states = [];
    $scope.autoconvert = true;
    $scope.opened = false;
    $scope.achievementsCollapsed = false;
    
    // Load racetypes
    ResultsService.getRaceTypes().then(function(racetypes) {
        $scope.racetypesList = racetypes;
    });
    
    // Load countries and states
    UtilsService.getCountries().then(function(countries) {
        $scope.countries = countries;
    });
    
    UtilsService.getStates().then(function(states) {
        $scope.states = states;
    });

   
    
    // Helper functions
    $scope.getRaceTypeClass = function(surface) {
        if (surface !== undefined) {
            return surface.replace(/ /g, '') + 'surface';
        }
    };
    
    $scope.open = function($event) {
        $event.preventDefault();
        $event.stopPropagation();
        $scope.opened = true;
    };
    
    $scope.onMetersChange = function() {
        if ($scope.autoconvert && $scope.race.racetype.meters) {
            $scope.race.racetype.miles = ($scope.race.racetype.meters * 0.000621371).toFixed(2);
        }
    };
    
    $scope.onMilesChange = function() {
        if ($scope.autoconvert && $scope.race.racetype.miles) {
            $scope.race.racetype.meters = Math.round($scope.race.racetype.miles * 1609.34);
        }
    };
    
    // Watch for country changes and nullify state if not USA
    $scope.$watch('race.location.country', function(newCountry, oldCountry) {
        if (newCountry !== oldCountry && newCountry !== 'USA') {
            $scope.race.location.state = null;
        }
    });
    

    
    $scope.addAchievement = function() {
        $scope.race.achievements.push({
            name: '',
            text: '',
            value: '',
            valueString: ''
        });
    };
    
    $scope.removeAchievement = function(index) {
        $scope.race.achievements.splice(index, 1);
    };
    
    $scope.updateAchievementValue = function(index) {
        var achievement = $scope.race.achievements[index];
        try {
            if (achievement.valueString && achievement.valueString.trim()) {
                achievement.value = JSON.parse(achievement.valueString);
            } else {
                achievement.value = '';
            }
        } catch (e) {
            // Keep the string value if JSON parsing fails
            achievement.value = achievement.valueString;
        }
    };
    
    $scope.addCustomOption = function() {
        $scope.race.customOptions.push({
            name: '',
            text: '',
            value: '',
            valueString: ''
        });
    };
    
    $scope.removeCustomOption = function(index) {
        $scope.race.customOptions.splice(index, 1);
    };
    
    $scope.updateCustomOptionValue = function(index) {
        var option = $scope.race.customOptions[index];
        try {
            if (option.valueString && option.valueString.trim()) {
                option.value = JSON.parse(option.valueString);
            } else {
                option.value = '';
            }
        } catch (e) {
            // Keep the string value if JSON parsing fails
            option.value = option.valueString;
        }
    };
    
    $scope.isAchievementDisabled = function(achievement) {
        return achievement.name === 'newLocation';
    };
    
    $scope.toggleAchievements = function() {
        $scope.achievementsCollapsed = !$scope.achievementsCollapsed;
    };
    
    $scope.save = function() {
        
        // Process all achievement values before saving
        if ($scope.race.achievements) {
            $scope.race.achievements.forEach(function(achievement, index) {
                $scope.updateAchievementValue(index);
            });
        }
        
        // Process all custom option values before saving
        if ($scope.race.customOptions) {
            $scope.race.customOptions.forEach(function(option, index) {
                $scope.updateCustomOptionValue(index);
            });
        }

        $uibModalInstance.close($scope.race);
    };
    
    $scope.cancel = function() {
        $uibModalInstance.dismiss('cancel');
    };
}]);


