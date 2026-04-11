import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { VolunteerJobsService } from '../../../core/services/volunteer-jobs.service';
import { MembersService } from '../../../core/services/members.service';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { NotificationService } from '../../../core/services/notification.service';
import { VolunteerJobBatchModalComponent } from '../modals/volunteer-job-batch-modal.component';
import { VolunteerJobEditModalComponent } from '../modals/volunteer-job-edit-modal.component';

@Component({
  selector: 'app-volunteer-jobs',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    VolunteerJobBatchModalComponent,
    VolunteerJobEditModalComponent
  ],
  template: `
    <div class="jumbotron">
      <h2><i class="fa fa-handshake-o"></i> Volunteer Jobs</h2>
      <div class="row" style="margin-bottom: 15px;">
        <div class="col-md-3">
          <select class="form-control" [(ngModel)]="selectedYear" (ngModelChange)="updateFilteredJobs()">
            <option *ngFor="let year of yearsList" [ngValue]="year">{{year}}</option>
          </select>
        </div>
        <div class="col-md-5">
          <input type="text" class="form-control" placeholder="Search..." [(ngModel)]="searchQuery" (ngModelChange)="updateFilteredJobs()">
        </div>
        <div class="col-md-4 text-right">
          <button class="btn btn-primary" (click)="showAddModal()"><i class="fa fa-plus"></i> Add Volunteer Jobs</button>
        </div>
      </div>
      <table class="table table-striped table-hover">
        <thead>
          <tr>
            <th>Date</th>
            <th>Event</th>
            <th>Member</th>
            <th>Description</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let job of filteredJobsList">
            <td>{{formatDate(job.jobDate)}}</td>
            <td>{{job.eventName}}</td>
            <td><a [routerLink]="['/members', job.member?._id]">{{job.member?.firstname}} {{job.member?.lastname}}</a></td>
            <td>{{job.description}}</td>
            <td>
              <button class="btn btn-xs btn-default" (click)="duplicateJob(job)" title="Duplicate"><i class="fa fa-copy"></i></button>
              <button class="btn btn-xs btn-default" (click)="editJob(job)" title="Edit"><i class="fa fa-pencil"></i></button>
              <button class="btn btn-xs btn-danger" (click)="removeJob(job)" title="Delete"><i class="fa fa-trash"></i></button>
            </td>
          </tr>
        </tbody>
      </table>
      <app-volunteer-job-batch-modal
        [visible]="showBatchModal"
        [membersList]="membersList"
        [prefillData]="prefillData"
        (saved)="onBatchSaved($event)"
        (cancelled)="onBatchCancelled()">
      </app-volunteer-job-batch-modal>
      <app-volunteer-job-edit-modal
        [job]="editingJob"
        [visible]="showEditModal"
        [membersList]="membersList"
        (saved)="onEditSaved($event)"
        (cancelled)="onEditCancelled()">
      </app-volunteer-job-edit-modal>
    </div>
  `
})
export class VolunteerJobsComponent implements OnInit {
  volunteerJobsList: any[] = [];
  membersList: any[] = [];
  yearsList: (string | number)[] = ['All'];
  selectedYear: string | number = new Date().getFullYear();
  searchQuery = '';

  showBatchModal = false;
  showEditModal = false;
  editingJob: any = null;
  prefillData: any = null;

  filteredJobsList: any[] = [];

  user: any;

  constructor(
    private volunteerJobsService: VolunteerJobsService,
    private membersService: MembersService,
    private authStateService: AuthStateService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.user = this.authStateService.currentUser;
    this.loadVolunteerJobs();
    this.loadMembers();
  }

  private async loadVolunteerJobs(): Promise<void> {
    try {
      this.volunteerJobsList = await this.volunteerJobsService.getVolunteerJobsWithCacheSupport({ sort: '-jobDate' });
      this.buildYearsList(this.volunteerJobsList);
      this.updateFilteredJobs();
    } catch (err) {
      console.error('Error loading volunteer jobs:', err);
      this.notificationService.showNotifiction(false, 'Error loading volunteer jobs');
    }
  }

  private async loadMembers(): Promise<void> {
    try {
      const members = await this.membersService.getMembersWithCacheSupport({});
      this.membersList = members.sort((a: any, b: any) => {
        // Current members first (isCurrent true before false/undefined)
        if (a.isCurrent && !b.isCurrent) return -1;
        if (!a.isCurrent && b.isCurrent) return 1;
        // Then by lastname, firstname
        const lastCompare = (a.lastname || '').localeCompare(b.lastname || '');
        if (lastCompare !== 0) return lastCompare;
        return (a.firstname || '').localeCompare(b.firstname || '');
      });
    } catch (err) {
      console.error('Error loading members:', err);
      this.notificationService.showNotifiction(false, 'Error loading members');
    }
  }

  buildYearsList(jobs: any[]): void {
    const yearsSet = new Set<number>();
    const currentYear = new Date().getFullYear();
    yearsSet.add(currentYear);

    jobs.forEach(job => {
      if (job.jobDate) {
        const year = new Date(job.jobDate).getUTCFullYear();
        yearsSet.add(year);
      }
    });

    const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);
    this.yearsList = ['All', ...sortedYears];
  }

  updateFilteredJobs(): void {
    let filtered = this.volunteerJobsList;

    // Filter by year
    if (this.selectedYear !== 'All') {
      const year = Number(this.selectedYear);
      filtered = filtered.filter(job => {
        if (!job.jobDate) return false;
        return new Date(job.jobDate).getUTCFullYear() === year;
      });
    }

    // Filter by search query
    if (this.searchQuery && this.searchQuery.trim()) {
      const query = this.searchQuery.trim().toLowerCase();
      filtered = filtered.filter(job => {
        const memberName = job.member
          ? ((job.member.firstname || '') + ' ' + (job.member.lastname || '')).toLowerCase()
          : '';
        const eventName = (job.eventName || '').toLowerCase();
        const description = (job.description || '').toLowerCase();
        return memberName.includes(query) || eventName.includes(query) || description.includes(query);
      });
    }

    this.filteredJobsList = filtered;
  }

  showAddModal(): void {
    this.prefillData = null;
    this.showBatchModal = true;
  }

  duplicateJob(job: any): void {
    this.prefillData = { eventName: job.eventName, jobDate: job.jobDate };
    this.showBatchModal = true;
  }

  editJob(job: any): void {
    this.editingJob = job;
    this.showEditModal = true;
  }

  async onBatchSaved(data: any): Promise<void> {
    try {
      for (const job of data.jobs) {
        const created = await this.volunteerJobsService.createVolunteerJob({
          member: job.memberId,
          eventName: data.eventName,
          jobDate: data.jobDate,
          description: job.description
        });
        this.volunteerJobsList.push(created);
      }
      this.buildYearsList(this.volunteerJobsList);
      this.updateFilteredJobs();
      this.showBatchModal = false;
      this.notificationService.showNotifiction(true, 'Volunteer jobs added successfully');
    } catch (err) {
      console.error('Error adding volunteer jobs:', err);
      this.notificationService.showNotifiction(false, 'Error adding volunteer jobs');
    }
  }

  async onEditSaved(data: any): Promise<void> {
    try {
      const updated = await this.volunteerJobsService.editVolunteerJob(this.editingJob._id, data);
      const index = this.volunteerJobsList.findIndex(j => j._id === this.editingJob._id);
      if (index !== -1) {
        this.volunteerJobsList[index] = updated;
      }
      this.showEditModal = false;
      this.editingJob = null;
      this.updateFilteredJobs();
      this.notificationService.showNotifiction(true, 'Volunteer job updated successfully');
    } catch (err) {
      console.error('Error updating volunteer job:', err);
      this.notificationService.showNotifiction(false, 'Error updating volunteer job');
    }
  }

  onBatchCancelled(): void {
    this.showBatchModal = false;
  }

  onEditCancelled(): void {
    this.showEditModal = false;
    this.editingJob = null;
  }

  async removeJob(job: any): Promise<void> {
    if (!window.confirm('Are you sure you want to delete this volunteer job?')) {
      return;
    }
    try {
      await this.volunteerJobsService.deleteVolunteerJob(job._id);
      const index = this.volunteerJobsList.indexOf(job);
      if (index !== -1) {
        this.volunteerJobsList.splice(index, 1);
      }
      this.updateFilteredJobs();
      this.notificationService.showNotifiction(true, 'Volunteer job deleted successfully');
    } catch (err) {
      console.error('Error deleting volunteer job:', err);
      this.notificationService.showNotifiction(false, 'Error deleting volunteer job');
    }
  }

  formatDate(d: any): string {
    if (!d) return '';
    return new Date(d).toISOString().split('T')[0];
  }
}
