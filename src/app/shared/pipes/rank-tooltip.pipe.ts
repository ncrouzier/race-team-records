import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'rankTooltip', standalone: true })
export class RankTooltipPipe implements PipeTransform {
  transform(ranking: any): string {
    if (!ranking) return '';
    let res = '';
    if (ranking.agerank) {
      res += 'Age group rank: ' + this.ordinalSuffix(ranking.agerank);
      if (ranking.agetotal) res += ' of ' + ranking.agetotal;
      res += '\n';
    }
    if (ranking.genderrank) {
      res += 'Gender rank: ' + this.ordinalSuffix(ranking.genderrank);
      if (ranking.gendertotal) res += ' of ' + ranking.gendertotal;
      res += '\n';
    }
    if (ranking.overallrank) {
      res += 'Overall rank: ' + this.ordinalSuffix(ranking.overallrank);
      if (ranking.overalltotal) res += ' of ' + ranking.overalltotal;
    }
    return res.trim();
  }

  private ordinalSuffix(i: number): string {
    const j = i % 10;
    const k = i % 100;
    if (j === 1 && k !== 11) return i + 'st';
    if (j === 2 && k !== 12) return i + 'nd';
    if (j === 3 && k !== 13) return i + 'rd';
    return i + 'th';
  }
}
