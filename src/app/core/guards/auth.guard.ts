import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthStateService } from '../services/auth-state.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private authState: AuthStateService, private router: Router) {}

  canActivate(): boolean {
    if (this.authState.isLoggedIn()) {
      return true;
    }
    window.location.href = '/login';
    return false;
  }
}
