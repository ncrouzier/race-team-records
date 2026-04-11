import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'multisportPace', standalone: true })
export class MultisportPacePipe implements PipeTransform {
  transform(result: any, raceinfo?: any, sportType?: string): string {
    if (!result?.time) return '';
    const distance = raceinfo ? raceinfo.racetype : result.race?.racetype;
    if (!distance) return '';

    if (sportType === 'swim' || distance.name === 'Swim') {
      return this.swimPace(result.time, distance.meters) + ' /100m';
    } else if (sportType === 'bike' || distance.name === 'Cycling') {
      return this.bikePace(result.time, distance.miles) + ' mph';
    } else {
      return this.runPace(result.time, distance.miles) + ' /mi';
    }
  }

  private swimPace(time: number, meters: number): string {
    const seconds = Math.ceil(time / 100);
    const hundreds = meters / 100;
    const secPerHundred = Math.floor(seconds / hundreds);
    let m = Math.floor(secPerHundred / 60);
    let s = Math.round(secPerHundred % 60);
    if (s === 60) { m++; s = 0; }
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  private bikePace(time: number, miles: number): string {
    const hours = time / 360000;
    return String(Math.floor(miles / hours));
  }

  private runPace(time: number, miles: number): string {
    const seconds = Math.ceil(time / 100);
    let m = Math.floor((seconds / 60) / miles);
    let s = Math.round((((seconds / 60) / miles) % 1) * 60);
    if (s === 60) { m++; s = 0; }
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
}
