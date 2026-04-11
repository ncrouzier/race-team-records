import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthStateService {
  private userSubject = new BehaviorSubject<any>(null);
  user$ = this.userSubject.asObservable();

  setUser(user: any): void {
    this.userSubject.next(user || null);
  }

  isLoggedIn(): any {
    const user = this.userSubject.value;
    return user ? user : false;
  }

  get currentUser(): any {
    return this.userSubject.value;
  }
}
