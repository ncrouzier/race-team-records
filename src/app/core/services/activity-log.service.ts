import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ActivityLogService {
  constructor(private http: HttpClient) {}

  async getLogs(params?: any): Promise<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] != null && params[key] !== '') {
          httpParams = httpParams.set(key, String(params[key]));
        }
      });
    }
    try {
      return await firstValueFrom(this.http.get<any>('/api/activitylogs', { params: httpParams }));
    } catch (error: any) {
      console.error('Error fetching activity logs:', error.status);
      return { logs: [], total: 0, pages: 0, page: 1 };
    }
  }

  async getActionTypes(): Promise<string[]> {
    try {
      return await firstValueFrom(this.http.get<string[]>('/api/activitylogs/actions'));
    } catch (error: any) {
      console.error('Error fetching action types:', error.status);
      return [];
    }
  }

  async deleteLog(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.delete<any>(`/api/activitylogs/${id}`));
      return true;
    } catch (error: any) {
      console.error('Error deleting activity log:', error.status);
      return false;
    }
  }
}
