import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'inlineOrdinalSuffix', standalone: true })
export class InlineOrdinalSuffixPipe implements PipeTransform {
  transform(i: number | undefined | null | '', withStyle = true, topThreeClass = 'red'): string {
    if (i === undefined || i === null || i === '') return '';

    const j = i % 10;
    const k = i % 100;
    let suffix = 'th';

    if (j === 1 && k !== 11) {
      suffix = 'st';
    } else if (j === 2 && k !== 12) {
      suffix = 'nd';
    } else if (j === 3 && k !== 13) {
      suffix = 'rd';
    }

    if (!withStyle) {
      return i + suffix;
    }

    const classToUse = i > 3 ? '    ' : topThreeClass;
    return '<span class="' + classToUse + '">' + i + '<span style="font-style: italic;vertical-align: super;font-size: 0.6em;">' + suffix + '</span></span>';
  }
}
