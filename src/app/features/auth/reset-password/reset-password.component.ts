import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="text-center">
      <div class="col-sm-6 col-sm-offset-3">
        <h1>Reset Password</h1>

        <div *ngIf="message" class="alert" [ngClass]="{'alert-success': success, 'alert-danger': !success}">
          {{ message }}
        </div>

        <div *ngIf="tokenExpired" class="alert alert-danger">
          This password reset link is invalid or has expired.
          <a routerLink="/forgot-password">Request a new one</a>.
        </div>

        <form #resetForm="ngForm" (ngSubmit)="resetPassword()" *ngIf="!success && !tokenExpired">
          <div class="form-group" [class.has-error]="passwordField.dirty && passwordField.invalid">
            <label>New Password</label>
            <input type="password" class="form-control" name="password"
                   [(ngModel)]="newPassword" required
                   minlength="8" maxlength="64" #passwordField="ngModel">
            <p class="help-block" *ngIf="passwordField.dirty && passwordField.errors?.['minlength']">
              Password must be at least 8 characters.
            </p>
          </div>
          <div class="form-group">
            <label>Confirm New Password</label>
            <input type="password" class="form-control" name="confirmPassword"
                   [(ngModel)]="confirmPassword" required>
          </div>
          <div *ngIf="newPassword && confirmPassword && newPassword !== confirmPassword" class="alert alert-danger">
            Passwords do not match.
          </div>
          <button [disabled]="resetForm.invalid || newPassword !== confirmPassword"
                  type="submit" class="btn btn-warning btn-lg">
            Reset Password
          </button>
        </form>

        <div *ngIf="success">
          <p><a routerLink="/login">Click here to login</a></p>
        </div>

        <hr>
      </div>
    </div>
  `
})
export class ResetPasswordComponent implements OnInit {
  newPassword = '';
  confirmPassword = '';
  message = '';
  success = false;
  tokenExpired = false;
  private token = '';

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') || '';

    this.http.get<any>('/api/reset/' + this.token).subscribe({
      error: (err) => {
        this.tokenExpired = true;
        this.message = err.error?.message || 'Invalid or expired token.';
      }
    });
  }

  resetPassword(): void {
    if (this.newPassword !== this.confirmPassword) {
      this.message = 'Passwords do not match.';
      return;
    }

    this.http.post<any>('/api/reset/' + this.token, { password: this.newPassword }).subscribe({
      next: (data) => {
        this.message = data.message;
        this.success = true;
      },
      error: (err) => {
        const data = err.error;
        this.message = data?.message || 'An error occurred. Please try again.';
        if (data?.message?.indexOf('expired') !== -1) {
          this.tokenExpired = true;
        }
      }
    });
  }
}
