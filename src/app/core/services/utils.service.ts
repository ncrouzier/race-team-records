import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MemoryCacheService } from './memory-cache.service';
import { US_STATES, STATE_FLAGS, State } from '../data/states';
import { COUNTRIES, COUNTRY_FLAGS, DEFAULT_FLAG, Country } from '../data/countries';

@Injectable({ providedIn: 'root' })
export class UtilsService {
  private readonly CACHE_NAME = 'locationInfo';

  states: State[] = US_STATES;
  countries: Country[] = COUNTRIES;

  constructor(
    private http: HttpClient,
    private memoryCacheService: MemoryCacheService
  ) {}

  calculateAge(birthday: string | Date): number {
    const bd = new Date(birthday);
    const ageDifMs = Date.now() - bd.getTime();
    const ageDate = new Date(ageDifMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  }

  getAgeGrade(params: any): Promise<any> {
    return firstValueFrom(this.http.get<any>('/api/agegrade', { params }));
  }

  getLocationInfo(params: any): Promise<any> {
    const key = JSON.stringify(params);
    const cachedData = this.memoryCacheService.get(this.CACHE_NAME, key);
    if (cachedData) {
      return Promise.resolve(cachedData);
    }
    return firstValueFrom(this.http.get<any>('/api/locations', { params })).then(
      (results) => {
        this.memoryCacheService.set(this.CACHE_NAME, key, results);
        return results;
      }
    );
  }

  getStateNameFromCode(code: string): string | null {
    if (!code) return null;
    const state = this.states.find(s => s.code.toLowerCase() === code.toLowerCase());
    return state ? state.name : code;
  }

  getCountryNameFromCode(code: string): string | null {
    if (!code) return null;
    const country = this.countries.find(c => c.code.toLowerCase() === code.toLowerCase());
    return country ? country.name : code;
  }

  getStateFlag(code: string): string {
    if (!code) return '';
    return STATE_FLAGS[code.toUpperCase()] || '';
  }

  getCountryFlag(code: string): string {
    if (!code) return '';
    return COUNTRY_FLAGS[code.toUpperCase()] || DEFAULT_FLAG;
  }

  getCountries(): Promise<Country[]> {
    return Promise.resolve(this.countries);
  }

  getStates(): Promise<State[]> {
    return Promise.resolve(this.states);
  }
}
