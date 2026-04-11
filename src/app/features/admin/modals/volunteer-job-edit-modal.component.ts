import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MemberSearchComponent } from '../../../shared/components/member-search/member-search.component';

@Component({
  selector: 'app-volunteer-job-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MemberSearchComponent],
  template: `
    <div class="modal-backdrop fade in" *ngIf="visible" (click)="cancel()"></div>
    <div class="modal fade in" *ngIf="visible" style="display: block;" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <button type="button" class="close" (click)="cancel()">&times;</button>
            <h4 class="modal-title">Edit Volunteer Job</h4>
          </div>
          <div class="modal-body">
            <form>
              <div class="form-group">
                <label>Member</label>
                <div *ngIf="selectedMember" style="margin-bottom: 5px;">
                  <span class="label label-default">
                    {{ selectedMember.firstname }} {{ selectedMember.lastname }}
                  </span>
                </div>
                <app-member-search
                  [members]="membersList"
                  placeholder="Search to change member..."
                  (memberSelected)="onMemberSelected($event)">
                </app-member-search>
              </div>
              <div class="form-group">
                <label>Event Name <span class="text-danger">*</span></label>
                <input type="text" class="form-control" [(ngModel)]="formData.eventName" name="eventName" required>
              </div>
              <div class="form-group">
                <label>Job Date <span class="text-danger">*</span></label>
                <input type="date" class="form-control" [(ngModel)]="formData.jobDate" name="jobDate" required>
              </div>
              <div class="form-group">
                <label>Description <span class="text-danger">*</span></label>
                <textarea class="form-control" [(ngModel)]="formData.description" name="description" rows="3" required></textarea>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-default" (click)="cancel()">Cancel</button>
            <button class="btn btn-primary" (click)="save()" [disabled]="!isFormValid()">Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class VolunteerJobEditModalComponent implements OnChanges {
  @Input() job: any = null;
  @Input() visible = false;
  @Input() membersList: any[] = [];
  @Output() saved = new EventEmitter<any>();
  @Output() cancelled = new EventEmitter<void>();

  formData: any = {};
  selectedMember: any = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible) {
      this.initForm();
    }
  }

  private initForm(): void {
    if (this.job) {
      this.formData = {
        eventName: this.job.eventName || '',
        jobDate: this.toDateStr(this.job.jobDate),
        description: this.job.description || ''
      };
      // Find the matching member from the members list
      if (this.job.member && this.membersList) {
        const memberId = this.job.member._id || this.job.member;
        this.selectedMember = this.membersList.find(m => m._id === memberId) || null;
      } else {
        this.selectedMember = null;
      }
    } else {
      this.formData = { eventName: '', jobDate: '', description: '' };
      this.selectedMember = null;
    }
  }

  private toDateStr(d: any): string {
    if (!d) return '';
    const date = new Date(d);
    return date.toISOString().split('T')[0];
  }

  onMemberSelected(member: any): void {
    this.selectedMember = member;
  }

  isFormValid(): boolean {
    return this.selectedMember && this.formData.eventName && this.formData.jobDate && this.formData.description;
  }

  save(): void {
    if (!this.isFormValid()) return;
    this.saved.emit({
      member: this.selectedMember._id,
      eventName: this.formData.eventName,
      jobDate: new Date(this.formData.jobDate + 'T00:00:00'),
      description: this.formData.description
    });
  }

  cancel(): void {
    this.cancelled.emit();
  }
}
