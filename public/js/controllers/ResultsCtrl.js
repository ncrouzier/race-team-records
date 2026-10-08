angular.module('mcrrcApp.results').controller('ResultsController', ['$scope', '$analytics', 'AuthService', 'ResultsService', 'UtilsService', 'dialogs', 'localStorageService','$stateParams','$location', '$q', 'MembersService', '$timeout', 'AdvancedFiltersService', '$state', function($scope, $analytics, AuthService, ResultsService, UtilsService, dialogs, localStorageService,$stateParams,$location, $q, MembersService, $timeout, AdvancedFiltersService, $state) {
    

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

    // "3" or "1-3" against a rank; shared with "By result"
    var isRankingInRange = AdvancedFiltersService.isRankingInRange;

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
        // Age grade range; narrows each race to the results inside it
        agMin: 0,
        agMax: 100,
        raceTypes: [],
        countries: [],
        states: [],
        selectedMembers: [],
        // {month, day, label} — a single day of the year, matched across every
        // year. Set by clicking a cell in the racing calendar on the stats pages.
        calendarDay: null,
        // {racetype, surfaces, sex, maxTime, label} — the performances behind one
        // milestone counter on the team stats page.
        milestone: null,
        // Admin data-cleanup filter: keep only races that still have at least one
        // result missing the chosen ranking field. One of MISSING_RANKING_OPTIONS.
        missingRanking: null
    };

    // Ranking fields an admin can hunt for gaps in (shared with "By result")
    $scope.missingRankingOptions = AdvancedFiltersService.MISSING_RANKING_OPTIONS;

    // How many of a race's results match the chosen gap — shown on the race row
    // so an admin can see how much work each race needs. Most options match a
    // result missing any one of their fields; the requireAll ones need every
    // field to be missing.
    $scope.missingRankingCount = function(race) {
        var option = $scope.filters.missingRanking;
        if (!option || !race || !race.results) return 0;
        return race.results.filter(function(result) {
            return AdvancedFiltersService.resultMissing(result, option);
        }).length;
    };

    // Distance range for slider
    $scope.distanceRange = {
        min: 0,
        max: 100
    };

    // Age grade range for its slider: up to 100%, or the best on file
    $scope.ageGradeRange = {
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
            // Filters from the URL (this applies them). Runs in a digest: this
            // async function resumes outside Angular.
            $scope.$evalAsync(function() { $scope.processStateParams(); });
            
            // The distance slider follows distanceRange on its own
            // (<advanced-filter-panel>)
            
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

    // The Advanced Filters panel's handlers (toggles, add/remove a race type,
    // country, state or member, the distance inputs), shared with "By result"
    AdvancedFiltersService.attach($scope);

    function cleanFilters() {
        return {
            dateFrom: '',
            dateTo: '',
            distanceMin: 0,
            distanceMax: $scope.distanceRange.max,
            agMin: 0,
            agMax: $scope.ageGradeRange.max,
            raceTypes: [],
            countries: [],
            states: [],
            selectedMembers: [],
            calendarDay: null,
            milestone: null,
            missingRanking: null
        };
    }

    $scope.clearAllFilters = function() {
        $scope.searchQuery = '';
        $scope.filters = cleanFilters();
        $scope.updateSliderFromInputs();
        $scope.updateAgeGradeSliderFromInputs();
        $scope.applyFilters();
    };



    $scope.hasActiveFilters = function() {
        return $scope.filters.dateFrom || 
               $scope.filters.dateTo || 
               $scope.filters.distanceMin > 0 || 
               $scope.filters.distanceMax < $scope.distanceRange.max ||
               $scope.ageGradeFilterOn() ||
               ($scope.filters.raceTypes && $scope.filters.raceTypes.length > 0) ||
               ($scope.filters.countries && $scope.filters.countries.length > 0) ||
               ($scope.filters.states && $scope.filters.states.length > 0) ||
               ($scope.filters.selectedMembers && $scope.filters.selectedMembers.length > 0) ||
               !!$scope.filters.calendarDay ||
               !!$scope.filters.milestone ||
               !!$scope.filters.missingRanking;
    };

    $scope.getActiveFilterCount = function() {
        var count = 0;
        
        // Count date filters
        if ($scope.filters.dateFrom) count++;
        if ($scope.filters.dateTo) count++;
        
        // Count distance filter (only if not at default values)
        if ($scope.filters.distanceMin > 0 || $scope.filters.distanceMax < $scope.distanceRange.max) count++;
        if ($scope.ageGradeFilterOn()) count++;
        
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
        if ($scope.filters.calendarDay) count++;
        if ($scope.filters.milestone) count++;
        if ($scope.filters.missingRanking) count++;

        return count;
    };

    $scope.applyFilters = function() {
        filterRaces();
        syncUrl();
    };

    function filterRaces() {
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

                // Special case: birthday search
                if (searchLower === "hasbirthday") {
                    var birthdayMatches = race.results.some(function (result) {
                        var res = result.achievements && result.achievements.some(function (achievement) {
                            return achievement.name === "birthday";
                        });
                        return res;
                    });

                    if (!birthdayMatches) {
                        return false;
                    }
                } else {
                    // Regular search logic
                    var raceMatches = race.racename.toLowerCase().includes(searchLower) ||
                        (race.location.country && race.location.country.toLowerCase().includes(searchLower)) ||
                        (race.location.state && race.location.state.toLowerCase().includes(searchLower)) ||
                        race.racetype.name.toLowerCase().includes(searchLower);

                    var resultMatches = race.results.some(function (result) {
                        return result.members.some(function (member) {
                            return (member.firstname && member.firstname.toLowerCase().includes(searchLower)) ||
                                (member.lastname && member.lastname.toLowerCase().includes(searchLower)) ||
                                (member.username && member.username.toLowerCase().includes(searchLower));
                        });
                    });

                    if (!raceMatches && !resultMatches) {
                        return false;
                    }
                }
               
                
            }

            // Advanced filters. They apply whether or not the panel is shown —
            // hiding it only hides it, as on "By result" — and their tags stay
            // visible below it (.active-filters-bar).
            {
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

                // Day-of-year filter: the same calendar day in every year, so
                // "Jul 4" keeps thirteen years of Independence Day races.
                if ($scope.filters.calendarDay) {
                    if (raceDate.getUTCMonth() !== $scope.filters.calendarDay.month ||
                        raceDate.getUTCDate() !== $scope.filters.calendarDay.day) {
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

                // Admin: keep only races that still need ranking data filled in
                if ($scope.filters.missingRanking) {
                    if ($scope.missingRankingCount(race) === 0) {
                        return false;
                    }
                }
            }

            return true;
        });

        // Age grade range: like the milestone below, it narrows each race to
        // the results inside the range (a result with no age grade is out),
        // and drops races left with none. Shallow copies, as there.
        if ($scope.ageGradeFilterOn()) {
            var agMin = $scope.filters.agMin, agMax = $scope.filters.agMax;
            $scope.filteredRacesList = $scope.filteredRacesList.reduce(function(acc, race) {
                var kept = (race.results || []).filter(function(result) {
                    var ag = parseFloat(result.agegrade);
                    return ag >= agMin && ag <= agMax;
                });
                if (kept.length) {
                    acc.push(kept.length === race.results.length ? race : angular.extend({}, race, { results: kept }));
                }
                return acc;
            }, []);
        }

        // The milestone filter is the other one that narrows a race's results
        // rather than just keeping or dropping the race. Without it a "sub-16
        // 5k" link would list every team result in those races, and the rows on
        // screen would not add up to the number that was clicked. The race is
        // shallow-copied so the shared cached list is never mutated.
        if ($scope.filters.milestone) {
            var ms = $scope.filters.milestone;
            $scope.filteredRacesList = $scope.filteredRacesList.reduce(function(acc, race) {
                if (race.racetype.name !== ms.racetype) return acc;
                if (ms.surfaces && ms.surfaces.indexOf(race.racetype.surface) === -1) return acc;

                var kept = (race.results || []).filter(function(result) {
                    if (!result.members || result.members.length !== 1) return false;
                    if (result.isRecordEligible === false) return false;
                    if (ms.maxTime && (!result.time || result.time >= ms.maxTime)) return false;
                    // The age-grade view has no gender restriction — age grading
                    // already normalises for it.
                    if (ms.minAgeGrade && !(parseFloat(result.agegrade) >= ms.minAgeGrade)) return false;
                    return !ms.sex || result.members[0].sex === ms.sex;
                });
                if (kept.length) {
                    acc.push(angular.extend({}, race, { results: kept }));
                }
                return acc;
            }, []);
        }
    }

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

        // Race types, countries and states on offer, with counts (shared
        // with "By result")
        var options = AdvancedFiltersService.buildOptions($scope.racesList);
        $scope.availableRaceTypes = options.raceTypes;
        $scope.availableCountries = options.countries;
        $scope.availableStates = options.states;

        // Update distance range
        $scope.distanceRange.max = options.maxDistance;

        // Update filter max if it's currently set to the old max
        if ($scope.filters.distanceMax === 100) {
            $scope.filters.distanceMax = $scope.distanceRange.max;
        }
        $scope.ageGradeRange.max = options.maxAgeGrade;
        if ($scope.filters.agMax === 100) {
            $scope.filters.agMax = $scope.ageGradeRange.max;
        }

        var members = {};
        $scope.racesList.forEach(function(race) {
            (race.results || []).forEach(function(result) {
                (result.members || []).forEach(function(member) {
                    if (member._id) {
                        members[member._id] = {
                            _id: member._id,
                            firstname: member.firstname,
                            lastname: member.lastname,
                            username: member.username
                        };
                    }
                });
            });
        });

        $scope.availableMembers = Object.keys(members).map(function(key) {
            return members[key];
        }).sort(function(a, b) {
            return a.firstname.localeCompare(b.firstname) || a.lastname.localeCompare(b.lastname);
        });
        
        // Also populate allMembers for the dropdown
        // $scope.allMembers = $scope.availableMembers;
             
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
    // ---- Filters <-> URL ---------------------------------------------------
    // "By race" keeps its filters in the URL, like "By result", so a filtered
    // list can be linked to, reloaded and shared:
    //   q            search box
    //   types        race types, name|surface: types=5k|road,1 mile|track
    //   distance     a race type name, from links: 5k (also 5000m), or "other"
    //                (odd distances and non-running surfaces); becomes types
    //   from, to     date range, YYYY-MM-DD    minmi, maxmi  distance range
    //   agmin, agmax age grade range, in %
    //   country, state   codes, comma separated
    //   runner       usernames, each optionally :ranking (nicolas:1-3)
    //   month, day   one day of the year, every year (1-based month)
    //   missing      (admin) a missing-ranking option
    // Older links passed a hidden JSON `search` param instead; it is still
    // read, through AdvancedFiltersService.queryToParams.
    var MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var urlReady = false;
    var syncPending = null;

    function paramList(text, upper) {
        return (text || '').split(',').map(function(x) {
            x = x.trim();
            return upper ? x.toUpperCase() : x;
        }).filter(Boolean);
    }

    function toDay(date) {
        if (!date) return null;
        var d = new Date(date);
        if (isNaN(d.getTime())) return null;
        var pad = function(n) { return (n < 10 ? '0' : '') + n; };
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }

    function fromDay(text) {
        var parts = (text || '').split('-');
        return parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : '';
    }

    function filtersToParams() {
        var f = $scope.filters;
        return {
            q: $scope.searchQuery || null,
            types: f.raceTypes.length ? f.raceTypes.map(function(t) {
                return (t.name + '|' + t.surface).toLowerCase();
            }).join(',') : null,
            from: toDay(f.dateFrom),
            to: toDay(f.dateTo),
            minmi: f.distanceMin > 0 ? String(f.distanceMin) : null,
            maxmi: f.distanceMax < $scope.distanceRange.max ? String(f.distanceMax) : null,
            agmin: f.agMin > 0 ? String(f.agMin) : null,
            agmax: f.agMax < $scope.ageGradeRange.max ? String(f.agMax) : null,
            country: f.countries.length ? f.countries.map(function(c) { return c.code; }).join(',') : null,
            state: f.states.length ? f.states.map(function(st) { return st.code; }).join(',') : null,
            runner: f.selectedMembers.length ? f.selectedMembers.map(function(m) {
                return m.username + (m.ranking ? ':' + m.ranking : '');
            }).join(',') : null,
            month: f.calendarDay ? String(f.calendarDay.month + 1) : null,
            day: f.calendarDay ? String(f.calendarDay.day) : null,
            missing: f.missingRanking ? f.missingRanking.key : null,
            // Only ever read: these turn into the params above
            distance: null,
            search: null
        };
    }

    function sameAsUrl(params) {
        return Object.keys(params).every(function(k) {
            return (params[k] || null) === ($state.params[k] || null);
        });
    }

    // Filters -> URL, replacing the history entry: Back leaves the page
    // rather than stepping through every filter change. Once per tick: a
    // slider drag or Clear applies the filters several times in a row, and
    // each transition would cut off the one before.
    function syncUrl() {
        if (!urlReady || syncPending) return;
        syncPending = $timeout(function() {
            syncPending = null;
            // Not while the link that opened the page is still landing: the
            // replace would take the place of the previous history entry.
            // A tick after it settles: the router writes the link's URL in
            // its own success hook, which a new transition would cancel.
            if ($state.transition) {
                $state.transition.promise.then(function() { $timeout(syncUrl); }, angular.noop);
                return;
            }
            var params = filtersToParams();
            if (!sameAsUrl(params)) {
                $state.go('/results', params, { location: 'replace', inherit: false });
            }
        });
    }

    // URL -> filters. Needs the filter options (race types, countries...)
    // and the members, so it runs once the races are loaded.
    $scope.processStateParams = function(params) {
        params = params || $stateParams;
        if (params.search) {
            try {
                params = AdvancedFiltersService.queryToParams(JSON.parse(params.search));
            } catch (e) {
                params = {};
            }
        }
        var f = $scope.filters = cleanFilters();
        $scope.searchQuery = params.q || '';

        var types = paramList(params.types).map(function(t) { return t.toLowerCase(); });
        if (types.length) {
            f.raceTypes = $scope.availableRaceTypes.filter(function(rt) {
                return types.indexOf((rt.name + '|' + rt.surface).toLowerCase()) !== -1;
            });
        } else if (params.distance) {
            var distance = String(params.distance).toLowerCase();
            f.raceTypes = $scope.availableRaceTypes.filter(function(rt) {
                if (distance === 'other') {
                    // Odd distances, and anything not run on road, track,
                    // trail or ultra
                    return rt.isVariable || ['road', 'track', 'trail', 'ultra'].indexOf(rt.surface) === -1;
                }
                var name = rt.name.toLowerCase();
                // Track 5000m and 10000m go with 5k and 10k
                return name === distance || (distance === '5k' && name === '5000m') ||
                    (distance === '10k' && name === '10000m');
            });
        }

        f.dateFrom = fromDay(params.from);
        f.dateTo = fromDay(params.to);
        var minmi = parseFloat(params.minmi), maxmi = parseFloat(params.maxmi);
        if (!isNaN(minmi)) f.distanceMin = minmi;
        if (!isNaN(maxmi)) f.distanceMax = maxmi;
        var agmin = parseFloat(params.agmin), agmax = parseFloat(params.agmax);
        if (!isNaN(agmin)) f.agMin = agmin;
        if (!isNaN(agmax)) f.agMax = agmax;

        paramList(params.country, true).forEach(function(code) {
            var found = $scope.availableCountries.find(function(c) { return c.code === code; });
            if (found) f.countries.push(found);
        });
        paramList(params.state, true).forEach(function(code) {
            var found = $scope.availableStates.find(function(st) { return st.code === code; });
            if (found) f.states.push(found);
        });
        paramList(params.runner).forEach(function(entry) {
            var parts = entry.split(':');
            var found = ($scope.allMembers || []).find(function(m) {
                return m.username && m.username.toLowerCase() === parts[0].toLowerCase();
            });
            if (found) {
                // A copy, so the ranking does not land on the shared member
                var member = Object.assign({}, found);
                if (parts[1]) member.ranking = parts[1];
                f.selectedMembers.push(member);
            }
        });

        var month = parseInt(params.month, 10), day = parseInt(params.day, 10);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            f.calendarDay = { month: month - 1, day: day, label: MONTHS_SHORT[month - 1] + ' ' + day };
        }
        f.missingRanking = $scope.missingRankingOptions.find(function(o) { return o.key === params.missing; }) || null;

        // The slider follows the restored range
        $timeout(function() {
            $scope.updateSliderFromInputs();
            $scope.updateAgeGradeSliderFromInputs();
        });

        urlReady = true;
        $scope.applyFilters();
    };

    // A link to "By race" followed while already on it changes only the
    // URL's (dynamic) params; ui-router calls this on the controller instance
    this.uiOnParamsChanged = function() {
        // Our own syncUrl landing, or about to: nothing to read
        if (!urlReady || syncPending || sameAsUrl(filtersToParams())) return;
        $scope.processStateParams($state.params);
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
            $scope.formData.customOptions = deleteIdFromSubdocs(result.customOptions, true);
            // Convert values to valueString for display
            $scope.formData.customOptions.forEach(function(option) {
              if (option.value !== undefined && option.value !== null) {
                if (typeof option.value === 'object') {
                  option.valueString = JSON.stringify(option.value);
                } else {
                  option.valueString = String(option.value);
                }
              } else {
                option.valueString = '';
              }
            });
          }
          if (!$scope.formData.customOptions) {
            $scope.formData.customOptions = [];
          }
          if ($scope.formData.isRecordEligible === false || $scope.formData.customOptions.length > 0){
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
        // The rest of the race's shared details: same results page, same field
        $scope.formData.resultlink = originalResult.resultlink;
        $scope.formData.ranking = {};
        if (originalResult.ranking && originalResult.ranking.overalltotal) {
            $scope.formData.ranking.overalltotal = originalResult.ranking.overalltotal;
        }
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
        $scope.formData.customOptions = [];
        if ($scope.formData.isRecordEligible === false){
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
        $scope.formData.customOptions = [];


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


        if ($scope.formData.customOptions) {
          $scope.formData.customOptions.forEach(function(option, index) {
            $scope.updateResultCustomOptionValue(index);
          });
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

        if ($scope.formData.customOptions) {
          $scope.formData.customOptions.forEach(function(option, index) {
            $scope.updateResultCustomOptionValue(index);
          });
        }

        $scope.isSaving = true;
        ResultsService.editResult($scope.formData).then(function(savedResult) {
            $uibModalInstance.close(savedResult);
        }).finally(function() {
            $scope.isSaving = false;
        });
    };

    // Custom options management for result modal
    $scope.addResultCustomOption = function() {
        if (!$scope.formData.customOptions) {
            $scope.formData.customOptions = [];
        }
        $scope.formData.customOptions.push({
            name: '',
            text: '',
            value: '',
            valueString: ''
        });
    };

    $scope.removeResultCustomOption = function(index) {
        $scope.formData.customOptions.splice(index, 1);
    };

    $scope.updateResultCustomOptionValue = function(index) {
        var option = $scope.formData.customOptions[index];
        try {
            if (option.valueString && option.valueString.trim()) {
                option.value = JSON.parse(option.valueString);
            } else {
                option.value = '';
            }
        } catch (e) {
            option.value = option.valueString;
        }
    };

    $scope.setResultCustomOptionPreset = function(index, presetName) {
        var option = $scope.formData.customOptions[index];
        var PRESETS = {
            'resultIcon': { name: 'resultIcon', text: '', value: '' },
            'resultText': { name: 'resultText', text: '', value: '' }
        };
        var preset = PRESETS[presetName];
        if (preset) {
            option.name = preset.name;
            option.text = preset.text;
            option.value = preset.value;
            option.valueString = typeof preset.value === 'object' ? JSON.stringify(preset.value) : String(preset.value);
        }
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
angular.module('mcrrcApp.results').controller('RaceEditModalInstanceController', ['$scope', '$uibModalInstance', '$q', 'race', 'ResultsService', 'UtilsService', 'MembersService', 'ResultExtractionService', 'NotificationService', function($scope, $uibModalInstance, $q, race, ResultsService, UtilsService, MembersService, ResultExtractionService, NotificationService) {
    

    
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
    
    // Ensure photoLinks array exists
    if (!$scope.race.photoLinks) {
        $scope.race.photoLinks = [];
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
    $scope.achievementsCollapsed = true;
    $scope.customOptionsCollapsed = !($scope.race.customOptions && $scope.race.customOptions.length > 0);
    $scope.photoLinksCollapsed = !($scope.race.photoLinks && $scope.race.photoLinks.length > 0);
    $scope.resultsCollapsed = true;
    
    // Load racetypes
    ResultsService.getRaceTypes({ sort: 'meters' }).then(function(racetypes) {
        $scope.racetypesList = racetypes;
    });
    
    // Load countries and states
    UtilsService.getCountries().then(function(countries) {
        $scope.countries = countries;
    });
    
    UtilsService.getStates().then(function(states) {
        $scope.states = states;
    });

    // Initialize results-related variables
    $scope.raceResults = [];
    $scope.loadingResults = false;
    $scope.resultsModified = false;
    
    // Load results when modal opens
    $scope.loadRaceResults = function() {
        if (!$scope.race._id) {
            console.log('No race ID available');
            return;
        }
        
        $scope.loadingResults = true;
        var filters = {
            raceid: $scope.race._id        
        };
        // Use getResults to fetch results for this race
        ResultsService.getResults({filters:filters}).then(function(results) {
            $scope.raceResults = results;
            
            // Initialize timeExp for each result
            $scope.raceResults.forEach(function(result) {
                if (result.time) {
                    result.timeExp = {
                        hours: Math.floor(result.time / 360000),
                        minutes: Math.floor(((result.time % 8640000) % 360000) / 6000),
                        seconds: Math.floor((((result.time % 8640000) % 360000) % 6000) / 100),
                        centiseconds: Math.floor((((result.time % 8640000) % 360000) % 6000) % 100)
                    };
                }
            });

            // Sort results by time (fastest first)
            $scope.raceResults.sort(function(result1, result2) {
                if (result1.time < result2.time) {
                    return -1;
                } else if (result1.time > result2.time) {
                    return 1;
                }
                return 0;
            });

            $scope.loadingResults = false;
        }).catch(function(error) {
            console.error('Error loading race results:', error);
            $scope.loadingResults = false;
        });
    };
    
    // Auto-load results when modal opens
    $scope.loadRaceResults();

    // Function to mark results as modified
    $scope.markResultsModified = function() {
        $scope.resultsModified = true;
    };

    // --- Retrieving ranking data from a results link -----------------------
    //
    // Same scrape the result extractor page does, but instead of creating
    // results it lines the scraped rows up against the results already stored
    // for this race and offers the differences as edits to confirm.

    $scope.extraction = {
        url: '',
        htmlSource: '',
        showPasteBox: false,
        loading: false,
        // Team members in the scraped results who have no result stored on this
        // race at all — offered as results to create.
        additions: [],
        // One entry per existing result with at least one differing field.
        proposals: null,
        // Every results table found on the page, so a wrong guess can be swapped
        tables: [],
        tableIndex: null,
        // The scraped table is kept so the column mapping can be corrected and
        // the proposals rebuilt without fetching the page again.
        tableHeaders: [],
        tableData: [],
        columnMapping: {},
        rowOptions: {},
        showMapping: false,
        error: null
    };

    $scope.mappableFields = ResultExtractionService.mappableFields;

    $scope.availableFieldsFor = function(header) {
        return ResultExtractionService.availableFieldsFor($scope.extraction.columnMapping, header);
    };

    // First non-empty value under a column, shown beside the dropdown so the
    // admin can tell what they are mapping without opening the source page.
    $scope.columnSample = function(header) {
        var row = ($scope.extraction.tableData || []).find(function(candidate) {
            return candidate[header];
        });
        return row ? row[header] : '';
    };

    // A field can only describe one column, so claiming it releases the other.
    $scope.onColumnMappingChange = function(header) {
        var field = $scope.extraction.columnMapping[header];
        if (field) {
            Object.keys($scope.extraction.columnMapping).forEach(function(other) {
                if (other !== header && $scope.extraction.columnMapping[other] === field) {
                    $scope.extraction.columnMapping[other] = '';
                }
            });
        }
        rebuildProposals();
    };

    // The fields offered as edits, in the order they appear in the table.
    var EXTRACTABLE_FIELDS = [
        { key: 'time', label: 'Time', isTime: true },
        { key: 'agerank', label: 'Age rank' },
        { key: 'agetotal', label: 'Age total' },
        { key: 'genderrank', label: 'Gender rank' },
        { key: 'gendertotal', label: 'Gender total' },
        { key: 'overallrank', label: 'Overall rank' },
        { key: 'overalltotal', label: 'Overall total' }
    ];

    // Members who were on the team on race day, used for name matching. A race
    // from 2014 should match the 2014 roster, not today's.
    $scope.raceDayMembers = [];
    MembersService.getMembers({
        'filters[memberStatus]': 'all',
        'sort': 'firstname lastname'
    }).then(function(members) {
        $scope.allMembersForExtraction = members;
        $scope.raceDayMembers = ResultExtractionService.membersActiveOn(members, $scope.race.racedate);
    });

    function currentValue(result, field) {
        return field === 'time' ? result.time : (result.ranking ? result.ranking[field] : undefined);
    }

    // Centiseconds split into the h/m/s/cs inputs the results table binds to
    function timeExpFor(centiseconds) {
        return {
            hours: Math.floor(centiseconds / 360000),
            minutes: Math.floor(((centiseconds % 8640000) % 360000) / 6000),
            seconds: Math.floor((((centiseconds % 8640000) % 360000) % 6000) / 100),
            centiseconds: Math.floor((((centiseconds % 8640000) % 360000) % 6000) % 100)
        };
    }

    function isEmptyValue(value) {
        return value === undefined || value === null || value === '' || value <= 0;
    }

    // Keep a freshly scraped table, guess its columns, and build the first set
    // of proposals. Shared by the two ways of getting one: fetching a URL, and
    // pasting page source.
    function receiveTable(data, sourceUrl) {
        if (!data || !data.success) {
            $scope.extraction.error = (data && data.error) || 'Failed to load the results table';
            $scope.extraction.loading = false;
            return;
        }

        var url = sourceUrl || '';
        var isParkrun = url.includes('parkrun.') || data.source === 'parkrun';

        $scope.extraction.tables = data.tables || [];
        $scope.extraction.tableHeaders = data.headers || [];
        $scope.extraction.tableData = data.data || [];
        $scope.extraction.columnMapping = ResultExtractionService.guessColumnMapping(
            isParkrun ? 'parkrun.' : url, data.headers, { fallbackToGenericHeaders: true });
        $scope.extraction.rowOptions = {
            stripPersonalBest: isParkrun,
            stripDigitsFromGender: isParkrun
        };

        rebuildProposals(true);
    }

    // Re-derive the proposals from the stored table and the current mapping.
    // Called again whenever the admin corrects a column.
    function rebuildProposals(isFirstRun) {
            var columnMapping = $scope.extraction.columnMapping;
            var options = $scope.extraction.rowOptions;
            var tableData = $scope.extraction.tableData || [];

            // Race-day roster, falling back to whatever is loaded if the member
            // list has not come back yet.
            var members = $scope.raceDayMembers && $scope.raceDayMembers.length
                ? $scope.raceDayMembers
                : ($scope.allMembersForExtraction || []);

            var proposals = [];
            var additions = [];

            tableData.forEach(function(row) {
                var parsed = ResultExtractionService.parseRow(row, columnMapping, tableData, options);
                if (!parsed) return;

                var member = ResultExtractionService.matchMember(parsed.firstname, parsed.lastname, members);
                if (!member) return; // not one of ours, ignore silently

                // Find the stored result for that member on this race
                var existing = $scope.raceResults.find(function(result) {
                    return (result.members || []).some(function(resultMember) {
                        return resultMember._id === member._id;
                    });
                });

                // On the team on race day and in the results, but with nothing
                // stored — offer to create the result rather than just noting it.
                if (!existing) {
                    additions.push({
                        name: member.firstname + ' ' + member.lastname,
                        member: member,
                        parsed: parsed,
                        values: EXTRACTABLE_FIELDS.map(function(field) {
                            var scraped = field.key === 'time' ? parsed.time : parsed.ranking[field.key];
                            if (isEmptyValue(scraped)) return null;
                            return { label: field.label, value: scraped, isTime: field.isTime };
                        }).filter(function(value) { return value !== null; }),
                        add: true
                    });
                    return;
                }

                var changes = EXTRACTABLE_FIELDS.map(function(field) {
                    var scraped = field.key === 'time' ? parsed.time : parsed.ranking[field.key];
                    if (isEmptyValue(scraped)) return null;

                    var current = currentValue(existing, field.key);
                    if (!isEmptyValue(current) && Number(current) === Number(scraped)) return null;

                    return {
                        key: field.key,
                        label: field.label,
                        isTime: field.isTime,
                        current: current,
                        scraped: scraped,
                        // Filling a blank is nearly always right, so it starts
                        // ticked; overwriting a value an admin may have entered
                        // by hand does not.
                        wasEmpty: isEmptyValue(current),
                        apply: isEmptyValue(current)
                    };
                }).filter(function(change) { return change !== null; });

                if (changes.length > 0) {
                    proposals.push({
                        result: existing,
                        name: member.firstname + ' ' + member.lastname,
                        changes: changes
                    });
                }
            });

            $scope.extraction.proposals = proposals;
            $scope.extraction.additions = additions;
            $scope.extraction.loading = false;

            if (isFirstRun && proposals.length === 0 && additions.length === 0) {
                // Most often a column was read wrongly, so point at the fix
                $scope.extraction.showMapping = true;
                NotificationService.showNotifiction(true,
                    'Nothing matched — check the column mapping below');
            }
    }

    function extractionFailed(response) {
        $scope.extraction.error = (response && response.data && response.data.error) ||
            'Failed to load the results table';
        $scope.extraction.loading = false;
    }

    function startExtraction() {
        $scope.extraction.loading = true;
        $scope.extraction.error = null;
        $scope.extraction.proposals = null;
        $scope.extraction.additions = [];
    }

    // Re-read the page, taking a different one of the tables found on it
    $scope.useTable = function(tableIndex) {
        $scope.extraction.tableIndex = tableIndex;
        if (($scope.extraction.htmlSource || '').trim()) {
            $scope.parsePastedResults(tableIndex);
        } else {
            $scope.fetchResultsFromLink(tableIndex);
        }
    };

    $scope.fetchResultsFromLink = function(tableIndex) {
        var url = ($scope.extraction.url || '').trim();
        if (!url) return;

        startExtraction();
        ResultExtractionService.fetchTable(url, tableIndex).then(function(data) {
            receiveTable(data, url);
        }).catch(extractionFailed);
    };

    // For sites that block server-side requests: the admin opens the page in
    // their browser, copies the source, and pastes it here.
    $scope.parsePastedResults = function(tableIndex) {
        var html = ($scope.extraction.htmlSource || '').trim();
        if (!html) return;

        startExtraction();
        ResultExtractionService.parseHtmlSource(html, tableIndex).then(function(data) {
            // The URL box may still hold the page the source came from; it is
            // used for the per-site column guesses and stored on edited results.
            receiveTable(data, ($scope.extraction.url || '').trim());
        }).catch(extractionFailed);
    };

    $scope.proposedChangeCount = function() {
        if (!$scope.extraction.proposals) return 0;
        return $scope.extraction.proposals.reduce(function(count, proposal) {
            return count + proposal.changes.filter(function(change) { return change.apply; }).length;
        }, 0);
    };

    $scope.proposedAdditionCount = function() {
        return ($scope.extraction.additions || []).filter(function(addition) {
            return addition.add;
        }).length;
    };

    $scope.setAllProposedChanges = function(apply) {
        ($scope.extraction.proposals || []).forEach(function(proposal) {
            proposal.changes.forEach(function(change) { change.apply = apply; });
        });
        ($scope.extraction.additions || []).forEach(function(addition) {
            addition.add = apply;
        });
    };

    // Write the confirmed changes onto the loaded results, and add the confirmed
    // new ones to the table. Nothing is persisted until the admin saves the
    // race, same as every other edit in this modal.
    $scope.applyProposedChanges = function() {
        var resultLink = ($scope.extraction.url || '').trim();
        var applied = 0;

        ($scope.extraction.proposals || []).forEach(function(proposal) {
            proposal.changes.forEach(function(change) {
                if (!change.apply) return;
                if (change.key === 'time') {
                    proposal.result.time = change.scraped;
                    proposal.result.timeExp = timeExpFor(change.scraped);
                } else {
                    if (!proposal.result.ranking) proposal.result.ranking = {};
                    proposal.result.ranking[change.key] = change.scraped;
                }
                applied++;
            });

            // The link the data came from, so the next admin can check the
            // source. Empty when the HTML was pasted without a URL.
            if (!proposal.result.resultlink && resultLink) {
                proposal.result.resultlink = resultLink;
            }
        });

        var added = 0;
        ($scope.extraction.additions || []).forEach(function(addition) {
            if (!addition.add) return;
            // Goes into the same table as the stored results so it can be
            // checked and edited before saving; created on save, not now.
            $scope.raceResults.push({
                isNew: true,
                members: [addition.member],
                time: addition.parsed.time,
                timeExp: timeExpFor(addition.parsed.time),
                ranking: angular.copy(addition.parsed.ranking),
                resultlink: resultLink,
                isRecordEligible: true,
                comments: '',
                legs: []
            });
            added++;
        });

        if (added > 0) {
            $scope.raceResults.sort(function(result1, result2) {
                return (result1.time || 0) - (result2.time || 0);
            });
        }

        if (applied > 0 || added > 0) {
            $scope.markResultsModified();
        }
        $scope.extraction.proposals = null;
        $scope.extraction.additions = [];

        var parts = [];
        if (applied > 0) parts.push(applied + (applied === 1 ? ' change' : ' changes'));
        if (added > 0) parts.push(added + (added === 1 ? ' new result' : ' new results'));
        NotificationService.showNotifiction(true,
            (parts.length ? parts.join(' and ') : 'Nothing') + ' applied — save the race to keep them');
    };

    $scope.discardProposedChanges = function() {
        $scope.extraction.proposals = null;
        $scope.extraction.additions = [];
        // Drop the scraped table too, so the panel goes back to a clean start
        // rather than leaving a mapping UI with nothing behind it.
        $scope.extraction.tableHeaders = [];
        $scope.extraction.tableData = [];
        $scope.extraction.tables = [];
        $scope.extraction.showMapping = false;
    };

    // Drop a result that was added from an extraction but not saved yet
    $scope.removeNewResult = function(index) {
        $scope.raceResults.splice(index, 1);
    };


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

    $scope.setRaceCustomOptionPreset = function(index, presetName) {
        var option = $scope.race.customOptions[index];
        var PRESETS = {
            'raceIcon': { name: 'raceIcon', text: '', value: '' },
            'raceText': { name: 'raceText', text: '', value: '' }
        };
        var preset = PRESETS[presetName];
        if (preset) {
            option.name = preset.name;
            option.text = preset.text;
            option.value = preset.value;
            option.valueString = typeof preset.value === 'object' ? JSON.stringify(preset.value) : String(preset.value);
        }
    };
    
    $scope.isAchievementDisabled = function(achievement) {
        return achievement.name === 'newLocation';
    };
    
    $scope.toggleAchievements = function() {
        $scope.achievementsCollapsed = !$scope.achievementsCollapsed;
    };
    
    $scope.toggleCustomOptions = function() {
        $scope.customOptionsCollapsed = !$scope.customOptionsCollapsed;
    };

    $scope.togglePhotoLinks = function() {
        $scope.photoLinksCollapsed = !$scope.photoLinksCollapsed;
    };

    $scope.addPhotoLink = function() {
        $scope.race.photoLinks.push({ url: '', label: '' });
        $scope.photoLinksCollapsed = false;
    };

    $scope.removePhotoLink = function(index) {
        $scope.race.photoLinks.splice(index, 1);
    };

    $scope.toggleResults = function() {
        $scope.resultsCollapsed = !$scope.resultsCollapsed;
    };
    
    
    
    // Delete a single result
    $scope.deleteResult = function(result, index) {
        if (confirm('Are you sure you want to delete this result?')) {
            ResultsService.deleteResult(result._id).then(function() {
                $scope.raceResults.splice(index, 1);
            }).catch(function(error) {
                console.error('Error deleting result:', error);
            });
        }
    };

    $scope.updateTime = function(result) {
        // Ensure all time components are numbers
        result.timeExp.hours = parseInt(result.timeExp.hours) || 0;
        result.timeExp.minutes = parseInt(result.timeExp.minutes) || 0;
        result.timeExp.seconds = parseInt(result.timeExp.seconds) || 0;
        result.timeExp.centiseconds = parseInt(result.timeExp.centiseconds) || 0;

        // Calculate total time in centiseconds
        result.time = (result.timeExp.hours * 3600 + 
                      result.timeExp.minutes * 60 + 
                      result.timeExp.seconds) * 100 + 
                      result.timeExp.centiseconds;
        $scope.markResultsModified();
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
       
        // Save the race first
        ResultsService.updateRace($scope.race).then(function(updatedRace) {

            // Results added from an extraction have no _id yet: they are created
            // against this race, while the rest are updated in place.
            var newResults = ($scope.raceResults || []).filter(function(result) {
                return result.isNew;
            });
            var storedResults = ($scope.raceResults || []).filter(function(result) {
                return !result.isNew;
            });

            var work = [];

            if ($scope.resultsModified && storedResults.length > 0) {
                var resultsToUpdate = storedResults.map(function(result) {
                    return {
                        _id: result._id,
                        time: result.time,
                        ranking: result.ranking,
                        members: result.members,
                        legs: result.legs,
                        comments: result.comments,
                        resultlink: result.resultlink,
                        isRecordEligible: result.isRecordEligible,
                        customOptions: result.customOptions,
                        achievements: result.achievements
                    };
                });
                work.push(ResultsService.updateResultsBulk(resultsToUpdate).then(function(response) {
                    updatedRace.results = response.results;
                }));
            }

            if (newResults.length > 0) {
                var resultsToCreate = newResults.map(function(result) {
                    return {
                        time: result.time,
                        ranking: result.ranking,
                        members: result.members,
                        legs: result.legs || [],
                        comments: result.comments || '',
                        resultlink: result.resultlink || '',
                        isRecordEligible: result.isRecordEligible !== false
                    };
                });
                // The bulk endpoint attaches these to the existing race by _id,
                // and works out age grades and personal bests as it goes.
                work.push(ResultsService.saveResultsBulk(resultsToCreate, $scope.race));
            }

            if (work.length === 0) {
                $uibModalInstance.close(updatedRace);
                return;
            }

            $q.all(work).then(function() {
                $uibModalInstance.close(updatedRace);
            }).catch(function(error) {
                console.error('Error saving results:', error);
                // Still close the modal even if the results step fails
                $uibModalInstance.close(updatedRace);
            });
        }).catch(function(error) {
            console.error('Error saving race:', error);
            // Don't close modal if race save fails
        });
    };
    
    $scope.cancel = function() {
        $uibModalInstance.dismiss('cancel');
    };
}]);


