import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'memberAge' })
export class MemberAgePipe implements PipeTransform {
  transform(member: any): number | string {
    if (!member || !member.dateofbirth) return '';
    const today = new Date();
    const birthDate = new Date(member.dateofbirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }
}
