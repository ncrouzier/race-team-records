import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class MemoryCacheService {
  private caches: Record<string, Record<string, any>> = {};

  get(cacheName: string, key: string): any {
    if (this.caches[cacheName] && this.caches[cacheName][key]) {
      return this.caches[cacheName][key];
    }
    return undefined;
  }

  set(cacheName: string, key: string, value: any): void {
    if (!this.caches[cacheName]) {
      this.caches[cacheName] = {};
    }
    this.caches[cacheName][key] = value;
  }

  clear(cacheName?: string): void {
    if (cacheName) {
      this.caches[cacheName] = {};
    } else {
      this.caches = {};
    }
  }
}
