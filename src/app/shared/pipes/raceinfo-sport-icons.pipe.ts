import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'raceinfoSportIcons', standalone: true })
export class RaceinfoSportIconsPipe implements PipeTransform {
  transform(raceinfo: any): string {
    let res = ' ';
    if (raceinfo.isMultisport === true && raceinfo.results?.[0]?.legs) {
      raceinfo.results[0].legs.forEach((leg: any) => {
        if (leg.legType === 'swim') res += '<span class="hoverhand" title="swim (' + leg.distanceName + ')">🏊</span>';
        else if (leg.legType === 'bike') res += '<span class="hoverhand" title="bike (' + leg.distanceName + ')">🚴</span>';
        else if (leg.legType === 'run') res += '<span class="hoverhand" title="run (' + leg.distanceName + ')">🏃</span>';
      });
    } else {
      if (raceinfo.racetype?.name === 'Swim') res += '<span class="hoverhand" title="swim">🏊</span>';
      else if (raceinfo.racetype?.name === 'Cycling') res += '<span class="hoverhand" title="bike">🚴</span>';
    }
    return res;
  }
}
