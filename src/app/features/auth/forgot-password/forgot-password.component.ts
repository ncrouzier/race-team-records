import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="text-center">
      <div class="col-sm-6 col-sm-offset-3">
        <h1>Forgot Password</h1>

        <div *ngIf="message" class="alert" [ngClass]="{'alert-success': success, 'alert-danger': !success}">
          {{ message }}
        </div>

        <form #forgotForm="ngForm" (ngSubmit)="requestReset()" *ngIf="!success">
          <div class="form-group">
            <label>Email Address</label>
            <input type="email" class="form-control" name="email"
                   [(ngModel)]="email" required autofocus>
          </div>
          <button [disabled]="forgotForm.invalid" type="submit" class="btn btn-warning btn-lg">Send Reset Link</button>
        </form>

        <hr>
        <p><a routerLink="/login">Back to Login</a></p>
      </div>
    </div>
  `
})
export class ForgotPasswordComponent {
  email = '';
  message = '';
  success = false;

  constructor(private http: HttpClient) {}

  requestReset(): void {
    this.http.post<any>('/api/forgot', { email: this.email }).subscribe({
      next: (data) => {
        this.message = data.message;
        this.success = true;
      },
      error: (err) => {
        const data = err.error;
        this.message = data?.message || 'An error occurred. Please try again.';
        this.success = false;
      }
    });
  }
}
