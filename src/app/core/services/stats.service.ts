import { Injectable } from '@angular/core';
import { MemoryCacheService } from './memory-cache.service';
import { DexieService } from './dexie.service';
import { SystemInfoService } from './system-info.service';
import { UtilsService } from './utils.service';
import { ResultsService } from './results.service';
import { MembersService } from './members.service';

const CACHE_NAMES = {
  STATS: 'stats',
  LOADING_PROMISES: 'loadingPromises',
  PARTICIPATION: 'participation',
  ATTENDANCE: 'attendance',
  RACE_INFOS: 'raceInfos'
};

function stripFunctions(obj: any): any {
  const seen = new WeakSet();
  return JSON.parse(JSON.stringify(obj, (_key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return undefined;
      seen.add(value);
    }
    return value;
  }));
}

@Injectable({ providedIn: 'root' })
export class StatsService {
  private db: any;

  constructor(
    private memoryCacheService: MemoryCacheService,
    private dexieService: DexieService,
    private systemInfoService: SystemInfoService,
    private utilsService: UtilsService,
    private resultsService: ResultsService,
    private membersService: MembersService
  ) {
    this.db = this.dexieService.getDb();
  }

  async getStats(year: string | number): Promise<any> {
    const sysinfo = await this.systemInfoService.getSystemInfo('mcrrc');

    const cachedStats = this.memoryCacheService.get(CACHE_NAMES.STATS, String(year));
    if (cachedStats) {
      return cachedStats;
    }

    const loadingPromise = this.memoryCacheService.get(CACHE_NAMES.LOADING_PROMISES, String(year));
    if (loadingPromise) {
      return loadingPromise;
    }

    const date = new Date(sysinfo!.overallUpdate!);
    const promise = this.db.statsCache.get(year).then((entry: any) => {
      if (entry && date.getTime() === new Date(entry.date).getTime() && entry.stats) {
        this.memoryCacheService.set(CACHE_NAMES.STATS, String(year), entry.stats);
        this.memoryCacheService.set(CACHE_NAMES.LOADING_PROMISES, String(year), null);
        return entry.stats;
      } else {
        return this.calculateStats(year).then((stats: any) => {
          this.memoryCacheService.set(CACHE_NAMES.STATS, String(year), stats);
          return this.db.statsCache.put({ year, date, stats: stripFunctions(stats) }).then(() => {
            this.memoryCacheService.set(CACHE_NAMES.LOADING_PROMISES, String(year), null);
            return stats;
          });
        });
      }
    });

    this.memoryCacheService.set(CACHE_NAMES.LOADING_PROMISES, String(year), promise);
    return promise;
  }

  calculateStats(year: string | number): Promise<any> {
    let fromDate = new Date(Date.UTC(2013, 0, 1)).getTime();
    const now = new Date();
    let toDate = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0);
    if (year !== 'All Time') {
      const y = typeof year === 'string' ? parseInt(year, 10) : year;
      fromDate = new Date(Date.UTC(y, 0, 1)).getTime();
      toDate = Date.UTC(y + 1, 0, 1, 0, 0, 0, 0);
    }

    return this.resultsService.getRaceResultsWithCacheSupport({
      sort: '-racedate -order racename',
      preload: false
    }).then((races: any[]) => {
      const filteredRaces = races.filter((race: any) => {
        if (year === 'All Time') return true;
        const raceDate = new Date(race.racedate);
        const raceYear = raceDate.getUTCFullYear();
        const selectedYear = typeof year === 'string' ? parseInt(year, 10) : year;
        return raceYear === selectedYear;
      });

      const stats = {
        teamMemberStats: this.calculateTeamMemberStats(filteredRaces),
        generalStats: this.calculateGeneralStats(filteredRaces),
        basicStats: this.calculateBasicStats(filteredRaces),
        teamRaceTypeBreakdown: this.calculateTeamRaceTypeBreakdown(filteredRaces),
        stateStats: this.calculateStateStats(filteredRaces),
        countryStats: this.calculateCountryStats(filteredRaces)
      };

      this.memoryCacheService.set(CACHE_NAMES.STATS, String(year), stats);
      this.memoryCacheService.set(CACHE_NAMES.LOADING_PROMISES, String(year), null);
      return stats;
    }).catch((error: any) => {
      this.memoryCacheService.set(CACHE_NAMES.LOADING_PROMISES, String(year), null);
      throw error;
    });
  }

  private calculateTeamMemberStats(races: any[]): any {
    const memberStats: Record<string, any> = {};
    const raceTurnout: Record<string, any> = {};

    races.forEach((race: any) => {
      if (race.results && race.results.length > 0) {
        const uniqueMembers = new Set<string>();
        race.results.forEach((result: any) => {
          (result.members || []).forEach((member: any) => {
            if (member && member._id) uniqueMembers.add(member._id);
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

        race.results.forEach((result: any) => {
          (result.members || []).forEach((member: any) => {
            if (!member || !member._id || !member.username) return;
            const memberId = member._id;

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
                years: new Set<number>(),
                locations: new Set<string>(),
                states: new Set<string>(),
                countries: new Set<string>()
              };
            }

            memberStats[memberId].races++;

            if (race.racename && race.racename.toLowerCase().includes('parkrun')) {
              memberStats[memberId].parkrunRaces = (memberStats[memberId].parkrunRaces || 0) + 1;
            }

            let resultMiles = 0;
            if (result.legs && result.legs.length > 0) {
              result.legs.forEach((leg: any) => {
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
            }

            if (result.ranking && (result.ranking.overallrank === 1 || result.ranking.genderrank === 1)) {
              memberStats[memberId].wins++;
            }

            if (result.agegrade) {
              memberStats[memberId].totalAgeGrade += result.agegrade;
              memberStats[memberId].ageGradeCount++;
              if (result.agegrade > memberStats[memberId].bestAgeGrade) {
                memberStats[memberId].bestAgeGrade = result.agegrade;
                memberStats[memberId].bestAgeGradeRace = race;
              }
            }

            const raceYear = new Date(race.racedate).getUTCFullYear();
            memberStats[memberId].years.add(raceYear);

            const locationKey = race.location.country + (race.location.state ? ' - ' + race.location.state : '');
            memberStats[memberId].locations.add(locationKey);
            memberStats[memberId].states.add(race.location.state || '');
            memberStats[memberId].countries.add(race.location.country);
          });
        });
      }
    });

    const memberStatsArray = Object.keys(memberStats).map((memberId) => {
      const stats = memberStats[memberId];
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

    const mostRaces = [...memberStatsArray]
      .sort((a, b) => b.races - a.races)
      .slice(0, 10);

    const mostMiles = [...memberStatsArray]
      .sort((a, b) => b.miles - a.miles)
      .slice(0, 10);

    const mostWins = [...memberStatsArray]
      .filter(m => m.wins > 0)
      .sort((a, b) => b.wins - a.wins)
      .slice(0, 10);

    const mostTraveled = [...memberStatsArray]
      .sort((a, b) => b.uniqueLocations - a.uniqueLocations)
      .slice(0, 10);

    const mostCountries = [...memberStatsArray]
      .sort((a, b) => b.uniqueCountries - a.uniqueCountries)
      .slice(0, 10);

    const bestAgeGrades = [...memberStatsArray]
      .filter(m => m.bestAgeGrade > 0)
      .sort((a, b) => b.bestAgeGrade - a.bestAgeGrade)
      .slice(0, 10);

    const mostConsistent = [...memberStatsArray]
      .filter(m => m.yearsRacing > 1)
      .sort((a, b) => b.avgRacesPerYear - a.avgRacesPerYear)
      .slice(0, 10);

    const bestTurnout = Object.values(raceTurnout)
      .sort((a: any, b: any) => b.teamMembers - a.teamMembers)
      .slice(0, 10);

    const totalMembers = memberStatsArray.length;
    const avgRacesPerMember = memberStatsArray.length > 0
      ? Math.round((memberStatsArray.reduce((sum, m) => sum + m.races, 0) / memberStatsArray.length) * 100) / 100
      : 0;
    const avgMilesPerMember = memberStatsArray.length > 0
      ? Math.round((memberStatsArray.reduce((sum, m) => sum + m.miles, 0) / memberStatsArray.length) * 100) / 100
      : 0;

    return {
      mostRaces,
      mostMiles,
      mostWins,
      mostTraveled,
      mostCountries,
      bestAgeGrades,
      mostConsistent,
      bestTurnout,
      totalMembers,
      avgRacesPerMember,
      avgMilesPerMember
    };
  }

  private calculateGeneralStats(races: any[]): any {
    const raceTypeCounts: Record<string, number> = {};

    races.forEach((race: any) => {
      if (race.racetype && race.racetype.name) {
        const raceTypeName = race.racetype.name;
        raceTypeCounts[raceTypeName] = (raceTypeCounts[raceTypeName] || 0) + 1;
      }
    });

    let mostPopularRaceType = '';
    let maxCount = 0;
    Object.keys(raceTypeCounts).forEach((raceType) => {
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

  private calculateBasicStats(races: any[]): any {
    let totalMiles = 0;
    let totalResults = 0;
    let totalWins = 0;

    races.forEach((race: any) => {
      if (race.results && race.results.length > 0) {
        race.results.forEach((result: any) => {
          totalResults++;

          if (result.legs && result.legs.length > 0) {
            result.legs.forEach((leg: any) => {
              if (leg.legType === 'run' && leg.miles) {
                totalMiles += leg.miles;
              }
            });
          } else if (race.racetype && race.racetype.isVariable && result.miles) {
            totalMiles += result.miles;
          } else if (race.racetype && race.racetype.miles) {
            totalMiles += race.racetype.miles;
          }

          if (result.ranking && (result.ranking.overallrank === 1 || result.ranking.genderrank === 1)) {
            totalWins++;
          }
        });
      }
    });

    return {
      milesRaced: parseFloat(String(totalMiles)).toFixed(2),
      resultsCount: totalResults,
      raceWon: totalWins
    };
  }

  private calculateTeamRaceTypeBreakdown(races: any[]): any[] {
    const raceTypes: Record<string, { category: string; name: string; count: number }> = {};
    let total = 0;

    races.forEach((race: any) => {
      const raceType = race.racetype || {};
      let category = 'other';
      let name = 'Other';

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
            category = raceType.name;
            name = raceType.name;
          }
        }
      } else {
        category = 'other';
        name = 'Other';
      }

      const key = category + '|' + name;
      if (!raceTypes[key]) {
        raceTypes[key] = { category, name, count: 0 };
      }
      raceTypes[key].count++;
      total++;
    });

    const colors = [
      '#007bff', '#28a745', '#ffc107', '#fd7e14', '#e83e8c',
      '#dc3545', '#6f42c1', '#6c757d', '#20c997', '#17a2b8'
    ];

    return Object.values(raceTypes).map((type, idx) => ({
      category: type.category,
      name: type.name,
      count: type.count,
      percentage: total > 0 ? Math.round((type.count / total) * 100) : 0,
      color: colors[idx % colors.length]
    })).sort((a, b) => b.count - a.count).slice(0, 10);
  }

  private calculateStateStats(races: any[]): any[] {
    const stateStats: Record<string, any> = {};
    races.forEach((race: any) => {
      if (race.location && race.location.state && race.location.country === 'USA') {
        const stateCode = race.location.state;
        if (!stateStats[stateCode]) {
          stateStats[stateCode] = {
            code: stateCode,
            name: this.utilsService.getStateNameFromCode(stateCode),
            flag: this.utilsService.getStateFlag(stateCode),
            count: 0
          };
        }
        stateStats[stateCode].count++;
      }
    });
    return Object.values(stateStats).sort((a: any, b: any) => b.count - a.count);
  }

  private calculateCountryStats(races: any[]): any[] {
    const countryStats: Record<string, any> = {};
    races.forEach((race: any) => {
      if (race.location && race.location.country) {
        const countryCode = race.location.country;
        if (!countryStats[countryCode]) {
          countryStats[countryCode] = {
            code: countryCode,
            name: this.utilsService.getCountryNameFromCode(countryCode),
            flag: this.utilsService.getCountryFlag(countryCode),
            count: 0
          };
        }
        countryStats[countryCode].count++;
      }
    });
    return Object.values(countryStats).sort((a: any, b: any) => b.count - a.count);
  }

  getParticipationStats(startDate: any, endDate: any): Promise<any> {
    const key = new Date(startDate).getTime() + '-' + new Date(endDate).getTime();
    const cachedData = this.memoryCacheService.get(CACHE_NAMES.PARTICIPATION, key);
    if (cachedData) {
      return Promise.resolve(cachedData);
    }
    return this.membersService.getParticipation({
      startdate: new Date(startDate).getTime(),
      enddate: new Date(endDate).getTime()
    }).then((data: any) => {
      this.memoryCacheService.set(CACHE_NAMES.PARTICIPATION, key, data);
      return data;
    });
  }

  getAttendanceStats(): Promise<any> {
    const cachedData = this.memoryCacheService.get(CACHE_NAMES.ATTENDANCE, 'data');
    if (cachedData) {
      return Promise.resolve(cachedData);
    }
    return Promise.all([
      this.resultsService.getRaces({ sort: '-racedate' }),
      this.membersService.getMembers({
        sort: 'firstname',
        select: '-bio -personalBests'
      })
    ]).then((results: any[]) => {
      const data = {
        races: results[0],
        members: results[1]
      };
      this.memoryCacheService.set(CACHE_NAMES.ATTENDANCE, 'data', data);
      return data;
    });
  }

  getRacesInfos(params: any): Promise<any> {
    const key = JSON.stringify(params);
    const cachedData = this.memoryCacheService.get(CACHE_NAMES.RACE_INFOS, key);
    if (cachedData) {
      return Promise.resolve(cachedData);
    }
    return this.resultsService.getRacesInfos(params).then((data: any) => {
      this.memoryCacheService.set(CACHE_NAMES.RACE_INFOS, key, data);
      return data;
    });
  }
}
