import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { SecondsToTimeStringPipe } from '../pipes/seconds-to-time-string.pipe';
import { LegPacePipe } from '../pipes/leg-pace.pipe';
import { RaceinfoSportIconsPipe } from '../pipes/raceinfo-sport-icons.pipe';

import { RaceIconComponent } from '../components/race-icon/race-icon.component';
import { ResultMembersNamesComponent } from '../components/result-members-names/result-members-names.component';

/**
 * ResultDetailsModalComponent
 *
 * Replaces AJS `ResultDetailslInstanceController` + `views/modals/resultDetailsModal.html`.
 * Displays a multisport result's leg-by-leg breakdown.
 *
 * Usage:
 *   <app-result-details-modal
 *     [visible]="showDetails"
 *     [result]="selectedResult"
 *     [race]="selectedRace"
 *     (closed)="showDetails = false">
 *   </app-result-details-modal>
 */
@Component({
  selector: 'app-result-details-modal',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    SecondsToTimeStringPipe,
    LegPacePipe,
    RaceIconComponent,
    ResultMembersNamesComponent
  ],
  template: `
    <div class="modal-backdrop fade in" *ngIf="visible" (click)="close()"></div>
    <div class="modal fade in" *ngIf="visible && result && race" style="display: block;" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header modern-modal-header">
            <button type="button" class="close" (click)="close()" style="position: absolute; right: 15px; top: 10px; z-index: 10;">&times;</button>
            <div class="race-header-content">
              <div class="race-title-section">
                <h3 class="race-title">{{ race.racename }}</h3>
                <app-race-icon [race]="race"></app-race-icon>
              </div>
              <div class="race-details-section">
                <div class="race-info-panel">
                  <div class="race-type-info">
                    <span *ngIf="!race.isMultisport && race.racetype?.isVariable === true"
                          [innerHTML]="race.distanceName + ' <span class=\\'' + getSurfaceClass(race.racetype.surface) + '\\'>(' + race.racetype.surface + ')</span>'">
                    </span>
                    <span *ngIf="!race.isMultisport && race.racetype?.isVariable === false"
                          [innerHTML]="race.racetype.name + ' <span class=\\'' + getSurfaceClass(race.racetype.surface) + '\\'>(' + race.racetype.surface + ')</span>'">
                    </span>
                    <span *ngIf="race.isMultisport">Multiple-sport Event</span>
                    <span [innerHTML]="sportIconsHtml"></span>
                  </div>

                  <div class="race-meta-info">
                    <div class="meta-item">
                      <i class="fa fa-calendar"></i>
                      <span>{{ race.racedate | date:'MMM d, yyyy':'UTC' }}</span>
                    </div>

                    <div class="meta-item">
                      <i class="fa fa-user"></i>
                      <span>
                        <app-result-members-names [result]="result" [race]="race" [full]="true"></app-result-members-names>
                      </span>
                    </div>

                    <div class="meta-item">
                      <i class="fa fa-clock-o"></i>
                      <span>{{ result.time | secondsToTimeString }}</span>
                    </div>

                    <div class="meta-item" *ngIf="result.resultlink">
                      <a [href]="result.resultlink" target="_blank" class="result-link">
                        <i class="fa fa-link"></i>
                        <span>View Result</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-body modern-modal-body">
            <div class="results-table-container">
              <div class="results-header modern-results-header" *ngIf="result.legs?.length">
                <div class="header-row">
                  <div class="header-cell leg-cell"><span class="header-text">LEG NAME</span></div>
                  <div class="header-cell distance-cell"><span class="header-text">DISTANCE</span></div>
                  <div class="header-cell time-cell"><span class="header-text">NET TIME</span></div>
                  <div class="header-cell pace-cell"><span class="header-text">PACE</span></div>
                </div>
              </div>

              <div class="results-list">
                <div class="result-row modern-result-row"
                     *ngFor="let leg of sortedLegs"
                     [class.transition-leg]="leg.isTransition">
                  <div class="result-content">
                    <div class="result-cell leg-cell">
                      <span class="leg-name" *ngIf="!leg.isTransition">{{ leg.legName }}</span>
                      <span class="transition-badge" *ngIf="leg.isTransition">{{ leg.legName }}</span>
                    </div>
                    <div class="result-cell distance-cell">
                      <span class="distance-text">{{ leg.distanceName }}</span>
                    </div>
                    <div class="result-cell time-cell">
                      <span class="time-text">{{ leg.time | secondsToTimeString }}</span>
                    </div>
                    <div class="result-cell pace-cell">
                      <span class="hoverhand" *ngIf="!leg.isTransition">
                        <span class="bold">{{ leg | legPace }}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="comments-section" *ngIf="result.comments">
              <div class="comments-panel">
                <h5><i class="fa fa-comment"></i> Comments</h5>
                <div class="comment-text">"{{ result.comments }}"</div>
              </div>
            </div>
          </div>

          <div class="modal-footer modern-modal-footer">
            <div class="footer-actions">
              <button class="btn btn-secondary modern-btn" (click)="close()">
                <i class="fa fa-times"></i>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ResultDetailsModalComponent {
  @Input() visible = false;
  @Input() result: any = null;
  @Input() race: any = null;
  @Output() closed = new EventEmitter<void>();

  private sportIconsPipe = new RaceinfoSportIconsPipe();

  constructor(private sanitizer: DomSanitizer) { }

  get sortedLegs(): any[] {
    if (!this.result?.legs) return [];
    return [...this.result.legs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  get sportIconsHtml(): SafeHtml {
    if (!this.race) return '';
    return this.sanitizer.bypassSecurityTrustHtml(this.sportIconsPipe.transform(this.race));
  }

  getSurfaceClass(surfaceName?: string): string {
    if (!surfaceName) return '';
    return 'surface-' + surfaceName.toLowerCase().replace(/\s+/g, '-');
  }

  close(): void {
    this.closed.emit();
  }
}
