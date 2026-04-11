import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="page-header text-center">
        <h1>My Account</h1>
        <a href="/logout" class="btn btn-default btn-sm">Logout</a>
      </div>

      <div class="row">
        <!-- PROFILE INFORMATION -->
        <div class="col-sm-6">
          <div class="panel panel-default">
            <div class="panel-heading">
              <h3 style="margin: 0;"><span class="fa fa-user"></span> Profile</h3>
            </div>
            <div class="panel-body">
              <!-- Display mode -->
              <div *ngIf="!editingProfile">
                <p>
                  <strong>Name</strong>: {{ user?.username }}<br>
                  <strong>Email</strong>: {{ user?.email }}<br>
                  <span *ngIf="user?.role"><strong>Role</strong>: {{ user.role }}</span>
                </p>
                <button class="btn btn-primary btn-sm" (click)="startEditProfile()">
                  <i class="fa fa-pencil"></i> Edit Profile
                </button>
              </div>

              <!-- Edit mode -->
              <div *ngIf="editingProfile">
                <div *ngIf="profileMessage" class="alert"
                     [ngClass]="{'alert-success': profileSuccess, 'alert-danger': !profileSuccess}">
                  {{ profileMessage }}
                </div>
                <form #editProfileForm="ngForm" (ngSubmit)="saveProfile()">
                  <div class="form-group" [class.has-error]="usernameField.invalid && !usernameField.pristine">
                    <label>Name</label>
                    <input type="text" class="form-control" name="username"
                           [(ngModel)]="editData.username" required #usernameField="ngModel">
                  </div>
                  <div class="form-group" [class.has-error]="emailField.invalid && !emailField.pristine">
                    <label>Email</label>
                    <input type="email" class="form-control" name="email"
                           [(ngModel)]="editData.email" required #emailField="ngModel">
                  </div>
                  <button type="submit" class="btn btn-success btn-sm" [disabled]="editProfileForm.invalid">
                    <i class="fa fa-check"></i> Save
                  </button>
                  <button type="button" class="btn btn-default btn-sm" (click)="cancelEditProfile()">
                    Cancel
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>

        <!-- CHANGE PASSWORD -->
        <div class="col-sm-6">
          <div class="panel panel-default">
            <div class="panel-heading">
              <h3 style="margin: 0;"><span class="fa fa-lock"></span> Change Password</h3>
            </div>
            <div class="panel-body">
              <div *ngIf="passwordMessage" class="alert"
                   [ngClass]="{'alert-success': passwordSuccess, 'alert-danger': !passwordSuccess}">
                {{ passwordMessage }}
              </div>
              <form #changePasswordForm="ngForm" (ngSubmit)="changePassword()">
                <div class="form-group">
                  <label>Current Password</label>
                  <input type="password" class="form-control" name="currentPassword"
                         [(ngModel)]="passwordData.currentPassword" required>
                </div>
                <div class="form-group" [class.has-error]="newPwField.dirty && newPwField.invalid">
                  <label>New Password</label>
                  <input type="password" class="form-control" name="newPassword"
                         [(ngModel)]="passwordData.newPassword" required
                         minlength="8" maxlength="64" #newPwField="ngModel">
                  <p class="help-block" *ngIf="newPwField.dirty && newPwField.errors?.['minlength']">
                    Password must be at least 8 characters.
                  </p>
                </div>
                <div class="form-group">
                  <label>Confirm New Password</label>
                  <input type="password" class="form-control" name="confirmPassword"
                         [(ngModel)]="passwordData.confirmPassword" required>
                </div>
                <div *ngIf="passwordData.newPassword && passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword"
                     class="alert alert-danger">
                  Passwords do not match.
                </div>
                <button type="submit" class="btn btn-warning btn-sm"
                        [disabled]="changePasswordForm.invalid || passwordData.newPassword !== passwordData.confirmPassword">
                  <i class="fa fa-key"></i> Change Password
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ProfileComponent implements OnInit {
  user: any = null;
  editingProfile = false;
  editData = { username: '', email: '' };
  passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
  profileMessage = '';
  profileSuccess = false;
  passwordMessage = '';
  passwordSuccess = false;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<any>('/api/profile').subscribe({
      next: (data) => { this.user = data.user; }
    });
  }

  startEditProfile(): void {
    this.editData = {
      username: this.user.username,
      email: this.user.email
    };
    this.profileMessage = '';
    this.editingProfile = true;
  }

  cancelEditProfile(): void {
    this.editingProfile = false;
    this.profileMessage = '';
  }

  saveProfile(): void {
    this.http.put<any>('/api/profile', this.editData).subscribe({
      next: (data) => {
        this.user = data;
        this.editingProfile = false;
        this.profileMessage = 'Profile updated successfully.';
        this.profileSuccess = true;
      },
      error: (err) => {
        this.profileMessage = err.error?.message || 'An error occurred.';
        this.profileSuccess = false;
      }
    });
  }

  changePassword(): void {
    if (this.passwordData.newPassword !== this.passwordData.confirmPassword) {
      this.passwordMessage = 'Passwords do not match.';
      this.passwordSuccess = false;
      return;
    }

    this.http.post<any>('/api/profile/change-password', {
      currentPassword: this.passwordData.currentPassword,
      newPassword: this.passwordData.newPassword
    }).subscribe({
      next: (data) => {
        this.passwordMessage = data.message;
        this.passwordSuccess = true;
        this.passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
      },
      error: (err) => {
        this.passwordMessage = err.error?.message || 'An error occurred.';
        this.passwordSuccess = false;
      }
    });
  }
}
