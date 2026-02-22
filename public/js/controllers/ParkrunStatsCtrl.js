angular.module('mcrrcApp').controller('ParkrunStatsController', ['$scope', 'ResultsService', 'MembersService', 'UtilsService', '$filter', '$state', function($scope, ResultsService, MembersService, UtilsService, $filter, $state) {

    $scope.loading = true;
    $scope.teamStats = {};
    $scope.theDedicated = [];
    $scope.speedDemons = [];
    $scope.parkrunTourists = [];
    $scope.popularParkruns = [];
    $scope.yearlyBreakdown = [];
    $scope.biggestGroupRuns = [];
    $scope.mostWins = [];

    function isParkrun(race) {
        return race.racename && race.racename.toLowerCase().includes('parkrun');
    }

    function getParkrunLocationName(racename) {
        // Normalize: strip event numbers like "#311" only
        // "College Park parkrun #311" and "College Park parkrun #312" → "College Park parkrun"
        return racename.replace(/#\d+/g, '').trim() || racename;
    }

    $scope.loadParkrunStats = async function() {
        try {
            var raceList = await ResultsService.getRaceResultsWithCacheSupport({
                "sort": '-racedate -order racename',
                "preload": false
            });

            var parkrunRaces = raceList.filter(isParkrun);

            if (parkrunRaces.length === 0) {
                $scope.loading = false;
                if (!$scope.$$phase) { $scope.$apply(); }
                return;
            }

            // Member aggregation maps
            var memberMap = {}; // memberId -> stats
            var locationSet = {};
            var yearMap = {};
            var parkrunLocationMap = {}; // location name -> { count, members set }
            var groupRunMap = {}; // raceId -> { racename, date, members[] }
            var totalResults = 0;

            var raceYearMap = {}; // year -> count of parkrun race events

            parkrunRaces.forEach(function(race) {
                var year = new Date(race.racedate).getUTCFullYear();
                yearMap[year] = (yearMap[year] || 0);
                raceYearMap[year] = (raceYearMap[year] || 0) + 1;

                var locationName = getParkrunLocationName(race.racename);
                locationSet[locationName] = true;

                if (!parkrunLocationMap[locationName]) {
                    parkrunLocationMap[locationName] = { count: 0, members: {} };
                }

                var raceMembers = [];

                if (race.results && race.results.length > 0) {
                    race.results.forEach(function(result) {
                        if (result.members) {
                            result.members.forEach(function(member) {
                                totalResults++;
                                yearMap[year]++;

                                if (!memberMap[member._id]) {
                                    memberMap[member._id] = {
                                        _id: member._id,
                                        firstname: member.firstname,
                                        lastname: member.lastname,
                                        username: member.username,
                                        sex: member.sex,
                                        count: 0,
                                        wins: 0,
                                        bestTime: null,
                                        bestTimeRace: null,
                                        locations: {},
                                        locationFlags: {}
                                    };
                                }

                                var m = memberMap[member._id];
                                m.count++;

                                // Track wins
                                if (result.ranking && (result.ranking.overallrank === 1 || result.ranking.genderrank === 1)) {
                                    m.wins++;
                                }

                                // Track location with flag info
                                if (!m.locationFlags[locationName]) {
                                    var flag;
                                    if (race.location && race.location.state && race.location.country === 'USA') {
                                        flag = { type: 'state', code: race.location.state, src: UtilsService.getStateFlag(race.location.state) };
                                    } else if (race.location && race.location.country) {
                                        flag = { type: 'country', emoji: UtilsService.getCountryFlag(race.location.country) };
                                    }
                                    m.locationFlags[locationName] = flag;
                                }
                                m.locations[locationName] = true;

                                // Track best time (lower is better)
                                if (result.time && (!m.bestTime || result.time < m.bestTime)) {
                                    m.bestTime = result.time;
                                    m.bestTimeRace = race;
                                }


                                // Track parkrun location visits
                                parkrunLocationMap[locationName].count++;
                                parkrunLocationMap[locationName].members[member._id] = true;

                                raceMembers.push(member.firstname + ' ' + member.lastname);
                            });
                        }
                    });
                }

                // Track group runs (2+ team members at same parkrun)
                if (raceMembers.length >= 2) {
                    groupRunMap[race._id] = {
                        race: race,
                        racename: race.racename,
                        date: race.racedate,
                        members: raceMembers,
                        count: raceMembers.length
                    };
                }
            });

            // Team summary stats
            var uniqueLocations = Object.keys(locationSet).length;
            var uniqueMembers = Object.keys(memberMap).length;
            $scope.teamStats = {
                totalParkruns: totalResults,
                uniqueParkrunners: uniqueMembers,
                totalMiles: (totalResults * 3.1).toFixed(1),
                uniqueLocations: uniqueLocations
            };

            // Convert member map to sorted arrays
            var members = Object.values(memberMap);

            // The Dedicated - most parkruns
            $scope.theDedicated = members.slice().sort(function(a, b) {
                return b.count - a.count;
            }).slice(0, 10);

            // Speed Demons - fastest parkrun time
            allSpeedDemons = members.filter(function(m) {
                return m.bestTime;
            }).sort(function(a, b) {
                return a.bestTime - b.bestTime;
            });
            $scope.speedDemons = allSpeedDemons.slice(0, 10);

            // Most Wins at parkruns
            $scope.mostWins = members.filter(function(m) {
                return m.wins > 0;
            }).sort(function(a, b) {
                return b.wins - a.wins;
            }).slice(0, 10);

            // Parkrun Tourists - most unique locations
            $scope.parkrunTourists = members.map(function(m) {
                var flags = [];
                Object.keys(m.locationFlags).forEach(function(loc) {
                    var flag = m.locationFlags[loc];
                    if (flag) {
                        flags.push({ ...flag, location: loc });
                    }
                });
                return { ...m, locationCount: Object.keys(m.locations).length, flags: flags };
            }).filter(function(m) {
                return m.locationCount > 1;
            }).sort(function(a, b) {
                return b.locationCount - a.locationCount;
            }).slice(0, 10);

            // Most Popular Parkruns
            $scope.popularParkruns = Object.keys(parkrunLocationMap).map(function(name) {
                return {
                    name: name,
                    count: parkrunLocationMap[name].count,
                    uniqueMembers: Object.keys(parkrunLocationMap[name].members).length
                };
            }).sort(function(a, b) {
                return b.count - a.count;
            }).slice(0, 10);

            // Yearly breakdown - count parkrun races attended, not individual results
            var years = Object.keys(raceYearMap).map(Number).sort(function(a, b) { return a - b; });
            $scope.yearlyBreakdown = years.map(function(y) {
                return { year: y, count: raceYearMap[y] };
            });

            // Biggest group runs
            $scope.biggestGroupRuns = Object.values(groupRunMap).sort(function(a, b) {
                return b.count - a.count;
            }).slice(0, 10);

            $scope.loading = false;
            if (!$scope.$$phase) { $scope.$apply(); }

        } catch (error) {
            console.error('Error loading parkrun stats:', error);
            $scope.loading = false;
            if (!$scope.$$phase) { $scope.$apply(); }
        }
    };

    // Speed Demons gender filter
    var allSpeedDemons = [];
    $scope.speedDemonGenderFilter = null;
    $scope.setSpeedDemonGenderFilter = function(gender) {
        $scope.speedDemonGenderFilter = gender;
        if (!gender) {
            $scope.speedDemons = allSpeedDemons.slice(0, 10);
        } else {
            $scope.speedDemons = allSpeedDemons.filter(function(m) {
                return m.sex === gender;
            }).slice(0, 10);
        }
    };

    // Navigation
    $scope.goToMember = function(member) {
        $state.go('/members/member/bio', { member: member.username });
    };

    $scope.showRaceModal = function(raceinfo) {
        if (raceinfo) {
            ResultsService.showRaceModal(raceinfo).then(function() {});
        }
    };

    $scope.goToResultsWithQuery = function(queryParams) {
        var cleanedParams = {};
        Object.keys(queryParams).forEach(function(key) {
            var value = queryParams[key];
            if (value !== null && value !== undefined && value !== '') {
                cleanedParams[key] = value;
            }
        });
        $state.go('/results', { search: JSON.stringify(cleanedParams) });
    };

    // Initialize
    $scope.loadParkrunStats();
}]);
