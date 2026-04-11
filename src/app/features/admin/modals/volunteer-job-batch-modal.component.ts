import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MemberSearchComponent } from '../../../shared/components/member-search/member-search.component';

@Component({
  selector: 'app-volunteer-job-batch-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MemberSearchComponent],
  template: `
    <div class="modal-backdrop fade in" *ngIf="visible" (click)="cancel()"></div>
    <div class="modal fade in" *ngIf="visible" style="display: block;" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <button type="button" class="close" (click)="cancel()">&times;</button>
            <h4 class="modal-title">Batch Add Volunteer Jobs</h4>
          </div>
          <div class="modal-body">
            <form>
              <div class="row">
                <div class="col-md-6">
                  <div class="form-group">
                    <label>Event Name <span class="text-danger">*</span></label>
                    <input type="text" class="form-control" [(ngModel)]="eventName" name="eventName" required>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="form-group">
                    <label>Job Date <span class="text-danger">*</span></label>
                    <input type="date" class="form-control" [(ngModel)]="jobDate" name="jobDate" required>
                  </div>
                </div>
              </div>

              <hr>

              <h5>Volunteers ({{rows.length}})</h5>

              <div *ngFor="let row of rows; let i = index" class="row" style="margin-bottom: 10px;">
                <div class="col-md-5">
                  <app-member-search
                    [members]="membersList"
                    placeholder="Search for a member..."
                    (memberSelected)="onRowMemberSelected(i, $event)">
                  </app-member-search>
                  <small *ngIf="row.member" class="text-muted">Selected: {{ row.member.firstname }} {{ row.member.lastname }}</small>
                </div>
                <div class="col-md-5">
                  <input type="text" class="form-control" [(ngModel)]="row.description" [name]="'desc' + i" placeholder="Description">
                </div>
                <div class="col-md-2">
                  <button class="btn btn-danger btn-sm" (click)="removeRow(i)" [disabled]="rows.length <= 1">
                    <i class="fa fa-times"></i> Remove
                  </button>
                </div>
              </div>

              <button class="btn btn-default btn-sm" (click)="addRow()">
                <i class="fa fa-plus"></i> Add Another Volunteer
              </button>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-default" (click)="cancel()">Cancel</button>
            <button class="btn btn-primary" (click)="save()" [disabled]="!isFormValid()">Save</button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class VolunteerJobBatchModalComponent implements OnChanges {
  @Input() visible = false;
  @Input() membersList: any[] = [];
  @Input() prefillData: any = null;
  @Output() saved = new EventEmitter<any>();
  @Output() cancelled = new EventEmitter<void>();

  eventName = '';
  jobDate = '';
  rows: { member: any; description: string; memberSearchQuery: string }[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible) {
      this.initForm();
    }
  }

  private initForm(): void {
    if (this.prefillData) {
      this.eventName = this.prefillData.eventName || '';
      this.jobDate = this.prefillData.jobDate ? this.toDateStr(this.prefillData.jobDate) : this.toDateStr(new Date());
    } else {
      this.eventName = '';
      this.jobDate = this.toDateStr(new Date());
    }
    this.rows = [{ member: null, description: '', memberSearchQuery: '' }];
  }

  private toDateStr(d: any): string {
    if (!d) return '';
    const date = new Date(d);
    return date.toISOString().split('T')[0];
  }

  onRowMemberSelected(index: number, member: any): void {
    this.rows[index].member = member;
    this.rows[index].memberSearchQuery = member.firstname + ' ' + member.lastname;
  }

  addRow(): void {
    this.rows.push({ member: null, description: '', memberSearchQuery: '' });
  }

  removeRow(index: number): void {
    if (this.rows.length > 1) {
      this.rows.splice(index, 1);
    }
  }

  isFormValid(): boolean {
    if (!this.eventName || !this.jobDate) return false;
    return this.rows.every(r => r.member && r.description);
  }

  save(): void {
    if (!this.isFormValid()) return;
    this.saved.emit({
      eventName: this.eventName,
      jobDate: new Date(this.jobDate + 'T00:00:00'),
      jobs: this.rows.map(r => ({
        memberId: r.member._id,
        description: r.description
      }))
    });
  }

  cancel(): void {
    this.cancelled.emit();
  }
}
