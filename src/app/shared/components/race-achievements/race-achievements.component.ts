import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UtilsService } from '../../../core/services/utils.service';

@Component({
  selector: 'app-race-achievements',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span *ngFor="let ach of achievements">
      <span *ngIf="ach.emoji" [title]="ach.tooltip">{{ach.emoji}}</span>
      <img *ngIf="ach.flag" [src]="ach.flag" alt="Location flag" class="achievement-flag"
           [title]="ach.tooltip" onerror="this.style.display='none'">
      <i *ngIf="ach.icon" [ngClass]="ach.icon" [title]="ach.tooltip"></i>
    </span>
  `
})
export class RaceAchievementsComponent implements OnChanges {
  @Input() race: any;
  achievements: any[] = [];

  constructor(private utilsService: UtilsService) {}

  ngOnChanges(): void {
    if (!this.race?.results) { this.achievements = []; return; }
    this.achievements = this.getAchievements(this.race);
  }

  private getAchievements(race: any): any[] {
    if (!race.results || race.results.length === 0) return [];
    const achievements: any[] = [];

    // Trophy for overall or gender win
    if (race.results.some((r: any) => r.ranking && (r.ranking.overallrank === 1 || r.ranking.genderrank === 1))) {
      achievements.push({ type: 'trophy', emoji: '🏆', tooltip: 'Race winner!' });
    }
    // Silver
    if (race.results.some((r: any) => r.ranking && (r.ranking.overallrank === 2 || r.ranking.genderrank === 2))) {
      achievements.push({ type: 'second', emoji: '🥈', tooltip: '2nd Place' });
    }
    // Bronze
    if (race.results.some((r: any) => r.ranking && (r.ranking.overallrank === 3 || r.ranking.genderrank === 3))) {
      achievements.push({ type: 'third', emoji: '🥉', tooltip: '3rd Place' });
    }
    // Personal bests
    if (race.results.some((r: any) => r.achievements?.some((a: any) => a.name?.toLowerCase() === 'pb'))) {
      achievements.push({ type: 'pb', emoji: '🧨', tooltip: 'Personal Best on the team' });
    }
    // World class age grade
    if (race.results.some((r: any) => r.agegrade && r.agegrade >= 90)) {
      achievements.push({ type: 'nationalClass', icon: 'ageworld fa fa-star', tooltip: 'World Class age grade performance' });
    }
    // New location
    if (race.achievements?.some((a: any) => a.name?.toLowerCase() === 'newlocation')) {
      const locAch = race.achievements.find((a: any) => a.name?.toLowerCase() === 'newlocation');
      if (locAch?.value) {
        if (locAch.value.state) {
          const stateName = this.utilsService.getStateNameFromCode(locAch.value.state);
          const flag = this.utilsService.getStateFlag(locAch.value.state);
          const tooltip = 'First team race in ' + stateName + '!';
          if (flag) {
            achievements.push({ type: 'newLocation', flag, tooltip });
          } else {
            achievements.push({ type: 'newLocation', emoji: '🗺️', tooltip });
          }
        } else if (locAch.value.country) {
          const countryName = this.utilsService.getCountryNameFromCode(locAch.value.country);
          const emoji = this.utilsService.getCountryFlag(locAch.value.country);
          achievements.push({ type: 'newLocation', emoji, tooltip: 'First team race in ' + countryName + '!' });
        } else {
          const name = locAch.value.locationName || 'this location';
          achievements.push({ type: 'newLocation', emoji: '🗺️', tooltip: 'First team race in ' + name + '!' });
        }
      } else {
        achievements.push({ type: 'newLocation', emoji: '🗺️', tooltip: 'First team race in this location!' });
      }
    }
    return achievements;
  }
}
