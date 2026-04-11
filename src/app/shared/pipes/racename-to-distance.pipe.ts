import { Pipe, PipeTransform } from '@angular/core';

export interface DistanceInfo {
  name: string;
  meters: number;
  miles: number;
}

const DISTANCE_CONVERSIONS: Record<string, DistanceInfo> = {
  '60m': { name: '60m', meters: 60, miles: 0.0373 },
  '100m': { name: '100m', meters: 100, miles: 0.0621 },
  '200m': { name: '200m', meters: 200, miles: 0.1243 },
  '400m': { name: '400m', meters: 400, miles: 0.2485 },
  '800m': { name: '800m', meters: 800, miles: 0.4971 },
  '1000m': { name: '1000m', meters: 1000, miles: 0.6214 },
  '1500m': { name: '1500m', meters: 1500, miles: 0.9321 },
  '1 mile': { name: '1 mile', meters: 1609.34, miles: 1 },
  '3000m': { name: '3000m', meters: 3000, miles: 1.864 },
  '5000m': { name: '5000m', meters: 5000, miles: 3.107 },
  '5k': { name: '5K', meters: 5000, miles: 3.107 },
  '6k': { name: '6K', meters: 6000, miles: 3.731 },
  '4 miles': { name: '4 miles', meters: 6437.38, miles: 4 },
  '8k': { name: '8K', meters: 8000, miles: 4.97097 },
  '5 miles': { name: '5 miles', meters: 8046.7, miles: 5 },
  '10k': { name: '10K', meters: 10000, miles: 6.214 },
  '7 miles': { name: '7 miles', meters: 12093.4, miles: 7 },
  '10000m': { name: '10,000m', meters: 10000, miles: 6.214 },
  '10 miles': { name: '10 miles', meters: 16093.4, miles: 10 },
  '12k': { name: '12K', meters: 12000, miles: 7.457 },
  '15k': { name: '15K', meters: 15000, miles: 9.321 },
  '20k': { name: '20K', meters: 20000, miles: 12.427 },
  '25k': { name: '25K', meters: 25000, miles: 15.534 },
  '30k': { name: '30K', meters: 30000, miles: 18.641 },
  'half marathon': { name: 'Half Marathon', meters: 21097.5, miles: 13.1 },
  'marathon': { name: 'Marathon', meters: 42195, miles: 26.2 },
  '50k': { name: '50K', meters: 50000, miles: 31.07 },
  '50 miles': { name: '50 miles', meters: 80467, miles: 50 },
  '100k': { name: '100K', meters: 100000, miles: 62.14 },
  '150k': { name: '150K', meters: 150000, miles: 93.21 },
  '100 miles': { name: '100 miles', meters: 160934, miles: 100 },
  '200k': { name: '200K', meters: 200000, miles: 124.27 }
};

@Pipe({ name: 'racenameToDistance', standalone: true })
export class RacenameToDistancePipe implements PipeTransform {
  transform(name: string): DistanceInfo | null {
    if (!name) return null;
    return DISTANCE_CONVERSIONS[name] || null;
  }
}
