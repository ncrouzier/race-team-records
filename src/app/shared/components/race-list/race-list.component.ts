import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { ResultsService } from '../../../core/services/results.service';
import { AuthStateService } from '../../../core/services/auth-state.service';

// Pipes
import { SecondsToTimeStringPipe } from '../../pipes/seconds-to-time-string.pipe';
import { RaceinfoSportIconsPipe } from '../../pipes/raceinfo-sport-icons.pipe';
import { InlineOrdinalSuffixPipe } from '../../pipes/inline-ordinal-suffix.pipe';
import { RankTooltipPipe } from '../../pipes/rank-tooltip.pipe';

// Sub-components
import { RaceIconComponent } from '../race-icon/race-icon.component';
import { RacePhotosComponent } from '../race-photos/race-photos.component';
import { ResultIconComponent } from '../result-icon/result-icon.component';
import { ResultMembersNamesComponent } from '../result-members-names/result-members-names.component';
import { ResultPaceComponent } from '../result-pace/result-pace.component';
import { RaceAchievementsComponent } from '../race-achievements/race-achievements.component';
import { PaginationComponent } from '../pagination/pagination.component';

// Modals
import { RaceModalComponent } from '../../modals/race-modal.component';
import { ResultDetailsModalComponent } from '../../modals/result-details-modal.component';
import { ResultModalComponent } from '../../modals/result-modal.component';
import { RaceEditModalComponent } from '../../modals/race-edit-modal.component';

/**
 * RaceListComponent
 *
 * Replaces AJS `raceList` directive + `views/directives/raceList.html`.
 *
 * Displays a paginated list of races with expandable result sections.
 * Supports sorting (race date / distance / participation), admin CRUD for
 * races and results, and embeds all four Angular modals (race, result,
 * result-details, race-edit) internally.
 *
 * Usage:
 *   <app-race-list
 *     [racesList]="races"
 *     [searchQuery]="query"
 *     [resultsTableProperties]="{ pageSize: 10 }"
 *     [user]="user"
 *     [loading]="loading">
 *   </app-race-list>
 */
@Component({
  selector: 'app-race-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DatePipe,
    SecondsToTimeStringPipe,
    RaceinfoSportIconsPipe,
    InlineOrdinalSuffixPipe,
    RankTooltipPipe,
    RaceIconComponent,
    RacePhotosComponent,
    ResultIconComponent,
    ResultMembersNamesComponent,
    ResultPaceComponent,
    RaceAchievementsComponent,
    PaginationComponent,
    RaceModalComponent,
    ResultDetailsModalComponent,
    ResultModalComponent,
    RaceEditModalComponent
  ],
  template: `
    <div class="row">
      <div class="col-md-12">
        <ul class="results-list list-group">
          <li class="list-group-item text-left resultlistheader" *ngIf="racesList && racesList.length > 0">
            <div class="row">
              <div [ngClass]="user?.role === 'admin' ? 'col-sm-4' : 'col-sm-5'">
                <div class="btn-group" style="margin-right: 10px;">
                  <i class="fa hoverhand"
                     (click)="toggleExpandAll()"
                     title="Expand/Collapse all races"
                     [ngClass]="{'fa-expand': !allRacesExpanded(), 'fa-compress': allRacesExpanded()}"></i>
                </div>
                <span (click)="sortRaceBy('racedate')" class="listheader hoverhand" title="Event">
                  EVENT ({{ racesList.length }})
                </span>
              </div>
              <div class="col-sm-2" style="text-align: center;">
                <span (click)="sortRaceBy('distance')" class="listheader hoverhand" title="Event Distance">DISTANCE</span>
              </div>
              <div class="col-sm-1" style="text-align: center;">
                <span (click)="sortRaceBy('participation')" class="listheader hoverhand" title="Number of team members racing"># RACERS</span>
              </div>
              <div [ngClass]="user?.role === 'admin' ? 'col-sm-2' : 'col-sm-2'" style="text-align: center;">
                <span class="listheader hoverhand" title="Pace">BEST TIME</span>
              </div>
              <div class="col-sm-2" style="text-align: center;">
                <span class="listheader hoverhand" title="Achievements">ACHIEVEMENTS</span>
              </div>
              <div *ngIf="user?.role === 'admin'" class="col-sm-1" style="text-align: center;">
                <span class="listheader hoverhand" title="Edit">EDIT</span>
              </div>
            </div>
          </li>

          <li *ngFor="let raceInfo of paginatedRaces; trackBy: trackByRaceId"
              class="list-group-item text-left resultlistrow"
              [ngClass]="{'expanded': isRaceExpanded(raceInfo._id), 'collapsed': !isRaceExpanded(raceInfo._id)}"
              style="padding-right: 0px; padding-left: 0px; padding-bottom: 0px;">
            <div style="cursor: pointer;" (click)="expand(raceInfo)">
              <div class="row">
                <div [ngClass]="user?.role === 'admin' ? 'col-sm-4' : 'col-sm-5'" style="padding-left: 30px;">
                  <i class="fa"
                     [ngClass]="{'fa-chevron-right': !isRaceExpanded(raceInfo._id), 'fa-chevron-down': isRaceExpanded(raceInfo._id)}"
                     style="margin-right: 5px;"></i>
                  <span class="hoverhandandunderline resultEvent">{{ raceInfo.racename }}</span>
                  <app-race-icon [race]="raceInfo"></app-race-icon>
                  <i (click)="$event.stopPropagation(); showRaceModal(raceInfo)"
                     class="fa fa-external-link hoverhand"
                     style="margin-left: 5px;"
                     title="Open race details"></i>
                  <app-race-photos (click)="$event.stopPropagation()" [race]="raceInfo" class="race-photos-inherit"></app-race-photos>
                  <br>
                  <small style="margin-left: 5px;">
                    {{ raceInfo.racedate | date:'longDate':'UTC' }}
                    <span *ngIf="raceInfo.location?.state">-- {{ raceInfo.location.state }}</span>
                    <span *ngIf="!raceInfo.location?.state">-- {{ raceInfo.location?.country }}</span>
                  </small>
                </div>
                <div class="col-sm-2" style="text-align: center;">
                  <div *ngIf="!raceInfo.racetype?.isVariable && raceInfo.racetype?.name !== 'Multisport'">
                    {{ raceInfo.racetype?.name }}
                  </div>
                  <div *ngIf="raceInfo.racetype?.isVariable && raceInfo.racetype?.name !== 'Multisport'">
                    {{ raceInfo.distanceName }}
                  </div>
                  <div *ngIf="raceInfo.racetype?.name === 'Multisport'">
                    <span [innerHTML]="getRaceinfoSportIconsSafe(raceInfo)"></span>
                  </div>
                </div>
                <div class="col-sm-1" style="text-align: center;">
                  {{ raceInfo.results?.length || 0 }}
                </div>
                <div [ngClass]="user?.role === 'admin' ? 'col-sm-2' : 'col-sm-2'" style="text-align: center;">
                  <span class="resultTime">{{ raceInfo.results?.[0]?.time | secondsToTimeString }}</span>
                </div>
                <div class="col-sm-2" style="text-align: center;">
                  <app-race-achievements [race]="raceInfo"></app-race-achievements>
                </div>
                <div *ngIf="user?.role === 'admin'" class="col-sm-1" style="text-align: center;">
                  <i class="hoverhand fa fa-pencil"
                     (click)="$event.stopPropagation(); editRace(raceInfo)"
                     title="Edit race"></i>
                  <i class="hoverhand fa fa-trash"
                     (click)="$event.stopPropagation(); removeRace(raceInfo)"
                     title="Remove race"></i>
                  <i class="hoverhand fa fa-plus-square"
                     (click)="$event.stopPropagation(); showAddResultModal(raceInfo)"
                     title="Add a result for this race"></i>
                </div>
              </div>
            </div>

            <!-- Results Section -->
            <div *ngIf="isRaceExpanded(raceInfo._id)"
                 class="results-section"
                 style="margin-top: 0px; background-color: #006687; border-radius: 0px; padding: 15px;">
              <div class="row">
                <div class="col-md-12">
                  <ul style="padding-left: 0; margin-bottom: 0;" class="results-list list-group">
                    <li *ngIf="raceInfo.results?.length > 0"
                        class="list-group-item text-left resultlistheader"
                        style="background-color: #e9ecef; border: none; border-radius: 6px 6px 0 0; padding: 12px 15px;">
                      <div class="row" style="font-size: 0.9em; color: #495057;">
                        <div class="col-sm-3">
                          <span class="listheader" title="Racer's name">RACER</span>
                        </div>
                        <div class="col-sm-1" style="text-align: center;">
                          <span class="listheader" title="Age Group Ranking">AGE</span>
                        </div>
                        <div class="col-sm-1" style="text-align: center;">
                          <span class="listheader" title="Gender Ranking">GENDER</span>
                        </div>
                        <div class="col-sm-1" style="text-align: center;">
                          <span class="listheader" title="Overall Ranking">OVERALL</span>
                        </div>
                        <div class="col-sm-2" style="text-align: center;">
                          <span (click)="sortResultsBy(raceInfo, 'pace')" class="listheader hoverhand" title="Sort by pace">PACE</span>
                          <i (click)="sortResultsBy(raceInfo, 'agegrade')"
                             title="Sort by age grading"
                             class="hoverhand agesort fa fa-star"></i>
                        </div>
                        <div [ngClass]="user?.role === 'admin' ? 'col-sm-2' : 'col-sm-4'" style="text-align: center;">
                          <span (click)="sortResultsBy(raceInfo, 'time')"
                                class="listheader hoverhand"
                                title="Sort by net time">NET TIME</span>
                        </div>
                        <div class="col-sm-2" *ngIf="user?.role === 'admin'" style="text-align: center;">
                          <span class="listheader" title="Edit">EDIT</span>
                          <i class="hoverhand fa"
                             [ngClass]="isAllSelected(raceInfo) ? 'fa-check-square' : 'fa-square-o'"
                             (click)="toggleSelectAllResults(raceInfo)"
                             title="Select/Unselect all"
                             style="margin-left: 8px;"></i>
                          <i *ngIf="getSelectedResults(raceInfo).length > 0"
                             class="hoverhand fa fa-trash deleteselectedButton"
                             (click)="$event.stopPropagation(); deleteSelectedResults(raceInfo)"
                             title="Delete selected results"></i>
                        </div>
                      </div>
                    </li>

                    <li *ngFor="let result of raceInfo.results; trackBy: trackByResultId"
                        class="list-group-item text-left resultlistrow"
                        [ngClass]="{'my-result-row': isMyResult(result)}"
                        [ngStyle]="{'background-color': isMyResult(result) ? '#fff8e1' : 'white'}"
                        style="border: none; border-bottom: 1px solid #e9ecef; transition: background-color 0.2s ease;">
                      <div class="row" style="display: flex; align-items: center; font-size: 0.95em;">
                        <div class="col-sm-3">
                          <app-result-members-names [result]="result" [race]="raceInfo"></app-result-members-names>
                          <app-result-icon [result]="result" [race]="raceInfo" [raceDisplay]="true"></app-result-icon>
                          <i class="fa fa-comment-o hoverhand"
                             *ngIf="result.comments"
                             [title]="result.comments"></i>
                        </div>
                        <div class="col-sm-1" style="text-align: center;">
                          <span *ngIf="result.ranking?.agerank !== undefined && result.ranking?.agerank !== ''"
                                class="hoverhand"
                                [title]="rankTooltipText(result.ranking)"
                                [innerHTML]="getOrdinalSafe(result.ranking.agerank)"></span>
                        </div>
                        <div class="col-sm-1" style="text-align: center;">
                          <span *ngIf="result.ranking?.genderrank !== undefined && result.ranking?.genderrank !== ''"
                                class="hoverhand"
                                [title]="rankTooltipText(result.ranking)"
                                [innerHTML]="getOrdinalSafe(result.ranking.genderrank)"></span>
                        </div>
                        <div class="col-sm-1" style="text-align: center;">
                          <span *ngIf="result.ranking?.overallrank !== undefined && result.ranking?.overallrank !== ''"
                                class="hoverhand"
                                [title]="rankTooltipText(result.ranking)"
                                [innerHTML]="getOrdinalSafe(result.ranking.overallrank)"></span>
                        </div>
                        <div class="col-sm-2" *ngIf="!raceInfo.isMultisport" style="text-align: center;">
                          <app-result-pace [result]="result" [race]="raceInfo"></app-result-pace>
                        </div>
                        <div class="col-sm-2" *ngIf="raceInfo.isMultisport" style="text-align: center;">
                          <span class="hoverhandandunderline resultPace"
                                title="View details"
                                (click)="showResultDetailsModal(result, raceInfo)">View details</span>
                        </div>
                        <div [ngClass]="user?.role === 'admin' ? 'col-sm-2' : 'col-sm-4'" style="text-align: center;">
                          <span class="resultTime">{{ result.time | secondsToTimeString }}</span>
                          <a *ngIf="result.resultlink" [href]="result.resultlink" target="_blank">
                            <i class="fa fa-link hoverhand" *ngIf="result.resultlink !== ''" title="view result"></i>
                          </a>
                        </div>
                        <div class="col-sm-2" *ngIf="user?.role === 'admin'" style="text-align: center;">
                          <span>
                            <i class="hoverhand fa fa-pencil-square-o"
                               (click)="retrieveResultForEdit(raceInfo, result)"
                               title="edit result"></i>
                            <i class="hoverhand fa fa-trash"
                               (click)="removeResult(raceInfo, result)"
                               title="remove result"></i>
                            <input type="checkbox"
                                   [(ngModel)]="result.selected"
                                   class="result-checkbox"
                                   style="margin-right: 10px;">
                          </span>
                        </div>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <div class="row text-center" *ngIf="racesList && racesList.length > resultsTableProperties.pageSize">
      <div class="col-md-12">
        <app-pagination
          [totalItems]="racesList.length"
          [itemsPerPage]="resultsTableProperties.pageSize"
          [currentPage]="currentPage"
          (pageChange)="onPageChange($event)">
        </app-pagination>
      </div>
    </div>

    <!-- Embedded modals -->
    <app-race-modal
      [visible]="raceModalVisible"
      [raceinfo]="raceModalRace"
      (closed)="raceModalVisible = false"
      (showResultDetails)="onRaceModalShowResultDetails($event)"
      (editRace)="onRaceModalEditRace($event)">
    </app-race-modal>

    <app-result-details-modal
      [visible]="resultDetailsVisible"
      [result]="resultDetailsResult"
      [race]="resultDetailsRace"
      (closed)="resultDetailsVisible = false">
    </app-result-details-modal>

    <app-result-modal
      [visible]="resultModalVisible"
      [editmode]="resultModalEditMode"
      [resultInput]="resultModalInput"
      (saved)="onResultModalSaved($event)"
      (savedAndAddAnother)="onResultModalSavedAndAddAnother($event)"
      (closed)="resultModalVisible = false">
    </app-result-modal>

    <app-race-edit-modal
      [visible]="raceEditModalVisible"
      [raceInput]="raceEditModalInput"
      (saved)="onRaceEditModalSaved($event)"
      (closed)="raceEditModalVisible = false">
    </app-race-edit-modal>
  `
})
export class RaceListComponent implements OnChanges {
  @Input() racesList: any[] = [];
  @Input() searchQuery = '';
  @Input() resultsTableProperties: { pageSize: number } = { pageSize: 10 };
  @Input() user: any = null;
  @Input() loading = false;

  @Output() reloadRaces = new EventEmitter<void>();

  // Expansion & sorting state
  expandedRaces: Record<string, boolean> = {};
  sortCriteria: 'racedate' | 'distance' | 'participation' = 'racedate';
  sortDirection = false; // false = desc, true = asc

  // Pagination state
  currentPage = 1;
  paginatedRaces: any[] = [];

  // Embedded modal state
  raceModalVisible = false;
  raceModalRace: any = null;

  resultDetailsVisible = false;
  resultDetailsResult: any = null;
  resultDetailsRace: any = null;

  resultModalVisible = false;
  resultModalEditMode = false;
  resultModalInput: any = null;
  private resultModalContext: { raceInfo: any; isAdd: boolean; originalResult?: any } | null = null;

  raceEditModalVisible = false;
  raceEditModalInput: any = null;
  private raceEditContext: { raceInfo: any } | null = null;

  private raceinfoSportIconsPipe = new RaceinfoSportIconsPipe();
  private inlineOrdinalSuffixPipe = new InlineOrdinalSuffixPipe();
  private rankTooltipPipe = new RankTooltipPipe();

  constructor(
    private resultsService: ResultsService,
    private authState: AuthStateService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['racesList']) {
      this.updatePaginatedRaces();
    }
  }

  // ==========================================================================
  // Expand / collapse
  // ==========================================================================

  expand(raceInfo: any): void {
    if (raceInfo) {
      this.expandedRaces[raceInfo._id] = !this.expandedRaces[raceInfo._id];
    }
  }

  isRaceExpanded(raceId: string): boolean {
    return this.expandedRaces[raceId] === true;
  }

  expandAll(): void {
    if (!this.racesList) return;
    this.racesList.forEach(race => {
      this.expandedRaces[race._id] = true;
    });
  }

  collapseAll(): void {
    this.expandedRaces = {};
  }

  allRacesExpanded(): boolean {
    if (!this.racesList || this.racesList.length === 0) return false;
    return this.racesList.every(race => this.expandedRaces[race._id]);
  }

  toggleExpandAll(): void {
    if (this.allRacesExpanded()) {
      this.collapseAll();
    } else {
      this.expandAll();
    }
  }

  // ==========================================================================
  // Sorting
  // ==========================================================================

  sortRaceBy(criteria: 'racedate' | 'distance' | 'participation'): void {
    if (this.sortCriteria === criteria) {
      this.sortDirection = !this.sortDirection;
    } else {
      this.sortCriteria = criteria;
      this.sortDirection = true;
    }
    this.racesList.sort(this.customRaceSort(this.sortCriteria, this.sortDirection));
    this.updatePaginatedRaces();
  }

  private customRaceSort(field: string, order: boolean) {
    return (race1: any, race2: any): number => {
      if (field === 'racedate') {
        if (race1.racedate < race2.racedate) return order ? -1 : 1;
        if (race1.racedate > race2.racedate) return order ? 1 : -1;
        if (race1.order < race2.order) return order ? -1 : 1;
        if (race1.order > race2.order) return order ? 1 : -1;
        if (race1.racename < race2.racename) return order ? -1 : 1;
        if (race1.racename > race2.racename) return order ? 1 : -1;
        return 0;
      }
      if (field === 'distance') {
        if (race1.racetype.miles > race2.racetype.miles) return order ? -1 : 1;
        if (race1.racetype.miles < race2.racetype.miles) return order ? 1 : -1;
        return 0;
      }
      if (field === 'participation') {
        if (race1.results.length > race2.results.length) return order ? -1 : 1;
        if (race1.results.length < race2.results.length) return order ? 1 : -1;
        return 0;
      }
      return 0;
    };
  }

  sortResultsBy(raceInfo: any, criteria: 'pace' | 'time' | 'agegrade'): void {
    if (!raceInfo._sortCriteria) raceInfo._sortCriteria = 'time';
    if (!raceInfo._sortDirection) raceInfo._sortDirection = true;
    if (raceInfo._sortCriteria === criteria) {
      raceInfo._sortDirection = !raceInfo._sortDirection;
    } else {
      raceInfo._sortCriteria = criteria;
      raceInfo._sortDirection = true;
    }
    raceInfo.results.sort(this.customResultSort(raceInfo, raceInfo._sortCriteria, raceInfo._sortDirection));
  }

  private customResultSort(raceinfo: any, field: string, order: boolean) {
    return (result1: any, result2: any): number => {
      if (field === 'pace') {
        if (result1.race?.isMultisport) return 1;
        if (result2.race?.isMultisport) return -1;
        const p1 = result1.time / raceinfo.racetype.miles;
        const p2 = result2.time / raceinfo.racetype.miles;
        if (p1 < p2) return order ? -1 : 1;
        if (p1 > p2) return order ? 1 : -1;
        return 0;
      }
      if (field === 'time') {
        if (result1.time < result2.time) return order ? -1 : 1;
        if (result1.time > result2.time) return order ? 1 : -1;
        return 0;
      }
      if (field === 'agegrade') {
        if (result1.agegrade === undefined) return 1;
        if (result2.agegrade === undefined) return -1;
        if (result1.agegrade < result2.agegrade) return order ? -1 : 1;
        if (result1.agegrade > result2.agegrade) return order ? 1 : -1;
        return 0;
      }
      return 0;
    };
  }

  // ==========================================================================
  // Pagination
  // ==========================================================================

  private updatePaginatedRaces(): void {
    if (!this.racesList) {
      this.paginatedRaces = [];
      return;
    }
    const start = (this.currentPage - 1) * this.resultsTableProperties.pageSize;
    const end = start + this.resultsTableProperties.pageSize;
    this.paginatedRaces = this.racesList.slice(start, end);
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.expandedRaces = {};
    this.updatePaginatedRaces();
  }

  // ==========================================================================
  // Selection
  // ==========================================================================

  getSelectedResults(raceinfo: any): any[] {
    if (!raceinfo.results) return [];
    return raceinfo.results.filter((result: any) => result.selected);
  }

  isAllSelected(raceinfo: any): boolean {
    if (!raceinfo.results || raceinfo.results.length === 0) return false;
    return this.getSelectedResults(raceinfo).length === raceinfo.results.length;
  }

  toggleSelectAllResults(raceinfo: any): void {
    if (!raceinfo.results || raceinfo.results.length === 0) return;
    const allSelected = this.isAllSelected(raceinfo);
    raceinfo.results.forEach((result: any) => {
      result.selected = !allSelected;
    });
  }

  async deleteSelectedResults(raceinfo: any): Promise<void> {
    const selectedResults = this.getSelectedResults(raceinfo);
    if (!selectedResults.length) return;
    if (!confirm('Delete Selected Results? Are you sure you want to delete all selected results?')) return;

    for (const result of selectedResults) {
      await this.resultsService.deleteResult(result._id);
      const idx = raceinfo.results.indexOf(result);
      if (idx > -1) raceinfo.results.splice(idx, 1);
    }
  }

  // ==========================================================================
  // Identity helpers
  // ==========================================================================

  isMyResult(result: any): boolean {
    return !!(
      this.user?.member &&
      result?.members &&
      result.members.some((m: any) => m._id === this.user.member._id)
    );
  }

  trackByRaceId(_index: number, race: any): string {
    return race._id;
  }

  trackByResultId(_index: number, result: any): string {
    return result._id;
  }

  // ==========================================================================
  // Pipe invocations (for innerHTML / title)
  // ==========================================================================

  getRaceinfoSportIconsSafe(raceInfo: any): SafeHtml {
    const html = this.raceinfoSportIconsPipe.transform(raceInfo) || '';
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  getOrdinalSafe(rank: number | string): SafeHtml {
    const html = this.inlineOrdinalSuffixPipe.transform(Number(rank), true, 'red') || '';
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  rankTooltipText(ranking: any): string {
    return this.rankTooltipPipe.transform(ranking) || '';
  }

  // ==========================================================================
  // Modal launchers
  // ==========================================================================

  /** Opens the race detail modal (from the external-link icon on the row). */
  showRaceModal(raceInfo: any): void {
    if (!raceInfo) return;
    this.raceModalRace = raceInfo;
    this.raceModalVisible = true;
  }

  showResultDetailsModal(result: any, raceinfo: any): void {
    this.resultDetailsResult = result;
    this.resultDetailsRace = raceinfo;
    this.resultDetailsVisible = true;
  }

  /** Admin: add a new result for this race. */
  showAddResultModal(raceInfo: any): void {
    if (!raceInfo || !raceInfo.results || raceInfo.results.length === 0) return;
    // Pre-populate new result with race metadata from the first existing result
    const base = JSON.parse(JSON.stringify(raceInfo.results[0]));
    delete base._id;
    delete base.members;
    delete base.ranking;
    delete base.time;
    delete base.timeExp;
    delete base.agegrade;
    delete base.achievements;
    delete base.selected;
    delete base.comments;
    delete base.resultlink;

    this.resultModalInput = base;
    this.resultModalEditMode = false;
    this.resultModalContext = { raceInfo, isAdd: true };
    this.resultModalVisible = true;
  }

  /** Admin: edit a single result. Fetches the full result first. */
  async retrieveResultForEdit(raceInfo: any, resultSource: any): Promise<void> {
    const fullResult = await this.resultsService.getResultById(resultSource._id);
    if (!fullResult) return;
    this.resultModalInput = fullResult;
    this.resultModalEditMode = true;
    this.resultModalContext = { raceInfo, isAdd: false, originalResult: resultSource };
    this.resultModalVisible = true;
  }

  /** Admin: edit a race. */
  editRace(raceInfo: any): void {
    this.raceEditModalInput = raceInfo;
    this.raceEditContext = { raceInfo };
    this.raceEditModalVisible = true;
  }

  /** Admin: remove a single result. */
  async removeResult(raceinfo: any, resultSource: any): Promise<void> {
    if (!confirm('Remove Result? Are you sure you want to remove this result?')) return;
    await this.resultsService.deleteResult(resultSource._id);
    const index = raceinfo.results.indexOf(resultSource);
    if (index > -1) raceinfo.results.splice(index, 1);
  }

  /** Admin: remove a race entirely. */
  async removeRace(raceInfo: any): Promise<void> {
    if (!confirm('Remove Race? Are you sure you want to remove this race?')) return;
    await this.resultsService.deleteRace(raceInfo._id);
    const index = this.racesList.findIndex(r => r._id === raceInfo._id);
    if (index > -1) {
      this.racesList.splice(index, 1);
      this.updatePaginatedRaces();
    }
  }

  // ==========================================================================
  // Modal event handlers
  // ==========================================================================

  onRaceModalShowResultDetails(event: { result: any; race: any }): void {
    this.showResultDetailsModal(event.result, event.race);
  }

  onRaceModalEditRace(race: any): void {
    this.raceModalVisible = false;
    this.editRace(race);
  }

  onResultModalSaved(savedResult: any): void {
    this.applySavedResult(savedResult);
    this.resultModalVisible = false;
  }

  onResultModalSavedAndAddAnother(savedResult: any): void {
    this.applySavedResult(savedResult);
    // Modal stays open — ResultModal will reset its form for the next entry
  }

  private applySavedResult(savedResult: any): void {
    if (!savedResult || !this.resultModalContext) return;
    const ctx = this.resultModalContext;

    if (ctx.isAdd) {
      // New result — add to existing race or create a new race entry
      const existingRaceIndex = this.racesList.findIndex(r => r._id === savedResult.race._id);
      if (existingRaceIndex === -1) {
        const newRace = JSON.parse(JSON.stringify(savedResult.race));
        newRace.results = [savedResult];
        this.racesList.unshift(newRace);
      } else {
        this.racesList[existingRaceIndex].results.unshift(savedResult);
      }
      this.updatePaginatedRaces();
    } else {
      // Edit — may have moved to a different race
      const resultMoved = savedResult.race._id !== ctx.originalResult.race._id;
      if (resultMoved) {
        // Remove from original race
        const originalIndex = ctx.raceInfo.results.findIndex((r: any) => r._id === ctx.originalResult._id);
        if (originalIndex > -1) ctx.raceInfo.results.splice(originalIndex, 1);

        const existingRaceIndex = this.racesList.findIndex(r => r._id === savedResult.race._id);
        if (existingRaceIndex > -1) {
          this.racesList[existingRaceIndex].results.unshift(savedResult);
        } else {
          const newRace = JSON.parse(JSON.stringify(savedResult.race));
          newRace.results = [savedResult];
          this.racesList.unshift(newRace);
        }
      } else {
        // Normal update — same race ID
        const index = ctx.raceInfo.results.findIndex((r: any) => r._id === ctx.originalResult._id);
        if (index > -1) {
          ctx.raceInfo.results[index] = JSON.parse(JSON.stringify(savedResult));
        }
      }
      this.updatePaginatedRaces();
    }
  }

  onRaceEditModalSaved(updatedRace: any): void {
    if (!updatedRace || !this.raceEditContext) {
      this.raceEditModalVisible = false;
      return;
    }
    const originalRaceInfo = this.raceEditContext.raceInfo;
    const wasMerged = updatedRace._id !== originalRaceInfo._id;
    const originalIndex = this.racesList.findIndex(r => r._id === originalRaceInfo._id);

    if (wasMerged) {
      // Race was merged into a different race — remove the original
      if (originalIndex > -1) this.racesList.splice(originalIndex, 1);
      const targetIndex = this.racesList.findIndex(r => r._id === updatedRace._id);
      if (targetIndex > -1) {
        this.racesList[targetIndex] = JSON.parse(JSON.stringify(updatedRace));
      } else {
        this.racesList.push(JSON.parse(JSON.stringify(updatedRace)));
      }
    } else {
      // Normal update
      if (originalIndex > -1) {
        this.racesList[originalIndex] = JSON.parse(JSON.stringify(updatedRace));
      }
    }
    this.updatePaginatedRaces();
    this.raceEditModalVisible = false;
  }
}
