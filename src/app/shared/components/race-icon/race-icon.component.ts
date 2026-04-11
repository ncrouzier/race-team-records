import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-race-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span *ngIf="isThanksgiving" title="Thanksgiving Race!">🦃</span>
    <span *ngIf="isFourthOfJuly" title="Fourth of July Race!">🎆</span>
    <span *ngFor="let icon of raceIcons" class="hoverhand resultIcons" [title]="icon.text">
      <img [src]="icon.value" [style.width]="icon.width || '16px'" [style.height]="icon.height || '16px'">
    </span>
    <span *ngFor="let text of raceTexts" class="hoverhand resultIcons" [title]="text.text">{{text.value}}</span>
  `
})
export class RaceIconComponent implements OnChanges {
  @Input() race: any;
  isThanksgiving = false;
  isFourthOfJuly = false;
  raceIcons: any[] = [];
  raceTexts: any[] = [];

  ngOnChanges(): void {
    if (!this.race) return;
    const d1 = new Date(this.race.racedate);
    const raceDate = new Date(d1.getUTCFullYear(), d1.getUTCMonth(), d1.getUTCDate());

    this.isThanksgiving = false;
    if (raceDate.getMonth() === 10) {
      const first = new Date(raceDate.getUTCFullYear(), 10, 1);
      const dayOfWeek = first.getUTCDay();
      const thanksgiving = new Date(raceDate.getUTCFullYear(), 10, 22 + (11 - dayOfWeek) % 7);
      this.isThanksgiving = raceDate.getUTCMonth() === thanksgiving.getUTCMonth() && raceDate.getUTCDate() === thanksgiving.getUTCDate();
    }

    this.isFourthOfJuly = raceDate.getUTCMonth() === 6 && raceDate.getUTCDate() === 4;

    this.raceIcons = this.race.customOptions?.filter((x: any) => x.name === 'raceIcon') || [];
    this.raceTexts = this.race.customOptions?.filter((x: any) => x.name === 'raceText') || [];
  }
}
