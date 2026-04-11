import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MemberSearchComponent } from '../../../shared/components/member-search/member-search.component';

@Component({
  selector: 'app-user-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MemberSearchComponent],
  template: `
    <div class="modal-backdrop fade in" *ngIf="visible" (click)="cancel()"></div>
    <div class="modal fade in" *ngIf="visible" style="display: block;" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <button type="button" class="close" (click)="cancel()">&times;</button>
            <h4 class="modal-title">Edit User</h4>
          </div>
          <div class="modal-body">
            <form>
              <div class="form-group">
                <label>Username</label>
                <input type="text" class="form-control" [(ngModel)]="formData.username" name="username" required readonly>
              </div>
              <div class="form-group">
                <label>Email</label>
                <input type="email" class="form-control" [(ngModel)]="formData.email" name="email" required>
              </div>
              <div class="form-group">
                <label>Role</label>
                <select class="form-control" [(ngModel)]="formData.role" name="role">
                  <option *ngFor="let r of roles" [value]="r">{{ r }}</option>
                </select>
              </div>
              <div class="form-group">
                <div class="checkbox">
                  <label>
                    <input type="checkbox" [(ngModel)]="formData.enabled" name="enabled">
                    Enabled
                  </label>
                </div>
              </div>
              <div class="form-group">
                <label>Associated Member</label>
                <app-member-search
                  [members]="membersList"
                  (memberSelected)="onMemberSelected($event)">
                </app-member-search>
                <p class="help-block" *ngIf="selectedMember">
                  Selected: {{ selectedMember.firstname }} {{ selectedMember.lastname }}
                </p>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-default" (click)="cancel()">Cancel</button>
            <button class="btn btn-primary" (click)="save()">Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class UserEditModalComponent implements OnChanges {
  @Input() user: any = null;
  @Input() visible = false;
  @Input() membersList: any[] = [];
  @Output() saved = new EventEmitter<any>();
  @Output() cancelled = new EventEmitter<void>();

  formData: any = {};
  selectedMember: any = null;
  searchQuery = '';
  roles: string[] = ['admin', 'captain', 'user'];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible) {
      this.initForm();
    }
  }

  private initForm(): void {
    if (this.user) {
      this.formData = {
        username: this.user.username || '',
        email: this.user.email || '',
        role: this.user.role || 'user',
        enabled: this.user.enabled !== undefined ? this.user.enabled : true
      };

      // Find matching member from membersList if user has an associated member
      if (this.user.member && this.user.member._id) {
        this.selectedMember = this.membersList.find(m => m._id === this.user.member._id) || null;
        if (this.selectedMember) {
          this.searchQuery = this.selectedMember.firstname + ' ' + this.selectedMember.lastname;
        }
      } else {
        this.selectedMember = null;
        this.searchQuery = '';
      }
    } else {
      this.formData = {
        username: '',
        email: '',
        role: 'user',
        enabled: true
      };
      this.selectedMember = null;
      this.searchQuery = '';
    }
  }

  onMemberSelected(member: any): void {
    this.selectedMember = member;
    this.searchQuery = member.firstname + ' ' + member.lastname;
  }

  save(): void {
    this.saved.emit({
      ...this.user,
      username: this.formData.username,
      email: this.formData.email,
      role: this.formData.role,
      enabled: this.formData.enabled,
      member: this.selectedMember?._id || null
    });
  }

  cancel(): void {
    this.cancelled.emit();
  }
}
