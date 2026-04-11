import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'timeToAgeGrade', standalone: true })
export class TimeToAgeGradePipe implements PipeTransform {
  transform(time: { hours?: number; minutes?: number; seconds?: number }, timeStandard: number, percentage: boolean): string {
    if (!time) return '';
    const timeInSeconds = (time.hours ? time.hours * 3600 : 0) +
                          (time.minutes ? time.minutes * 60 : 0) +
                          (time.seconds ? time.seconds : 0);
    if (timeInSeconds === 0) return '';
    return (timeStandard / timeInSeconds * 100).toFixed(2) + (percentage === true ? '%' : '');
  }
}
