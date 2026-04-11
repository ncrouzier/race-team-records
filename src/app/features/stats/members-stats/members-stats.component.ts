import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StatsNavComponent } from '../stats-nav/stats-nav.component';
import { StatsService } from '../../../core/services/stats.service';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { UtilsService } from '../../../core/services/utils.service';

@Component({
  selector: 'app-members-stats',
  standalone: true,
  imports: [CommonModule, FormsModule, StatsNavComponent],
  template: `
    <div class="jumbotron">
      <app-stats-nav></app-stats-nav>

      <div class="members-header">
        <div class="row">
          <div class="col-md-8">
            <h2><i class="fa fa-users"></i> Team Members Statistics</h2>
            <p class="text-muted">View and manage team member information and upcoming birthdays</p>
          </div>
          <div class="col-md-4 text-right">
            <div class="stats-summary">
              <div class="stat-item">
                <span class="stat-number">{{ membersList.length }}</span>
                <span class="stat-label">Total Members</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div *ngIf="loading" class="text-center loading-container">
        <i class="fa fa-spinner fa-spin fa-3x text-primary"></i>
        <p class="loading-text">Loading team members statistics...</p>
      </div>

      <div *ngIf="!loading">
        <div class="birthdays-panel">
          <div class="panel panel-default">
            <div class="panel-heading"><h4><i class="fa fa-birthday-cake"></i> Upcoming Birthdays</h4></div>
            <div class="panel-body">
              <div class="birthdays-list">
                <div *ngFor="let m of upcomingBirthdays" class="birthday-item">
                  <i class="fa fa-gift"></i>
                  <a class="member-link" [href]="'/members/member/' + m.username">{{ m.firstname }} {{ m.lastname }}</a>
                  <span class="birthday-info">
                    will be {{ getAge(m) + 1 }} on {{ m.dateofbirth | date:'MM/dd':'UTC' }}
                  </span>
                </div>
                <div *ngIf="upcomingBirthdays.length === 0" class="no-birthdays">
                  <i class="fa fa-info-circle"></i>
                  <span>No upcoming birthdays found</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="members-table-container">
          <div class="panel panel-default">
            <div class="panel-heading"><h4><i class="fa fa-list"></i> All Team Members</h4></div>
            <div class="panel-body" style="padding: 0;">
              <div class="table-responsive">
                <table class="table table-hover members-table">
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
                      <th class="dob-column">
                        <a href="javascript:void(0)" (click)="setSortField('dateofbirth')" class="sortable-header">
                          <i class="fa fa-calendar"></i> Date of Birth
                          <i *ngIf="sortField === 'dateofbirth'" class="fa" [ngClass]="sortReverse ? 'fa-sort-desc' : 'fa-sort-asc'"></i>
                        </a>
                      </th>
                      <th class="status-column">
                        <a href="javascript:void(0)" (click)="setSortField('memberStatus')" class="sortable-header">
                          <i class="fa fa-info-circle"></i> Status
                          <i *ngIf="sortField === 'memberStatus'" class="fa" [ngClass]="sortReverse ? 'fa-sort-desc' : 'fa-sort-asc'"></i>
                        </a>
                        <div class="status-filters">
                          <label class="status-filter"><input type="radio" name="statusFilter" value="" [(ngModel)]="statusFilter" (change)="applyFilter()"><span>All</span></label>
                          <label class="status-filter"><input type="radio" name="statusFilter" value="current" [(ngModel)]="statusFilter" (change)="applyFilter()"><span>Current</span></label>
                          <label class="status-filter"><input type="radio" name="statusFilter" value="past" [(ngModel)]="statusFilter" (change)="applyFilter()"><span>Past</span></label>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let m of sortedMembers; let i = index" class="member-row"
                        [ngClass]="(m.memberStatus === 'past' ? 'past-member-row' : 'active-member-row') + (isCurrentUser(m) ? ' my-member-row' : '')">
                      <td class="rank-cell"><span class="rank-number">{{ i + 1 }}</span></td>
                      <td class="member-cell">
                        <a [href]="'/members/member/' + m.username"
                           [ngClass]="m.memberStatus === 'past' ? 'past-member-link' : 'active-member-link'"
                           class="member-link">
                          <i class="fa fa-user-circle"></i> {{ m.firstname }} {{ m.lastname }}
                        </a>
                      </td>
                      <td class="age-cell"><span class="age-value">{{ getAge(m) }}</span></td>
                      <td class="dob-cell"><span class="dob-value">{{ m.dateofbirth | date:'yyyy-MM-dd':'UTC' }}</span></td>
                      <td class="status-cell">
                        <span class="status-badge" [ngClass]="m.memberStatus">{{ m.memberStatus }}</span>
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
export class MembersStatsComponent implements OnInit {
  loading = true;
  membersList: any[] = [];
  sortedMembers: any[] = [];
  upcomingBirthdays: any[] = [];
  sortField = 'firstname';
  sortReverse = false;
  statusFilter = 'current';

  constructor(
    private statsService: StatsService,
    private authStateService: AuthStateService,
    private utilsService: UtilsService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  private async loadData(): Promise<void> {
    this.loading = true;
    try {
      const data = await this.statsService.getAttendanceStats();
      this.membersList = data.members;
      this.computeBirthdays();
      this.applyFilter();
    } catch (e) {
      console.error('Error loading members stats:', e);
    }
    this.loading = false;
  }

  private computeBirthdays(): void {
    const now = new Date();
    const nowUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const nowUTCDate = new Date(nowUTC);
    const currentYear = now.getUTCFullYear();

    this.membersList.forEach((m: any) => {
      if (!m.dateofbirth) { m.fromNow = Infinity; return; }
      const dob = new Date(m.dateofbirth);
      const birthdayDate = new Date(Date.UTC(currentYear, dob.getUTCMonth(), dob.getUTCDate()));
      if (birthdayDate.getTime() < nowUTCDate.getTime()) {
        birthdayDate.setUTCFullYear(currentYear + 1);
      }
      m.fromNow = birthdayDate.getTime() - nowUTCDate.getTime();
    });

    this.upcomingBirthdays = this.membersList
      .filter((m: any) => m.memberStatus === 'current' && m.dateofbirth)
      .sort((a: any, b: any) => a.fromNow - b.fromNow)
      .slice(0, 5);
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

  applyFilter(): void {
    this.applySorting();
  }

  private applySorting(): void {
    let arr = [...this.membersList];
    if (this.statusFilter) {
      arr = arr.filter(m => m.memberStatus === this.statusFilter);
    }
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
    this.sortedMembers = arr;
  }

  getAge(member: any): number {
    if (!member.dateofbirth) return 0;
    return this.utilsService.calculateAge(member.dateofbirth);
  }

  isCurrentUser(member: any): boolean {
    const user = this.authStateService.currentUser;
    return user && user.member && user.member._id && member._id === user.member._id;
  }
}
