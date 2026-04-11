import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="col-sm-6 col-sm-offset-3">
      <h1><span class="fa fa-sign-in"></span> Create Account</h1>

      <div *ngIf="message" class="alert alert-danger">{{ message }}</div>

      <div *ngIf="success" class="alert alert-success">
        <i class="fa fa-check-circle"></i> {{ successMessage }}
      </div>

      <form #signupForm="ngForm" (ngSubmit)="signup()" *ngIf="!success">
        <div class="form-group">
          <label>Name</label>
          <input type="text" class="form-control" name="username"
                 [(ngModel)]="user.username" required autofocus>
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" class="form-control" name="email"
                 [(ngModel)]="user.email" required>
        </div>
        <div class="form-group" [class.has-error]="passwordField.dirty && passwordField.invalid">
          <label>Password</label>
          <input type="password" class="form-control" name="password"
                 [(ngModel)]="user.password" required
                 minlength="8" maxlength="64" #passwordField="ngModel">
          <p class="help-block" *ngIf="passwordField.dirty && passwordField.errors?.['minlength']">
            Password must be at least 8 characters.
          </p>
        </div>

        <button [disabled]="signupForm.invalid" type="submit" class="btn btn-warning btn-lg">Create Account</button>
      </form>

      <hr>
      <p>Already have an account? <a routerLink="/login">Login</a></p>
    </div>
  `
})
export class SignupComponent {
  user = { username: '', email: '', password: '' };
  message = '';
  success = false;
  successMessage = '';

  constructor(private http: HttpClient) {}

  signup(): void {
    this.http.post<any>('/api/signup', this.user).subscribe({
      next: (data) => {
        this.message = '';
        this.success = true;
        this.successMessage = data.message;
      },
      error: (err) => {
        const data = err.error;
        this.message = Array.isArray(data) ? data[0] : (data?.message || 'An error occurred.');
        this.success = false;
      }
    });
  }
}
