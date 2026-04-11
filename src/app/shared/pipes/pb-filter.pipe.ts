import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'pbFilter' })
export class PbFilterPipe implements PipeTransform {
  transform(pbs: any[], surface: string): any[] {
    if (!pbs || !surface) return pbs || [];
    return pbs.filter(pb => {
      if (pb && pb.race && pb.race.racetype) {
        return pb.race.racetype.surface === surface;
      }
      return false;
    });
  }
}
