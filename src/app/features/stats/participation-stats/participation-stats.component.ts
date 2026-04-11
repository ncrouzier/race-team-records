import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StatsNavComponent } from '../stats-nav/stats-nav.component';
import { StatsService } from '../../../core/services/stats.service';
import { ResultsService } from '../../../core/services/results.service';
import { UtilsService } from '../../../core/services/utils.service';

@Component({
  selector: 'app-participation-stats',
  standalone: true,
  imports: [CommonModule, FormsModule, StatsNavComponent],
  template: `
    <div class="jumbotron">
      <app-stats-nav></app-stats-nav>

      <div class="participation-header">
        <div class="row">
          <div class="col-md-8">
            <h2><i class="fa fa-users"></i> Participation Statistics</h2>
            <p class="text-muted">Track team member participation and performance over time</p>
          </div>
          <div class="col-md-4 text-right">
            <div class="stats-summary">
              <div class="stat-item">
                <span class="stat-number">{{ participationStats.length }}</span>
                <span class="stat-label">Members</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="date-range-panel">
        <div class="panel panel-default">
          <div class="panel-heading"><h4><i class="fa fa-calendar"></i> Date Range</h4></div>
          <div class="panel-body">
            <div class="row">
              <div class="col-md-4">
                <label class="control-label">From:</label>
                <input type="date" class="form-control" [(ngModel)]="startDateStr" (change)="onDateChange()">
              </div>
              <div class="col-md-4">
                <label class="control-label">To:</label>
                <input type="date" class="form-control" [(ngModel)]="endDateStr" (change)="onDateChange()">
              </div>
              <div class="col-md-4">
                <label class="control-label">&nbsp;</label>
                <div class="date-range-info">
                  <span class="text-muted"><i class="fa fa-info-circle"></i> Select date range to filter participation data</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div *ngIf="loading" class="text-center loading-container">
        <i class="fa fa-spinner fa-spin fa-3x text-primary"></i>
        <p class="loading-text">Loading participation statistics...</p>
      </div>

      <div *ngIf="!loading">
        <div class="participation-table-container">
          <div class="panel panel-default">
            <div class="panel-heading"><h4><i class="fa fa-list"></i> Member Participation Rankings</h4></div>
            <div class="panel-body" style="padding: 0;">
              <div class="table-responsive">
                <table class="table table-hover participation-table">
                  <thead>
                    <tr class="table-header">
                      <th class="rank-column">#</th>
                      <th class="member-column">
                        <a href="javascript:void(0)" (click)="setSortField('firstname')" class="sortable-header">
                          <i class="fa fa-user"></i> Member
                          <i *ngIf="sortField === 'firstname'" class="fa" [ngClass]="sortReverse ? 'fa-sort-desc' : 'fa-sort-asc'"></i>
                        </a>
                      </th>
                      <th class="age-column">
                        <a href="javascript:void(0)" (click)="setSortField('age')" class="sortable-header">
                          <i class="fa fa-birthday-cake"></i> Age
                          <i *ngIf="sortField === 'age'" class="fa" [ngClass]="sortReverse ? 'fa-sort-desc' : 'fa-sort-asc'"></i>
                        </a>
                      </th>
                      <th class="races-column">
                        <a href="javascript:void(0)" (click)="setSortField('numberofraces')" class="sortable-header">
                          <i class="fa fa-flag-checkered"></i> Races
                          <i *ngIf="sortField === 'numberofraces'" class="fa" [ngClass]="sortReverse ? 'fa-sort-desc' : 'fa-sort-asc'"></i>
                        </a>
                      </th>
                      <th class="agegrade-column">
                        <a href="javascript:void(0)" (click)="setSortField('max')" class="sortable-header">
                          <i class="fa fa-star"></i> Best AG%
                          <i *ngIf="sortField === 'max'" class="fa" [ngClass]="sortReverse ? 'fa-sort-desc' : 'fa-sort-asc'"></i>
                        </a>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let r of sortedStats; let i = index" class="member-row"
                        [ngClass]="r.memberStatus === 'past' ? 'past-member-row' : 'active-member-row'">
                      <td class="rank-cell"><span class="rank-number">{{ i + 1 }}</span></td>
                      <td class="member-cell">
                        <a [href]="'/members/member/' + r.username"
                           [ngClass]="r.memberStatus === 'past' ? 'past-member-link' : 'active-member-link'"
                           class="member-link">{{ r.firstname }} {{ r.lastname }}</a>
                      </td>
                      <td class="age-cell"><span class="age-value">{{ getAge(r) }}</span></td>
                      <td class="races-cell"><span class="races-count">{{ r.numberofraces }}</span></td>
                      <td class="agegrade-cell">
                        <span class="agegrade-value hoverhandandunderline resultEvent" (click)="showRaceFromId(r.maxRaceId)">
                          {{ r.max }}%
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ParticipationStatsComponent implements OnInit {
  loading = true;
  participationStats: any[] = [];
  sortedStats: any[] = [];
  sortField = 'firstname';
  sortReverse = false;
  startDateStr: string;
  endDateStr: string;

  constructor(
    private statsService: StatsService,
    private utilsService: UtilsService,
    private resultsService: ResultsService
  ) {
    const now = new Date();
    const startOfYear = new Date(Date.UTC(now.getFullYear(), 0, 1));
    this.startDateStr = this.toDateStr(startOfYear);
    this.endDateStr = this.toDateStr(now);
  }

  ngOnInit(): void {
    this.loadData();
  }

  onDateChange(): void {
    this.loadData();
  }

  private async loadData(): Promise<void> {
    this.loading = true;
    try {
      const start = new Date(this.startDateStr + 'T00:00:00Z');
      const end = new Date(this.endDateStr + 'T00:00:00Z');
      this.participationStats = await this.statsService.getParticipationStats(start, end);
      this.applySorting();
    } catch (e) {
      console.error('Error loading participation stats:', e);
    }
    this.loading = false;
  }

  setSortField(field: string): void {
    if (this.sortField === field) {
      this.sortReverse = !this.sortReverse;
    } else {
      this.sortField = field;
      this.sortReverse = false;
    }
    this.applySorting();
  }

  private applySorting(): void {
    const arr = [...this.participationStats];
    arr.sort((a, b) => {
      let valA = a[this.sortField];
      let valB = b[this.sortField];
      if (this.sortField === 'age') {
        valA = this.getAge(a);
        valB = this.getAge(b);
      }
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      let cmp = 0;
      if (valA < valB) cmp = -1;
      else if (valA > valB) cmp = 1;
      return this.sortReverse ? -cmp : cmp;
    });
    this.sortedStats = arr;
  }

  getAge(member: any): number {
    if (!member.dateofbirth) return 0;
    return this.utilsService.calculateAge(member.dateofbirth);
  }

  showRaceFromId(raceId: string): void {
    if (raceId) {
      this.resultsService.showRaceFromRaceIdModal(raceId);
    }
  }

  private toDateStr(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
