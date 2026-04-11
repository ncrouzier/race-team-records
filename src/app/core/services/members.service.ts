import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MemoryCacheService } from './memory-cache.service';

const CACHE_NAMES = {
  MEMBERS: 'members',
  LOADING_PROMISES: 'loadingPromises'
};

@Injectable({ providedIn: 'root' })
export class MembersService {
  constructor(
    private http: HttpClient,
    private memoryCacheService: MemoryCacheService
  ) {}

  async getMembers(params?: any): Promise<any[]> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return firstValueFrom(this.http.get<any[]>('/api/members', { params: httpParams }));
  }

  async getMembersWithCacheSupport(params?: any): Promise<any[]> {
    const cacheKey = JSON.stringify(params || {});

    // Check memory cache first
    const cachedMembers = this.memoryCacheService.get(CACHE_NAMES.MEMBERS, cacheKey);
    if (cachedMembers) {
      return cachedMembers;
    }

    // Check for loading promises to prevent duplicate requests
    const loadingPromise = this.memoryCacheService.get(CACHE_NAMES.LOADING_PROMISES, cacheKey);
    if (loadingPromise) {
      return loadingPromise;
    }

    // Fetch from API and cache in memory only
    const promise = this.getMembers(params).then(members => {
      this.memoryCacheService.set(CACHE_NAMES.MEMBERS, cacheKey, members);
      this.memoryCacheService.set(CACHE_NAMES.LOADING_PROMISES, cacheKey, null);
      return members;
    }).catch(error => {
      console.error('API call failed:', error);
      this.memoryCacheService.set(CACHE_NAMES.LOADING_PROMISES, cacheKey, null);
      throw error;
    });

    this.memoryCacheService.set(CACHE_NAMES.LOADING_PROMISES, cacheKey, promise);
    return promise;
  }

  async getMember(id: string): Promise<any> {
    return firstValueFrom(this.http.get<any>(`/api/members/${id}`));
  }

  async createMember(member: any): Promise<any> {
    return firstValueFrom(this.http.post<any>('/api/members', member));
  }

  async editMember(id: string, member: any): Promise<any> {
    return firstValueFrom(this.http.put<any>(`/api/members/${id}`, member));
  }

  async editMemberBio(memberId: string, bio: string): Promise<any> {
    return firstValueFrom(this.http.put<any>(`/api/members/${memberId}/bio`, { bio }));
  }

  async editMemberPhoto(memberId: string, pictureLink: string): Promise<any> {
    return firstValueFrom(this.http.put<any>(`/api/members/${memberId}/photo`, { pictureLink }));
  }

  async deleteMember(id: string): Promise<any> {
    return firstValueFrom(this.http.delete<any>(`/api/members/${id}`));
  }

  async getMemberPbs(memberId: string): Promise<any[]> {
    return firstValueFrom(this.http.get<any[]>(`/api/members/${memberId}/pbs`));
  }

  async getParticipation(params: any): Promise<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return firstValueFrom(this.http.get<any>('/api/stats/participation', { params: httpParams }));
  }
}
