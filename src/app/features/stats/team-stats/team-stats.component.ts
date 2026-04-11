import { Component, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StatsNavComponent } from '../stats-nav/stats-nav.component';
import { D3PieChartComponent } from '../../../shared/components/d3-pie-chart/d3-pie-chart.component';
import { StatsService } from '../../../core/services/stats.service';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { ResultsService } from '../../../core/services/results.service';

@Component({
  selector: 'app-team-stats',
  standalone: true,
  imports: [CommonModule, FormsModule, StatsNavComponent, D3PieChartComponent],
  template: `
    <div class="jumbotron">
      <app-stats-nav></app-stats-nav>

      <div class="row text-left">
        <div class="col-md-9"></div>
        <div class="col-md-3">
          <div style="float: right;">
            <select class="form-control" [(ngModel)]="selectedYear" (ngModelChange)="onYearChange()">
              <option *ngFor="let y of yearsList" [ngValue]="y">{{ y }}</option>
            </select>
          </div>
        </div>
      </div>

      <div *ngIf="loading" class="text-center" style="padding: 50px;">
        <i class="fa fa-spinner fa-spin fa-3x"></i>
        <p style="margin-top: 15px;">Loading team statistics...</p>
      </div>

      <div *ngIf="!loading">
        <!-- General Stats + Best Turnout -->
        <div class="row">
          <div class="col-md-6">
            <div class="panel panel-default">
              <div class="panel-heading"><h4><i class="fa fa-bar-chart"></i> General Stats</h4></div>
              <div class="panel-body" style="padding: 0;">
                <ul class="list-group" style="margin: 0; border: none;">
                  <li class="list-group-item text-left" style="border: none;">
                    <div class="row"><div class="col-sm-8"><strong>Number of results</strong></div><div class="col-sm-4 text-right">{{ stats.resultsCount }}</div></div>
                  </li>
                  <li class="list-group-item text-left" style="border: none;">
                    <div class="row"><div class="col-sm-8"><strong>Miles raced</strong></div><div class="col-sm-4 text-right">{{ stats.milesRaced | number }}</div></div>
                  </li>
                  <li class="list-group-item text-left" style="border: none;">
                    <div class="row"><div class="col-sm-8"><strong>Number of wins by team members</strong></div><div class="col-sm-4 text-right">{{ stats.raceWon | number }}</div></div>
                  </li>
                  <li class="list-group-item text-left" style="border: none;">
                    <div class="row"><div class="col-sm-12"><strong>Most popular race distances:</strong></div></div>
                  </li>
                  <li class="list-group-item text-left" style="border: none;">
                    <div class="panel-body">
                      <app-d3-pie-chart [data]="teamRaceTypeBreakdown" [width]="350" [height]="250"
                        (sliceClick)="onPieSliceClick($event)">
                      </app-d3-pie-chart>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="panel panel-default">
              <div class="panel-heading"><h4><i class="fa fa-users"></i> Best Turnout</h4></div>
              <div class="panel-body" style="padding: 0;">
                <ul class="list-group" style="margin: 0; border: none;">
                  <li class="list-group-item text-left" *ngFor="let race of stats.bestTurnout; let i = index" style="border: none;">
                    <div class="row">
                      <div class="col-sm-8">
                        <strong>{{ i + 1 }}. <span class="hoverhandandunderline resultEvent" (click)="showRaceFromId(race._id)">{{ race.racename }}</span></strong>
                        <br><small>{{ race.racedate | date:'yyyy-MM-dd':'UTC' }} - {{ race.racetype?.name }}
                          <span *ngIf="race.location?.state">({{ race.location.state }})</span>
                          <span *ngIf="!race.location?.state && race.location?.country">({{ race.location.country }})</span>
                        </small>
                      </div>
                      <div class="col-sm-4 text-right">{{ race.teamMembers }} members</div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <!-- Most Races + Most Traveled -->
        <div class="row">
          <div class="col-md-6">
            <div class="panel panel-default">
              <div class="panel-heading"><h4><i class="fa fa-flag-checkered"></i> Most Races Completed</h4></div>
              <div class="panel-body" style="padding: 0;">
                <ul class="list-group" style="margin: 0; border: none;">
                  <li class="list-group-item text-left" *ngFor="let member of stats.mostRaces; let i = index" style="border: none;"
                      [class.my-member-row]="isCurrentUser(member.username)">
                    <div class="row">
                      <div class="col-sm-8">
                        <strong>{{ i + 1 }}. <a [href]="'/members/member/' + member.username">{{ member.name }}</a></strong>
                        <br><small>{{ member.avgRacesPerYear }} avg/year, {{ member.yearsRacing }} years racing</small>
                      </div>
                      <div class="col-sm-4 text-right">
                        <a class="hoverhandandunderline" (click)="goToResults({members:[{username: member.username}]})">{{ member.races }} races</a>
                        <span *ngIf="member.parkrunRaces" class="hoverhand" title="({{ member.parkrunRaces }} parkrun races)">*</span>
                      </div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="panel panel-default">
              <div class="panel-heading"><h4><i class="fa fa-globe"></i> Most Traveled Runners</h4></div>
              <div class="panel-body" style="padding: 0;">
                <ul class="list-group" style="margin: 0; border: none;">
                  <li class="list-group-item text-left" *ngFor="let member of stats.mostTraveled; let i = index" style="border: none;"
                      [class.my-member-row]="isCurrentUser(member.username)">
                    <div class="row">
                      <div class="col-sm-8">
                        <strong>{{ i + 1 }}. <a [href]="'/members/member/' + member.username">{{ member.name }}</a></strong>
                        <br><small>{{ member.uniqueCountries }} {{ member.uniqueCountries === 1 ? 'country' : 'countries' }}, {{ member.uniqueStates }} {{ member.uniqueStates === 1 ? 'state' : 'states' }}</small>
                      </div>
                      <div class="col-sm-4 text-right">{{ member.uniqueLocations }} locations</div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <!-- Most Miles + Most Wins -->
        <div class="row">
          <div class="col-md-6">
            <div class="panel panel-default">
              <div class="panel-heading"><h4><i class="fa fa-road"></i> Most Miles Raced</h4></div>
              <div class="panel-body" style="padding: 0;">
                <ul class="list-group" style="margin: 0; border: none;">
                  <li class="list-group-item text-left" *ngFor="let member of stats.mostMiles; let i = index" style="border: none;"
                      [class.my-member-row]="isCurrentUser(member.username)">
                    <div class="row">
                      <div class="col-sm-8">
                        <strong>{{ i + 1 }}. <a [href]="'/members/member/' + member.username">{{ member.name }}</a></strong>
                        <br><small>{{ member.races }} races, {{ member.avgMilesPerRace }} avg miles/race</small>
                      </div>
                      <div class="col-sm-4 text-right">{{ member.miles }} miles</div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="panel panel-default">
              <div class="panel-heading"><h4><i class="fa fa-trophy"></i> Most Wins</h4></div>
              <div class="panel-body" style="padding: 0;">
                <ul class="list-group" style="margin: 0; border: none;">
                  <li class="list-group-item text-left" *ngFor="let member of stats.mostWins; let i = index" style="border: none;"
                      [class.my-member-row]="isCurrentUser(member.username)">
                    <div class="row">
                      <div class="col-sm-8">
                        <strong>{{ i + 1 }}. <a [href]="'/members/member/' + member.username">{{ member.name }}</a></strong>
                        <br><small>{{ member.races }} total races</small>
                      </div>
                      <div class="col-sm-4 text-right">
                        <a class="hoverhandandunderline" (click)="goToResults({members:[{username: member.username, ranking: '1'}]})">{{ member.wins }} wins</a>
                      </div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <!-- Best Age Grades + Most Consistent -->
        <div class="row">
          <div class="col-md-6">
            <div class="panel panel-default">
              <div class="panel-heading"><h4><i class="fa fa-star"></i> Best Age Grades</h4></div>
              <div class="panel-body" style="padding: 0;">
                <ul class="list-group" style="margin: 0; border: none;">
                  <li class="list-group-item text-left" *ngFor="let member of stats.bestAgeGrades; let i = index" style="border: none;"
                      [class.my-member-row]="isCurrentUser(member.username)">
                    <div class="row">
                      <div class="col-sm-8">
                        <strong>{{ i + 1 }}. <a [href]="'/members/member/' + member.username">{{ member.name }}</a></strong>
                        <br><small><span class="hoverhandandunderline resultEvent" (click)="showRaceModal(member.bestAgeGradeRace)">{{ member.bestAgeGradeRace?.racename }}</span> (avg: {{ member.avgAgeGrade }}%)</small>
                      </div>
                      <div class="col-sm-4 text-right">{{ member.bestAgeGrade }}%</div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="panel panel-default">
              <div class="panel-heading"><h4><i class="fa fa-calendar"></i> Most Consistent Racers</h4></div>
              <div class="panel-body" style="padding: 0;">
                <ul class="list-group" style="margin: 0; border: none;">
                  <li class="list-group-item text-left" *ngFor="let member of stats.mostConsistent; let i = index" style="border: none;"
                      [class.my-member-row]="isCurrentUser(member.username)">
                    <div class="row">
                      <div class="col-sm-8">
                        <strong>{{ i + 1 }}. <a [href]="'/members/member/' + member.username">{{ member.name }}</a></strong>
                        <br><small>{{ member.races }} races over {{ member.yearsRacing }} years</small>
                      </div>
                      <div class="col-sm-4 text-right">{{ member.avgRacesPerYear }}/year</div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class TeamStatsComponent implements OnInit {
  yearsList: (string | number)[] = [];
  selectedYear: string | number = 'All Time';
  loading = true;
  stats: any = {};
  teamRaceTypeBreakdown: any[] = [];

  constructor(
    private statsService: StatsService,
    private authStateService: AuthStateService,
    private resultsService: ResultsService
  ) {
    const currentYear = new Date().getFullYear();
    this.yearsList = ['All Time'];
    for (let i = currentYear; i >= 2013; i--) {
      this.yearsList.push(i);
    }
  }

  ngOnInit(): void {
    this.loadStats();
  }

  onYearChange(): void {
    this.loadStats();
  }

  private async loadStats(): Promise<void> {
    this.loading = true;
    try {
      const result = await this.statsService.getStats(this.selectedYear);
      const teamMemberStats = result.teamMemberStats || {};
      // Filter out null/undefined entries (can happen from stale IndexedDB cache)
      const memberArrayKeys = ['mostRaces', 'mostMiles', 'mostWins', 'mostTraveled', 'mostCountries',
                                'bestAgeGrades', 'mostConsistent', 'bestTurnout'];
      memberArrayKeys.forEach(key => {
        if (Array.isArray(teamMemberStats[key])) {
          teamMemberStats[key] = teamMemberStats[key].filter((m: any) => m != null);
        }
      });
      this.stats = {
        ...result.basicStats,
        ...result.generalStats,
        ...teamMemberStats
      };
      this.teamRaceTypeBreakdown = result.teamRaceTypeBreakdown;
    } catch (e) {
      console.error('Error loading stats:', e);
    }
    this.loading = false;
  }

  isCurrentUser(username: string | undefined): boolean {
    if (!username) return false;
    const user = this.authStateService.currentUser;
    return user && user.member && user.member.username === username;
  }

  showRaceModal(raceinfo: any): void {
    if (raceinfo) {
      this.resultsService.showRaceModal(raceinfo);
    }
  }

  showRaceFromId(raceId: string): void {
    if (raceId) {
      this.resultsService.showRaceFromRaceIdModal(raceId);
    }
  }

  onPieSliceClick(data: any): void {
    const query: any = { distance: data.name };
    if (this.selectedYear !== 'All Time') {
      query.year = this.selectedYear;
    }
    this.goToResults(query);
  }

  goToResults(queryParams: any): void {
    const cleaned: any = {};
    Object.keys(queryParams).forEach(key => {
      if (queryParams[key] !== null && queryParams[key] !== undefined && queryParams[key] !== '') {
        cleaned[key] = queryParams[key];
      }
    });
    if (this.selectedYear !== 'All Time') {
      cleaned.year = this.selectedYear;
    }
    window.location.href = '/results?search=' + encodeURIComponent(JSON.stringify(cleaned));
  }
}
