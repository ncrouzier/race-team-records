import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { getTeamRequirementsForYear } from '../../../core/data/team-requirements';

@Component({
  selector: 'app-team-requirements-badge',
  imports: [CommonModule],
  template: `
    <span *ngIf="member && member.teamRequirementStats" [title]="tooltipText">
      <i class="fa" [ngClass]="fulfilled ? 'fa-check-circle text-success' : 'fa-times-circle text-danger'"></i>
    </span>
  `
})
export class TeamRequirementsBadgeComponent implements OnChanges {
  @Input() member: any;

  fulfilled = false;
  tooltipText = '';

  ngOnChanges(): void {
    if (!this.member || !this.member.teamRequirementStats) {
      this.fulfilled = false;
      return;
    }
    const reqConfig = getTeamRequirementsForYear(new Date().getFullYear());
    const stats = this.member.teamRequirementStats;
    const raceAndVolunteer = (stats.raceCount || 0) + (stats.volunteerJobCount || 0);
    this.fulfilled = raceAndVolunteer >= reqConfig.minRaceAndVolunteerCount &&
                     (stats.maxAgeGrade || 0) >= reqConfig.minAgeGrade;
    this.tooltipText = this.fulfilled ? 'Team requirements fulfilled' :
      `Needs ${reqConfig.minRaceAndVolunteerCount} races+volunteer (has ${raceAndVolunteer}) and ${reqConfig.minAgeGrade}% age grade (has ${(stats.maxAgeGrade || 0).toFixed(1)}%)`;
  }
}
