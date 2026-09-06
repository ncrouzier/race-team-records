angular.module('mcrrcApp.results').controller('StatsController', ['$scope', 'AuthService', 'ResultsService', 'MembersService', 'UtilsService', 'StatsService', 'dialogs', '$filter', '$state', 'MemoryCacheService', function ($scope, AuthService, ResultsService, MembersService, UtilsService, StatsService, dialogs, $filter, $state, MemoryCacheService) {

    $scope.authService = AuthService;
    $scope.$watch('authService.isLoggedIn()', function (user) {
        var hadUser = !!$scope.user;
        $scope.user = user;
        // When user logs in after initial load, only load participation stats (other stats are user-independent)
        if ($scope.statsInitialized && !hadUser && user && (user.role === 'user' || user.role === 'admin' || user.role === 'captain')) {
            $scope.getParticipationStats();
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

    $scope.current = { memberStatus: "current" };

    $scope.past = { memberStatus: "past" };

    $scope.statusChoice = $scope.current;
    $scope.reverseSort = false;
    $scope.reverseSortParticipation = false;

    var currentYear = new Date().getFullYear();
    $scope.yearsList = ['All Time'];
    for (i = currentYear; i >= 2013; i--) {
        $scope.yearsList.push(i);
    }

    $scope.participationStats = {};

    $scope.partdates = {};
    var start = new Date(Date.UTC(new Date().getFullYear(), 0, 1, 0, 0, 0, 0));
    var end = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 0, 0, 0, 0));
    $scope.partdates.participationStatsStart = start;
    $scope.partdates.participationStatsEnd = end;

    $scope.participationStatsStartPicker = {};
    $scope.openParticipationStatsStartPicker = function ($event) {
        $event.preventDefault();
        $event.stopPropagation();
        $scope.participationStatsStartPicker.opened = true;
    };


    $scope.participationStatsEndPicker = {};
    $scope.openParticipationStatsEndPicker = function ($event) {
        $event.preventDefault();
        $event.stopPropagation();
        $scope.participationStatsEndPicker.opened = true;
    };

    $scope.selectDate = function () {
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
        }).catch(function (error) {
            $scope.loadingStates.participationStats = false;
            throw error;
        });
    };


    $scope.getRacesStats = function () {
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
                "dateTo": toDate - 1
            }
        }).then(function (races) {
            // For consistency, also filter on client side using year-based logic
            if ($scope.raceStats.year !== "All Time") {
                races = races.filter(function (race) {
                    var raceDate = new Date(race.racedate);
                    var raceYear = raceDate.getUTCFullYear();
                    return raceYear === parseInt($scope.raceStats.year);
                });
            }

            $scope.racesList = races;
            $scope.loadingStates.raceStats = false;
            return races;
        }).catch(function (error) {
            $scope.loadingStates.raceStats = false;
            throw error;
        });
    };

    $scope.getMiscStats = function () {
        $scope.loadingStates.miscStats = true;

        StatsService.getStats($scope.miscStats.year).then(function (stats) {
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
        }).catch(function (error) {
            $scope.loadingStates.miscStats = false;

            // Force digest cycle to update UI
            if (!$scope.$$phase) {
                $scope.$apply();
            }

            throw error;
        });
    };

    $scope.ageBucketSizes = [1, 2, 5, 10];
    $scope.ageBucketSize = 1;

    // Members matching the given status filter. `statusValue` is 'current',
    // 'past', or falsy (no restriction — matches the header status selector's
    // "All" option). Shared by everything that buckets/aggregates members.
    function filteredMembers(members, statusValue) {
        return members.filter(function (m) { return !statusValue || m.memberStatus === statusValue; });
    }

    // Ages (sorted) for members matching the given status filter.
    function filteredAges(members, statusValue) {
        var ageFilter = $filter('memberAgeFilter');
        return filteredMembers(members, statusValue)
            .map(function (m) { return ageFilter(m); })
            .filter(function (age) { return age != null && !isNaN(age); })
            .sort(function (a, b) { return a - b; });
    }

    // A member's single best (highest) age grade across all their personal
    // bests, or null if they have none on file.
    function bestAgeGrade(member) {
        var bests = member && member.personalBests;
        if (!bests || !bests.length) return null;
        var max = null;
        bests.forEach(function (pb) {
            var ag = pb && pb.result && pb.result.agegrade;
            if (ag != null && (max == null || ag > max)) max = ag;
        });
        return max;
    }

    // A member's own average age grade across all their personal bests (as
    // opposed to bestAgeGrade, their single peak performance), or null if
    // they have none on file.
    function memberAvgAgeGrade(member) {
        var bests = member && member.personalBests;
        if (!bests || !bests.length) return null;
        var sum = 0, n = 0;
        bests.forEach(function (pb) {
            var ag = pb && pb.result && pb.result.agegrade;
            if (ag != null) { sum += ag; n++; }
        });
        return n ? sum / n : null;
    }

    // Buckets members into age brackets for the age distribution + age-grade
    // histograms on the Team Members Stats page. Each bucket carries the
    // member count (age distribution) plus two age-grade aggregates so the
    // age-grade chart can switch between them without recomputing:
    //   - avgBestAgeGrade: bucket average of each member's own best PB
    //   - avgOfAvgAgeGrade: bucket average of each member's own average PB
    // Both are null for a bucket where no member in it has a personal best
    // on file. When bucketSize is 1, each bucket covers a single age, so the
    // label is just that age rather than a "X-X" range.
    function buildAgeDistribution(members, statusValue, bucketSize) {
        bucketSize = bucketSize || 1;
        var ageFilter = $filter('memberAgeFilter');
        var buckets = {};

        filteredMembers(members, statusValue).forEach(function (m) {
            var age = ageFilter(m);
            if (age == null || isNaN(age)) return;
            var lower = Math.floor(age / bucketSize) * bucketSize;
            if (!buckets[lower]) buckets[lower] = { count: 0, bestSum: 0, avgSum: 0, agCount: 0 };
            buckets[lower].count++;
            var bestAg = bestAgeGrade(m);
            if (bestAg != null) {
                buckets[lower].bestSum += bestAg;
                buckets[lower].avgSum += memberAvgAgeGrade(m);
                buckets[lower].agCount++;
            }
        });

        var lowers = Object.keys(buckets).map(Number);
        if (!lowers.length) return [];
        var min = Math.min.apply(null, lowers);
        var max = Math.max.apply(null, lowers);

        var result = [];
        for (var lower = min; lower <= max; lower += bucketSize) {
            var label = bucketSize === 1 ? String(lower) : (lower + '-' + (lower + bucketSize - 1));
            var b = buckets[lower];
            result.push({
                lower: lower,
                label: label,
                count: b ? b.count : 0,
                avgBestAgeGrade: (b && b.agCount) ? Math.round((b.bestSum / b.agCount) * 10) / 10 : null,
                avgOfAvgAgeGrade: (b && b.agCount) ? Math.round((b.avgSum / b.agCount) * 10) / 10 : null,
                ageGradeMemberCount: b ? b.agCount : 0
            });
        }
        return result;
    }

    // Mean and median age for members matching the given status filter.
    function computeAgeStats(members, statusValue) {
        var ages = filteredAges(members, statusValue);
        if (!ages.length) return { mean: null, median: null };

        var sum = ages.reduce(function (a, b) { return a + b; }, 0);
        var mean = sum / ages.length;

        var mid = Math.floor(ages.length / 2);
        var median = ages.length % 2 ? ages[mid] : (ages[mid - 1] + ages[mid]) / 2;

        return { mean: Math.round(mean * 10) / 10, median: median };
    }

    $scope.getAttendanceStats = function () {
        $scope.loadingStates.attendanceStats = true;

        return StatsService.getAttendanceStats().then(function (data) {
            $scope.attendanceRacesList = data.races;

            var now = new Date();
            var nowUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0);
            var nowUTCDate = new Date(nowUTC);
            data.members.forEach(function (m) {
                var date = new Date($filter('date')(m.dateofbirth, 'yyyy-MM-dd', 'UTC'));
                var currentYear = new Date().getUTCFullYear();
                var birthdayDate = new Date(Date.UTC(currentYear, date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));

                if (birthdayDate.getTime() < nowUTCDate.getTime()) {
                    birthdayDate.setUTCFullYear(currentYear + 1);
                }
                m.fromNow = birthdayDate.getTime() - nowUTCDate.getTime();
            });

            $scope.membersList = data.members;
            refreshAgeDistribution();
            $scope.loadingStates.attendanceStats = false;
            return data;
        }).catch(function (error) {
            $scope.loadingStates.attendanceStats = false;
            throw error;
        });
    };

    // Recomputes both the histogram and the mean/median summary from the
    // current membersList, status filter, and bucket size.
    function refreshAgeDistribution() {
        if (!$scope.membersList) return;
        var statusValue = $scope.statusChoice && $scope.statusChoice.memberStatus;
        $scope.ageDistribution = buildAgeDistribution($scope.membersList, statusValue, $scope.ageBucketSize);
        $scope.ageStats = computeAgeStats($scope.membersList, statusValue);
    }

    // Keep the age distribution chart in sync with the header status selector
    // (All/Current/Past) and the bucket size selector.
    $scope.$watchGroup(['statusChoice', 'ageBucketSize'], refreshAgeDistribution);

    // Lets the user pick which per-member age-grade figure the second
    // histogram averages per bucket: their single best PB, or their own
    // average across all PBs.
    $scope.ageGradeMetric = 'best';
    $scope.ageGradeMetricOptions = [
        { id: 'best', label: "Members' Best AG" },
        { id: 'average', label: "Members' Average AG" }
    ];

    // Toggles the age-grade chart's y-axis between the full 0-100% range and
    // a zoomed-in range fit to the data actually shown (most values cluster
    // in 60-90%, so the full range makes differences hard to see).
    $scope.ageGradeZoomed = false;

    // Derives the chart-ready array for the age-grade histogram from
    // ageDistribution, picking whichever per-bucket aggregate matches the
    // selected metric — no need to recompute the buckets themselves.
    function refreshAgeGradeChartData() {
        var metric = $scope.ageGradeMetric;
        $scope.ageGradeChartData = ($scope.ageDistribution || []).map(function (b) {
            return {
                label: b.label,
                avgAgeGrade: metric === 'average' ? b.avgOfAvgAgeGrade : b.avgBestAgeGrade,
                ageGradeMemberCount: b.ageGradeMemberCount
            };
        });
    }

    $scope.$watchGroup(['ageDistribution', 'ageGradeMetric'], refreshAgeGradeChartData);

    // Label of the currently selected age-grade metric, used as the chart's
    // dataset/axis label so it matches whichever figure is being shown.
    $scope.selectedAgeGradeMetricLabel = function () {
        var match = $scope.ageGradeMetricOptions.filter(function (o) { return o.id === $scope.ageGradeMetric; })[0];
        return match ? match.label : 'Avg Age Grade';
    };

    // Human-readable label for the currently selected status filter, used in
    // panel headings on the Team Members Stats page.
    $scope.statusChoiceLabel = function () {
        var s = $scope.statusChoice && $scope.statusChoice.memberStatus;
        if (s === 'current') return 'Current';
        if (s === 'past') return 'Past';
        return 'All';
    };



    $scope.onSelectRace = function (item, model) {
        ResultsService.getResults({
            "sort": 'members.firstname',
            "filters": {
                "raceid": item._id
            }
        }).then(function (results) {
            resultarray = [];
            numberOfRacer = new Array($scope.membersList.length).fill(0);
            if ($scope.attendanceStats.selectedAttendanceRaces.length === 0) {
                $scope.attendanceStats.racedRaces = new Array($scope.membersList.length).fill(0);
            }
            foundRunners = 0;
            for (i = 0; i < $scope.membersList.length; i++) {
                found = false;
                for (j = 0; j < results.length; j++) {
                    for (k = 0; k < results[j].members.length; k++) {

                        if ($scope.membersList[i]._id === results[j].members[k]._id) {
                            found = results[j];
                        }
                    }
                }
                if (found) {
                    found.text = "y";
                    foundRunners++;
                    $scope.attendanceStats.racedRaces[i]++;
                    numberOfRacer[i]++;
                    resultarray.push(found);
                } else {
                    found = {};
                    found.text = "n";
                    resultarray.push(found);
                }
            }
            $scope.attendanceStats.selectedAttendanceRaces.push([item.racename, resultarray, foundRunners, numberOfRacer]);

        });
    };
    $scope.getRaceTypeClass = function (s) {
        if (s !== undefined) {
            return s.replace(/ /g, '') + '-col';
        }
    };

    $scope.removeRace = function (index) {
        for (i = 0; i < $scope.attendanceStats.selectedAttendanceRaces[index][3].length; i++) {
            $scope.attendanceStats.racedRaces[i] = $scope.attendanceStats.racedRaces[i] - $scope.attendanceStats.selectedAttendanceRaces[index][3][i];
        }
        $scope.attendanceStats.selectedAttendanceRaces.splice(index, 1);
    };


    $scope.showRaceModal = function (raceinfo) {
        if (raceinfo) {
            ResultsService.showRaceModal(raceinfo).then(function () { });
        }
    };

    $scope.showRaceFromRaceIdModal = function (raceId) {
        if (raceId) {
            ResultsService.showRaceFromRaceIdModal(raceId).then(function () { });
        }
    };

    $scope.goToResultsWithQuery = function (queryParams) {
        // Remove null, undefined, or empty string values
        var cleanedParams = {};
        Object.keys(queryParams).forEach(function (key) {
            var value = queryParams[key];
            if (value !== null && value !== undefined && value !== '') {
                cleanedParams[key] = value;
            }
        });

        var searchQuery = JSON.stringify(cleanedParams);
        $state.go('/results', { search: searchQuery });
    };



    // Pre-load all years in the cache for faster year switching
    $scope.preloadAllYears = function () {
        $scope.loadingStates.preloadingYears = true;

        // Get all years except "All Time" (which is already loaded)
        var yearsToPreload = $scope.yearsList.filter(function (year) {
            return year !== "All Time";
        });

        // Pre-load each year with a small delay to avoid overwhelming the system
        var preloadPromises = yearsToPreload.map(function (year, index) {
            return new Promise(function (resolve) {
                // Add a small delay between requests to be more user-friendly
                setTimeout(function () {
                    StatsService.getStats(year).then(function (stats) {
                        resolve({ year: year, stats: stats });
                    }).catch(function (error) {
                        console.error(`[StatsCtrl] Error pre-loading year ${year}:`, error);
                        resolve({ year: year, error: error });
                    });
                }, index * 100); // 100ms delay between each request
            });
        });

        // Wait for all pre-loads to complete
        Promise.all(preloadPromises).then(function (results) {
            var successCount = results.filter(function (result) {
                return !result.error;
            }).length;
            $scope.loadingStates.preloadingYears = false;
            if (!$scope.$$phase) {
                $scope.$apply();
            }
        }).catch(function (error) {
            console.error('[StatsCtrl] Error pre-loading years:', error);
            $scope.loadingStates.preloadingYears = false;
            if (!$scope.$$phase) {
                $scope.$apply();
            }
        });
    };

    // On controller load, check for DB updates and clear caches if needed
    // Use Promise-based loading to avoid race conditions and ensure proper timing
    // =====================================
    // AWARDS (ROY / MUTROY) ===============
    $scope.awardsByYear = [];
    $scope.loadingStates.awards = false;

    $scope.loadAwards = function () {
        if ($scope.awardsByYear.length > 0) return; // already loaded
        $scope.loadingStates.awards = true;

        MembersService.getMembersWithCacheSupport({
            select: 'firstname lastname username achievements sex'
        }).then(function (members) {
            var awards = [];
            members.forEach(function (member) {
                if (!member.achievements || member.achievements.length === 0) return;
                member.achievements.forEach(function (ach) {
                    if (ach.name !== 'ROY' && ach.name !== 'MUTROY') return;
                    // Parse year from text (e.g., "Runner of the Year Open Male 2014")
                    var yearMatch = ach.text && ach.text.match(/\b(20\d{2})\b/);
                    var year = yearMatch ? parseInt(yearMatch[1]) : null;
                    // Parse category: remove the award title prefix and the year
                    var category = '';
                    if (ach.text) {
                        category = ach.text
                            .replace(/Runner of the Year\s*/i, '')
                            .replace(/Mountain\/Ultra\/Trail Runner of the Year\s*/i, '')
                            .replace(/\b20\d{2}\b/, '')
                            .trim();
                    }
                    awards.push({
                        type: ach.name,
                        typeName: ach.name === 'ROY' ? 'Runner of the Year' : 'Mountain/Ultra/Trail Runner of the Year',
                        category: category,
                        year: year,
                        member: {
                            firstname: member.firstname,
                            lastname: member.lastname,
                            username: member.username
                        },
                        img: ach.value && ach.value.img ? ach.value.img : null,
                        text: ach.text
                    });
                });
            });

            // Group by year, sorted descending
            var yearMap = {};
            awards.forEach(function (award) {
                var key = award.year || 'Unknown';
                if (!yearMap[key]) yearMap[key] = [];
                yearMap[key].push(award);
            });

            var sortedYears = Object.keys(yearMap).sort(function (a, b) {
                if (a === 'Unknown') return 1;
                if (b === 'Unknown') return -1;
                return parseInt(b) - parseInt(a);
            });

            $scope.awardsByYear = sortedYears.map(function (year) {
                // Sort awards within year: ROY first, then MUTROY, then by category
                var yearAwards = yearMap[year].sort(function (a, b) {
                    if (a.type !== b.type) return a.type === 'ROY' ? -1 : 1;
                    return a.category.localeCompare(b.category);
                });
                return { year: year, awards: yearAwards };
            });

            $scope.loadingStates.awards = false;
        });
    };

    // Load awards if on the awards page
    if ($state.current.name === '/stats/awards') {
        $scope.loadAwards();
    }

    $scope.initializeStats = function () {
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
        Promise.all(statsPromises).then(function (results) {
            // Trigger a digest cycle to ensure UI updates
            if (!$scope.$$phase) {
                $scope.$apply();
            }

            // Pre-load all years after main stats are loaded
            $scope.preloadAllYears();
            if (!$scope.$$phase) {
                $scope.$apply();
            }
        }).catch(function (error) {
            console.error('[StatsCtrl] Error loading stats:', error);
        });
    };

    // Initialize stats when controller loads
    $scope.statsInitialized = true;
    $scope.initializeStats();



}]);
