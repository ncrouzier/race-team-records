import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'membersNames', standalone: true })
export class MembersNamesPipe implements PipeTransform {
  transform(members: any[], truncate = false, maxLength = 25): string {
    if (!members || members.length === 0) return '';
    const names = members.map((m: any) => m.firstname + ' ' + m.lastname).join(', ');
    if (truncate && names.length > maxLength) {
      return names.substring(0, maxLength) + '...';
    }
    return names;
  }
}
