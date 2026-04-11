import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router } from '@angular/router';

import { SecondsToTimeStringPipe } from '../pipes/seconds-to-time-string.pipe';
import { RaceinfoSportIconsPipe } from '../pipes/raceinfo-sport-icons.pipe';
import { InlineOrdinalSuffixPipe } from '../pipes/inline-ordinal-suffix.pipe';
import { RankTooltipPipe } from '../pipes/rank-tooltip.pipe';

import { RaceIconComponent } from '../components/race-icon/race-icon.component';
import { RacePhotosComponent } from '../components/race-photos/race-photos.component';
import { ResultIconComponent } from '../components/result-icon/result-icon.component';
import { ResultMembersNamesComponent } from '../components/result-members-names/result-members-names.component';
import { ResultPaceComponent } from '../components/result-pace/result-pace.component';
import { RaceAchievementsComponent } from '../components/race-achievements/race-achievements.component';

import { UtilsService } from '../../core/services/utils.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthStateService } from '../../core/services/auth-state.service';

/**
 * RaceModalComponent
 *
 * Replaces AJS `RaceModalInstanceController` + `views/modals/raceModal.html`.
 *
 * Displays race details with stats summary, gender filter, and sortable result list.
 *
 * Children handled by parent via events:
 * - showResultDetails: emit when a multisport leg-details link is clicked
 * - editRace: emit when admin clicks edit-race button
 *
 * Usage:
 *   <app-race-modal
 *     [visible]="showRaceModal"
 *     [raceinfo]="selectedRace"
 *     [fromStateParams]="fromStateParams"
 *     (closed)="onRaceModalClosed()"
 *     (showResultDetails)="onShowResultDetails($event)"
 *     (editRace)="onEditRace($event)">
 *   </app-race-modal>
 */
@Component({
  selector: 'app-race-modal',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    SecondsToTimeStringPipe,
    RaceIconComponent,
    RacePhotosComponent,
    ResultIconComponent,
    ResultMembersNamesComponent,
    ResultPaceComponent,
    RaceAchievementsComponent
  ],
  template: `
    <div class="modal-backdrop fade in" *ngIf="visible" (click)="cancel()"></div>
    <div class="modal fade in" *ngIf="visible && raceinfo" style="display: block;" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header modern-modal-header">
            <button type="button" class="close" (click)="cancel()" style="position: absolute; right: 15px; top: 10px; z-index: 10;">&times;</button>
            <div class="race-header-content">
              <div class="race-title-section">
                <h3 class="race-title">{{ raceinfo.racename }}</h3>
                <app-race-icon [race]="raceinfo"></app-race-icon>
                <app-race-photos [race]="raceinfo"></app-race-photos>
                <button *ngIf="user?.role === 'admin'"
                        class="btn btn-sm btn-outline-primary edit-race-btn"
                        (click)="onEditRaceClicked()"
                        title="Edit race details">
                  <i class="fa fa-pencil"></i>
                </button>
              </div>

              <div class="race-details-section">
                <div class="race-info-panel">
                  <div class="race-type-info">
                    <span *ngIf="!raceinfo.isMultisport && raceinfo.racetype?.isVariable === true"
                          [innerHTML]="raceinfo.distanceName + ' <span class=\\'' + getSurfaceClass(raceinfo.racetype.surface) + '\\'>(' + raceinfo.racetype.surface + ')</span>'">
                    </span>
                    <span *ngIf="!raceinfo.isMultisport && raceinfo.racetype?.isVariable === false"
                          [innerHTML]="raceinfo.racetype.name + ' <span class=\\'' + getSurfaceClass(raceinfo.racetype.surface) + '\\'>(' + raceinfo.racetype.surface + ')</span>'">
                    </span>
                    <span *ngIf="raceinfo.isMultisport">Multiple-sport Event</span>
                    <span [innerHTML]="sportIconsHtml"></span>
                  </div>

                  <div class="race-meta-info">
                    <div class="meta-item">
                      <i class="fa fa-calendar"></i>
                      <span>{{ raceinfo.racedate | date:'MMM d, yyyy':'UTC' }}</span>
                    </div>

                    <div class="meta-item">
                      <i class="fa fa-map-marker"></i>
                      <span *ngIf="raceinfo.location?.state">
                        {{ raceinfo.location.state }}
                        <img *ngIf="getStateFlag(raceinfo.location.state)"
                             [src]="getStateFlag(raceinfo.location.state)"
                             [alt]="raceinfo.location.state"
                             class="location-flag"
                             onerror="this.style.display='none'">
                      </span>
                      <span *ngIf="!raceinfo.location?.state && raceinfo.location?.country">
                        {{ raceinfo.location.country }}
                        <span *ngIf="getCountryFlag(raceinfo.location.country)" class="location-flag-emoji">
                          {{ getCountryFlag(raceinfo.location.country) }}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="race-stats-summary">
                <div class="stat-item">
                  <span class="stat-number">{{ raceinfo.results.length }}</span>
                  <span class="stat-label">racer<span *ngIf="raceinfo.results.length > 1">s</span></span>
                </div>
                <div class="stat-item" *ngIf="fastestTimeResult">
                  <span class="stat-number">{{ fastestTimeResult.time | secondsToTimeString }}</span>
                  <span class="stat-label">fastest time</span>
                  <div class="stat-detail">{{ fastestTimeResult.members[0].firstname }} {{ fastestTimeResult.members[0].lastname }}</div>
                </div>
                <div class="stat-item" *ngIf="bestAgeGradeResult">
                  <span class="stat-number">{{ bestAgeGradeResult.agegrade | number:'1.1-1' }}%</span>
                  <span class="stat-label">best age grade</span>
                  <div class="stat-detail">{{ bestAgeGradeResult.members[0].firstname }} {{ bestAgeGradeResult.members[0].lastname }}</div>
                </div>
                <div class="stat-item" *ngIf="avg !== null">
                  <span class="stat-number">{{ avg | secondsToTimeString }}</span>
                  <span class="stat-label">avg time</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">achievements</span>
                  <div class="stat-achievements">
                    <app-race-achievements [race]="raceinfo"></app-race-achievements>
                  </div>
                </div>

                <!-- Gender Filter -->
                <div class="gender-filter-container race-modal-gf">
                  <div class="btn-group" role="group">
                    <button type="button" class="btn btn-sm"
                            [class.btn-primary]="!genderFilter"
                            [class.btn-outline-primary]="genderFilter"
                            (click)="setGenderFilter(null)">
                      <i class="fa fa-users"></i>
                      All Members
                    </button>
                    <button type="button" class="btn btn-sm"
                            [class.btn-primary]="genderFilter === 'Female'"
                            [class.btn-outline-primary]="genderFilter !== 'Female'"
                            (click)="setGenderFilter('Female')"
                            title="Here for the women's race">
                      <i class="fa fa-venus"></i>
                      Women Only
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-body modern-modal-body">
            <div id="member-list" class="row">
              <div class="col-md-12">
                <div class="results-table-container">
                  <div class="results-header modern-results-header" *ngIf="raceinfo.results.length">
                    <div class="header-row">
                      <div class="header-cell racer-cell"><span class="header-text">RACER</span></div>
                      <div class="header-cell rank-cell"><span class="header-text">AGE</span></div>
                      <div class="header-cell rank-cell"><span class="header-text">GENDER</span></div>
                      <div class="header-cell rank-cell"><span class="header-text">OVERALL</span></div>
                      <div class="header-cell pace-cell">
                        <span class="header-text hoverhand" (click)="sortBy('time')">PACE</span>
                        <i *ngIf="raceinfo.results[0]?.agegrade"
                           (click)="sortBy('agegrade')"
                           title="Sort by age grading"
                           class="hoverhand agesort fa fa-star"></i>
                      </div>
                      <div class="header-cell time-cell">
                        <span class="header-text hoverhand" (click)="sortBy('time')">NET TIME</span>
                      </div>
                    </div>
                  </div>

                  <div class="results-list">
                    <div class="result-row modern-result-row"
                         *ngFor="let result of filteredResults"
                         [class.my-result-row]="isMyResult(result)">
                      <div class="result-content">
                        <div class="result-cell racer-cell">
                          <a (click)="goToMember(result)" class="racer-link hoverhand">
                            <app-result-members-names [result]="result" [race]="raceinfo" [full]="true"></app-result-members-names>
                            <app-result-icon [result]="result" [race]="raceinfo" [raceDisplay]="true"></app-result-icon>
                          </a>
                        </div>
                        <div class="result-cell rank-cell">
                          <span class="rank-text" title="Age Group ranking"
                                [innerHTML]="formatRank(result.ranking?.agerank)"></span>
                        </div>
                        <div class="result-cell rank-cell">
                          <span class="rank-text" title="Gender ranking"
                                [innerHTML]="formatRank(result.ranking?.genderrank)"></span>
                        </div>
                        <div class="result-cell rank-cell">
                          <span class="rank-text" title="Overall ranking"
                                [innerHTML]="formatRank(result.ranking?.overallrank)"></span>
                        </div>
                        <div class="result-cell pace-cell" *ngIf="!raceinfo.isMultisport">
                          <app-result-pace [race]="raceinfo" [result]="result"></app-result-pace>
                        </div>
                        <div class="result-cell pace-cell" *ngIf="raceinfo.isMultisport">
                          <span class="view-details-link hoverhand"
                                title="View details"
                                (click)="onShowResultDetails(result)">
                            View details
                          </span>
                        </div>
                        <div class="result-cell time-cell">
                          <span class="time-text">{{ result.time | secondsToTimeString }}</span>
                          <a *ngIf="result.resultlink" [href]="result.resultlink" target="_blank" class="result-link">
                            <i class="fa fa-link" title="view result"></i>
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer modern-modal-footer">
            <div class="footer-actions">
              <button class="btn btn-primary modern-btn" (click)="copyRaceLinkToClipboard()">
                <i class="fa fa-clipboard"></i>
                Copy race results permalink
              </button>
              <button class="btn btn-secondary modern-btn" (click)="cancel()">
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
export class RaceModalComponent implements OnChanges {
  @Input() visible = false;
  @Input() raceinfo: any = null;
  @Input() fromStateParams = false;
  @Output() closed = new EventEmitter<void>();
  @Output() showResultDetails = new EventEmitter<{ result: any; race: any }>();
  @Output() editRace = new EventEmitter<any>();

  user: any = null;
  avg: number | null = null;
  fastestTimeResult: any = null;
  bestAgeGradeResult: any = null;
  genderFilter: string | null = null;

  private sortCriteria: string | null = null;
  private sortDirection = true;

  private sportIconsPipe = new RaceinfoSportIconsPipe();
  private inlineOrdinalSuffixPipe = new InlineOrdinalSuffixPipe();
  private rankTooltipPipe = new RankTooltipPipe();

  constructor(
    private sanitizer: DomSanitizer,
    private utilsService: UtilsService,
    private notificationService: NotificationService,
    private authState: AuthStateService,
    private router: Router
  ) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['raceinfo'] && this.raceinfo) {
      this.computeStats();
      this.user = this.authState.currentUser;
      this.genderFilter = null;
    }
  }

  private computeStats(): void {
    if (!this.raceinfo?.results) {
      this.avg = null;
      this.fastestTimeResult = null;
      this.bestAgeGradeResult = null;
      return;
    }

    let sum = 0;
    let count = 0;
    let fastestTime = Infinity;
    let bestAgeGrade = 0;
    this.fastestTimeResult = null;
    this.bestAgeGradeResult = null;

    for (const r of this.raceinfo.results) {
      if (r.time != null) {
        sum += r.time;
        count++;
      }
      if (r.time && r.time < fastestTime) {
        fastestTime = r.time;
        this.fastestTimeResult = r;
      }
      if (r.agegrade && r.agegrade > bestAgeGrade) {
        bestAgeGrade = r.agegrade;
        this.bestAgeGradeResult = r;
      }
    }

    this.avg = count > 0 ? Math.ceil(sum / count) : null;
  }

  get sportIconsHtml(): SafeHtml {
    if (!this.raceinfo) return '';
    return this.sanitizer.bypassSecurityTrustHtml(this.sportIconsPipe.transform(this.raceinfo));
  }

  get filteredResults(): any[] {
    if (!this.raceinfo?.results) return [];
    if (!this.genderFilter) return this.raceinfo.results;
    return this.raceinfo.results.filter((r: any) =>
      r.members?.some((m: any) => m.sex === this.genderFilter)
    );
  }

  formatRank(rank: number | undefined | null): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(
      this.inlineOrdinalSuffixPipe.transform(rank, true, 'red')
    );
  }

  rankTooltip(ranking: any): string {
    return this.rankTooltipPipe.transform(ranking);
  }

  getSurfaceClass(surfaceName?: string): string {
    if (!surfaceName) return '';
    return 'surface-' + surfaceName.toLowerCase().replace(/\s+/g, '-');
  }

  getStateFlag(stateCode: string): string {
    return this.utilsService.getStateFlag(stateCode);
  }

  getCountryFlag(countryCode: string): string {
    return this.utilsService.getCountryFlag(countryCode);
  }

  setGenderFilter(gender: string | null): void {
    this.genderFilter = gender;
  }

  isMyResult(result: any): boolean {
    return !!(this.user?.member?._id && result.members?.[0]?._id === this.user.member._id);
  }

  sortBy(criteria: string): void {
    if (this.sortCriteria === criteria) {
      this.sortDirection = !this.sortDirection;
    } else {
      this.sortCriteria = criteria;
      this.sortDirection = true;
    }
    if (!this.raceinfo?.results) return;
    const order = this.sortDirection;
    this.raceinfo.results.sort((r1: any, r2: any) => {
      if (criteria === 'time') {
        if (r1.time < r2.time) return order ? -1 : 1;
        if (r1.time > r2.time) return order ? 1 : -1;
        return 0;
      }
      if (criteria === 'agegrade') {
        if (r1.agegrade === undefined) return 1;
        if (r2.agegrade === undefined) return -1;
        if (r1.agegrade < r2.agegrade) return order ? -1 : 1;
        if (r1.agegrade > r2.agegrade) return order ? 1 : -1;
        return 0;
      }
      return 0;
    });
  }

  goToMember(result: any): void {
    const username = result.members?.[0]?.username;
    if (username) {
      this.cancel();
      this.router.navigate(['/members', username, 'bio']);
    }
  }

  onShowResultDetails(result: any): void {
    this.showResultDetails.emit({ result, race: this.raceinfo });
  }

  onEditRaceClicked(): void {
    if (this.user?.role === 'admin') {
      this.editRace.emit(this.raceinfo);
    }
  }

  copyRaceLinkToClipboard(): void {
    const url = window.location.origin + '/races/' + this.raceinfo._id;
    navigator.clipboard.writeText(url)
      .then(() => this.notificationService.clipboardCopyNotifiction(true, url))
      .catch(err => {
        this.notificationService.clipboardCopyNotifiction(false, url);
        console.error('Failed to copy text: ', err);
      });
  }

  cancel(): void {
    if (this.fromStateParams) {
      this.router.navigate(['/results']);
    }
    this.closed.emit();
  }
}
