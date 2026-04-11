import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';

@Component({
  selector: 'app-activity-log-detail-modal',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <div class="modal-backdrop fade in" *ngIf="visible" (click)="close()"></div>
    <div class="modal fade in" *ngIf="visible" style="display: block;" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <button type="button" class="close" (click)="close()">&times;</button>
            <h4 class="modal-title">Activity Log Detail</h4>
          </div>
          <div class="modal-body" *ngIf="log">
            <table class="table table-bordered">
              <tbody>
                <tr>
                  <td><strong>Date</strong></td>
                  <td>{{ log.createdAt | date:'yyyy-MM-dd HH:mm:ss' }}</td>
                </tr>
                <tr>
                  <td><strong>User</strong></td>
                  <td>{{ log.user }}</td>
                </tr>
                <tr>
                  <td><strong>Action</strong></td>
                  <td><span class="label label-info">{{ log.action }}</span></td>
                </tr>
                <tr>
                  <td><strong>Description</strong></td>
                  <td>{{ log.description }}</td>
                </tr>
                <tr>
                  <td><strong>Target Type</strong></td>
                  <td>{{ log.targetType || '-' }}</td>
                </tr>
                <tr>
                  <td><strong>Target Name</strong></td>
                  <td>{{ log.targetName || '-' }}</td>
                </tr>
                <tr *ngIf="log.ipAddress">
                  <td><strong>IP Address</strong></td>
                  <td>{{ log.ipAddress }}</td>
                </tr>
                <tr *ngIf="log.metadata?.oldValue !== undefined">
                  <td><strong>Old Value</strong></td>
                  <td>
                    <ng-container *ngIf="log.action === 'bio_edit'">
                      <div *ngIf="log.metadata.oldValue" style="max-height: 300px; overflow-y: auto; padding: 10px; background-color: #fdf2f2; border-radius: 4px;" [innerHTML]="log.metadata.oldValue"></div>
                      <em *ngIf="!log.metadata.oldValue">empty</em>
                    </ng-container>
                    <ng-container *ngIf="log.action !== 'bio_edit'">
                      <span *ngIf="log.metadata.oldValue">{{ log.metadata.oldValue }}</span>
                      <em *ngIf="!log.metadata.oldValue">empty</em>
                    </ng-container>
                  </td>
                </tr>
                <tr *ngIf="log.metadata?.newValue !== undefined">
                  <td><strong>New Value</strong></td>
                  <td>
                    <ng-container *ngIf="log.action === 'bio_edit'">
                      <div *ngIf="log.metadata.newValue" style="max-height: 300px; overflow-y: auto; padding: 10px; background-color: #f2fdf3; border-radius: 4px;" [innerHTML]="log.metadata.newValue"></div>
                      <em *ngIf="!log.metadata.newValue">empty</em>
                    </ng-container>
                    <ng-container *ngIf="log.action !== 'bio_edit'">
                      <span *ngIf="log.metadata.newValue">{{ log.metadata.newValue }}</span>
                      <em *ngIf="!log.metadata.newValue">empty</em>
                    </ng-container>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="modal-footer">
            <button class="btn btn-default" (click)="close()">Close</button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ActivityLogDetailModalComponent {
  @Input() log: any = null;
  @Input() visible = false;
  @Output() closed = new EventEmitter<void>();

  close(): void {
    this.closed.emit();
  }
}
