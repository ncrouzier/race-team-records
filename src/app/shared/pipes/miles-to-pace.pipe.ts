import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'milesToPace', standalone: true })
export class MilesToPacePipe implements PipeTransform {
  transform(miles: number | null | undefined, centiseconds: number): string {
    if (!miles || !centiseconds) return '';

    const seconds = Math.floor(centiseconds / 100);
    let m = Math.floor((seconds / 60) / miles);
    let s = Math.round(((((seconds / 60) / miles) % 1) * 60));

    if (s === 60) {
      m = m + 1;
      s = 0;
    }

    return m + ':' + (s < 10 ? '0' : '') + s;
  }
}
