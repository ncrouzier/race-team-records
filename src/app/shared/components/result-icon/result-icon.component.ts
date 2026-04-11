import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-result-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span *ngFor="let ag of ags" class="hoverhand" [title]="ag.text"><div class="pbBox">🎖️</div></span>
    <span *ngFor="let pb of pbs" class="hoverhand" [title]="pb.text"><div class="pbBox">🧨</div></span>
    <span *ngFor="let rc of raceCounts" class="hoverhand" [title]="rc.text"><div class="raceCountBox">{{rc.value.raceCount}}</div></span>
    <span *ngFor="let bd of birthdays" class="hoverhand" [title]="bd.text">🎂</span>
    <span *ngIf="!raceDisplay && isThanksgiving" title="Thanksgiving Race!">🦃</span>
    <span *ngIf="!raceDisplay && isFourthOfJuly" title="Fourth of July Race!">🎆</span>
    <span *ngFor="let icon of raceIcons" class="hoverhand resultIcons" [title]="icon.text">
      <img [src]="icon.value" [style.width]="icon.width || '16px'" [style.height]="icon.height || '16px'">
    </span>
    <span *ngFor="let text of raceTexts" class="hoverhand resultIcons" [title]="text.text">{{text.value}}</span>
    <span *ngFor="let icon of resultIcons" class="hoverhand resultIcons" [title]="icon.text">
      <img [src]="icon.value" [style.width]="icon.width || '16px'" [style.height]="icon.height || '16px'">
    </span>
    <span *ngFor="let text of resultTexts" class="hoverhand resultIcons" [title]="text.text">{{text.value}}</span>
  `
})
export class ResultIconComponent implements OnChanges {
  @Input() result: any;
  @Input() race: any;
  @Input() raceDisplay = false;

  ags: any[] = [];
  pbs: any[] = [];
  raceCounts: any[] = [];
  birthdays: any[] = [];
  isThanksgiving = false;
  isFourthOfJuly = false;
  raceIcons: any[] = [];
  raceTexts: any[] = [];
  resultIcons: any[] = [];
  resultTexts: any[] = [];

  ngOnChanges(): void {
    if (!this.result || !this.race) return;

    this.ags = this.result.achievements?.filter((x: any) => x.name === 'agegrade') || [];
    this.pbs = this.result.achievements?.filter((x: any) => x.name === 'pb') || [];
    this.raceCounts = this.result.achievements?.filter((x: any) => x.name === 'raceCount') || [];
    this.birthdays = this.result.achievements?.filter((x: any) => x.name === 'birthday') || [];

    this.resultIcons = this.result.customOptions?.filter((x: any) => x.name === 'resultIcon') || [];
    this.resultTexts = this.result.customOptions?.filter((x: any) => x.name === 'resultText') || [];

    if (!this.raceDisplay) {
      this.raceIcons = this.race.customOptions?.filter((x: any) => x.name === 'raceIcon') || [];
      this.raceTexts = this.race.customOptions?.filter((x: any) => x.name === 'raceText') || [];
    } else {
      this.raceIcons = [];
      this.raceTexts = [];
    }

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
  }
}
