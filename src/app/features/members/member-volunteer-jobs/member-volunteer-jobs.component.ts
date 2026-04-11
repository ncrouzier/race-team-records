import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MembersService } from '../../../core/services/members.service';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { MemberNavComponent } from '../member-nav/member-nav.component';

@Component({
  selector: 'app-member-volunteer-jobs',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MemberNavComponent],
  template: `
    <app-member-nav *ngIf="currentMember" [member]="currentMember" activeTab="volunteer-jobs" [user]="user"></app-member-nav>

    <div class="jumbotron" *ngIf="currentMember">
      <div *ngIf="loading" class="text-center" style="padding: 40px;">
        <i class="fa fa-spinner fa-spin fa-2x"></i>
        <p>Loading volunteer jobs...</p>
      </div>

      <div *ngIf="!loading && !authorized" class="text-center text-muted" style="padding: 40px;">
        <i class="fa fa-lock fa-2x"></i>
        <p>You are not authorized to view this page.</p>
      </div>

      <div *ngIf="!loading && authorized">
        <h3><i class="fa fa-heart"></i> {{ currentMember.firstname }}'s Volunteer Jobs ({{ getFilteredCount() }})</h3>

        <div class="row" style="margin-bottom: 15px;">
          <div class="col-md-3">
            <label>Year:</label>
            <select class="form-control" [(ngModel)]="selectedYear" (ngModelChange)="onFilterChange()">
              <option *ngFor="let y of yearsList" [ngValue]="y">{{ y }}</option>
            </select>
          </div>
          <div class="col-md-4">
            <label>Search:</label>
            <input type="text" class="form-control" [(ngModel)]="searchQuery" placeholder="Search jobs...">
          </div>
        </div>

        <div *ngIf="getFilteredJobs().length === 0" class="text-muted text-center" style="padding: 20px;">
          No volunteer jobs found.
        </div>

        <table class="table table-striped" *ngIf="getFilteredJobs().length > 0">
          <thead>
            <tr>
              <th>Date</th>
              <th>Event</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let job of getFilteredJobs()">
              <td>{{ job.jobDate | date:'M/d/y':'UTC' }}</td>
              <td>{{ job.eventName }}</td>
              <td>{{ job.description }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class MemberVolunteerJobsComponent implements OnInit {
  currentMember: any = null;
  volunteerJobsList: any[] = [];
  loading = true;
  authorized = false;
  user: any = null;
  yearsList: (string | number)[] = ['All'];
  selectedYear: string | number = new Date().getFullYear();
  searchQuery = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private membersService: MembersService,
    private authStateService: AuthStateService
  ) {}

  ngOnInit(): void {
    this.user = this.authStateService.currentUser;
    this.loadData();
  }

  private async loadData(): Promise<void> {
    const username = this.route.snapshot.paramMap.get('member');
    if (!username) { this.router.navigate(['/members']); return; }

    try {
      const allMembers = await this.membersService.getMembersWithCacheSupport();
      const member = allMembers.find((m: any) => m.username === username);
      if (!member) { this.router.navigate(['/members']); return; }

      const fullMember = await this.membersService.getMember(member._id);
      this.currentMember = fullMember;

      if (!this.isAuthorized(this.user, fullMember)) {
        this.authorized = false;
        this.loading = false;
        return;
      }
      this.authorized = true;

      const jobs: any = await this.http.get('/api/members/' + fullMember._id + '/volunteerjobs').toPromise();
      this.volunteerJobsList = jobs || [];
      this.buildYearsList(this.volunteerJobsList);
      this.loading = false;
    } catch (e) {
      console.error('Error loading volunteer jobs:', e);
      this.router.navigate(['/members']);
    }
  }

  private isAuthorized(user: any, member: any): boolean {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'captain') return true;
    return !!(user.member?._id && member && user.member._id === member._id);
  }

  private buildYearsList(jobs: any[]): void {
    const yearsSet: Record<number, boolean> = {};
    jobs.forEach((job: any) => {
      yearsSet[new Date(job.jobDate).getUTCFullYear()] = true;
    });
    const years = Object.keys(yearsSet).map(Number).sort((a, b) => b - a);
    this.yearsList = ['All', ...years];
    if (typeof this.selectedYear === 'number' && years.indexOf(this.selectedYear) === -1) {
      this.selectedYear = years.length > 0 ? years[0] : 'All';
    }
  }

  onFilterChange(): void {}

  getFilteredJobs(): any[] {
    return this.volunteerJobsList.filter(job => {
      if (this.selectedYear !== 'All') {
        if (new Date(job.jobDate).getUTCFullYear() !== this.selectedYear) return false;
      }
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        const eventName = (job.eventName || '').toLowerCase();
        const description = (job.description || '').toLowerCase();
        if (!eventName.includes(q) && !description.includes(q)) return false;
      }
      return true;
    });
  }

  getFilteredCount(): number {
    return this.getFilteredJobs().length;
  }
}
