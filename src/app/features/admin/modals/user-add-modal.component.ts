import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MemberSearchComponent } from '../../../shared/components/member-search/member-search.component';

@Component({
  selector: 'app-user-add-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MemberSearchComponent],
  template: `
    <div class="modal-backdrop fade in" *ngIf="visible" (click)="cancel()"></div>
    <div class="modal fade in" *ngIf="visible" style="display: block;" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <button type="button" class="close" (click)="cancel()">&times;</button>
            <h4 class="modal-title">Add User</h4>
          </div>
          <div class="modal-body">
            <form>
              <div class="form-group">
                <label>Username</label>
                <input type="text" class="form-control" [(ngModel)]="formData.username" name="username" required>
              </div>
              <div class="form-group">
                <label>Email</label>
                <input type="email" class="form-control" [(ngModel)]="formData.email" name="email" required>
              </div>
              <div class="form-group">
                <label>Password</label>
                <input type="password" class="form-control" [(ngModel)]="formData.password" name="password"
                       required minlength="8" maxlength="64" #passwordField="ngModel">
                <p class="help-block text-danger" *ngIf="passwordField.errors?.['minlength'] && passwordField.touched">
                  Password must be at least 8 characters long.
                </p>
              </div>
              <div class="form-group">
                <label>Role</label>
                <select class="form-control" [(ngModel)]="formData.role" name="role">
                  <option *ngFor="let r of roles" [value]="r">{{ r }}</option>
                </select>
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
            <button class="btn btn-primary" (click)="save()">Add User</button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class UserAddModalComponent implements OnChanges {
  @Input() visible = false;
  @Input() membersList: any[] = [];
  @Output() saved = new EventEmitter<any>();
  @Output() cancelled = new EventEmitter<void>();

  formData: any = {};
  selectedMember: any = null;
  roles: string[] = ['admin', 'captain', 'user'];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible) {
      this.initForm();
    }
  }

  private initForm(): void {
    this.formData = {
      username: '',
      email: '',
      password: '',
      role: 'user'
    };
    this.selectedMember = null;
  }

  onMemberSelected(member: any): void {
    this.selectedMember = member;
  }

  save(): void {
    this.saved.emit({
      username: this.formData.username,
      email: this.formData.email,
      password: this.formData.password,
      role: this.formData.role,
      member: this.selectedMember?._id || null
    });
  }

  cancel(): void {
    this.cancelled.emit();
  }
}
