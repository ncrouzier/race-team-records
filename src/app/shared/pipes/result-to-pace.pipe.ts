import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'resultToPace' })
export class ResultToPacePipe implements PipeTransform {
  transform(result: any): string {
    if (!result || !result.time || !result.race || !result.race.racetype || !result.race.racetype.miles) return '';
    if (result.race.isMultisport) return '';
    const paceInCentiseconds = result.time / result.race.racetype.miles;
    const totalSeconds = Math.floor(paceInCentiseconds / 100);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes + ':' + (seconds < 10 ? '0' : '') + seconds + ' /mi';
  }
}
