import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'secondsToTimeString', standalone: true })
export class SecondsToTimeStringPipe implements PipeTransform {
  transform(centisec: number): string {
    if (centisec == null) return '';

    const hours = Math.floor(centisec / 360000);
    const minutes = Math.floor(((centisec % 8640000) % 360000) / 6000);
    let seconds: number | string = Math.floor((((centisec % 8640000) % 360000) % 6000) / 100);
    let centiseconds: number | string = Math.floor((((centisec % 8640000) % 360000) % 6000) % 100);

    if (hours === 0) {
      if (seconds < 10) seconds = '0' + seconds;
      if (centiseconds !== 0) {
        if (centiseconds < 10) centiseconds = '0' + centiseconds;
        return minutes + ':' + seconds + '.' + centiseconds;
      } else {
        return minutes + ':' + seconds;
      }
    } else {
      let min: number | string = minutes;
      if (min < 10) min = '0' + min;
      if (seconds < 10) seconds = '0' + seconds;
      if (centiseconds !== 0) {
        if (centiseconds < 10) centiseconds = '0' + centiseconds;
        return hours + ':' + min + ':' + seconds + '.' + centiseconds;
      } else {
        return hours + ':' + min + ':' + seconds;
      }
    }
  }
}
