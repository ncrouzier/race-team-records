import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'legPace', standalone: true })
export class LegPacePipe implements PipeTransform {
  transform(leg: any): string {
    if (!leg?.time) return '';
    if (leg.legType === 'swim') {
      const seconds = Math.ceil(leg.time / 100);
      const hundreds = leg.meters / 100;
      const secPerHundred = Math.floor(seconds / hundreds);
      let m = Math.floor(secPerHundred / 60);
      let s = Math.round(secPerHundred % 60);
      if (s === 60) { m++; s = 0; }
      return m + ':' + (s < 10 ? '0' : '') + s + ' /100m';
    } else if (leg.legType === 'bike') {
      const hours = leg.time / 360000;
      return Math.floor(leg.miles / hours) + ' mph';
    } else { // run
      const seconds = Math.ceil(leg.time / 100);
      let m = Math.floor((seconds / 60) / leg.miles);
      let s = Math.round((((seconds / 60) / leg.miles) % 1) * 60);
      if (s === 60) { m++; s = 0; }
      return m + ':' + (s < 10 ? '0' : '') + s + ' /mi';
    }
  }
}
