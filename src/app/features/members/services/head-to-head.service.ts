import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class HeadToHeadService {

  calculateMemberStats(results: any[]): any {
    const stats: any = {
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
      raceTypeBreakdown: {} as Record<string, number>,
      locationBreakdown: {} as Record<string, number>
    };

    const years = new Set<number>();
    let totalAgeGrade = 0;
    let ageGradeCount = 0;

    results.forEach((result: any) => {
      const raceYear = new Date(result.race.racedate).getUTCFullYear();
      years.add(raceYear);

      if (result.race.location) {
        const locationKey = result.race.location.country + (result.race.location.state ? ' - ' + result.race.location.state : '');
        stats.uniqueLocations.add(locationKey);
        stats.uniqueStates.add(result.race.location.state || '');
        stats.uniqueCountries.add(result.race.location.country);
      }

      if (result.race.racetype) {
        const raceTypeName = result.race.racetype.name;
        stats.raceTypeBreakdown[raceTypeName] = (stats.raceTypeBreakdown[raceTypeName] || 0) + 1;
      }

      if (result.legs && result.legs.length > 0) {
        result.legs.forEach((leg: any) => {
          if (leg.legType === 'run' && leg.miles) {
            stats.totalMiles += leg.miles;
          }
        });
      } else if (result.race.racetype && result.race.racetype.miles) {
        stats.totalMiles += result.race.racetype.miles;
      }

      if (result.ranking) {
        if ((result.ranking.overallrank && result.ranking.overallrank === 1) || (result.ranking.genderrank && result.ranking.genderrank === 1)) {
          stats.wins++;
        }
        if ((result.ranking.overallrank && result.ranking.overallrank <= 3) || (result.ranking.genderrank && result.ranking.genderrank <= 3)) {
          stats.top3Finishes++;
        }
      }

      if (result.agegrade) {
        totalAgeGrade += result.agegrade;
        ageGradeCount++;
        if (result.agegrade > stats.bestAgeGrade) {
          stats.bestAgeGrade = result.agegrade;
          stats.bestAgeGradeRace = result.race;
        }
      }
    });

    stats.yearsRacing = years.size;
    stats.avgRacesPerYear = years.size > 0 ? results.length / years.size : 0;
    stats.avgAgeGrade = ageGradeCount > 0 ? totalAgeGrade / ageGradeCount : 0;
    stats.uniqueLocations = stats.uniqueLocations.size;
    stats.uniqueStates = stats.uniqueStates.size;
    stats.uniqueCountries = stats.uniqueCountries.size;

    return stats;
  }

  calculateComparisonStats(member1Results: any[], member2Results: any[]): any {
    const stats1 = this.calculateMemberStats(member1Results);
    const stats2 = this.calculateMemberStats(member2Results);

    return {
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
  }

  findSharedRaces(member1Results: any[], member2Results: any[], ageGradeMode: boolean): any[] {
    const member1RaceIds = new Set(member1Results.map((r: any) => r.race._id));
    const member2RaceIds = new Set(member2Results.map((r: any) => r.race._id));
    const sharedRaceIds = new Set([...member1RaceIds].filter(id => member2RaceIds.has(id)));

    const sharedRaces: any[] = [];

    sharedRaceIds.forEach(raceId => {
      const member1Result = member1Results.find((r: any) => r.race._id === raceId);
      const member2Result = member2Results.find((r: any) => r.race._id === raceId);

      if (member1Result && member2Result && member1Result._id !== member2Result._id) {
        let isTie = false;
        let winner: string | null = null;

        if (ageGradeMode) {
          const m1AG = member1Result.agegrade;
          const m2AG = member2Result.agegrade;
          if (m1AG && m2AG) {
            isTie = m1AG === m2AG;
            if (isTie) {
              if (member1Result.time !== member2Result.time) {
                isTie = false;
                winner = member1Result.time < member2Result.time ? 'member1' : 'member2';
              }
            } else {
              winner = m1AG > m2AG ? 'member1' : 'member2';
            }
          } else {
            return; // skip if either lacks age grade
          }
        } else {
          isTie = member1Result.time === member2Result.time;
          if (isTie) {
            const m1Rank = member1Result.ranking ? member1Result.ranking.overallrank : null;
            const m2Rank = member2Result.ranking ? member2Result.ranking.overallrank : null;
            if (m1Rank && m2Rank && m1Rank !== m2Rank) {
              isTie = false;
              winner = m1Rank < m2Rank ? 'member1' : 'member2';
            }
          } else {
            winner = member1Result.time < member2Result.time ? 'member1' : 'member2';
          }
        }

        sharedRaces.push({
          race: member1Result.race,
          member1Result,
          member2Result,
          timeDifference: isTie ? 0 : (ageGradeMode ?
            Math.abs(member1Result.agegrade - member2Result.agegrade) :
            Math.abs(member1Result.time - member2Result.time)),
          winner,
          isTie
        });
      }
    });

    return sharedRaces.sort((a, b) => new Date(b.race.racedate).getTime() - new Date(a.race.racedate).getTime());
  }

  calculateHeadToHeadRecord(sharedRaces: any[]): { member1Wins: number; member2Wins: number; ties: number } {
    const record = { member1Wins: 0, member2Wins: 0, ties: 0 };
    sharedRaces.forEach((race: any) => {
      if (race.isTie) { record.ties++; }
      else if (race.winner === 'member1') { record.member1Wins++; }
      else { record.member2Wins++; }
    });
    return record;
  }

  buildYearlyHeadToHeadData(sharedRaces: any[]): any {
    if (!sharedRaces || sharedRaces.length === 0) return null;

    const yearMap: Record<number, { member1Wins: number; member2Wins: number; ties: number }> = {};
    sharedRaces.forEach((race: any) => {
      const year = new Date(race.race.racedate).getUTCFullYear();
      if (!yearMap[year]) yearMap[year] = { member1Wins: 0, member2Wins: 0, ties: 0 };
      if (race.isTie) { yearMap[year].ties++; }
      else if (race.winner === 'member1') { yearMap[year].member1Wins++; }
      else { yearMap[year].member2Wins++; }
    });

    const years = Object.keys(yearMap).map(Number).sort((a, b) => a - b);
    return {
      labels: years,
      member1Wins: years.map(y => yearMap[y].member1Wins),
      member2Wins: years.map(y => yearMap[y].member2Wins),
      ties: years.map(y => yearMap[y].ties)
    };
  }

  calculateTopTeamMembers(raceList: any[], allMembers: any[], currentMemberId: string, ageGradeMode: boolean): any[] {
    const teamMemberCounts: Record<string, any> = {};

    raceList.forEach((race: any) => {
      if (!race.results || race.results.length === 0) return;

      let currentMemberResult: any = null;
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

      if (!currentMemberInRace || !currentMemberResult) return;

      race.results.forEach((result: any) => {
        if (result.members) {
          result.members.forEach((member: any) => {
            if (member._id !== currentMemberId) {
              if (!teamMemberCounts[member._id]) {
                const fullMemberData = allMembers.find((m: any) => m._id === member._id);
                teamMemberCounts[member._id] = {
                  _id: member._id,
                  firstname: member.firstname,
                  lastname: member.lastname,
                  username: member.username,
                  sex: member.sex,
                  memberStatus: fullMemberData ? fullMemberData.memberStatus : undefined,
                  count: 0,
                  ageGradeCount: 0,
                  headToHeadRecord: { wins: 0, losses: 0, ties: 0, winRate: 0 }
                };
              }
              teamMemberCounts[member._id].count++;

              if (currentMemberResult._id !== result._id) {
                if (ageGradeMode) {
                  const currentAG = currentMemberResult.agegrade;
                  const otherAG = result.agegrade;
                  if (currentAG && otherAG) {
                    teamMemberCounts[member._id].ageGradeCount++;
                    if (currentAG === otherAG) {
                      if (currentMemberResult.time !== result.time) {
                        if (currentMemberResult.time < result.time) { teamMemberCounts[member._id].headToHeadRecord.wins++; }
                        else { teamMemberCounts[member._id].headToHeadRecord.losses++; }
                      } else { teamMemberCounts[member._id].headToHeadRecord.ties++; }
                    } else if (currentAG > otherAG) { teamMemberCounts[member._id].headToHeadRecord.wins++; }
                    else { teamMemberCounts[member._id].headToHeadRecord.losses++; }
                  }
                } else {
                  const currentTime = currentMemberResult.time;
                  const otherTime = result.time;
                  if (currentTime === otherTime) {
                    const currentRank = currentMemberResult.ranking ? currentMemberResult.ranking.overallrank : null;
                    const otherRank = result.ranking ? result.ranking.overallrank : null;
                    if (currentRank && otherRank && currentRank !== otherRank) {
                      if (currentRank < otherRank) { teamMemberCounts[member._id].headToHeadRecord.wins++; }
                      else { teamMemberCounts[member._id].headToHeadRecord.losses++; }
                    } else { teamMemberCounts[member._id].headToHeadRecord.ties++; }
                  } else if (currentTime < otherTime) { teamMemberCounts[member._id].headToHeadRecord.wins++; }
                  else { teamMemberCounts[member._id].headToHeadRecord.losses++; }
                }
              }
            }
          });
        }
      });
    });

    return Object.values(teamMemberCounts)
      .filter((member: any) => {
        if (ageGradeMode) return member.ageGradeCount > 0;
        return true;
      })
      .map((member: any) => {
        const totalRaces = member.headToHeadRecord.wins + member.headToHeadRecord.losses + member.headToHeadRecord.ties;
        member.headToHeadRecord.winRate = totalRaces > 0 ? (member.headToHeadRecord.wins / totalRaces) * 100 : 0;
        return member;
      });
  }
}
