angular.module('mcrrcApp').service('StatsService', ['DexieService', 'ResultsService', 'MembersService', 'UtilsService', '$q', 'MemoryCacheService', 'SystemService', function(DexieService, ResultsService, MembersService, UtilsService, $q, MemoryCacheService, SystemService) {
    var db = DexieService;
    
    // Cache names for MemoryCacheService
    var CACHE_NAMES = {
        STATS: 'stats',
        LOADING_PROMISES: 'loadingPromises',
        PARTICIPATION: 'participation',
        ATTENDANCE: 'attendance',
        RACE_INFOS: 'raceInfos'
    };
    
    var self = this;

    function stripFunctions(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    this.getStats = async function(year) {
        var sysinfo = await SystemService.getSystemInfo('mcrrc').then(function (sysinfo) {
            return sysinfo;
        }).catch(function(error) {
            throw error;
        });
        var cachedStats = MemoryCacheService.get(CACHE_NAMES.STATS, year);
        if (cachedStats) {
            return $q.resolve(cachedStats);
        }
        
        var loadingPromises = MemoryCacheService.get(CACHE_NAMES.LOADING_PROMISES, year);
        if (loadingPromises) {
            return loadingPromises;
        }
        
        // Try IndexedDB       
        var date = new Date(sysinfo.resultUpdate);        
        var promise = db.statsCache.get(year).then(function(entry) {            
            if (entry && date.getTime()  === new Date(entry.date).getTime()  && entry.stats) {
                MemoryCacheService.set(CACHE_NAMES.STATS, year, entry.stats);
                MemoryCacheService.set(CACHE_NAMES.LOADING_PROMISES, year, null);
                return entry.stats;
            } else {
                return self.calculateStats(year).then(function(stats) {
                    MemoryCacheService.set(CACHE_NAMES.STATS, year, stats);
                    return db.statsCache.put({ year: year, date: date, stats: stripFunctions(stats) }).then(function() {
                        MemoryCacheService.set(CACHE_NAMES.LOADING_PROMISES, year, null);
                        return stats;
                    }).catch(function(err) {
                        throw err;
                    });
                });
            }
        }).catch(function(err) {
            throw err;
        });
        
        MemoryCacheService.set(CACHE_NAMES.LOADING_PROMISES, year, promise);
        return promise;
    };
    
    this.calculateStats = function(year) {
        var fromDate = new Date(Date.UTC(2013, 0, 1)).getTime();
        var now = new Date();
        var toDate = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0);
        if (year !== "All Time") {
            fromDate = new Date(Date.UTC(year, 0, 1)).getTime();
            toDate = Date.UTC(year + 1, 0, 1, 0, 0, 0, 0);
        }

        // Get all race data with results (cached) and filter on client side
        return ResultsService.getRaceResultsWithCacheSupport({
            "sort": '-racedate -order racename',
            "preload": false
        }).then(function(races) {
            
            // Filter races by date on client side since cache doesn't respect server filters
            var filteredRaces = races.filter(function(race) {
                if (year === "All Time") {
                    return true; // Include all races for "All Time"
                }
                
                // Use UTC methods to avoid timezone conversion issues
                var raceDate = new Date(race.racedate);
                var raceYear = raceDate.getUTCFullYear();
                var selectedYear = parseInt(year);
                              
                return raceYear === selectedYear;
            });
            
            // Calculate all stats
            var stats = {
                teamMemberStats: calculateTeamMemberStats(filteredRaces),
                generalStats: calculateGeneralStats(filteredRaces),
                basicStats: calculateBasicStats(filteredRaces),
                teamRaceTypeBreakdown: calculateTeamRaceTypeBreakdown(filteredRaces),
                stateStats: calculateStateStats(filteredRaces),
                countryStats: calculateCountryStats(filteredRaces)
            };
            
            // Cache the results
            MemoryCacheService.set(CACHE_NAMES.STATS, year, stats);
            MemoryCacheService.set(CACHE_NAMES.LOADING_PROMISES, year, null);
            
            return stats;
        }).catch(function(error) {
            MemoryCacheService.set(CACHE_NAMES.LOADING_PROMISES, year, null);
            throw error;
        });
    };
    
    function calculateTeamMemberStats(races) {
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
                                username: member.username,
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
                        var raceYear = new Date(race.racedate).getUTCFullYear();
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
                username: stats.username,
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
        var mostRaces = memberStatsArray
            .sort(function(a, b) { return b.races - a.races; })
            .slice(0, 10);

        var mostMiles = memberStatsArray
            .sort(function(a, b) { return b.miles - a.miles; })
            .slice(0, 10);

        var mostWins = memberStatsArray
            .filter(function(member) { return member.wins > 0; })
            .sort(function(a, b) { return b.wins - a.wins; })
            .slice(0, 10);

        var mostTraveled = memberStatsArray
            .sort(function(a, b) { return b.uniqueLocations - a.uniqueLocations; })
            .slice(0, 10);

        var mostCountries = memberStatsArray
            .sort(function(a, b) { return b.uniqueCountries - a.uniqueCountries; })
            .slice(0, 10);

        var bestAgeGrades = memberStatsArray
            .filter(function(member) { return member.bestAgeGrade > 0; })
            .sort(function(a, b) { return b.bestAgeGrade - a.bestAgeGrade; })
            .slice(0, 10);

        var mostConsistent = memberStatsArray
            .filter(function(member) { return member.yearsRacing > 1; })
            .sort(function(a, b) { return b.avgRacesPerYear - a.avgRacesPerYear; })
            .slice(0, 10);

        // Calculate best turnout races
        var raceTurnoutArray = Object.keys(raceTurnout).map(function(raceId) {
            return raceTurnout[raceId];
        });
        
        var bestTurnout = raceTurnoutArray
            .sort(function(a, b) { return b.teamMembers - a.teamMembers; })
            .slice(0, 10);

        // Overall team stats
        var totalMembers = memberStatsArray.length;
        var avgRacesPerMember = memberStatsArray.length > 0 ? 
            Math.round((memberStatsArray.reduce(function(sum, member) { return sum + member.races; }, 0) / memberStatsArray.length) * 100) / 100 : 0;
        var avgMilesPerMember = memberStatsArray.length > 0 ? 
            Math.round((memberStatsArray.reduce(function(sum, member) { return sum + member.miles; }, 0) / memberStatsArray.length) * 100) / 100 : 0;

        return {
            mostRaces: mostRaces,
            mostMiles: mostMiles,
            mostWins: mostWins,
            mostTraveled: mostTraveled,
            mostCountries: mostCountries,
            bestAgeGrades: bestAgeGrades,
            mostConsistent: mostConsistent,
            bestTurnout: bestTurnout,
            totalMembers: totalMembers,
            avgRacesPerMember: avgRacesPerMember,
            avgMilesPerMember: avgMilesPerMember
        };
    }
    
    function calculateGeneralStats(races) {
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
        
        return {
            mostPopularRaceDistance: mostPopularRaceType,
            mostPopularRaceCount: maxCount
        };
    }
    
    function calculateBasicStats(races) {
        var totalMiles = 0;
        var totalResults = 0;
        var totalWins = 0;

        races.forEach(function(race) {
            if (race.results && race.results.length > 0) {
                race.results.forEach(function(result) {
                    totalResults++;
                    
                    // Count miles (for non-multisport races)
                    if (!race.isMultisport && race.racetype && race.racetype.miles) {
                        totalMiles += race.racetype.miles;
                    }
                    
                    // Count wins
                    if (result.ranking && (result.ranking.overallrank === 1 || result.ranking.genderrank === 1)) {
                        totalWins++;
                    }
                });
            }
        });
        
        return {
            milesRaced: parseFloat(totalMiles).toFixed(2),
            resultsCount: totalResults,
            raceWon: totalWins
        };
    }
    
    function calculateTeamRaceTypeBreakdown(races) {
        const raceTypes = {};
        let total = 0;
        races.forEach(function(race) {
            const raceType = race.racetype || {};
            let category = 'other';
            let name = 'Other';
            // If any result has multiple members, categorize as Other
            let hasMultiMemberResult = false;
            if (race.results && race.results.length > 0) {
                for (let i = 0; i < race.results.length; i++) {
                    if (race.results[i].members && race.results[i].members.length > 1) {
                        hasMultiMemberResult = true;
                        break;
                    }
                }
            }
            if (hasMultiMemberResult) {
                category = 'other';
                name = 'Other';
            } else 
            if (raceType.isVariable) {
                category = 'other';
                name = 'Other';
            } else if (raceType.surface === 'road' || raceType.surface === 'track' || raceType.surface === 'trail' || raceType.surface === 'ultra') {
                if (raceType.isVariable) {
                    category = 'other';
                    name = 'Other';
                } else {
                    category = raceType.name;
                    name = raceType.name;
                }
            } else {
                category = 'other';
                name = 'Other';
            }
            const key = category + '|' + name;
            raceTypes[key] = raceTypes[key] || { category: category, name: name, count: 0 };
            raceTypes[key].count++;
            total++;
        });
        const colors = [
            '#007bff', // blue
            '#28a745', // green
            '#ffc107', // yellow
            '#fd7e14', // orange
            '#e83e8c', // pink
            '#dc3545', // red
            '#6f42c1', // purple
            '#6c757d', // gray
            '#20c997', // teal
            '#17a2b8'  // cyan
        ];
        return Object.values(raceTypes).map(function(type, idx) {
            return {
                category: type.category,
                name: type.name,
                count: type.count,
                percentage: total > 0 ? Math.round((type.count / total) * 100) : 0,
                color: colors[idx % colors.length]
            };
        }).sort(function(a, b) { return b.count - a.count; }).slice(0,10);
    }
    
    function calculateStateStats(races) {
        const stateStats = {};
        races.forEach(function(race) {
            if (race.location && race.location.state && race.location.country === 'USA') {
                const stateCode = race.location.state;
                if (!stateStats[stateCode]) {
                    stateStats[stateCode] = {
                        code: stateCode,
                        name: UtilsService.getStateNameFromCode(stateCode),
                        flag: UtilsService.getStateFlag(stateCode),
                        count: 0
                    };
                }
                stateStats[stateCode].count++;
            }
        });
        return Object.values(stateStats).sort(function(a, b) { return b.count - a.count; });
    }
    
    function calculateCountryStats(races) {
        const countryStats = {};
        races.forEach(function(race) {
            if (race.location && race.location.country) {
                const countryCode = race.location.country;
                if (!countryStats[countryCode]) {
                    countryStats[countryCode] = {
                        code: countryCode,
                        name: UtilsService.getCountryNameFromCode(countryCode),
                        flag: UtilsService.getCountryFlag(countryCode),
                        count: 0
                    };
                }
                countryStats[countryCode].count++;
            }
        });
        return Object.values(countryStats).sort(function(a, b) { return b.count - a.count; });
    }
        
    this.getParticipationStats = function(startDate, endDate) {
        var key = new Date(startDate).getTime() + '-' + new Date(endDate).getTime();
        var cachedData = MemoryCacheService.get(CACHE_NAMES.PARTICIPATION, key);
        if (cachedData) {
            return $q.resolve(cachedData);
        }
        return MembersService.getParticipation({
            "startdate": new Date(startDate).getTime(),
            "enddate": new Date(endDate).getTime()
        }).then(function(data) {
            MemoryCacheService.set(CACHE_NAMES.PARTICIPATION, key, data);
            return data;
        });
    };
    
    this.getAttendanceStats = function() {
        var cachedData = MemoryCacheService.get(CACHE_NAMES.ATTENDANCE, 'data');
        if (cachedData) {
            return $q.resolve(cachedData);
        }
        return $q.all([
            ResultsService.getRaces({ sort: '-racedate' }),
            MembersService.getMembers({
                sort: 'firstname',
                select: '-bio -personalBests',
            })
        ]).then(function(results) {
            var data = {
                races: results[0],
                members: results[1]
            };
            MemoryCacheService.set(CACHE_NAMES.ATTENDANCE, 'data', data);
            return data;
        });
    };

    this.getRacesInfos = function(params) {
        var key = JSON.stringify(params);
        
        var cachedData = MemoryCacheService.get(CACHE_NAMES.RACE_INFOS, key);
        if (cachedData) {
            return $q.resolve(cachedData);
        }
        
        return ResultsService.getRacesInfos(params).then(function(data) {
            MemoryCacheService.set(CACHE_NAMES.RACE_INFOS, key, data);
            return data;
        }).catch(function(error) {
            throw error; // Re-throw to ensure the error is propagated
        });
    };
    
}]); 