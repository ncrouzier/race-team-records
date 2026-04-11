import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'categoryFilter' })
export class CategoryFilterPipe implements PipeTransform {
  transform(dob: any): string {
    if (!dob) return '';
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 40 ? 'Master' : 'Open';
  }
}
