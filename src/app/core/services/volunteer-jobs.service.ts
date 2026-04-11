import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MemoryCacheService } from './memory-cache.service';
import { DexieService } from './dexie.service';
import { SystemInfoService } from './system-info.service';

const CACHE_NAMES = {
  VOLUNTEER_JOBS: 'volunteerJobs'
};

@Injectable({ providedIn: 'root' })
export class VolunteerJobsService {
  private db: any;

  constructor(
    private http: HttpClient,
    private memoryCacheService: MemoryCacheService,
    private dexieService: DexieService,
    private systemInfoService: SystemInfoService
  ) {
    this.db = this.dexieService.getDb();
  }

  getVolunteerJobs(params?: any): Promise<any[]> {
    return firstValueFrom(this.http.get<any[]>('/api/volunteerjobs', { params }));
  }

  async getVolunteerJobsWithCacheSupport(params?: any): Promise<any[]> {
    const sysinfo = await this.systemInfoService.getSystemInfo('mcrrc');
    const date = new Date(sysinfo!.volunteerJobUpdate!);

    const key = 'all';
    const memKey = key + ':' + JSON.stringify(params || {});

    // Check in-memory cache first
    const memCacheEntry = this.memoryCacheService.get(CACHE_NAMES.VOLUNTEER_JOBS, memKey);
    if (memCacheEntry && memCacheEntry.date && date.getTime() === new Date(memCacheEntry.date).getTime()) {
      return memCacheEntry.data;
    }

    // Try IndexedDB
    let cache: any;
    try {
      cache = await this.db.volunteerjobs.get(key);
    } catch {
      cache = undefined;
    }

    let cacheDate: Date | null = null;
    if (cache && cache.date) {
      try {
        cacheDate = new Date(JSON.parse(cache.date));
      } catch {
        cacheDate = null;
      }
    }

    if (cache === undefined || !cacheDate || date.getTime() > cacheDate.getTime()) {
      // Fetch from API
      const jobsFromDatabase = await firstValueFrom(this.http.get<any[]>('/api/volunteerjobs', { params }));
      try {
        const jsonDate = JSON.stringify(date);
        this.db.volunteerjobs.put({ instance: key, date: jsonDate, data: JSON.stringify(jobsFromDatabase) }).catch(() => {});
      } catch {
        // Don't throw, just swallow
      }

      const cacheData = { date, data: jobsFromDatabase };
      this.memoryCacheService.set(CACHE_NAMES.VOLUNTEER_JOBS, memKey, cacheData);
      return jobsFromDatabase;
    } else {
      // Use IndexedDB cache
      const data = JSON.parse(cache.data);
      const cacheData = { date, data };
      this.memoryCacheService.set(CACHE_NAMES.VOLUNTEER_JOBS, memKey, cacheData);
      return data;
    }
  }

  getVolunteerJob(id: string): Promise<any> {
    return firstValueFrom(this.http.get<any>('/api/volunteerjobs/' + id));
  }

  createVolunteerJob(job: any): Promise<any> {
    return firstValueFrom(this.http.post<any>('/api/volunteerjobs', job));
  }

  createVolunteerJobsBatch(batchData: any): Promise<any> {
    return firstValueFrom(this.http.post<any>('/api/volunteerjobs/batch', batchData));
  }

  editVolunteerJob(id: string, job: any): Promise<any> {
    return firstValueFrom(this.http.put<any>('/api/volunteerjobs/' + id, job));
  }

  deleteVolunteerJob(id: string): Promise<any> {
    return firstValueFrom(this.http.delete<any>('/api/volunteerjobs/' + id));
  }
}
