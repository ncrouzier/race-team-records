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

    // Clear stale stats cache that was corrupted by the old stripFunctions
    // (shared object references were incorrectly treated as circular refs)
    try { db.statsCache.clear(); } catch(e) { /* ignore */ }

    function stripFunctions(obj) {
        // Deep-clone obj to a plain JSON-safe value.
        // We must skip circular references but NOT shared references
        // (e.g. the same racetype object used by many races).
        function deepClone(value, ancestors) {
            if (value === null || value === undefined) return value;
            if (typeof value === 'function') return undefined;
            if (typeof value !== 'object') return value;
            // Arrays and Dates
            if (value instanceof Date) return value.toISOString();
            if (ancestors.has(value)) return undefined; // true circular ref
            ancestors.add(value);
            var result;
            if (Array.isArray(value)) {
                result = [];
                for (var i = 0; i < value.length; i++) {
                    result.push(deepClone(value[i], ancestors));
                }
            } else {
                result = {};
                var keys = Object.keys(value);
                for (var j = 0; j < keys.length; j++) {
                    var k = keys[j];
                    var v = deepClone(value[k], ancestors);
                    if (v !== undefined) result[k] = v;
                }
            }
            ancestors.delete(value); // allow shared refs, only block true cycles
            return result;
        }
        return deepClone(obj, new Set());
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
        var date = new Date(sysinfo.overallUpdate);        
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

        // Races, plus the roster: the milestone counters express each barrier as
        // a share of the current membership, which the race data alone cannot say.
        return $q.all([
            ResultsService.getRaceResultsWithCacheSupport({
                "sort": '-racedate -order racename',
                "preload": false
            }),
            MembersService.getMembersWithCacheSupport({
                sort: 'firstname',
                select: 'sex memberStatus'
            })
        ]).then(function(loaded) {
            var races = loaded[0];
            var members = loaded[1];
            
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
                raceCalendar: calculateRaceCalendar(filteredRaces, year),
                milestones: calculateMilestones(filteredRaces, members),
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
                                states: new Set(),
                                otherCountries: new Set(),
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

                        // Count miles - if result has legs, only count running legs
                        var resultMiles = 0;
                        if (result.legs && result.legs.length > 0) {
                            result.legs.forEach(function(leg) {
                                if (leg.legType === 'run' && leg.miles) {
                                    resultMiles += leg.miles;
                                }
                            });
                        } else if (race.racetype && race.racetype.isVariable && result.miles) {
                            resultMiles = result.miles;
                        } else if (race.racetype && race.racetype.miles) {
                            resultMiles = race.racetype.miles;
                        }
                        if (resultMiles > 0) {
                            memberStats[memberId].miles += resultMiles;
                            memberMiles[memberId] = (memberMiles[memberId] || 0) + resultMiles;
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

                        // Places raced, counted as US states plus non-US countries:
                        // one composite key per country+state would count two
                        // Canadian provinces as two places, which is not what
                        // "locations" means here. The two sets are disjoint, so
                        // the headline total is exactly their sum.
                        if (race.location.country === 'USA') {
                            if (race.location.state) {
                                memberStats[memberId].states.add(race.location.state);
                            }
                        } else if (race.location.country) {
                            memberStats[memberId].otherCountries.add(race.location.country);
                        }
                        memberStats[memberId].countries.add(race.location.country);
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
                uniqueLocations: stats.states.size + stats.otherCountries.size,
                uniqueStates: stats.states.size,
                uniqueOtherCountries: stats.otherCountries.size,
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
                    
                    // Count miles - if result has legs, only count running legs
                    if (result.legs && result.legs.length > 0) {
                        result.legs.forEach(function(leg) {
                            if (leg.legType === 'run' && leg.miles) {
                                totalMiles += leg.miles;
                            }
                        });
                    } else if (race.racetype && race.racetype.isVariable && result.miles) {
                        totalMiles += result.miles;
                    } else if (race.racetype && race.racetype.miles) {
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

    // ---- Club milestone counters -------------------------------------
    // Round-number time barriers per distance: how often the club has broken
    // each one, and how many different runners have.
    //
    // The ladders are per gender rather than shared. A shared ladder would
    // leave the women's column empty at the top three tiers of every distance,
    // which says nothing about the club; separate ladders are how standards
    // tables are normally written. Each was picked so the hardest tier is a
    // genuine outlier and the easiest is within reach of a good club runner.
    //
    // Times are centiseconds, matching result.time.
    function ms(min, sec) { return ((min * 60) + (sec || 0)) * 100; }

    var MILESTONE_DEFS = [
        {
            name: '1 mile',
            // The mile is raced on the track as often as the road here, and both
            // are flat and legitimate; only trail is excluded.
            surfaces: ['road', 'track'],
            Male: [ms(4, 30), ms(4, 45), ms(5), ms(5, 30), ms(6)],
            Female: [ms(5, 15),ms(5, 30), ms(5, 45), ms(6, 15), ms(7)]
        },
        {
            name: '5k', surfaces: ['road'],
            Male: [ms(15), ms(16), ms(17), ms(18), ms(19)],
            Female: [ms(17,30), ms(18), ms(19), ms(20), ms(21)]
        },
        {
            name: '10k', surfaces: ['road'],
            Male: [ms(31),ms(33),ms(34), ms(36), ms(38)],
            Female: [ms(37), ms(38), ms(40), ms(42), ms(44)]
        },
        {
            name: '10 miles', surfaces: ['road'],
            Male: [ms(51), ms(55), ms(57), ms(60), ms(65)],
            Female: [ms(60),ms(62), ms(65), ms(70), ms(75),]
        },
        {
            name: 'Half Marathon', label: 'Half marathon', surfaces: ['road'],
            Male: [ms(70),ms(75), ms(80), ms(85), ms(90)],
            Female: [ms(80),ms(85), ms(90), ms(95), ms(100)]
        },
        {
            name: 'Marathon', surfaces: ['road'],
            Male: [ms(150), ms(160), ms(170), ms(180), ms(195)],
            Female: [ms(170),ms(180), ms(190), ms(200), ms(220)]
        }
    ];

    // Age-grade barriers, shared by every distance and both genders — age
    // grading already normalises for both, which is the point of it. 72% is not
    // a class boundary like the others; it is the club's kit standard.
    var AGEGRADE_TIERS = [90, 85, 80, 75, 72];

    function milestoneLabel(centiseconds) {
        var total = centiseconds / 100;
        var hours = Math.floor(total / 3600);
        var minutes = Math.floor((total % 3600) / 60);
        var seconds = Math.floor(total % 60);
        if (hours > 0) {
            return hours + ':' + (minutes < 10 ? '0' : '') + minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
        }
        return minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
    }

    function calculateMilestones(races, members) {
        // Denominator for the "share of the club" figure: everyone who has ever
        // been on the team, past members included. The counts above already
        // include their performances, so the denominator has to match them.
        var memberIds = { Male: {}, Female: {}, All: {} };
        var memberTotals = { Male: 0, Female: 0, All: 0 };
        (members || []).forEach(function (member) {
            if (!memberIds[member.sex]) return;
            memberIds[member.sex][member._id] = true;
            memberTotals[member.sex]++;
            memberIds.All[member._id] = true;
            memberTotals.All++;
        });

        // One pass over every result, bucketed by distance and gender, rather
        // than a filter per distance per gender per tier.
        var pools = {};
        MILESTONE_DEFS.forEach(function (def) {
            pools[def.name] = { Male: [], Female: [] };
        });

        races.forEach(function (race) {
            if (!race.results || !race.racetype) return;
            var def = null;
            MILESTONE_DEFS.forEach(function (d) {
                if (d.name === race.racetype.name && d.surfaces.indexOf(race.racetype.surface) !== -1) def = d;
            });
            if (!def) return;

            race.results.forEach(function (result) {
                // One runner only: a relay leg or a team entry is not an
                // individual performance at this distance.
                if (!result.time || result.members.length !== 1) return;
                if (result.isRecordEligible === false) return;
                var member = result.members[0];
                var pool = pools[def.name][member.sex];
                if (pool) {
                    pool.push({
                        time: result.time,
                        id: member._id,
                        agegrade: parseFloat(result.agegrade) || 0
                    });
                }
            });
        });

        var out = {};
        ['Male', 'Female'].forEach(function (sex) {
            out[sex] = MILESTONE_DEFS.map(function (def) {
                var pool = pools[def.name][sex];
                // Hardest tier each runner has cleared, so a logged-in reader
                // can be shown where they stand without the cached stats having
                // to be computed per user.
                var bestTime = {};
                pool.forEach(function (entry) {
                    if (bestTime[entry.id] === undefined || entry.time < bestTime[entry.id]) {
                        bestTime[entry.id] = entry.time;
                    }
                });
                var bestTierByMember = {};
                Object.keys(bestTime).forEach(function (id) {
                    // Tiers run hardest first, so the first one cleared is the best.
                    for (var i = 0; i < def[sex].length; i++) {
                        if (bestTime[id] < def[sex][i]) {
                            bestTierByMember[id] = i;
                            break;
                        }
                    }
                });
                return {
                    bestTierByMember: bestTierByMember,
                    distance: def.label || def.name,
                    kind: 'time',
                    // Carried through so a click can rebuild exactly this
                    // filter on the results page.
                    racetype: def.name,
                    surfaces: def.surfaces,
                    sex: sex,
                    pool: pool.length,
                    tiers: def[sex].map(function (threshold) {
                        var runners = {};
                        var memberRunners = {};
                        var count = 0;
                        pool.forEach(function (entry) {
                            if (entry.time < threshold) {
                                count++;
                                runners[entry.id] = true;
                                // Guards against an id with no matching member
                                // record, so the share can never exceed 100%.
                                if (memberIds[sex][entry.id]) memberRunners[entry.id] = true;
                            }
                        });
                        var achievers = Object.keys(memberRunners).length;
                        var memberTotal = memberTotals[sex];
                        return {
                            label: 'sub-' + milestoneLabel(threshold),
                            maxTime: threshold,
                            count: count,
                            runners: Object.keys(runners).length,
                            achievers: achievers,
                            memberTotal: memberTotal,
                            percent: memberTotal ? Math.round((achievers / memberTotal) * 100) : 0
                        };
                    })
                };
            });
        });

        // Age grade needs no gender split, so both pools feed one set of rows.
        out.AgeGrade = MILESTONE_DEFS.map(function (def) {
            var graded = pools[def.name].Male.concat(pools[def.name].Female)
                .filter(function (entry) { return entry.agegrade > 0; });
            var bestGrade = {};
            graded.forEach(function (entry) {
                if (bestGrade[entry.id] === undefined || entry.agegrade > bestGrade[entry.id]) {
                    bestGrade[entry.id] = entry.agegrade;
                }
            });
            var agBestTierByMember = {};
            Object.keys(bestGrade).forEach(function (id) {
                for (var i = 0; i < AGEGRADE_TIERS.length; i++) {
                    if (bestGrade[id] >= AGEGRADE_TIERS[i]) {
                        agBestTierByMember[id] = i;
                        break;
                    }
                }
            });
            return {
                bestTierByMember: agBestTierByMember,
                distance: def.label || def.name,
                kind: 'agegrade',
                racetype: def.name,
                surfaces: def.surfaces,
                sex: null,
                // Only graded results, since an ungraded one could never
                // qualify — this also makes a thin age-grading table visible
                // rather than silently dragging the counts down.
                pool: graded.length,
                tiers: AGEGRADE_TIERS.map(function (threshold) {
                    var runners = {};
                    var memberRunners = {};
                    var count = 0;
                    graded.forEach(function (entry) {
                        if (entry.agegrade >= threshold) {
                            count++;
                            runners[entry.id] = true;
                            if (memberIds.All[entry.id]) memberRunners[entry.id] = true;
                        }
                    });
                    var achievers = Object.keys(memberRunners).length;
                    return {
                        label: threshold + '%+',
                        minAgeGrade: threshold,
                        count: count,
                        runners: Object.keys(runners).length,
                        achievers: achievers,
                        memberTotal: memberTotals.All,
                        percent: memberTotals.All ? Math.round((achievers / memberTotals.All) * 100) : 0
                    };
                })
            };
        });

        return out;
    }

    var CALENDAR_MONTHS = [
        { name: 'January', short: 'Jan', length: 31 },
        { name: 'February', short: 'Feb', length: 29 },
        { name: 'March', short: 'Mar', length: 31 },
        { name: 'April', short: 'Apr', length: 30 },
        { name: 'May', short: 'May', length: 31 },
        { name: 'June', short: 'Jun', length: 30 },
        { name: 'July', short: 'Jul', length: 31 },
        { name: 'August', short: 'Aug', length: 31 },
        { name: 'September', short: 'Sep', length: 30 },
        { name: 'October', short: 'Oct', length: 31 },
        { name: 'November', short: 'Nov', length: 30 },
        { name: 'December', short: 'Dec', length: 31 }
    ];

    // The racing year as a 12 x 31 grid: for each calendar day, how much racing
    // happened on it. The blanks are the point — across the club's whole history
    // only a handful of days have never been raced, so the grid doubles as a list
    // of days left to fill.
    //
    // Takes neutral {date, count, name} entries rather than races so the team
    // page (races, counted by their results) and a member page (that member's
    // own results) can share one implementation.
    var CALENDAR_LEVELS = 8;

    this.buildRaceCalendar = function (entries, year) {
        var isAllTime = (year === 'All Time');
        var numericYear = parseInt(year, 10);
        // February 29 only belongs on the grid when the chosen year has one.
        var includeLeapDay = isAllTime ||
            (numericYear % 4 === 0 && (numericYear % 100 !== 0 || numericYear % 400 === 0));

        var buckets = {};
        entries.forEach(function (entry) {
            if (!entry.count) return;
            var date = new Date(entry.date);
            var key = date.getUTCMonth() + '-' + date.getUTCDate();
            var bucket = buckets[key];
            if (!bucket) {
                bucket = buckets[key] = { count: 0, years: {}, races: {} };
            }
            bucket.count += entry.count;
            bucket.years[date.getUTCFullYear()] = true;
            if (entry.name) bucket.races[entry.name] = true;
        });

        // Shade by where a day ranks among the days actually raced, not by its
        // share of the busiest one: New Year's Day alone carries 162 results, and
        // a linear ramp off that flattens every ordinary day into the palest
        // band. Percentile bands keep all eight shades in play.
        var counts = Object.keys(buckets).map(function (k) { return buckets[k].count; })
            .sort(function (a, b) { return a - b; });
        var thresholds = [];
        for (var t = 1; t < CALENDAR_LEVELS; t++) {
            thresholds.push(counts.length ? counts[Math.floor(counts.length * t / CALENDAR_LEVELS)] : 0);
        }
        function levelFor(count) {
            for (var i = 0; i < thresholds.length; i++) {
                if (count <= thresholds[i]) return i + 1;
            }
            return CALENDAR_LEVELS;
        }

        var busiestCount = counts.length ? counts[counts.length - 1] : 0;
        // How many days share the top spot. Known up front from the sorted
        // counts, so each starred cell's tooltip can say it is a tie.
        var busiestTies = counts.filter(function (c) { return c === busiestCount; }).length;
        // When every raced day carries the same number of races — a member who
        // has never raced the same date twice — no day is the busiest, and
        // starring all of them would say nothing. counts.length is the number
        // of days raced, so an all-round tie is exactly busiestTies === it.
        var hasBusiest = busiestTies > 0 && busiestTies < counts.length;
        var months = [];
        var daysRaced = 0;
        var totalDays = 0;
        var missingDays = [];
        var busiestDays = [];

        CALENDAR_MONTHS.forEach(function (month, monthIndex) {
            var length = (monthIndex === 1 && !includeLeapDay) ? 28 : month.length;
            var days = [];
            for (var day = 1; day <= length; day++) {
                var bucket = buckets[monthIndex + '-' + day];
                var count = bucket ? bucket.count : 0;
                var label = month.short + ' ' + day;
                var entry = {
                    month: monthIndex,
                    day: day,
                    label: label,
                    count: count,
                    level: 0,
                    isBusiest: false
                };

                totalDays++;
                if (count) {
                    daysRaced++;
                    entry.level = levelFor(count);
                    // Every day at the maximum is starred, not just the first —
                    // a tie means they really are all the busiest day.
                    if (hasBusiest && count === busiestCount) {
                        entry.isBusiest = true;
                        busiestDays.push(entry.label);
                    }
                    var yearCount = Object.keys(bucket.years).length;
                    var raceNames = Object.keys(bucket.races);
                    entry.title = label + ' — ' + count + (count === 1 ? ' result' : ' results') +
                        ' across ' + yearCount + (yearCount === 1 ? ' year' : ' years') +
                        (entry.isBusiest
                            ? '  ★ busiest day of the year' + (busiestTies > 1
                                ? ' (tied with ' + (busiestTies - 1) + (busiestTies === 2 ? ' other day)' : ' other days)')
                                : '')
                            : '') + '\n' +
                        raceNames.slice(0, 4).join(', ') +
                        (raceNames.length > 4 ? ' +' + (raceNames.length - 4) + ' more' : '');
                } else {
                    missingDays.push({ label: label, month: monthIndex, day: day });
                    entry.title = label + ' — never raced';
                }

                days.push(entry);
            }
            // Short months pad out to 31 so every column is the same calendar
            // day and the grid can be read down as well as across.
            for (var pad = length; pad < 31; pad++) {
                days.push(null);
            }
            months.push({ name: month.name, short: month.short, days: days });
        });

        return {
            months: months,
            dayNumbers: Array.apply(null, { length: 31 }).map(function (v, i) { return i + 1; }),
            levels: Array.apply(null, { length: CALENDAR_LEVELS }).map(function (v, i) { return i + 1; }),
            daysRaced: daysRaced,
            totalDays: totalDays,
            missingDays: missingDays,
            // Only worth listing when it is a short, actionable set — for a
            // single year most of the calendar is blank and the list is noise.
            showMissingList: missingDays.length > 0 && missingDays.length <= 15,
            // The amber "gap" outline only earns its prominence when the gaps
            // are few. On a member's grid, or a single year, most of the
            // calendar is empty and flagging all of it reads as an error state
            // rather than as a handful of days left to collect.
            highlightMissing: missingDays.length <= 15,
            hasBusiest: hasBusiest,
            busiestCount: busiestCount,
            busiestDays: busiestDays,
            busiestTies: busiestTies,
            // Named individually while that stays readable; past a handful the
            // legend just says how many days share the top spot.
            busiestLabelText: busiestDays.length <= 4
                ? busiestDays.join(', ')
                : busiestDays.length + ' days'
        };
    };

    function calculateRaceCalendar(races, year) {
        return self.buildRaceCalendar(races.map(function (race) {
            return {
                date: race.racedate,
                count: (race.results && race.results.length) || 0,
                name: race.racename
            };
        }), year);
    }

    function calculateTeamRaceTypeBreakdown(races) {
        const raceTypes = {};
        let total = 0;
        races.forEach(function(race) {
            const raceType = race.racetype || {};
            let category = 'other';
            let name = 'Other';
            // If any result has multiple members, categorize as Other
            // let hasMultiMemberResult = false;
            // if (race.results && race.results.length > 0) {
            //     for (let i = 0; i < race.results.length; i++) {
            //         if (race.results[i].members && race.results[i].members.length > 1) {
            //             hasMultiMemberResult = true;
            //             break;
            //         }
            //     }
            // }
            // if (hasMultiMemberResult) {
            //     category = 'other';
            //     name = 'Other';
            // } else 
            if (raceType.isVariable) {
                category = 'other';
                name = 'Other';
            } else if (raceType.surface === 'road' || raceType.surface === 'track' || raceType.surface === 'trail' || raceType.surface === 'ultra') {
                if (raceType.isVariable) {
                    category = 'other';
                    name = 'Other';
                } else {
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
                // Keep personalBests.result.agegrade (needed for the age-grade
                // histogram) but drop the heavy embedded race/members/etc.
                // subdocuments nested under each personal best's result.
                select: '-bio -personalBests.result.race -personalBests.result.members -personalBests.result.legs -personalBests.result.customOptions -personalBests.result.achievements -personalBests.result.comments -personalBests.result.resultlink -personalBests.result.ranking',
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