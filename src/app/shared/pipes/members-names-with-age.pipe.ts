import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'membersNamesWithAge', standalone: true })
export class MembersNamesWithAgePipe implements PipeTransform {
  transform(result: any, race?: any): string {
    if (!result?.members) return '';
    const date = race ? race.racedate : result.race?.racedate;
    return result.members.map((m: any) => {
      const age = this.calculateAgeAtDate(m.dateofbirth, date);
      return m.firstname + ' ' + m.lastname + ' (' + age + ')';
    }).join(', ');
  }

  private calculateAgeAtDate(birthday: any, date: any): number {
    const bd = new Date(birthday);
    const customDate = new Date(date);
    const birthYear = bd.getUTCFullYear();
    const birthMonth = bd.getUTCMonth();
    const birthDay = bd.getUTCDate();
    const targetYear = customDate.getUTCFullYear();
    const targetMonth = customDate.getUTCMonth();
    const targetDay = customDate.getUTCDate();
    let age = targetYear - birthYear;
    if (targetMonth < birthMonth || (targetMonth === birthMonth && targetDay < birthDay)) {
      age--;
    }
    return Math.max(0, age);
  }
}
