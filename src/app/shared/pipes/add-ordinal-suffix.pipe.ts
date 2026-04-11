import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'addOrdinalSuffix', standalone: true })
export class AddOrdinalSuffixPipe implements PipeTransform {
  transform(value: number): string {
    if (value == null) return '';
    if (value % 100 >= 11 && value % 100 <= 13) {
      return value + 'th';
    }
    switch (value % 10) {
      case 1: return value + 'st';
      case 2: return value + 'nd';
      case 3: return value + 'rd';
      default: return value + 'th';
    }
  }
}
