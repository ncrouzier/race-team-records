// The "Advanced Filters" panel, shared by Team Results "By race" (ResultsCtrl)
// and "By result" (individualResults). The panel's markup lives in
// <advanced-filter-panel>; this service holds what both hosts need around it:
//
//   buildOptions(races)  the race types, countries and states to offer, with
//                        race counts, the longest distance for the distance
//                        slider and the top age grade for the age grade one
//   attach(scope)        the panel's handlers (add/remove a race type, country,
//                        state or member; the distance inputs; show/hide),
//                        defined on the host scope. Each change ends with
//                        scope.applyFilters(), which the host implements.
//   isRankingInRange     "3" or "1-3" against a rank
//
// The host provides scope.filters (dateFrom, dateTo, distanceMin, distanceMax,
// agMin, agMax, raceTypes, countries, states, selectedMembers, missingRanking),
// and scope.distanceRange, scope.ageGradeRange, scope.applyFilters,
// scope.clearAllFilters,
// scope.getActiveFilterCount and scope.hasActiveFilters.
angular.module('mcrrcApp').service('AdvancedFiltersService', ['UtilsService', '$timeout', function (UtilsService, $timeout) {

    // Admin data-cleanup filter: ranking fields an admin can hunt for gaps
    // in. 'any' covers all four, which is the usual starting point when
    // working through the backlog.
    this.MISSING_RANKING_OPTIONS = [
        { key: 'any', label: 'Any ranking field', fields: ['overallrank', 'genderrank', 'overalltotal', 'gendertotal'] },
        { key: 'overallrank', label: 'Overall ranking', fields: ['overallrank'] },
        { key: 'genderrank', label: 'Gender ranking', fields: ['genderrank'] },
        { key: 'overalltotal', label: 'Overall total', fields: ['overalltotal'] },
        { key: 'gendertotal', label: 'Gender total', fields: ['gendertotal'] },
        { key: 'ranks', label: 'Either ranking', fields: ['overallrank', 'genderrank'] },
        { key: 'totals', label: 'Either total', fields: ['overalltotal', 'gendertotal'] },
        // requireAll narrows to results missing every listed field rather than
        // any one of them: a result with no placing recorded at all, which is a
        // different job from topping up one missing number.
        {
            key: 'noRanks',
            label: 'Both rankings missing (overall and gender)',
            fields: ['overallrank', 'genderrank'],
            requireAll: true
        }
    ];

    // Absent, null and non-positive all mean "not filled in yet"
    this.isRankingFieldMissing = function (result, field) {
        var value = result.ranking ? result.ranking[field] : undefined;
        return value === undefined || value === null || value <= 0;
    };

    // Whether one result has the gap a missing-ranking option looks for
    this.resultMissing = function (result, option) {
        var self = this;
        var test = function (field) { return self.isRankingFieldMissing(result, field); };
        return option.requireAll ? option.fields.every(test) : option.fields.some(test);
    };

    // Helper function to check if a ranking is within a specified range
    this.isRankingInRange = function (actualRank, rankingFilter) {
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
    };

    // Race types, countries and states found in the race list, each with the
    // number of races, plus the longest distance (for the slider's range)
    this.buildOptions = function (racesList) {
        var raceTypes = {};
        var countries = {};
        var states = {};
        var maxDistance = 0;
        var maxAgeGrade = 0;
        var raceTypeCounts = {};
        var countryCounts = {};
        var stateCounts = {};

        (racesList || []).forEach(function (race) {
            if (race.racetype && race.racetype._id) {
                raceTypes[race.racetype._id] = race.racetype;
                raceTypeCounts[race.racetype._id] = (raceTypeCounts[race.racetype._id] || 0) + 1;
            }
            if (race.location) {
                if (race.location.country) {
                    countries[race.location.country] = true;
                    countryCounts[race.location.country] = (countryCounts[race.location.country] || 0) + 1;
                }
                if (race.location.state) {
                    states[race.location.state] = true;
                    stateCounts[race.location.state] = (stateCounts[race.location.state] || 0) + 1;
                }
            }
            if (race.racetype && race.racetype.miles && race.racetype.miles > maxDistance) {
                maxDistance = race.racetype.miles;
            }
            (race.results || []).forEach(function (result) {
                var ag = parseFloat(result.agegrade);
                if (ag > maxAgeGrade) maxAgeGrade = ag;
            });
        });

        var availableRaceTypes = Object.keys(raceTypes).map(function (key) {
            var raceType = raceTypes[key];
            return {
                _id: raceType._id,
                name: raceType.name,
                surface: raceType.surface,
                miles: raceType.miles,
                isVariable: raceType.isVariable,
                count: raceTypeCounts[raceType._id] || 0
            };
        }).sort(function (a, b) {
            // Put special race types at the end
            var specialTypes = ['swim', 'cycling', 'multisport', 'odd trail distance', 'odd road distance', 'odd track distance', 'odd ultra distance'];
            var runningTypes = ['odd trail distance', 'odd road distance', 'odd track distance', 'odd ultra distance'];
            var aIsSpecial = specialTypes.some(function (type) {
                return a.name.toLowerCase().includes(type);
            });
            var bIsSpecial = specialTypes.some(function (type) {
                return b.name.toLowerCase().includes(type);
            });

            if (aIsSpecial && !bIsSpecial) return 1;
            if (!aIsSpecial && bIsSpecial) return -1;
            if (aIsSpecial && bIsSpecial) {
                // If one is running and other isn't, put running first
                var aIsRunning = runningTypes.some(function (type) {
                    return a.name.toLowerCase().includes(type);
                });
                var bIsRunning = runningTypes.some(function (type) {
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

        // Countries and states from UtilsService, with counts, by name
        var availableCountries = UtilsService.countries.filter(function (country) {
            return countries[country.code];
        }).map(function (country) {
            return { name: country.name, code: country.code, count: countryCounts[country.code] || 0 };
        }).sort(function (a, b) {
            return a.name.localeCompare(b.name);
        });

        var availableStates = UtilsService.states.filter(function (state) {
            return states[state.code];
        }).map(function (state) {
            return { name: state.name, code: state.code, count: stateCounts[state.code] || 0 };
        }).sort(function (a, b) {
            return a.name.localeCompare(b.name);
        });

        return {
            raceTypes: availableRaceTypes,
            countries: availableCountries,
            states: availableStates,
            maxDistance: Math.ceil(maxDistance),
            // 100%, or the best age grade on file if one beats it
            maxAgeGrade: Math.max(100, Math.ceil(maxAgeGrade))
        };
    };

    // The query shape the stats, member and head-to-head pages build for a
    // "By race" link — {members: [{username, ranking}], query, year,
    // distance, countries, states, calendarDay, dateFrom, dateTo} — as the
    // /results URL params:
    //   q, runner (username, or username:ranking e.g. nicolas:1-3), from, to,
    //   distance (a race type name; "other" for odd distances), country,
    //   state, month and day (1-based)
    this.queryToParams = function (query) {
        query = query || {};
        var params = {};
        if (query.query) params.q = query.query;
        if (query.members && query.members.length) {
            params.runner = query.members.map(function (m) {
                return m.username + (m.ranking ? ':' + m.ranking : '');
            }).join(',');
        }
        if (query.year) {
            params.from = query.year + '-01-01';
            params.to = query.year + '-12-31';
        }
        if (query.dateFrom) params.from = query.dateFrom;
        if (query.dateTo) params.to = query.dateTo;
        if (query.distance) params.distance = String(query.distance).toLowerCase();
        if (query.countries && query.countries.length) params.country = query.countries.join(',');
        if (query.states && query.states.length) params.state = query.states.join(',');
        if (query.calendarDay && query.calendarDay.month != null && query.calendarDay.day != null) {
            params.month = String(query.calendarDay.month + 1);
            params.day = String(query.calendarDay.day);
        }
        return params;
    };

    // Open "By race" with such a query; the filters land in its URL
    this.goToRaceList = function ($state, query) {
        $state.go('/results', this.queryToParams(query), { inherit: false });
    };

    // The panel's handlers, on the host scope
    this.attach = function (scope) {

        // Brief "Added to filter" confirmation next to a dropdown's label
        function flash(flag) {
            scope[flag] = true;
            $timeout(function () {
                scope[flag] = false;
            }, 1500);
        }

        function slider() {
            var element = document.getElementById('distance-slider');
            return element && element.noUiSlider ? element.noUiSlider : null;
        }

        scope.showCountryFeedback = false;
        scope.showStateFeedback = false;
        scope.showMemberFeedback = false;
        scope.showRaceTypeFeedback = false;

        scope.toggleFilterPanel = function () {
            scope.filterPanelExpanded = !scope.filterPanelExpanded;
        };

        scope.toggleAdvancedFilters = function () {
            scope.showAdvancedFilters = !scope.showAdvancedFilters;
            if (scope.showAdvancedFilters) {
                scope.filterPanelExpanded = true;
            }
        };

        scope.getRaceTypeClass = function (s) {
            if (s !== undefined) {
                return s.replace(/ /g, '') + '-col';
            }
        };

        scope.clearDistanceFilter = function () {
            scope.filters.distanceMin = 0;
            scope.filters.distanceMax = scope.distanceRange.max;
            if (slider()) {
                slider().set([0, scope.distanceRange.max]);
            }
            scope.applyFilters();
        };

        // Update slider when input fields change
        scope.updateSliderFromInputs = function () {
            if (slider()) {
                slider().set([scope.filters.distanceMin, scope.filters.distanceMax]);
            }
        };

        // Handle min distance input change
        scope.onDistanceMinInputChange = function () {
            // Ensure min doesn't exceed max
            if (scope.filters.distanceMinUI > scope.filters.distanceMaxUI) {
                scope.filters.distanceMinUI = scope.filters.distanceMaxUI;
                scope.filters.distanceMin = scope.filters.distanceMax;
            }
            // Ensure min is not negative
            if (scope.filters.distanceMinUI < 0) {
                scope.filters.distanceMinUI = 0;
                scope.filters.distanceMin = 0;
            }
            scope.filters.distanceMin = scope.filters.distanceMinUI;
            scope.updateSliderFromInputs();
            scope.applyFilters();
        };

        // Handle max distance input change
        scope.onDistanceMaxInputChange = function () {
            // Ensure max doesn't go below min
            if (scope.filters.distanceMaxUI < scope.filters.distanceMinUI) {
                return;
            }
            // Ensure max doesn't exceed the actual max distance
            if (scope.filters.distanceMaxUI > scope.distanceRange.max) {
                scope.filters.distanceMaxUI = scope.distanceRange.max;
                scope.filters.distanceMax = scope.distanceRange.max;
            }
            scope.filters.distanceMax = scope.filters.distanceMaxUI;
            scope.updateSliderFromInputs();
            scope.applyFilters();
        };

        // Age grade range: the same as distance, on its own slider
        function agSlider() {
            var element = document.getElementById('agegrade-slider');
            return element && element.noUiSlider ? element.noUiSlider : null;
        }

        scope.ageGradeFilterOn = function () {
            return scope.filters.agMin > 0 || scope.filters.agMax < scope.ageGradeRange.max;
        };

        scope.ageGradeFilterLabel = function () {
            var f = scope.filters;
            if (!(f.agMax < scope.ageGradeRange.max)) return 'Age grade ' + f.agMin + '%+';
            if (!(f.agMin > 0)) return 'Age grade up to ' + f.agMax + '%';
            return 'Age grade ' + f.agMin + '–' + f.agMax + '%';
        };

        scope.clearAgeGradeFilter = function () {
            scope.filters.agMin = 0;
            scope.filters.agMax = scope.ageGradeRange.max;
            if (agSlider()) {
                agSlider().set([0, scope.ageGradeRange.max]);
            }
            scope.applyFilters();
        };

        scope.updateAgeGradeSliderFromInputs = function () {
            if (agSlider()) {
                agSlider().set([scope.filters.agMin, scope.filters.agMax]);
            }
        };

        scope.onAgeGradeMinInputChange = function () {
            var f = scope.filters;
            if (!(f.agMinUI >= 0)) f.agMinUI = 0;
            if (f.agMinUI > f.agMaxUI) f.agMinUI = f.agMaxUI;
            f.agMin = f.agMinUI;
            scope.updateAgeGradeSliderFromInputs();
            scope.applyFilters();
        };

        scope.onAgeGradeMaxInputChange = function () {
            var f = scope.filters;
            if (f.agMaxUI < f.agMinUI) return;
            if (f.agMaxUI > scope.ageGradeRange.max) f.agMaxUI = scope.ageGradeRange.max;
            f.agMax = f.agMaxUI;
            scope.updateAgeGradeSliderFromInputs();
            scope.applyFilters();
        };

        // Add/remove for the four list filters. Adding something already in
        // the list just confirms it.
        function adder(listName, sameAs, flag) {
            return function (item) {
                if (!item) return;
                var exists = scope.filters[listName].some(function (other) {
                    return sameAs(other, item);
                });
                if (!exists) {
                    scope.filters[listName].push(item);
                    scope.applyFilters();
                }
                flash(flag);
            };
        }

        scope.addCountryToFilter = function (country) {
            if (country && country.code) {
                adder('countries', function (a, b) { return a.code === b.code; }, 'showCountryFeedback')(country);
            }
        };

        scope.removeCountryFromFilter = function (countryCode) {
            scope.filters.countries = scope.filters.countries.filter(function (country) {
                return country.code !== countryCode;
            });
            scope.applyFilters();
        };

        scope.addStateToFilter = function (state) {
            if (state && state.code) {
                adder('states', function (a, b) { return a.code === b.code; }, 'showStateFeedback')(state);
                // Clear the selection to revert to placeholder
                scope.selectedState = null;
            }
        };

        scope.removeStateFromFilter = function (stateCode) {
            scope.filters.states = scope.filters.states.filter(function (state) {
                return state.code !== stateCode;
            });
            scope.applyFilters();
        };

        scope.addRaceTypeToFilter = function (raceType) {
            if (raceType && raceType.name) {
                adder('raceTypes', function (a, b) { return a.name === b.name && a.surface === b.surface; }, 'showRaceTypeFeedback')(raceType);
            }
        };

        scope.removeRaceTypeFromFilter = function (raceTypeToRemove) {
            scope.filters.raceTypes = scope.filters.raceTypes.filter(function (raceType) {
                return !(raceType.name === raceTypeToRemove.name && raceType.surface == raceTypeToRemove.surface);
            });
            scope.applyFilters();
        };

        scope.addMemberToFilter = function (member) {
            if (member && member._id) {
                adder('selectedMembers', function (a, b) { return a._id === b._id; }, 'showMemberFeedback')(member);
            }
        };

        scope.removeMemberFromFilter = function (memberId) {
            scope.filters.selectedMembers = scope.filters.selectedMembers.filter(function (member) {
                return member._id !== memberId;
            });
            scope.applyFilters();
        };
    };
}]);
