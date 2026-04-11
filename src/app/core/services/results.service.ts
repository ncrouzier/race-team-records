import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom, Subject } from 'rxjs';
import { MemoryCacheService } from './memory-cache.service';
import { DexieService } from './dexie.service';
import { SystemInfoService } from './system-info.service';
import { NotificationService } from './notification.service';

const CACHE_NAMES = {
  RACE_RESULTS: 'raceResults'
};

/** Emitted by ResultsService.showRaceModal() and friends. */
export interface RaceModalRequest {
  raceinfo?: any;
  raceId?: string;
}

@Injectable({ providedIn: 'root' })
export class ResultsService {
  private inFlightRequests: { [key: string]: Promise<any> | undefined } = {};

  /** Global modal open requests — consumed by AppComponent's modal host. */
  raceModalRequest$ = new Subject<RaceModalRequest>();

  constructor(
    private http: HttpClient,
    private memoryCacheService: MemoryCacheService,
    private dexieService: DexieService,
    private systemInfoService: SystemInfoService,
    private notificationService: NotificationService
  ) {}

  // =====================================
  // RESULTS API CALLS ===================
  // =====================================

  async getResultById(resultId: string): Promise<any> {
    if (!resultId) return null;
    try {
      return await firstValueFrom(this.http.get<any>(`/api/results/${resultId}`));
    } catch (error: any) {
      this.notificationService.showNotifiction(false, 'Error while retrieving result.');
      console.error('Error:', error.status);
      return null;
    }
  }

  async getResults(params?: any): Promise<any[]> {
    const httpParams = this.buildParams(params);
    return firstValueFrom(this.http.get<any[]>('/api/results', { params: httpParams }));
  }

  async createResult(result: any): Promise<any> {
    try {
      const r = await firstValueFrom(this.http.post<any>('/api/results', result));
      this.notificationService.showNotifiction(true, 'Result created successfully!');
      return r;
    } catch (error: any) {
      this.notificationService.showNotifiction(false, 'Error while creating result.');
      console.error('Error:', error.status);
      return null;
    }
  }

  async saveSingleResult(result: any): Promise<any> {
    return firstValueFrom(this.http.post<any>('/api/results', result));
  }

  async saveResultsBulk(resultsToSave: any[], race: any): Promise<any> {
    return firstValueFrom(this.http.post<any>('/api/results/bulk', {
      results: resultsToSave,
      race
    }));
  }

  async updateResultsBulk(resultsToUpdate: any[]): Promise<any> {
    return firstValueFrom(this.http.put<any>('/api/results/bulk', {
      results: resultsToUpdate
    }));
  }

  async saveResults(resultsToSave: any[]): Promise<any> {
    let race = null;
    if (resultsToSave.length > 0 && resultsToSave[0].race) {
      race = resultsToSave[0].race;
    }
    if (!race) {
      this.notificationService.showNotifiction(false, 'No race information found in results');
      throw new Error('No race information found');
    }
    try {
      const response = await this.saveResultsBulk(resultsToSave, race);
      if (response.success) {
        this.notificationService.showNotifiction(true, response.message || response.createdCount + ' results saved successfully!');
        return resultsToSave;
      } else {
        this.notificationService.showNotifiction(false, response.message || 'Bulk save failed');
        throw new Error(response.message || 'Bulk save failed');
      }
    } catch (error: any) {
      const errorMessage = error.data?.error || error.data?.details || error.message || 'Failed to save results';
      this.notificationService.showNotifiction(false, errorMessage);
      throw error;
    }
  }

  async editResult(resultId: string, result: any): Promise<any> {
    try {
      const r = await firstValueFrom(this.http.put<any>(`/api/results/${resultId}`, result));
      this.notificationService.showNotifiction(true, 'Result edited successfully!');
      return r;
    } catch (error: any) {
      this.notificationService.showNotifiction(false, 'Error while editing result.');
      console.error('Error:', error.status);
      return null;
    }
  }

  async deleteResult(resultId: string): Promise<void> {
    try {
      await firstValueFrom(this.http.delete<any>(`/api/results/${resultId}`));
      this.notificationService.showNotifiction(true, 'Result deleted successfully!');
    } catch (error: any) {
      this.notificationService.showNotifiction(false, 'Error while deleting result!');
      console.error('Error:', error.status);
    }
  }

  // =====================================
  // RACE API CALLS ======================
  // =====================================

  async getRaces(params?: any): Promise<any[]> {
    const httpParams = this.buildParams(params);
    return firstValueFrom(this.http.get<any[]>('/api/races', { params: httpParams }));
  }

  async getRaceById(raceId: string): Promise<any> {
    if (!raceId) return null;
    try {
      return await firstValueFrom(this.http.get<any>(`/api/races/${raceId}`));
    } catch (error: any) {
      this.notificationService.showNotifiction(false, 'Error while retrieving race.');
      console.error('Error:', error.status);
      return null;
    }
  }

  async updateRace(race: any): Promise<any> {
    if (!race || !race._id) {
      this.notificationService.showNotifiction(false, 'Invalid race data.');
      throw new Error('Invalid race data');
    }
    try {
      const updatedRace = await firstValueFrom(this.http.put<any>(`/api/races/${race._id}`, race));
      this.notificationService.showNotifiction(true, 'Race updated successfully.');
      return updatedRace;
    } catch (error: any) {
      this.notificationService.showNotifiction(false, 'Error while updating race.');
      console.error('Error:', error.status);
      return null;
    }
  }

  async deleteRace(raceInfoId: string): Promise<void> {
    try {
      await firstValueFrom(this.http.delete<any>(`/api/raceinfos/${raceInfoId}`));
      this.notificationService.showNotifiction(true, 'Race deleted successfully!');
    } catch (error: any) {
      this.notificationService.showNotifiction(false, 'Error while deleting race!');
      console.error('Error:', error.status);
    }
  }

  async getRacesInfos(params?: any): Promise<any> {
    const httpParams = this.buildParams(params);
    return firstValueFrom(this.http.get<any>('/api/raceinfos', { params: httpParams }));
  }

  // =====================================
  // RACE RESULTS WITH CACHE SUPPORT =====
  // =====================================

  getRaceResultsWithCacheSupport(params: any): Promise<any> {
    const dedupeKey = JSON.stringify(params || {});

    if (this.inFlightRequests[dedupeKey]) {
      return this.inFlightRequests[dedupeKey];
    }

    const promise = this._getRaceResultsWithCacheSupportImpl(params).finally(() => {
      delete this.inFlightRequests[dedupeKey];
    });

    this.inFlightRequests[dedupeKey] = promise;
    return promise;
  }

  private async _getRaceResultsWithCacheSupportImpl(params: any): Promise<any> {
    const sysinfo = await this.systemInfoService.getSystemInfo('mcrrc');
    if (!sysinfo || !sysinfo.overallUpdate) {
      // Fallback to direct API call if sysinfo unavailable
      return this.getRacesInfos(params);
    }
    const date = new Date(sysinfo.overallUpdate);

    const db = this.dexieService.getDb();
    try {
      await db.open();
    } catch (error) {
      // If IndexedDB fails, fall through to API
    }

    let key: string;
    if (params.type === 'last30') {
      key = 'last30';
    } else if (params.type === 'last60') {
      key = 'last60';
    } else {
      key = 'current';
    }

    const memKey = key + ':' + JSON.stringify(params || {});

    // Check in-memory cache first
    const memCacheEntry = this.memoryCacheService.get(CACHE_NAMES.RACE_RESULTS, memKey);
    if (memCacheEntry && memCacheEntry.date && date.getTime() === new Date(memCacheEntry.date).getTime()) {
      return memCacheEntry.data;
    }

    // Try IndexedDB
    let cache: any;
    try {
      cache = await db.races.get(key);
    } catch (error) {
      cache = undefined;
    }

    let cacheDate: Date | null = null;
    if (cache && cache.date) {
      try {
        cacheDate = new Date(JSON.parse(cache.date));
      } catch (e) {
        console.error('Error parsing cache date:', e);
        cacheDate = null;
      }
    }

    if (cache === undefined || !cacheDate || date.getTime() > cacheDate.getTime()) {
      // Cache miss or stale — fetch from API
      const resultsFromDatabase = await this.getRacesInfos(params);

      if (!params.preload) {
        try {
          const jsonDate = JSON.stringify(date);
          db.races.put({ instance: key, date: jsonDate, data: JSON.stringify(resultsFromDatabase) })
            .catch(() => { /* Don't throw on IndexedDB write failure */ });
        } catch (error) {
          // Don't throw on serialization failure
        }
      }

      this.memoryCacheService.set(CACHE_NAMES.RACE_RESULTS, memKey, { date, data: resultsFromDatabase });
      return resultsFromDatabase;
    } else {
      // Use IndexedDB cache
      const data = JSON.parse(cache.data);
      this.memoryCacheService.set(CACHE_NAMES.RACE_RESULTS, memKey, { date, data });
      return data;
    }
  }

  // =====================================
  // RACETYPE API CALLS ==================
  // =====================================

  async getRaceTypes(params?: any): Promise<any[]> {
    const httpParams = this.buildParams(params);
    return firstValueFrom(this.http.get<any[]>('/api/racetypes', { params: httpParams }));
  }

  async createRaceType(racetype: any): Promise<any> {
    return firstValueFrom(this.http.post<any>('/api/racetypes', racetype));
  }

  async editRaceType(racetypeId: string, data: any): Promise<any> {
    return firstValueFrom(this.http.put<any>(`/api/racetypes/${racetypeId}`, data));
  }

  async deleteRaceType(racetypeId: string): Promise<void> {
    return firstValueFrom(this.http.delete<any>(`/api/racetypes/${racetypeId}`));
  }

  // =====================================
  // PDF / STATS API =====================
  // =====================================

  async getResultsForPdf(params?: any): Promise<any> {
    const httpParams = this.buildParams(params);
    return firstValueFrom(this.http.get<any>('/api/pdfreport', { params: httpParams }));
  }

  async getMilesRaced(params?: any): Promise<any> {
    const httpParams = this.buildParams(params);
    return firstValueFrom(this.http.get<any>('/api/milesraced', { params: httpParams }));
  }

  // =====================================
  // MODAL HELPER METHODS ================
  // =====================================
  // These emit on raceModalRequest$ which AppComponent's modal host consumes.

  showRaceModal(raceinfo: any, _fromStateParams?: any): void {
    this.raceModalRequest$.next({ raceinfo });
  }

  showRaceFromResultModal(raceId: string, _fromStateParams?: any): void {
    this.raceModalRequest$.next({ raceId });
  }

  showRaceFromRaceIdModal(raceId: string, _fromStateParams?: any): void {
    this.raceModalRequest$.next({ raceId });
  }

  // =====================================
  // HELPERS =============================
  // =====================================

  private buildParams(params: any): HttpParams {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        const val = params[key];
        if (val !== null && val !== undefined) {
          if (typeof val === 'object' && !Array.isArray(val)) {
            // Nested objects (e.g. filters) — serialize as JSON string
            httpParams = httpParams.set(key, JSON.stringify(val));
          } else {
            httpParams = httpParams.set(key, String(val));
          }
        }
      });
    }
    return httpParams;
  }
}
