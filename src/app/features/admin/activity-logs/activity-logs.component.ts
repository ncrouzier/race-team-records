import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivityLogService } from '../../../core/services/activity-log.service';
import { ActivityLogDetailModalComponent } from '../modals/activity-log-detail-modal.component';

@Component({
  selector: 'app-activity-logs',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, ActivityLogDetailModalComponent],
  template: `
<div class="jumbotron">
  <h2><i class="fa fa-list-alt"></i> Activity Logs</h2>
  <div class="row" style="margin-bottom: 15px;">
    <div class="col-md-4">
      <select class="form-control" [(ngModel)]="actionFilter" (ngModelChange)="onFilterChange()">
        <option value="">All Actions</option>
        <option *ngFor="let action of actionTypes" [value]="action">{{action}}</option>
      </select>
    </div>
    <div class="col-md-4">
      <input type="text" class="form-control" placeholder="Search by username..." [(ngModel)]="usernameFilter" (ngModelChange)="onFilterChange()">
    </div>
    <div class="col-md-4 text-right">
      <span class="text-muted">{{total}} total logs</span>
    </div>
  </div>
  <table class="table table-striped table-hover">
    <thead>
      <tr>
        <th>Date</th>
        <th>User</th>
        <th>Action</th>
        <th>Description</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      <tr *ngFor="let log of logs">
        <td>{{log.createdAt | date:'yyyy-MM-dd HH:mm'}}</td>
        <td>{{log.username}}</td>
        <td><span class="label label-info">{{log.action}}</span></td>
        <td>{{log.description}}</td>
        <td>
          <button class="btn btn-xs btn-default" (click)="viewDetail(log)" title="View details"><i class="fa fa-eye"></i></button>
          <button class="btn btn-xs btn-danger" (click)="deleteLog(log)" title="Delete"><i class="fa fa-trash"></i></button>
        </td>
      </tr>
    </tbody>
  </table>
  <div class="text-center" *ngIf="pages > 1">
    <button class="btn btn-default" (click)="prevPage()" [disabled]="currentPage <= 1"><i class="fa fa-chevron-left"></i> Prev</button>
    <span style="margin: 0 10px;">Page {{currentPage}} of {{pages}}</span>
    <button class="btn btn-default" (click)="nextPage()" [disabled]="currentPage >= pages">Next <i class="fa fa-chevron-right"></i></button>
  </div>
  <app-activity-log-detail-modal [log]="selectedLog" [visible]="showDetailModal" (closed)="onDetailClosed()"></app-activity-log-detail-modal>
</div>
  `
})
export class ActivityLogsComponent implements OnInit {
  logs: any[] = [];
  total = 0;
  pages = 0;
  currentPage = 1;
  limit = 50;
  actionFilter = '';
  usernameFilter = '';
  actionTypes: string[] = [];
  selectedLog: any = null;
  showDetailModal = false;

  constructor(private activityLogService: ActivityLogService) {}

  async ngOnInit(): Promise<void> {
    try {
      this.actionTypes = await this.activityLogService.getActionTypes();
    } catch (err) {
      console.error('Error loading action types:', err);
    }
    await this.loadLogs();
  }

  async loadLogs(): Promise<void> {
    try {
      const response = await this.activityLogService.getLogs({
        page: this.currentPage,
        limit: this.limit,
        action: this.actionFilter,
        username: this.usernameFilter
      });
      this.logs = response.logs;
      this.total = response.total;
      this.pages = response.pages;
      this.currentPage = response.currentPage;
    } catch (err) {
      console.error('Error loading logs:', err);
    }
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadLogs();
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadLogs();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.pages) {
      this.currentPage++;
      this.loadLogs();
    }
  }

  viewDetail(log: any): void {
    this.selectedLog = log;
    this.showDetailModal = true;
  }

  onDetailClosed(): void {
    this.showDetailModal = false;
  }

  async deleteLog(log: any): Promise<void> {
    if (!window.confirm('Are you sure you want to delete this log entry?')) {
      return;
    }
    try {
      const result = await this.activityLogService.deleteLog(log._id);
      if (result) {
        await this.loadLogs();
      }
    } catch (err) {
      console.error('Error deleting log:', err);
    }
  }
}
