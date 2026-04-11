import { Component, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StatsNavComponent } from '../stats-nav/stats-nav.component';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { VolunteerJobsService } from '../../../core/services/volunteer-jobs.service';
import { ResultsService } from '../../../core/services/results.service';
import { MembersService } from '../../../core/services/members.service';
import { getTeamRequirementsForYear } from '../../../core/data/team-requirements';

@Component({
  selector: 'app-requirements',
  standalone: true,
  imports: [CommonModule, FormsModule, StatsNavComponent],
  template: `
    <div class="jumbotron">
      <!-- Header -->
      <div class="requirements-header">
        <div class="row">
          <div class="col-md-8">
            <h2><i class="fa fa-trophy"></i> Team Requirements Dashboard</h2>
          </div>
          <div class="col-md-4 text-right">
            <div class="form-group">
              <label>Select Year:</label>
              <select class="form-control" [(ngModel)]="selectedYear" (ngModelChange)="onYearChange()">
                <option *ngFor="let y of yearsList" [ngValue]="y">{{ y }}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Summary Stats -->
      <div class="requirements-summary" *ngIf="summaryStats">
        <div class="row">
          <div class="col-md-3">
            <div class="stat-box">
              <h3>{{ summaryStats.complete }}/{{ summaryStats.total }}</h3>
              <p>Members Complete ({{ summaryStats.percentage }}%)</p>
            </div>
          </div>
          <div class="col-md-3">
            <div class="stat-box">
              <h3>{{ summaryStats.avgRaces }}</h3>
              <p>Average Races</p>
            </div>
          </div>
          <div class="col-md-3">
            <div class="stat-box">
              <h3>{{ summaryStats.avgVolunteer }}</h3>
              <p>Average Volunteer Jobs</p>
            </div>
          </div>
          <div class="col-md-3">
            <div class="stat-box">
              <h4>Requirements</h4>
              <p class="requirements-text">
                <i class="fa fa-check-circle text-success"></i> {{ reqConfig.minRaceAndVolunteerCount }}+ races (volunteer jobs count)<br>
                <i class="fa fa-check-circle text-success"></i> {{ reqConfig.minAgeGrade }}%+ age grade
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Requirements Table -->
      <div class="requirements-content">
        <div class="panel panel-default">
          <div class="panel-heading">
            <h4><i class="fa fa-list"></i> Member Requirements Status - {{ selectedYear }}</h4>
          </div>
          <div class="panel-body no-padding">
            <div *ngIf="loading" class="text-center loading-container">
              <i class="fa fa-spinner fa-spin fa-3x"></i>
              <p>Loading requirements data...</p>
            </div>

            <div *ngIf="!loading && requirementsList.length === 0" class="text-center text-muted empty-container">
              <i class="fa fa-info-circle"></i> No active members found for {{ selectedYear }}.
            </div>

            <table class="table table-striped table-hover" *ngIf="!loading && requirementsList.length > 0">
              <thead>
                <tr>
                  <th style="width: 40px; text-align: center;">#</th>
                  <th (click)="setSortBy('member.lastname')" class="sortable">
                    Member
                    <i class="fa" *ngIf="sortByField === 'member.lastname'" [ngClass]="sortReverse ? 'fa-sort-down' : 'fa-sort-up'"></i>
                  </th>
                  <th (click)="setSortBy('raceCount')" class="sortable">
                    Races
                    <i class="fa" *ngIf="sortByField === 'raceCount'" [ngClass]="sortReverse ? 'fa-sort-down' : 'fa-sort-up'"></i>
                  </th>
                  <th (click)="setSortBy('maxAgeGrade')" class="sortable">
                    Best Age Grade
                    <i class="fa" *ngIf="sortByField === 'maxAgeGrade'" [ngClass]="sortReverse ? 'fa-sort-down' : 'fa-sort-up'"></i>
                  </th>
                  <th (click)="setSortBy('volunteerJobCount')" class="sortable">
                    Volunteer Jobs
                    <i class="fa" *ngIf="sortByField === 'volunteerJobCount'" [ngClass]="sortReverse ? 'fa-sort-down' : 'fa-sort-up'"></i>
                  </th>
                  <th (click)="setSortBy('statusValue')" class="sortable">
                    Status
                    <i class="fa" *ngIf="sortByField === 'statusValue'" [ngClass]="sortReverse ? 'fa-sort-down' : 'fa-sort-up'"></i>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let req of sortedRequirements; let i = index" [ngClass]="getStatusClass(req)">
                  <td style="text-align: center; color: #888; font-weight: 600;">{{ i + 1 }}</td>
                  <td>
                    <a [href]="'/members/member/' + req.member.username">{{ req.member.firstname }} {{ req.member.lastname }}</a>
                    <i *ngIf="req.joinedDuringYear" class="fa fa-sign-in text-success status-icon" [title]="'Joined during ' + selectedYear"></i>
                    <i *ngIf="req.leftDuringYear" class="fa fa-sign-out text-warning status-icon" [title]="'Left during ' + selectedYear"></i>
                  </td>
                  <td>
                    <span (click)="goToResults({members:[{username: req.member.username}], year: selectedYear})"
                          class="hoverhand"
                          [ngClass]="req.meetsRaceRequirement ? 'text-success' : 'text-danger'">
                      <i class="fa" [ngClass]="req.meetsRaceRequirement ? 'fa-check-circle' : 'fa-times-circle'"></i>
                      {{ req.raceCount }}
                    </span>
                  </td>
                  <td>
                    <span [ngClass]="req.meetsAgeGradeRequirement ? 'text-success' : 'text-danger'">
                      <i class="fa" [ngClass]="req.meetsAgeGradeRequirement ? 'fa-check-circle' : 'fa-times-circle'"></i>
                      {{ req.maxAgeGrade | number:'1.2-2' }}%
                    </span>
                  </td>
                  <td>
                    <span *ngIf="req.volunteerJobCount > 0" class="hoverhand text-primary">
                      {{ req.volunteerJobCount }}
                    </span>
                    <span *ngIf="req.volunteerJobCount === 0">0</span>
                  </td>
                  <td>
                    <span class="status-badge" [ngClass]="getStatusClass(req)">{{ getStatusText(req) }}</span>
                    <span *ngIf="req.volunteerJobCount > 0" class="text-muted">
                      ({{ req.raceCount }} + {{ req.volunteerJobCount }} = {{ req.raceCount + req.volunteerJobCount }})
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `
})
export class RequirementsComponent implements OnInit {
  yearsList: number[] = [];
  selectedYear: number;
  reqConfig: any;
  loading = true;
  requirementsList: any[] = [];
  sortedRequirements: any[] = [];
  summaryStats: any = null;
  sortByField = 'statusValue';
  sortReverse = true;

  constructor(
    private authStateService: AuthStateService,
    private volunteerJobsService: VolunteerJobsService,
    private resultsService: ResultsService,
    private membersService: MembersService
  ) {
    const currentYear = new Date().getFullYear();
    for (let i = currentYear; i >= 2013; i--) {
      this.yearsList.push(i);
    }
    this.selectedYear = currentYear;
    this.reqConfig = getTeamRequirementsForYear(currentYear);
  }

  ngOnInit(): void {
    this.loadRequirements();
  }

  onYearChange(): void {
    this.loadRequirements();
  }

  private async loadRequirements(): Promise<void> {
    this.loading = true;
    this.reqConfig = getTeamRequirementsForYear(this.selectedYear);

    try {
      const [members, races, volunteerJobs] = await Promise.all([
        this.membersService.getMembersWithCacheSupport({ select: '-bio -personalBests' }),
        this.resultsService.getRaceResultsWithCacheSupport({ sort: '-racedate -order racename', preload: false }),
        this.volunteerJobsService.getVolunteerJobsWithCacheSupport({ sort: '-jobDate' })
      ]);

      const data = this.buildRequirements(members, races, volunteerJobs, this.selectedYear);
      data.forEach((req: any) => { req.statusValue = this.calculateStatusValue(req); });
      this.requirementsList = data;
      this.calculateSummaryStats();
      this.applySorting();
    } catch (e) {
      console.error('Error loading requirements:', e);
    }
    this.loading = false;
  }

  private buildRequirements(members: any[], races: any[], volunteerJobs: any[], year: number): any[] {
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

    const memberRaceStats: Record<string, { raceCount: number; maxAgeGrade: number }> = {};
    races.forEach((race: any) => {
      const raceDate = new Date(race.racedate);
      if (raceDate < yearStart || raceDate >= yearEnd) return;
      (race.results || []).forEach((result: any) => {
        (result.members || []).forEach((m: any) => {
          const id = String(m._id);
          if (!memberRaceStats[id]) memberRaceStats[id] = { raceCount: 0, maxAgeGrade: 0 };
          memberRaceStats[id].raceCount++;
          const ag = result.agegrade || 0;
          if (ag > memberRaceStats[id].maxAgeGrade) memberRaceStats[id].maxAgeGrade = ag;
        });
      });
    });

    const memberVolunteerCount: Record<string, number> = {};
    (volunteerJobs || []).forEach((job: any) => {
      const jobDate = new Date(job.jobDate);
      if (jobDate < yearStart || jobDate >= yearEnd) return;
      const id = job.member && job.member._id ? String(job.member._id) : null;
      if (!id) return;
      memberVolunteerCount[id] = (memberVolunteerCount[id] || 0) + 1;
    });

    const data: any[] = [];
    members.forEach((member: any) => {
      if (!member.membershipDates || member.membershipDates.length === 0) return;
      const isActive = member.membershipDates.some((period: any) => {
        const periodStart = new Date(period.start);
        const periodEnd = period.end ? new Date(period.end) : new Date(9999, 11, 31);
        return periodStart < yearEnd && periodEnd >= yearStart;
      });
      if (!isActive) return;

      const id = String(member._id);
      const stats = memberRaceStats[id] || { raceCount: 0, maxAgeGrade: 0 };
      const volunteerJobCount = memberVolunteerCount[id] || 0;
      const meetsRaceRequirement = (stats.raceCount + volunteerJobCount) >= this.reqConfig.minRaceAndVolunteerCount;
      const meetsAgeGradeRequirement = stats.maxAgeGrade >= this.reqConfig.minAgeGrade;

      const joinedDuringYear = member.membershipDates.some((p: any) => {
        const ps = new Date(p.start);
        return ps >= yearStart && ps < yearEnd;
      });
      const leftDuringYear = member.membershipDates.some((p: any) => {
        if (!p.end) return false;
        const pe = new Date(p.end);
        return pe >= yearStart && pe < yearEnd;
      });

      data.push({
        member: { _id: member._id, firstname: member.firstname, lastname: member.lastname, username: member.username },
        raceCount: stats.raceCount,
        maxAgeGrade: stats.maxAgeGrade,
        volunteerJobCount,
        meetsRaceRequirement,
        meetsAgeGradeRequirement,
        meetsAllRequirements: meetsRaceRequirement && meetsAgeGradeRequirement,
        joinedDuringYear,
        leftDuringYear
      });
    });

    return data;
  }

  private calculateSummaryStats(): void {
    if (!this.requirementsList || this.requirementsList.length === 0) {
      this.summaryStats = { total: 0, complete: 0, percentage: '0.0', avgRaces: '0.0', avgVolunteer: '0.0' };
      return;
    }
    const total = this.requirementsList.length;
    const complete = this.requirementsList.filter(r => r.meetsAllRequirements).length;
    const totalRaces = this.requirementsList.reduce((sum: number, r: any) => sum + r.raceCount, 0);
    const totalVolunteer = this.requirementsList.reduce((sum: number, r: any) => sum + r.volunteerJobCount, 0);
    this.summaryStats = {
      total,
      complete,
      percentage: ((complete / total) * 100).toFixed(1),
      avgRaces: (totalRaces / total).toFixed(1),
      avgVolunteer: (totalVolunteer / total).toFixed(1)
    };
  }

  private calculateStatusValue(req: any): number {
    if (req.meetsAllRequirements) return 2;
    if (req.meetsRaceRequirement || req.meetsAgeGradeRequirement) return 1;
    return 0;
  }

  getStatusClass(req: any): string {
    if (req.meetsAllRequirements) return 'status-complete';
    if (req.meetsRaceRequirement || req.meetsAgeGradeRequirement) return 'status-partial';
    return 'status-incomplete';
  }

  getStatusText(req: any): string {
    if (req.meetsAllRequirements) return 'Complete';
    const met = [req.meetsRaceRequirement, req.meetsAgeGradeRequirement].filter(Boolean).length;
    if (met === 0) return 'Incomplete (0/2)';
    return 'Partial (' + met + '/2)';
  }

  setSortBy(field: string): void {
    if (this.sortByField === field) {
      this.sortReverse = !this.sortReverse;
    } else {
      this.sortByField = field;
      this.sortReverse = field === 'statusValue' || field === 'raceCount' || field === 'maxAgeGrade' || field === 'volunteerJobCount';
    }
    this.applySorting();
  }

  private applySorting(): void {
    const arr = [...this.requirementsList];
    arr.sort((a, b) => {
      let valA: any, valB: any;
      if (this.sortByField === 'member.lastname') {
        valA = (a.member.lastname || '').toLowerCase();
        valB = (b.member.lastname || '').toLowerCase();
      } else {
        valA = a[this.sortByField];
        valB = b[this.sortByField];
      }
      let cmp = 0;
      if (valA < valB) cmp = -1;
      else if (valA > valB) cmp = 1;
      return this.sortReverse ? -cmp : cmp;
    });
    this.sortedRequirements = arr;
  }

  goToResults(queryParams: any): void {
    const cleaned: any = {};
    Object.keys(queryParams).forEach(key => {
      if (queryParams[key] !== null && queryParams[key] !== undefined && queryParams[key] !== '') {
        cleaned[key] = queryParams[key];
      }
    });
    window.location.href = '/results?search=' + encodeURIComponent(JSON.stringify(cleaned));
  }
}
