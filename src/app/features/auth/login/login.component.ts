import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthStateService } from '../../../core/services/auth-state.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="text-center">
      <div class="col-sm-6 col-sm-offset-3">
        <h1>Login</h1>

        <div *ngIf="message" class="alert alert-danger">{{ message }}</div>

        <form #loginForm="ngForm" (ngSubmit)="login()">
          <div class="form-group">
            <label for="email">Email</label>
            <input type="text" class="form-control" id="email" name="email"
                   [(ngModel)]="user.email" autofocus>
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" class="form-control" id="password" name="password"
                   [(ngModel)]="user.password">
          </div>

          <button type="submit" class="btn btn-warning btn-lg">Login</button>
        </form>

        <p style="margin-top: 15px;"><a routerLink="/forgot-password">Forgot Password?</a></p>
        <p style="margin-top: 20px;">Don't have an account? <a routerLink="/signup">Create an account</a></p>
        <hr>
      </div>
    </div>
  `
})
export class LoginComponent {
  user = { email: '', password: '' };
  message = '';

  constructor(
    private http: HttpClient,
    private authState: AuthStateService
  ) {}

  login(): void {
    this.http.post<any>('/api/login', this.user).subscribe({
      next: (data) => {
        this.authState.setUser(data.user);
        window.location.href = '/';
      },
      error: (err) => {
        const data = err.error;
        this.message = Array.isArray(data) ? data[0] : (data?.message || 'Login failed.');
      }
    });
  }
}
