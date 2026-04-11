import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { NotificationService } from './notification.service';

@Injectable({ providedIn: 'root' })
export class UsersService {
  constructor(
    private http: HttpClient,
    private notificationService: NotificationService
  ) {}

  async getUsers(): Promise<any[]> {
    try {
      return await firstValueFrom(this.http.get<any[]>('/api/users'));
    } catch (error: any) {
      console.error('Error fetching users:', error.status);
      return [];
    }
  }

  async createUser(userData: any): Promise<any> {
    try {
      const user = await firstValueFrom(this.http.post<any>('/api/users', userData));
      this.notificationService.showNotifiction(true, 'User created successfully!');
      return user;
    } catch (error: any) {
      this.notificationService.showNotifiction(false, error.error?.message || 'Error creating user.');
      console.error('Error:', error.status);
      throw error;
    }
  }

  async editUser(userId: string, userData: any, options?: { notifyUser?: boolean }): Promise<any> {
    const body = { ...userData };
    if (options?.notifyUser) {
      body.notifyUser = true;
    }
    try {
      const user = await firstValueFrom(this.http.put<any>(`/api/users/${userId}`, body));
      this.notificationService.showNotifiction(true, 'User updated successfully!');
      return user;
    } catch (error: any) {
      this.notificationService.showNotifiction(false, 'Error updating user.');
      console.error('Error:', error.status);
      return null;
    }
  }

  async deleteUser(userId: string): Promise<void> {
    try {
      await firstValueFrom(this.http.delete<any>(`/api/users/${userId}`));
      this.notificationService.showNotifiction(true, 'User deleted successfully!');
    } catch (error: any) {
      this.notificationService.showNotifiction(false, 'Error deleting user.');
      console.error('Error:', error.status);
    }
  }
}
