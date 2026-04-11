import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface SystemInfo {
  resultUpdate: string | null;
  raceUpdate: string | null;
  racetypeUpdate: string | null;
  memberUpdate: string | null;
  volunteerJobUpdate: string | null;
  overallUpdate: string | null;
}

@Injectable({ providedIn: 'root' })
export class SystemInfoService {
  private lastSystemInfo: SystemInfo | null = null;
  private lastApiCallTime = 0;
  private readonly CACHE_DURATION = 600000; // 10 minutes

  constructor(private http: HttpClient) {}

  getSystemInfo(name: string): Promise<SystemInfo | null> {
    const now = Date.now();
    if (this.lastSystemInfo && (now - this.lastApiCallTime) < this.CACHE_DURATION) {
      return Promise.resolve(this.lastSystemInfo);
    }

    return firstValueFrom(this.http.get<any>('/api/systeminfos/' + name)).then(
      (data) => {
        this.lastApiCallTime = now;
        // Build system info from API response body
        const dates = [data.resultUpdate, data.raceUpdate, data.racetypeUpdate,
                       data.memberUpdate, data.volunteerJobUpdate].filter(Boolean);
        const overallUpdate = dates.length > 0
          ? new Date(Math.max(...dates.map((d: string) => new Date(d).getTime()))).toISOString()
          : null;
        this.lastSystemInfo = {
          resultUpdate: data.resultUpdate || null,
          raceUpdate: data.raceUpdate || null,
          racetypeUpdate: data.racetypeUpdate || null,
          memberUpdate: data.memberUpdate || null,
          volunteerJobUpdate: data.volunteerJobUpdate || null,
          overallUpdate
        };
        return this.lastSystemInfo;
      },
      () => {
        if (this.lastSystemInfo) {
          return this.lastSystemInfo;
        }
        return null;
      }
    );
  }

  updateFromHeaders(response: any): void {
    if (response && response.headers) {
      const headers = typeof response.headers === 'function' ? response.headers() : response.headers;
      if (headers['x-result-update'] || headers['x-race-update'] || headers['x-racetype-update'] ||
          headers['x-member-update'] || headers['x-overall-update']) {
        this.lastSystemInfo = {
          resultUpdate: headers['x-result-update'] || null,
          raceUpdate: headers['x-race-update'] || null,
          racetypeUpdate: headers['x-racetype-update'] || null,
          memberUpdate: headers['x-member-update'] || null,
          volunteerJobUpdate: headers['x-volunteer-job-update'] || null,
          overallUpdate: headers['x-overall-update'] || null
        };
        this.lastApiCallTime = Date.now();
      }
    }
  }

  getCachedSystemInfo(): SystemInfo | null {
    return this.lastSystemInfo;
  }
}
