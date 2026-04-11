import { Injectable } from '@angular/core';
import Dexie from 'dexie';

class McrrcDatabase extends Dexie {
  races: Dexie.Table<any, string>;
  statsCache: Dexie.Table<any, string>;
  members: Dexie.Table<any, string>;
  volunteerjobs: Dexie.Table<any, string>;

  constructor() {
    super('mcrrcAppDatabase');
    this.version(4).stores({
      races: 'instance',
      statsCache: 'year',
      members: 'params',
      volunteerjobs: 'instance'
    });
    this.races = this.table('races');
    this.statsCache = this.table('statsCache');
    this.members = this.table('members');
    this.volunteerjobs = this.table('volunteerjobs');
  }
}

// The DexieService Angular injectable is a thin holder.
// For AngularJS compatibility, we downgrade a factory that returns
// the raw Dexie instance (AngularJS code does `var db = DexieService; db.open(); db.races.get(...)`)
@Injectable({ providedIn: 'root' })
export class DexieService {
  private db: McrrcDatabase;

  constructor() {
    if ((window as any).mcrrcDexie) {
      this.db = (window as any).mcrrcDexie;
    } else {
      this.db = new McrrcDatabase();
      (window as any).mcrrcDexie = this.db;
    }
  }

  getDb(): McrrcDatabase {
    return this.db;
  }
}

// Factory function for downgrading — returns the raw Dexie DB instance
// so AngularJS code can use it exactly as before (db.open(), db.races, etc.)
export function dexieServiceFactory(dexieService: DexieService): McrrcDatabase {
  return dexieService.getDb();
}
