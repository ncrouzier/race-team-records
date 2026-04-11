import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ResultsService } from '../../../core/services/results.service';
import { UtilsService } from '../../../core/services/utils.service';
import { ParkrunYearlyChartComponent } from '../../../shared/components/parkrun-yearly-chart/parkrun-yearly-chart.component';
import { SecondsToTimeStringPipe } from '../../../shared/pipes/seconds-to-time-string.pipe';

@Component({
  selector: 'app-parkrun-stats',
  standalone: true,
  imports: [CommonModule, ParkrunYearlyChartComponent, SecondsToTimeStringPipe],
  template: `
<style>
  .parkrun-page { background-color: #f2f2f2; font-family: 'Montserrat', sans-serif; padding-bottom: 40px; }
  .parkrun-hero { background-color: #2b233d; padding: 40px 20px 30px; margin-bottom: 30px; text-align: center; }
  .parkrun-hero h1 { color: #ffffff; font-size: 42px; font-weight: 700; letter-spacing: 3px; margin: 0 0 8px; }
  .parkrun-hero p { color: #00ceae; font-size: 16px; margin: 0; font-weight: 500; }
  .parkrun-stat-box { background: #ffffff; border-radius: 4px; padding: 20px 10px; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
  .parkrun-stat-box h2 { color: #2b233d; font-size: 36px; font-weight: 700; margin: 0 0 6px; }
  .parkrun-stat-box p { color: #666; font-size: 13px; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
  .parkrun-stat-box p i { color: #00ceae; margin-right: 4px; }
  .parkrun-card { background: #ffffff; border-radius: 4px; box-shadow: 0 1px 4px rgba(0,0,0,0.1); margin-bottom: 24px; overflow: hidden; }
  .parkrun-card-header { background-color: #2b233d; padding: 14px 18px; }
  .parkrun-card-header h4 { color: #ffffff; margin: 0; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
  .parkrun-card-header h4 i { color: #00ceae; margin-right: 6px; }
  .parkrun-card-header small { color: #a095b8; font-size: 12px; display: block; margin-top: 4px; }
  .parkrun-list-item { padding: 12px 18px; border-bottom: 1px solid #f0f0f0; }
  .parkrun-list-item:last-child { border-bottom: none; }
  .parkrun-list-item:hover { background-color: #f7f7f7; }
  .parkrun-pos { color: #2b233d; font-size: 20px; font-weight: 700; display: inline-block; }
  .parkrun-list-item .text-right { color: #2b233d; font-weight: 600; }
  .parkrun-list-item a { color: #2b233d; }
  .parkrun-list-item a:hover { color: #00ceae; text-decoration: none; }
  .parkrun-list-item small { color: #888; font-size: 12px; }
  .parkrun-card-header .btn-group .btn { border: none; border-radius: 3px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 10px; }
  .parkrun-card-header .btn-group .btn-primary { background-color: #00ceae; color: #ffffff; }
  .parkrun-card-header .btn-group .btn-default { background-color: rgba(255,255,255,0.15); color: #ffffff; }
  .parkrun-card-header .btn-group .btn-default:hover { background-color: rgba(255,255,255,0.25); }
  .parkrun-spinner { padding: 60px; text-align: center; color: #2b233d; }
  .parkrun-spinner i { color: #00ceae; }
  .parkrun-chart-body { padding: 20px; background: #ffffff; }
</style>

<div class="jumbotron parkrun-page">

  <!-- Hero Banner -->
  <div class="parkrun-hero">
    <h1>#notacult</h1>
    <p>Stats for our members lost in denial</p>
  </div>

  <!-- Loading Spinner -->
  <div *ngIf="loading" class="parkrun-spinner">
    <i class="fa fa-spinner fa-spin fa-3x"></i>
    <p style="margin-top: 15px;">Counting Saturday mornings...</p>
  </div>

  <!-- No Data Message -->
  <div *ngIf="!loading && teamStats.totalParkruns === 0" class="parkrun-spinner">
    <i class="fa fa-tree fa-3x" style="color: #00ceae;"></i>
    <h3 style="color: #2b233d; margin-top: 12px;">No parkrun data found.</h3>
    <p style="color: #888;">The cult hasn't started yet.</p>
  </div>

  <div *ngIf="!loading && teamStats.totalParkruns > 0">
    <!-- Team Summary -->
    <div class="row" style="margin-bottom: 10px;">
      <div class="col-sm-3">
        <div class="parkrun-stat-box">
          <h2>{{teamStats.totalParkruns}}</h2>
          <p><i class="fa fa-flag-checkered"></i> Total parkrun results</p>
        </div>
      </div>
      <div class="col-sm-3">
        <div class="parkrun-stat-box">
          <h2>{{teamStats.uniqueParkrunners}}</h2>
          <p><i class="fa fa-users"></i> Cult members</p>
        </div>
      </div>
      <div class="col-sm-3">
        <div class="parkrun-stat-box">
          <h2>{{teamStats.totalMiles}}</h2>
          <p><i class="fa fa-road"></i> Miles raced</p>
        </div>
      </div>
      <div class="col-sm-3">
        <div class="parkrun-stat-box">
          <h2>{{teamStats.uniqueLocations}}</h2>
          <p><i class="fa fa-map-marker"></i> Locations</p>
        </div>
      </div>
    </div>

    <!-- Row 1: Most Active Cult Members + Most Popular parkruns -->
    <div class="row">
      <div class="col-md-6">
        <div class="parkrun-card">
          <div class="parkrun-card-header">
            <h4><i class="fa fa-heart"></i> Most Active Cult Members</h4>
            <small>Most parkruns completed</small>
          </div>
          <div>
            <div class="parkrun-list-item" *ngFor="let member of theDedicated; let i = index">
              <div class="row">
                <div class="col-sm-8">
                  <span class="parkrun-pos">{{i + 1}}.</span>
                  <strong><a class="hoverhandandunderline"
                      (click)="goToMember(member)">{{member.firstname}}
                      {{member.lastname}}</a></strong>
                </div>
                <div class="col-sm-4 text-right">
                  <a class="hoverhandandunderline"
                    (click)="goToResultsWithQuery({members:[{username: member.username}], query: 'parkrun'})"
                    title="View parkrun results for {{member.firstname}} {{member.lastname}}">{{member.count}}
                    parkruns</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="parkrun-card">
          <div class="parkrun-card-header">
            <h4><i class="fa fa-map-marker"></i> Most Popular parkruns</h4>
            <small>Team's favourite locations</small>
          </div>
          <div>
            <div class="parkrun-list-item" *ngFor="let parkrun of paginatedPopularParkruns; let i = index">
              <div class="row">
                <div class="col-sm-6">
                  <span class="parkrun-pos">{{i + 1 + (popularParkrunsPage - 1) * popularParkrunsPageSize}}.</span>
                  <strong><a class="hoverhandandunderline"
                      (click)="goToResultsWithQuery({query: parkrun.name})">{{parkrun.name}}</a></strong>
                  <img *ngIf="parkrun.flag?.type === 'state'" [src]="parkrun.flag.src"
                    [attr.alt]="parkrun.flagLabel" [attr.title]="parkrun.flagLabel"
                    style="width: 16px; height: auto; vertical-align: middle; margin-left: 4px; border: 1px solid #ccc;">
                  <span *ngIf="parkrun.flag?.type === 'country'" [attr.title]="parkrun.flagLabel"
                    style="margin-left: 4px;">{{parkrun.flag.emoji}}</span>
                </div>
                <div class="col-sm-6 text-right">
                  <a class="hoverhandandunderline"
                    (click)="goToResultsWithQuery({query: parkrun.name})">
                    {{parkrun.count}} results ({{parkrun.uniqueMembers}} members)</a>
                </div>
              </div>
            </div>
          </div>
          <div *ngIf="popularParkrunsTotalPages > 1"
            style="padding: 10px 18px; text-align: center; border-top: 1px solid #f0f0f0;">
            <button class="btn btn-sm btn-default" [disabled]="popularParkrunsPage === 1"
              (click)="popularParkrunsGoToPage(popularParkrunsPage - 1)">
              <i class="fa fa-chevron-left"></i>
            </button>
            <span style="margin: 0 10px; color: #2b233d; font-weight: 600;">
              Page {{popularParkrunsPage}} of {{popularParkrunsTotalPages}}
            </span>
            <button class="btn btn-sm btn-default"
              [disabled]="popularParkrunsPage === popularParkrunsTotalPages"
              (click)="popularParkrunsGoToPage(popularParkrunsPage + 1)">
              <i class="fa fa-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Row 2: Saturday Morning Roll Call + parkrun Tourists -->
    <div class="row">
      <div class="col-md-6">
        <div class="parkrun-card">
          <div class="parkrun-card-header">
            <h4><i class="fa fa-group"></i> Saturday Morning Roll Call</h4>
            <small>Biggest team parkrun gatherings</small>
          </div>
          <div>
            <div class="parkrun-list-item" *ngFor="let run of biggestGroupRuns; let i = index">
              <div class="row">
                <div class="col-sm-8">
                  <span class="parkrun-pos">{{i + 1}}.</span>
                  <strong><a class="hoverhandandunderline resultEvent"
                      (click)="showRaceModal(run.race)">{{run.racename}}</a></strong>
                  <br><small>{{run.date | date:'M/d/yyyy':'UTC'}} </small>
                </div>
                <div class="col-sm-4 text-right">
                  {{run.count}} members
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="parkrun-card">
          <div class="parkrun-card-header">
            <h4><i class="fa fa-plane"></i> parkrun Tourists</h4>
            <small>Most unique parkrun locations</small>
          </div>
          <div>
            <div class="parkrun-list-item" *ngFor="let member of parkrunTourists; let i = index">
              <div class="row">
                <div class="col-sm-8">
                  <span class="parkrun-pos">{{i + 1}}.</span>
                  <strong><a class="hoverhandandunderline"
                      (click)="goToMember(member)">{{member.firstname}}
                      {{member.lastname}}</a></strong>
                  <br><small>
                    <a *ngFor="let flag of member.flags" class="hoverhand" style="margin-right: 3px;"
                      (click)="goToResultsWithQuery({members:[{username: member.username}], query: flag.location})"
                      [attr.title]="flag.location">
                      <img *ngIf="flag.type === 'state'" [src]="flag.src"
                        [attr.alt]="flag.location"
                        style="width: 16px; height: auto; vertical-align: middle; border: 1px solid #ccc;">
                      <span *ngIf="flag.type === 'country'">{{flag.emoji}}</span>
                    </a>
                  </small>
                </div>
                <div class="col-sm-4 text-right">
                  {{member.locationCount}} locations
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Row 3: Most Wins + Speed Cultists -->
    <div class="row">
      <div class="col-md-6">
        <div class="parkrun-card">
          <div class="parkrun-card-header">
            <h4><i class="fa fa-trophy"></i> Most Wins / Not a Race</h4>
            <small>Overall or gender wins at parkruns</small>
          </div>
          <div>
            <div class="parkrun-list-item" *ngFor="let member of mostWins; let i = index">
              <div class="row">
                <div class="col-sm-8">
                  <span class="parkrun-pos">{{i + 1}}.</span>
                  <strong><a class="hoverhandandunderline"
                      (click)="goToMember(member)">{{member.firstname}}
                      {{member.lastname}}</a></strong>
                  <br><small>{{member.count}} parkruns</small>
                </div>
                <div class="col-sm-4 text-right">
                  <a class="hoverhandandunderline"
                    (click)="goToResultsWithQuery({members:[{username: member.username, ranking: '1'}], query: 'parkrun'})"
                    title="View all wins for {{member.firstname}} {{member.lastname}}">{{member.wins}}
                    wins</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-md-6">
        <div class="parkrun-card">
          <div class="parkrun-card-header">
            <h4 style="display: flex; align-items: center; justify-content: space-between; margin: 0;">
              <span><i class="fa fa-bolt"></i> Speed Cultists</span>
              <span class="btn-group" role="group">
                <button type="button" class="btn btn-sm"
                  [ngClass]="{'btn-primary': !speedDemonGenderFilter, 'btn-default': speedDemonGenderFilter}"
                  (click)="setSpeedDemonGenderFilter(null)">
                  <i class="fa fa-users"></i> All
                </button>
                <button type="button" class="btn btn-sm"
                  [ngClass]="{'btn-primary': speedDemonGenderFilter === 'Female', 'btn-default': speedDemonGenderFilter !== 'Female'}"
                  (click)="setSpeedDemonGenderFilter('Female')">
                  <i class="fa fa-venus"></i> Women
                </button>
              </span>
            </h4>
            <small>Fastest parkrun personal bests</small>
          </div>
          <div>
            <div class="parkrun-list-item" *ngFor="let member of speedDemons; let i = index">
              <div class="row">
                <div class="col-sm-8">
                  <span class="parkrun-pos">{{i + 1}}.</span>
                  <strong><a class="hoverhandandunderline"
                      (click)="goToMember(member)">{{member.firstname}}
                      {{member.lastname}}</a></strong>
                  <br><small><span class="hoverhandandunderline resultEvent"
                      (click)="showRaceModal(member.bestTimeRace)">{{member.bestTimeRace.racename}}</span>
                    - {{member.bestTimeRace.racedate | date:'M/d/yyyy':'UTC'}}</small>
                </div>
                <div class="col-sm-4 text-right">
                  {{member.bestTime | secondsToTimeString}}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Row 4: parkruns Attended by Year -->
    <div class="row">
      <div class="col-md-12">
        <div class="parkrun-card">
          <div class="parkrun-card-header">
            <h4><i class="fa fa-line-chart"></i> parkruns Attended by Year</h4>
          </div>
          <div class="parkrun-chart-body">
            <app-parkrun-yearly-chart [data]="yearlyBreakdown"
              (onBarClick)="onChartBarClick($event)"></app-parkrun-yearly-chart>
          </div>
        </div>
      </div>
    </div>
  </div>

</div>
  `
})
export class ParkrunStatsComponent implements OnInit {
  loading = true;
  teamStats: any = { totalParkruns: 0 };
  theDedicated: any[] = [];
  speedDemons: any[] = [];
  parkrunTourists: any[] = [];
  popularParkruns: any[] = [];
  paginatedPopularParkruns: any[] = [];
  popularParkrunsPage = 1;
  popularParkrunsPageSize = 10;
  popularParkrunsTotalPages = 0;
  yearlyBreakdown: any[] = [];
  biggestGroupRuns: any[] = [];
  mostWins: any[] = [];
  speedDemonGenderFilter: string | null = null;
  private allSpeedDemons: any[] = [];

  constructor(
    private resultsService: ResultsService,
    private utilsService: UtilsService
  ) {}

  ngOnInit(): void {
    this.loadParkrunStats();
  }

  async loadParkrunStats(): Promise<void> {
    try {
      const raceList = await this.resultsService.getRaceResultsWithCacheSupport({
        sort: '-racedate -order racename',
        preload: false
      });

      const parkrunRaces = raceList.filter((race: any) =>
        race.racename && race.racename.toLowerCase().includes('parkrun')
      );

      if (parkrunRaces.length === 0) {
        this.loading = false;
        return;
      }

      const memberMap: any = {};
      const locationSet: any = {};
      const yearMap: any = {};
      const parkrunLocationMap: any = {};
      const groupRunMap: any = {};
      let totalResults = 0;
      const raceYearMap: any = {};

      parkrunRaces.forEach((race: any) => {
        const year = new Date(race.racedate).getUTCFullYear();
        yearMap[year] = yearMap[year] || 0;
        raceYearMap[year] = (raceYearMap[year] || 0) + 1;

        const locationName = this.getParkrunLocationName(race.racename);
        locationSet[locationName] = true;

        if (!parkrunLocationMap[locationName]) {
          let locFlag: any = null;
          let locFlagLabel = '';
          if (race.location?.state && race.location.country === 'USA') {
            locFlag = { type: 'state', src: this.utilsService.getStateFlag(race.location.state) };
            locFlagLabel = race.location.state;
          } else if (race.location?.country) {
            locFlag = { type: 'country', emoji: this.utilsService.getCountryFlag(race.location.country) };
            locFlagLabel = race.location.country;
          }
          parkrunLocationMap[locationName] = { count: 0, members: {}, flag: locFlag, flagLabel: locFlagLabel };
        }

        const raceMembers: string[] = [];

        if (race.results?.length > 0) {
          race.results.forEach((result: any) => {
            if (result.members) {
              result.members.forEach((member: any) => {
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

                const m = memberMap[member._id];
                m.count++;

                if (result.ranking && (result.ranking.overallrank === 1 || result.ranking.genderrank === 1)) {
                  m.wins++;
                }

                if (!m.locationFlags[locationName]) {
                  let flag: any;
                  if (race.location?.state && race.location.country === 'USA') {
                    flag = { type: 'state', code: race.location.state, src: this.utilsService.getStateFlag(race.location.state) };
                  } else if (race.location?.country) {
                    flag = { type: 'country', emoji: this.utilsService.getCountryFlag(race.location.country) };
                  }
                  m.locationFlags[locationName] = flag;
                }
                m.locations[locationName] = true;

                if (result.time && (!m.bestTime || result.time < m.bestTime)) {
                  m.bestTime = result.time;
                  m.bestTimeRace = race;
                }

                parkrunLocationMap[locationName].count++;
                parkrunLocationMap[locationName].members[member._id] = true;

                raceMembers.push(member.firstname + ' ' + member.lastname);
              });
            }
          });
        }

        if (raceMembers.length >= 2) {
          groupRunMap[race._id] = {
            race,
            racename: race.racename,
            date: race.racedate,
            members: raceMembers,
            count: raceMembers.length
          };
        }
      });

      // Team summary stats
      const uniqueLocations = Object.keys(locationSet).length;
      const uniqueMembers = Object.keys(memberMap).length;
      this.teamStats = {
        totalParkruns: totalResults,
        uniqueParkrunners: uniqueMembers,
        totalMiles: (totalResults * 3.1).toFixed(1),
        uniqueLocations
      };

      const members = Object.values(memberMap) as any[];

      // The Dedicated
      this.theDedicated = members.slice().sort((a, b) => b.count - a.count).slice(0, 10);

      // Speed Demons
      this.allSpeedDemons = members.filter(m => m.bestTime).sort((a, b) => a.bestTime - b.bestTime);
      this.speedDemons = this.allSpeedDemons.slice(0, 10);

      // Most Wins
      this.mostWins = members.filter(m => m.wins > 0).sort((a, b) => b.wins - a.wins).slice(0, 10);

      // Parkrun Tourists
      this.parkrunTourists = members.map(m => {
        const flags: any[] = [];
        Object.keys(m.locationFlags).forEach(loc => {
          const flag = m.locationFlags[loc];
          if (flag) flags.push({ ...flag, location: loc });
        });
        return { ...m, locationCount: Object.keys(m.locations).length, flags };
      }).filter(m => m.locationCount > 1).sort((a, b) => b.locationCount - a.locationCount).slice(0, 10);

      // Most Popular Parkruns
      this.popularParkruns = Object.keys(parkrunLocationMap).map(name => ({
        name,
        count: parkrunLocationMap[name].count,
        uniqueMembers: Object.keys(parkrunLocationMap[name].members).length,
        flag: parkrunLocationMap[name].flag,
        flagLabel: parkrunLocationMap[name].flagLabel
      })).sort((a, b) => b.count - a.count);
      this.popularParkrunsTotalPages = Math.ceil(this.popularParkruns.length / this.popularParkrunsPageSize);
      this.popularParkrunsPage = 1;
      this.updatePaginatedPopularParkruns();

      // Yearly breakdown
      const years = Object.keys(raceYearMap).map(Number).sort((a, b) => a - b);
      this.yearlyBreakdown = years.map(y => ({ year: y, count: raceYearMap[y] }));

      // Biggest group runs
      this.biggestGroupRuns = (Object.values(groupRunMap) as any[]).sort((a, b) => b.count - a.count).slice(0, 10);

      this.loading = false;
    } catch (error) {
      console.error('Error loading parkrun stats:', error);
      this.loading = false;
    }
  }

  private getParkrunLocationName(racename: string): string {
    return racename.replace(/#\d+/g, '').trim() || racename;
  }

  private updatePaginatedPopularParkruns(): void {
    const start = (this.popularParkrunsPage - 1) * this.popularParkrunsPageSize;
    this.paginatedPopularParkruns = this.popularParkruns.slice(start, start + this.popularParkrunsPageSize);
  }

  setSpeedDemonGenderFilter(gender: string | null): void {
    this.speedDemonGenderFilter = gender;
    if (!gender) {
      this.speedDemons = this.allSpeedDemons.slice(0, 10);
    } else {
      this.speedDemons = this.allSpeedDemons.filter(m => m.sex === gender).slice(0, 10);
    }
  }

  popularParkrunsGoToPage(page: number): void {
    if (page >= 1 && page <= this.popularParkrunsTotalPages) {
      this.popularParkrunsPage = page;
      this.updatePaginatedPopularParkruns();
    }
  }

  goToMember(member: any): void {
    window.location.href = '/members/' + member.username + '/bio';
  }

  showRaceModal(raceinfo: any): void {
    if (raceinfo) {
      this.resultsService.showRaceModal(raceinfo);
    }
  }

  onChartBarClick(event: any): void {
    this.goToResultsWithQuery({ query: 'parkrun', year: event.year });
  }

  goToResultsWithQuery(queryParams: any): void {
    const cleanedParams: any = {};
    Object.keys(queryParams).forEach(key => {
      const value = queryParams[key];
      if (value !== null && value !== undefined && value !== '') {
        cleanedParams[key] = value;
      }
    });
    window.location.href = '/results?search=' + encodeURIComponent(JSON.stringify(cleanedParams));
  }
}
