import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'milesAndTimeToPace', standalone: true })
export class MilesAndTimeToPacePipe implements PipeTransform {
  transform(miles: number | null | undefined, time: { hours?: number; minutes?: number; seconds?: number }): string {
    if (!miles || !time) return '';

    const timeInSeconds = (time.hours ? time.hours * 3600 : 0) +
                          (time.minutes ? time.minutes * 60 : 0) +
                          (time.seconds ? time.seconds : 0);
    if (timeInSeconds === 0) return '';

    let m = Math.floor((timeInSeconds / 60) / miles);
    let s = Math.round(((((timeInSeconds / 60) / miles) % 1) * 60));

    if (s === 60) {
      m = m + 1;
      s = 0;
    }

    return m + ':' + (s < 10 ? '0' : '') + s;
  }
}
