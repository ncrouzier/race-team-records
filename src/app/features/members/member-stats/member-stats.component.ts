import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MembersService } from '../../../core/services/members.service';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { UtilsService } from '../../../core/services/utils.service';
import { ResultsService } from '../../../core/services/results.service';
import { getTeamRequirementsForYear } from '../../../core/data/team-requirements';
import { MemberNavComponent } from '../member-nav/member-nav.component';
import { D3PieChartComponent } from '../../../shared/components/d3-pie-chart/d3-pie-chart.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { MemberBestTimeChartComponent } from '../../../shared/components/member-best-time-chart/member-best-time-chart.component';
import { SecondsToTimeStringPipe } from '../../../shared/pipes/seconds-to-time-string.pipe';

declare var gtag: any;

@Component({
  selector: 'app-member-stats',
  standalone: true,
  imports: [CommonModule, RouterLink, MemberNavComponent, D3PieChartComponent, PaginationComponent, MemberBestTimeChartComponent, SecondsToTimeStringPipe],
  template: `
    <app-member-nav *ngIf="currentMember" [member]="currentMember" activeTab="stats" [user]="user"></app-member-nav>

    <div class="jumbotron" *ngIf="!currentMember">
      <div class="text-center" style="padding: 40px;">
        <i class="fa fa-spinner fa-spin fa-2x"></i>
        <p>Loading statistics...</p>
      </div>
    </div>

    <div class="jumbotron" *ngIf="currentMember && memberStats">
      <div class="row text-center">
        <h2 class="bold">Statistics as a team member</h2>
      </div>

      <!-- Racing Activity Overview -->
      <div class="row">
        <div class="col-md-12">
          <div class="panel panel-default">
            <div class="panel-heading"><h4><i class="fa fa-calendar"></i> Racing Activity</h4></div>
            <div class="panel-body">
              <div class="row">
                <div class="col-sm-4">
                  <div class="stat-box text-center hoverhand" (click)="goToResultsWithQuery({members:[{username: currentMember.username}]})">
                    <div class="stat-number">{{ memberStats.totalRaces }}</div>
                    <div class="stat-label">Total Races</div>
                  </div>
                </div>
                <div class="col-sm-4">
                  <div class="stat-box text-center hoverhand" (click)="goToResultsWithQuery({members:[{username: currentMember.username}], year: currentYear})">
                    <div class="stat-number">{{ memberStats.racesThisYear }}</div>
                    <div class="stat-label">Races This Year</div>
                  </div>
                </div>
                <div class="col-sm-4">
                  <div class="stat-box text-center">
                    <div class="stat-number">{{ memberStats.avgRacesPerYear | number:'1.1-1' }}</div>
                    <div class="stat-label">Avg Races/Year</div>
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col-sm-4">
                  <div class="stat-box text-center">
                    <div class="stat-number">{{ memberStats.yearsRacing }}</div>
                    <div class="stat-label">Years Racing on the Team</div>
                  </div>
                </div>
                <div class="col-sm-4" *ngIf="canViewRequirements && currentMember.teamRequirementStats">
                  <div class="stat-box text-center" [class.requirement-met]="reqMeetsAll">
                    <div class="stat-number">
                      {{ reqTotal }} / {{ reqConfig.minRaceAndVolunteerCount }}
                      <i *ngIf="reqMeetsRaces" class="fa fa-check text-success" style="font-size: 16px;"></i>
                    </div>
                    <div class="stat-label">{{ currentMember.teamRequirementStats.year }} Races Requirement</div>
                    <div *ngIf="currentMember.teamRequirementStats.volunteerJobCount > 0" style="font-size: 11px; color: #777;">
                      {{ currentMember.teamRequirementStats.raceCount }} races + {{ currentMember.teamRequirementStats.volunteerJobCount }} volunteer
                      {{ currentMember.teamRequirementStats.volunteerJobCount === 1 ? 'job' : 'jobs' }}
                    </div>
                  </div>
                </div>
                <div class="col-sm-4" *ngIf="canViewRequirements && currentMember.teamRequirementStats">
                  <div class="stat-box text-center" [class.requirement-met]="reqMeetsAll">
                    <div class="stat-number">
                      <span *ngIf="currentMember.teamRequirementStats.maxAgeGrade !== 'N/A'">{{ currentMember.teamRequirementStats.maxAgeGrade | number:'1.1-1' }}%</span>
                      <span *ngIf="currentMember.teamRequirementStats.maxAgeGrade === 'N/A'">N/A</span>
                      <i *ngIf="currentMember.teamRequirementStats.maxAgeGrade >= reqConfig.minAgeGrade" class="fa fa-check text-success" style="font-size: 16px;"></i>
                    </div>
                    <div class="stat-label">{{ currentMember.teamRequirementStats.year }} Age Grade ({{ reqConfig.minAgeGrade }}%+ needed)</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Personal Bests + Performance Highlights -->
      <div class="row">
        <div class="col-md-6">
          <div class="panel panel-default">
            <div class="panel-heading">
              <h4 title="Personal bests as MCRRC race team member"><i class="fa fa-trophy"></i> Personal Bests <span style="font-size: 75%;">(as MCRRC race team member)</span></h4>
            </div>
            <div class="panel-body" style="padding: 0;">
              <div style="padding: 10px;">
                <div class="btn-group">
                  <ng-container *ngFor="let surface of pbSurfaces">
                    <button *ngIf="getPbsForSurface(surface).length > 0" class="btn btn-sm"
                            [class.btn-primary]="activePbTab === surface"
                            [class.btn-default]="activePbTab !== surface"
                            (click)="activePbTab = surface">
                      {{ surface }}
                    </button>
                  </ng-container>
                </div>
              </div>
              <ul class="pb-list list-group" style="margin: 0; border: none;" *ngIf="getPbsForSurface(activePbTab).length > 0">
                <li class="list-group-item text-left pblistheader">
                  <div class="row">
                    <div class="col-sm-6" style="font-size: 15px;"><span class="listheader">RACE</span></div>
                    <div class="col-sm-6" style="font-size: 15px;"><span class="listheader">TIME</span></div>
                  </div>
                </li>
                <li *ngFor="let pb of getPbsForSurface(activePbTab)" class="list-group-item text-left pblistrow">
                  <div class="row">
                    <div class="col-sm-6">
                      <span class="hoverhandandunderline resultEvent" (click)="showRaceModal(pb.result?.race)">{{ pb.name }}</span>
                    </div>
                    <div class="col-sm-6">
                      <span class="hoverhandandunderline resultEvent time" (click)="showRaceModal(pb.result?.race)">{{ formatTime(pb.time) }}</span>
                    </div>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="panel panel-default">
            <div class="panel-heading"><h4><i class="fa fa-trophy"></i> Performance Highlights</h4></div>
            <div class="panel-body">
              <div class="row">
                <div class="col-sm-6">
                  <div class="stat-box text-center hoverhand" (click)="goToResultsWithQuery({members:[{username: currentMember.username, ranking: '1'}]})">
                    <div class="stat-number">{{ memberStats.wins }}</div>
                    <div class="stat-label">Wins</div>
                  </div>
                </div>
                <div class="col-sm-6">
                  <div class="stat-box text-center hoverhand" (click)="goToResultsWithQuery({members:[{username: currentMember.username, ranking: '1-3'}]})">
                    <div class="stat-number">{{ memberStats.top3Finishes }}</div>
                    <div class="stat-label">Top 3 Finishes</div>
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col-sm-6">
                  <div class="stat-box text-center">
                    <div class="stat-number">{{ memberStats.ageGroupWins }}</div>
                    <div class="stat-label">Age Group Wins</div>
                  </div>
                </div>
                <div class="col-sm-6">
                  <div class="stat-box text-center hoverhand" (click)="showRaceModal(memberStats.bestAgeGradeRace)">
                    <div class="stat-number">{{ memberStats.bestAgeGrade | number:'1.2-2' }}%</div>
                    <div class="stat-label">Best Age Grade</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Race Distance Distribution + Locations -->
      <div class="row">
        <div class="col-md-6">
          <div class="panel panel-default">
            <div class="panel-heading"><h4><i class="fa fa-pie-chart"></i> Race Distance Distribution</h4></div>
            <div class="panel-body">
              <app-d3-pie-chart [data]="memberStats.raceTypeBreakdown?.categories" [width]="350" [height]="250"
                                (sliceClick)="goToResultsWithQuery({members:[{username: currentMember.username}], distance: $any($event).name})">
              </app-d3-pie-chart>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="panel panel-default">
            <div class="panel-heading"><h4><i class="fa fa-map-marker"></i> Racing Locations</h4></div>
            <div class="panel-body">
              <div class="location-stats">
                <div *ngFor="let location of paginatedLocations" class="location-item">
                  <div class="location-name">
                    <a (click)="goToResultsWithQuery({members:[{username: currentMember.username}], states:[location.state]})" class="hoverhandandunderline">
                      <span *ngIf="location.stateName">
                        <img [src]="location.stateFlag" alt="State flag" style="width: 16px; height: auto; margin-right: 4px; vertical-align: middle; border: 1px solid #898f95;">
                        {{ location.stateName }}
                      </span>
                      <span *ngIf="!location.stateName">{{ location.countryFlag }} {{ location.countryName }}</span>
                    </a>
                  </div>
                  <div class="location-count">{{ location.count }} races</div>
                </div>
              </div>
              <div class="text-center" *ngIf="memberStats.locationBreakdown.length > 10">
                <app-pagination [totalItems]="memberStats.locationBreakdown.length" [itemsPerPage]="10"
                                [currentPage]="locationPage" (pageChange)="locationPage = $event; updateLocationPagination()">
                </app-pagination>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Top Team Members -->
      <div class="row">
        <div class="col-md-12">
          <div class="panel panel-default">
            <div class="panel-heading"><h4><i class="fa fa-users"></i> Top Team Members Raced With</h4></div>
            <div class="panel-body">
              <div class="team-members-stats">
                <div *ngFor="let member of paginatedTeamMembers" class="team-member-item">
                  <div class="team-member-name">
                    <a class="hoverhand" [routerLink]="['/members', member.username]">{{ member.firstname }} {{ member.lastname }}</a>
                  </div>
                  <div class="team-member-count">
                    <span (click)="goToResultsWithQuery({members:[{username: currentMember.username}, {username: member.username}]})" class="hoverhand">
                      {{ member.count }} races together
                    </span>
                    <br>
                    <a [routerLink]="['/members', currentMember.username, 'head-to-head', member.username]" class="btn btn-xs btn-primary">
                      <i class="fa fa-trophy"></i> Head-to-Head
                    </a>
                  </div>
                </div>
              </div>
              <div class="text-center" *ngIf="memberStats.topTeamMembers?.length > 10">
                <app-pagination [totalItems]="memberStats.topTeamMembers.length" [itemsPerPage]="10"
                                [currentPage]="teamMemberPage" (pageChange)="teamMemberPage = $event; updateTeamMemberPagination()">
                </app-pagination>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Performance Chart -->
      <div class="row">
        <div class="col-md-12">
          <div class="panel panel-default">
            <div class="panel-heading"><h4><i class="fa fa-line-chart"></i> Performances Over Time</h4></div>
            <div class="panel-body">
              <app-member-best-time-chart [raceTypeBreakdown]="memberStats.raceTypeBreakdown"></app-member-best-time-chart>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class MemberStatsComponent implements OnInit {
  currentMember: any = null;
  memberStats: any = null;
  user: any = null;
  loading = true;
  currentYear = new Date().getFullYear();
  reqConfig: any;

  // Requirement stats
  reqTotal = 0;
  reqMeetsRaces = false;
  reqMeetsAG = false;
  reqMeetsAll = false;

  // PB tabs
  pbSurfaces = ['road', 'track', 'trail', 'ultra'];
  activePbTab = 'road';

  // Pagination
  locationPage = 1;
  paginatedLocations: any[] = [];
  teamMemberPage = 1;
  paginatedTeamMembers: any[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private membersService: MembersService,
    private authStateService: AuthStateService,
    private utilsService: UtilsService,
    private resultsService: ResultsService
  ) {
    this.reqConfig = getTeamRequirementsForYear(this.currentYear);
  }

  ngOnInit(): void {
    this.user = this.authStateService.currentUser;
    this.loadData();
  }

  get canViewRequirements(): boolean {
    if (!this.user) return false;
    if (this.user.role === 'admin') return true;
    return !!(this.user.member?._id && this.currentMember && this.user.member._id === this.currentMember._id);
  }

  private async loadData(): Promise<void> {
    const username = this.route.snapshot.paramMap.get('member');
    if (!username) { this.router.navigate(['/members']); return; }

    try {
      const allMembers = await this.membersService.getMembersWithCacheSupport();
      const member = allMembers.find((m: any) => m.username === username);
      if (!member) { this.router.navigate(['/members']); return; }

      const fullMember = await this.membersService.getMember(member._id);

      const raceList = await this.resultsService.getRaceResultsWithCacheSupport({
        sort: '-racedate -order racename', preload: false
      });

      // Extract member results
      const results: any[] = [];
      raceList.forEach((race: any) => {
        if (race.results) {
          race.results.forEach((result: any) => {
            if (result.members) {
              result.members.forEach((m: any) => {
                if (m._id === fullMember._id) {
                  results.push({ ...result, race });
                }
              });
            }
          });
        }
      });
      results.sort((a, b) => new Date(b.race.racedate).getTime() - new Date(a.race.racedate).getTime());

      this.currentMember = fullMember;
      this.calculateMemberStats(results, raceList);

      // Calculate requirement stats
      if (this.currentMember.teamRequirementStats) {
        const rs = this.currentMember.teamRequirementStats;
        this.reqTotal = (rs.raceCount || 0) + (rs.volunteerJobCount || 0);
        this.reqMeetsRaces = this.reqTotal >= this.reqConfig.minRaceAndVolunteerCount;
        this.reqMeetsAG = rs.maxAgeGrade >= this.reqConfig.minAgeGrade;
        this.reqMeetsAll = this.reqMeetsRaces && this.reqMeetsAG;
      }

      // Set initial PB tab
      for (const s of this.pbSurfaces) {
        if (this.getPbsForSurface(s).length > 0) { this.activePbTab = s; break; }
      }

      this.loading = false;

      if (typeof gtag !== 'undefined') {
        gtag('event', 'view_member_stats', { member_name: fullMember.firstname + ' ' + fullMember.lastname });
      }
    } catch (e) {
      console.error('Error loading member stats:', e);
      this.router.navigate(['/members']);
    }
  }

  private calculateMemberStats(results: any[], raceList: any[]): void {
    // Port the full calculation from MemberStatsCtrl.calculateMemberStats
    const stats: any = {
      totalRaces: results.length, racesThisYear: 0, yearsRacing: 0, avgRacesPerYear: 0,
      personalBests: this.currentMember.personalBests ? this.currentMember.personalBests.length : 0,
      top3Finishes: 0, wins: 0, ageGroupWins: 0, bestAgeGrade: 0, bestAgeGradeRace: null, avgAgeGrade: 0,
      lastRaceDate: null, lastRaceName: '', raceTypeBreakdown: [], locationBreakdown: [], topTeamMembers: []
    };

    const years = new Set<number>();
    const raceTypes: Record<string, any> = {};
    const yearlyBreakdown: Record<number, any> = {};
    const locations: Record<string, any> = {};
    let totalAgeGrade = 0, ageGradeCount = 0;

    results.forEach((result: any) => {
      const raceYear = new Date(result.race.racedate).getUTCFullYear();
      if (raceYear === this.currentYear) stats.racesThisYear++;
      years.add(raceYear);

      // Race type categorization
      const raceType = result.race.racetype;
      let category = 'other', name = 'Other';
      if (['road', 'track', 'trail', 'ultra'].includes(raceType.surface)) {
        if (raceType.isVariable) { category = 'other'; name = 'Other'; }
        else if (raceType.name === '5000m') { category = '5k'; name = '5k'; }
        else if (raceType.name === '10000m') { category = '10k'; name = '10k'; }
        else { category = raceType.name; name = raceType.name; }
      }
      const key = category + '|' + name;
      raceTypes[key] = raceTypes[key] || { category, name, count: 0 };
      raceTypes[key].count++;

      if (!yearlyBreakdown[raceYear]) yearlyBreakdown[raceYear] = {};
      if (!yearlyBreakdown[raceYear][category]) yearlyBreakdown[raceYear][category] = { results: [] };
      yearlyBreakdown[raceYear][category].results.push(result);

      // Locations
      const loc = result.race.location?.state || result.race.location?.country;
      if (loc && !locations[loc]) {
        const stateName = result.race.location.state ? this.utilsService.getStateNameFromCode(result.race.location.state) : null;
        const countryName = result.race.location.country ? this.utilsService.getCountryNameFromCode(result.race.location.country) : null;
        const stateFlag = result.race.location.state ? this.utilsService.getStateFlag(result.race.location.state) : '';
        const countryFlag = result.race.location.country ? this.utilsService.getCountryFlag(result.race.location.country) : '';
        locations[loc] = { count: 0, state: result.race.location.state, country: result.race.location.country,
          stateName, countryName, stateFlag, countryFlag,
          displayName: stateName || countryName || loc, displayFlag: stateFlag || countryFlag };
      }
      if (loc) locations[loc].count++;

      // Rankings
      if (result.ranking) {
        if ((result.ranking.overallrank === 1) || (result.ranking.genderrank === 1)) stats.wins++;
        if (result.ranking.agerank === 1) stats.ageGroupWins++;
        if ((result.ranking.overallrank && result.ranking.overallrank <= 3) || (result.ranking.genderrank && result.ranking.genderrank <= 3)) stats.top3Finishes++;
      }

      // Age grades
      if (result.agegrade) {
        totalAgeGrade += result.agegrade; ageGradeCount++;
        if (result.agegrade > stats.bestAgeGrade) { stats.bestAgeGrade = result.agegrade; stats.bestAgeGradeRace = result.race; }
      }

      if (!stats.lastRaceDate || new Date(result.race.racedate) > new Date(stats.lastRaceDate)) {
        stats.lastRaceDate = result.race.racedate; stats.lastRaceName = result.race.racename;
      }
    });

    stats.yearsRacing = years.size;
    stats.avgRacesPerYear = years.size > 0 ? results.length / years.size : 0;
    stats.avgAgeGrade = ageGradeCount > 0 ? totalAgeGrade / ageGradeCount : 0;

    const colors = ['#007bff', '#28a745', '#ffc107', '#fd7e14', '#e83e8c', '#dc3545', '#6f42c1', '#6c757d'];
    const categories = Object.values(raceTypes).map((t: any) => ({
      category: t.category, name: t.name, count: t.count,
      percentage: Math.round((t.count / results.length) * 100)
    })).sort((a: any, b: any) => b.count - a.count);
    categories.forEach((t: any, i: number) => { t.color = colors[i % colors.length]; });

    stats.raceTypeBreakdown = { categories, yearly: yearlyBreakdown };
    stats.locationBreakdown = Object.values(locations).sort((a: any, b: any) => b.count - a.count);

    // Top team members
    const teamMemberCounts: Record<string, any> = {};
    const currentMemberId = this.currentMember._id;
    raceList.forEach((race: any) => {
      if (!race.results) return;
      let inRace = false;
      for (const r of race.results) {
        if (r.members?.some((m: any) => m._id === currentMemberId)) { inRace = true; break; }
      }
      if (!inRace) return;
      race.results.forEach((result: any) => {
        result.members?.forEach((m: any) => {
          if (m._id !== currentMemberId) {
            if (!teamMemberCounts[m._id]) {
              teamMemberCounts[m._id] = { _id: m._id, firstname: m.firstname, lastname: m.lastname, username: m.username, count: 0 };
            }
            teamMemberCounts[m._id].count++;
          }
        });
      });
    });
    stats.topTeamMembers = Object.values(teamMemberCounts).sort((a: any, b: any) => b.count - a.count);

    this.memberStats = stats;
    this.updateLocationPagination();
    this.updateTeamMemberPagination();
  }

  getPbsForSurface(surface: string): any[] {
    if (!this.currentMember?.personalBests) return [];
    return this.currentMember.personalBests
      .filter((pb: any) => pb.surface === surface)
      .sort((a: any, b: any) => (a.distance || 0) - (b.distance || 0));
  }

  updateLocationPagination(): void {
    if (!this.memberStats?.locationBreakdown) { this.paginatedLocations = []; return; }
    const start = (this.locationPage - 1) * 10;
    this.paginatedLocations = this.memberStats.locationBreakdown.slice(start, start + 10);
  }

  updateTeamMemberPagination(): void {
    if (!this.memberStats?.topTeamMembers) { this.paginatedTeamMembers = []; return; }
    const start = (this.teamMemberPage - 1) * 10;
    this.paginatedTeamMembers = this.memberStats.topTeamMembers.slice(start, start + 10);
  }

  formatTime(centiseconds: number): string {
    if (!centiseconds || centiseconds <= 0) return '';
    const totalSeconds = Math.floor(centiseconds / 100);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hours > 0) return hours + ':' + (minutes < 10 ? '0' : '') + minutes + ':' + (secs < 10 ? '0' : '') + secs;
    return minutes + ':' + (secs < 10 ? '0' : '') + secs;
  }

  showRaceModal(race: any): void {
    if (race) this.resultsService.showRaceFromRaceIdModal(race._id);
  }

  goToResultsWithQuery(queryParams: any): void {
    const cleaned: any = {};
    Object.keys(queryParams).forEach(key => {
      if (queryParams[key] !== null && queryParams[key] !== undefined && queryParams[key] !== '') {
        cleaned[key] = queryParams[key];
      }
    });
    if (Object.keys(cleaned).length > 0) {
      window.location.href = '/results?search=' + encodeURIComponent(JSON.stringify(cleaned));
    }
  }
}
