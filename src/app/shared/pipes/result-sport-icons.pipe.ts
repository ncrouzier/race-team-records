import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'resultSportIcons' })
export class ResultSportIconsPipe implements PipeTransform {
  transform(result: any): string {
    if (!result) return '';
    if (result.legs && result.legs.length > 0) {
      return result.legs.map((leg: any) => {
        switch (leg.legType) {
          case 'swim': return '\u{1F3CA}';
          case 'bike': return '\u{1F6B4}';
          case 'run': return '\u{1F3C3}';
          default: return '';
        }
      }).join('');
    }
    return '';
  }
}
