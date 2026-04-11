import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ResultToPacePipe } from '../../pipes/result-to-pace.pipe';
import { MultisportPacePipe } from '../../pipes/multisport-pace.pipe';

@Component({
  selector: 'app-result-pace',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Running -->
    <span class="resultPace" *ngIf="isRun">
      <span [title]="ageGradeTooltip">
        {{pace}} <i *ngIf="ageGradeClass" class="fa fa-star" [ngClass]="ageGradeClass"></i>
      </span>
      <br><small class="resultPaceTxt">min/mi</small>
    </span>
    <!-- Swimming -->
    <span class="resultPace" *ngIf="isSwim">
      <span>{{swimPace}}</span>
      <br><small class="resultPaceTxt">/100m</small>
    </span>
    <!-- Cycling -->
    <span class="resultPace" *ngIf="isBike">
      <span>{{bikePace}}</span>
      <br><small class="resultPaceTxt">mph</small>
    </span>
  `
})
export class ResultPaceComponent implements OnChanges {
  @Input() result: any;
  @Input() race: any;

  pace = '';
  swimPace = '';
  bikePace = '';
  isRun = false;
  isSwim = false;
  isBike = false;
  ageGradeClass = '';
  ageGradeTooltip = '';

  private pacePipe = new ResultToPacePipe();
  private multisportPacePipe = new MultisportPacePipe();

  ngOnChanges(): void {
    if (!this.result || !this.race) return;
    const rtName = this.race.racetype?.name;
    this.isSwim = rtName === 'Swim';
    this.isBike = rtName === 'Cycling';
    this.isRun = !this.isSwim && !this.isBike;

    if (this.isRun) {
      // ResultToPacePipe reads result.race internally; ensure it's attached
      this.pace = this.pacePipe.transform({ ...this.result, race: this.race });
      const ag = this.result.agegrade;
      if (ag != null) {
        this.ageGradeTooltip = 'Age Grade: ' + ag + '%';
        if (ag >= 90) { this.ageGradeClass = 'ageworld'; this.ageGradeTooltip += ' - World Class'; }
        else if (ag >= 80) { this.ageGradeClass = 'agenational'; this.ageGradeTooltip += ' - National Class'; }
        else if (ag >= 70) { this.ageGradeClass = 'ageregional'; this.ageGradeTooltip += ' - Regional Class'; }
        else { this.ageGradeClass = ''; }
      } else {
        this.ageGradeClass = '';
        this.ageGradeTooltip = '';
      }
    } else if (this.isSwim) {
      this.swimPace = this.multisportPacePipe.transform(this.result, this.race, 'swim');
      // Remove the " /100m" suffix since we show it separately
      this.swimPace = this.swimPace.replace(' /100m', '');
    } else if (this.isBike) {
      this.bikePace = this.multisportPacePipe.transform(this.result, this.race, 'bike');
      this.bikePace = this.bikePace.replace(' mph', '');
    }
  }
}
