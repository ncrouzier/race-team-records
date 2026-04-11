import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { ResultsService } from '../../core/services/results.service';
import { UtilsService } from '../../core/services/utils.service';
import { TypeaheadSelectComponent } from '../components/typeahead-select/typeahead-select.component';

/**
 * RaceEditModalComponent
 *
 * Replaces AJS `RaceEditModalInstanceController` + `views/modals/raceEditModal.html`.
 *
 * Admin-only modal for editing race metadata and its associated results.
 *
 * Features:
 * - Edit race name, date, order, race type (with variable distance support)
 * - Edit location (country/state with USA state shortcuts)
 * - Toggle isMultisport flag
 * - Collapsible sections: results (inline-edit time + rankings), photoLinks, customOptions, achievements
 * - Save race + bulk-update modified results
 *
 * Usage:
 *   <app-race-edit-modal
 *     [visible]="showRaceEditModal"
 *     [raceInput]="selectedRace"
 *     (saved)="onRaceSaved($event)"
 *     (closed)="showRaceEditModal = false">
 *   </app-race-edit-modal>
 */
@Component({
  selector: 'app-race-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TypeaheadSelectComponent],
  template: `
    <div class="modal-backdrop fade in" *ngIf="visible" (click)="cancel()"></div>
    <div class="modal fade in" *ngIf="visible && race" style="display: block;" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header modern-modal-header">
            <button type="button" class="close" (click)="cancel()" style="position: absolute; right: 15px; top: 10px; z-index: 10;">&times;</button>
            <div class="race-edit-header-content">
              <div class="race-edit-title-section">
                <h3 class="race-edit-title">
                  <i class="fa fa-pencil"></i>
                  Edit Race: {{ race.racename }}
                </h3>
              </div>
            </div>
          </div>

          <div class="modal-body modern-modal-body" style="overflow: visible;">
            <form #raceEditForm="ngForm" novalidate>
              <div class="row">
                <div class="col-md-4">
                  <div class="form-group" [class.has-error]="raceNameInvalid">
                    <label class="text-left">Race name: *</label>
                    <input type="text"
                           name="racename"
                           class="form-control text-left"
                           [(ngModel)]="race.racename"
                           required>
                  </div>
                </div>
                <div class="col-md-3">
                  <div class="form-group" [class.has-error]="raceDateInvalid">
                    <label class="text-left">Race date: *</label>
                    <p class="input-group">
                      <input type="date"
                             name="racedate"
                             class="form-control input-md"
                             [(ngModel)]="raceDateString"
                             (ngModelChange)="onRaceDateChange($event)"
                             required />
                    </p>
                  </div>
                </div>
                <div class="col-md-1">
                  <label class="text-left">Order:</label>
                  <input type="number"
                         name="order"
                         [(ngModel)]="race.order"
                         min="0"
                         class="form-control input-md text-left"
                         placeholder="0">
                </div>
                <div class="col-md-4">
                  <div class="form-group">
                    <label class="text-left">Race Type: *</label>
                    <br>
                    <app-typeahead-select
                      [items]="racetypesList"
                      [displayFn]="racetypeDisplay"
                      [searchFields]="['name', 'surface']"
                      [placeholder]="'Select a race type'"
                      [(ngModel)]="race.racetype"
                      name="racetype"
                      [allowClear]="false">
                    </app-typeahead-select>
                  </div>
                </div>
              </div>

              <div class="row" *ngIf="race.racetype?.isVariable && race.racetype?.surface !== 'multiple'">
                <div class="col-md-3">
                  <div class="form-group">
                    <label class="text-left">Distance Display Name:</label>
                    <input type="text"
                           name="distanceName"
                           [(ngModel)]="race.distanceName"
                           class="form-control input-md text-left"
                           required>
                  </div>
                </div>
                <div class="col-md-4">
                  <div class="form-group">
                    <label class="text-left">Distance in meters:</label>
                    <input type="number"
                           name="meters"
                           [(ngModel)]="race.racetype.meters"
                           (ngModelChange)="onMetersChange()"
                           class="form-control input-md text-left"
                           required>
                  </div>
                </div>
                <div class="col-md-1 text-center">
                  <label><small>Auto convert</small></label>
                  <input type="checkbox" [(ngModel)]="autoconvert" name="autoconvert">
                </div>
                <div class="col-md-4">
                  <div class="form-group">
                    <label class="text-left">Distance in miles:</label>
                    <input type="number"
                           name="miles"
                           [(ngModel)]="race.racetype.miles"
                           (ngModelChange)="onMilesChange()"
                           class="form-control input-md text-left"
                           required>
                  </div>
                </div>
              </div>

              <div class="row">
                <div class="col-md-4">
                  <div class="form-group">
                    <label class="control-label text-left">Country:</label>
                    <br>
                    <app-typeahead-select
                      [items]="countries"
                      [displayFn]="countryDisplay"
                      [searchFields]="['name', 'code']"
                      [placeholder]="'Select a country'"
                      [(ngModel)]="selectedCountry"
                      (ngModelChange)="onCountryChange($event)"
                      name="country"
                      [allowClear]="false">
                    </app-typeahead-select>
                  </div>
                </div>
                <div class="col-md-4">
                  <div class="form-group">
                    <label class="control-label text-left">State:</label>
                    <br>
                    <app-typeahead-select
                      [items]="states"
                      [displayFn]="stateDisplay"
                      [searchFields]="['name', 'code']"
                      [placeholder]="'Select a state'"
                      [(ngModel)]="selectedState"
                      (ngModelChange)="onStateChange($event)"
                      name="state"
                      [allowClear]="true">
                    </app-typeahead-select>
                  </div>
                </div>
                <div class="col-md-4">
                  <div class="form-group">
                    <label class="control-label text-left">Shortcuts:</label>
                    <br>
                    <button type="button" class="btn btn-primary"
                            (click)="setLocation('USA', 'MD')">MD</button>
                    <button type="button" class="btn btn-primary"
                            (click)="setLocation('USA', 'DC')">DC</button>
                    <button type="button" class="btn btn-primary"
                            (click)="setLocation('USA', 'VA')">VA</button>
                    <button type="button" class="btn btn-primary"
                            (click)="setLocation('USA', 'PA')">PA</button>
                    <button type="button" class="btn btn-primary"
                            (click)="setLocation('USA', 'DE')">DE</button>
                  </div>
                </div>
              </div>

              <div class="row">
                <div class="col-md-12">
                  <div class="form-group">
                    <label class="text-left">Is MultiSport?</label>
                    <div class="checkbox">
                      <label>
                        <input type="checkbox" [(ngModel)]="race.isMultisport" name="isMultisport">
                        This is a multisport event (triathlon, duathlon, etc.)
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Results Section -->
              <div class="custom-options-section">
                <div class="section-header collapsible" (click)="toggleResults()">
                  <h4>
                    <i class="fa" [class.fa-chevron-right]="resultsCollapsed" [class.fa-chevron-down]="!resultsCollapsed"></i>
                    Results <span class="item-count">({{ raceResults ? raceResults.length : 0 }})</span>
                  </h4>
                </div>
                <div class="results-content" *ngIf="!resultsCollapsed">
                  <div class="loading-indicator" *ngIf="loadingResults">
                    <i class="fa fa-spinner fa-spin"></i> Loading results...
                  </div>
                  <div class="results-table" *ngIf="raceResults && raceResults.length > 0">
                    <div class="table-responsive">
                      <table class="table table-striped">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Time</th>
                            <th>Time Details</th>
                            <th>Overall</th>
                            <th>Gender</th>
                            <th>Age</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr *ngFor="let result of raceResults; let i = index">
                            <td>{{ result.members?.[0]?.firstname }} {{ result.members?.[0]?.lastname }}</td>
                            <td><span class="resultTime">{{ formatTime(result.time) }}</span></td>
                            <td class="agegradeCell customtime nowrap">
                              <div class="input-group input-group-sm" style="width: 100px;">
                                <input type="number" min="0" style="width: 29px;"
                                       [(ngModel)]="result.timeExp.hours"
                                       [ngModelOptions]="{standalone: true}"
                                       (ngModelChange)="updateTime(result)" placeholder="0">:<input type="number"
                                       min="0" max="59" style="width: 29px;"
                                       [(ngModel)]="result.timeExp.minutes"
                                       [ngModelOptions]="{standalone: true}"
                                       (ngModelChange)="updateTime(result)" placeholder="0">:<input type="number"
                                       min="0" max="59" style="width: 29px;"
                                       [(ngModel)]="result.timeExp.seconds"
                                       [ngModelOptions]="{standalone: true}"
                                       (ngModelChange)="updateTime(result)" placeholder="0">.<input type="number"
                                       min="0" max="99" style="width: 29px;"
                                       [(ngModel)]="result.timeExp.centiseconds"
                                       [ngModelOptions]="{standalone: true}"
                                       (ngModelChange)="updateTime(result)" placeholder="0">
                              </div>
                            </td>
                            <td>
                              <div class="input-group input-group-sm" style="width: 120px;">
                                <input type="number" [(ngModel)]="result.ranking.overallrank"
                                       [ngModelOptions]="{standalone: true}"
                                       class="form-inline input-md text-left" style="width: 50px;"
                                       (ngModelChange)="markResultsModified()">
                                <span>/</span>
                                <input type="number" [(ngModel)]="result.ranking.overalltotal"
                                       [ngModelOptions]="{standalone: true}"
                                       class="form-inline input-md text-left" style="width: 50px;"
                                       (ngModelChange)="markResultsModified()">
                              </div>
                            </td>
                            <td>
                              <div class="input-group input-group-sm" style="width: 120px;">
                                <input type="number" [(ngModel)]="result.ranking.genderrank"
                                       [ngModelOptions]="{standalone: true}"
                                       class="form-inline input-md text-left" style="width: 50px;"
                                       (ngModelChange)="markResultsModified()">
                                <span>/</span>
                                <input type="number" [(ngModel)]="result.ranking.gendertotal"
                                       [ngModelOptions]="{standalone: true}"
                                       class="form-inline input-md text-left" style="width: 50px;"
                                       (ngModelChange)="markResultsModified()">
                              </div>
                            </td>
                            <td>
                              <div class="input-group input-group-sm" style="width: 120px;">
                                <input type="number" [(ngModel)]="result.ranking.agerank"
                                       [ngModelOptions]="{standalone: true}"
                                       class="form-inline input-md text-left" style="width: 50px;"
                                       (ngModelChange)="markResultsModified()">
                                <span>/</span>
                                <input type="number" [(ngModel)]="result.ranking.agetotal"
                                       [ngModelOptions]="{standalone: true}"
                                       class="form-inline input-md text-left" style="width: 50px;"
                                       (ngModelChange)="markResultsModified()">
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div class="no-results-message" *ngIf="!loadingResults && (!raceResults || raceResults.length === 0)">
                    <p class="text-muted">No results found for this race.</p>
                  </div>
                </div>
              </div>

              <!-- Photo Links Section -->
              <div class="photo-links-section">
                <div class="section-header collapsible" (click)="togglePhotoLinks()">
                  <h4>
                    <i class="fa" [class.fa-chevron-right]="photoLinksCollapsed" [class.fa-chevron-down]="!photoLinksCollapsed"></i>
                    Photo Links <span class="item-count">({{ race.photoLinks ? race.photoLinks.length : 0 }})</span>
                  </h4>
                  <button type="button" class="btn btn-sm btn-success"
                          (click)="addPhotoLink(); $event.stopPropagation()">
                    <i class="fa fa-plus"></i> Add Photo Link
                  </button>
                </div>
                <div class="photo-links-content" *ngIf="!photoLinksCollapsed">
                  <div class="photo-link-item" *ngFor="let link of race.photoLinks; let i = index; trackBy: trackByIndex">
                    <div class="row">
                      <div class="col-md-7">
                        <div class="form-group">
                          <label>URL</label>
                          <input type="text" class="form-control" [(ngModel)]="link.url"
                                 [ngModelOptions]="{standalone: true}"
                                 placeholder="https://photos.example.com/album">
                        </div>
                      </div>
                      <div class="col-md-4">
                        <div class="form-group">
                          <label>Label</label>
                          <input type="text" class="form-control" [(ngModel)]="link.label"
                                 [ngModelOptions]="{standalone: true}"
                                 placeholder="Photos">
                        </div>
                      </div>
                      <div class="col-md-1">
                        <div class="form-group">
                          <label>&nbsp;</label>
                          <button type="button" class="btn btn-sm btn-danger"
                                  (click)="removePhotoLink(i)">
                            <i class="fa fa-trash"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="no-items-message" *ngIf="!race.photoLinks || race.photoLinks.length === 0">
                    <p class="text-muted">No photo links added yet. Click "Add Photo Link" to get started.</p>
                  </div>
                </div>
              </div>

              <!-- Custom Options Section -->
              <div class="custom-options-section">
                <div class="section-header collapsible" (click)="toggleCustomOptions()">
                  <h4>
                    <i class="fa" [class.fa-chevron-right]="customOptionsCollapsed" [class.fa-chevron-down]="!customOptionsCollapsed"></i>
                    Custom Options <span class="item-count">({{ race.customOptions ? race.customOptions.length : 0 }})</span>
                  </h4>
                  <button type="button" class="btn btn-sm btn-success"
                          (click)="addCustomOption(); $event.stopPropagation()">
                    <i class="fa fa-plus"></i> Add Custom Option
                  </button>
                </div>
                <div class="custom-options-content" *ngIf="!customOptionsCollapsed">
                  <div class="custom-option-item" *ngFor="let option of race.customOptions; let i = index; trackBy: trackByIndex">
                    <div class="row">
                      <div class="col-md-3">
                        <div class="form-group">
                          <label>Option Name</label>
                          <div class="input-group">
                            <div class="input-group-btn dropdown" [class.open]="openPresetIndex === i">
                              <button type="button" class="btn btn-default"
                                      (click)="togglePresetDropdown(i); $event.stopPropagation()">
                                <span class="caret"></span>
                              </button>
                              <ul class="dropdown-menu" *ngIf="openPresetIndex === i">
                                <li><a (click)="setRaceCustomOptionPreset(i, 'raceIcon')">raceIcon</a></li>
                                <li><a (click)="setRaceCustomOptionPreset(i, 'raceText')">raceText</a></li>
                              </ul>
                            </div>
                            <input type="text" class="form-control" [(ngModel)]="option.name"
                                   [ngModelOptions]="{standalone: true}">
                          </div>
                        </div>
                      </div>
                      <div class="col-md-3">
                        <div class="form-group">
                          <label>Option Text</label>
                          <input type="text" class="form-control" [(ngModel)]="option.text"
                                 [ngModelOptions]="{standalone: true}">
                        </div>
                      </div>
                      <div class="col-md-5">
                        <div class="form-group">
                          <label>Value (JSON)</label>
                          <textarea class="form-control" rows="3"
                                    [(ngModel)]="option.valueString"
                                    [ngModelOptions]="{standalone: true}"
                                    (ngModelChange)="updateCustomOptionValue(i)"
                                    placeholder="Enter JSON value..."></textarea>
                        </div>
                      </div>
                      <div class="col-md-1">
                        <div class="form-group">
                          <label>&nbsp;</label>
                          <button type="button" class="btn btn-sm btn-danger"
                                  (click)="removeCustomOption(i)">
                            <i class="fa fa-trash"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="no-items-message" *ngIf="!race.customOptions || race.customOptions.length === 0">
                    <p class="text-muted">No custom options added yet. Click "Add Custom Option" to get started.</p>
                  </div>
                </div>
              </div>

              <!-- Achievements Section -->
              <div class="achievements-section">
                <div class="section-header collapsible" (click)="toggleAchievements()">
                  <h4>
                    <i class="fa" [class.fa-chevron-right]="achievementsCollapsed" [class.fa-chevron-down]="!achievementsCollapsed"></i>
                    Achievements <span class="item-count">({{ race.achievements ? race.achievements.length : 0 }})</span>
                  </h4>
                  <button type="button" class="btn btn-sm btn-success"
                          (click)="addAchievement(); $event.stopPropagation()">
                    <i class="fa fa-plus"></i> Add Achievement
                  </button>
                </div>
                <div class="achievements-content" *ngIf="!achievementsCollapsed">
                  <div class="achievement-item" *ngFor="let achievement of race.achievements; let i = index; trackBy: trackByIndex">
                    <div class="row">
                      <div class="col-md-3">
                        <div class="form-group">
                          <label>Achievement Name</label>
                          <input type="text" class="form-control"
                                 [(ngModel)]="achievement.name"
                                 [ngModelOptions]="{standalone: true}"
                                 [disabled]="isAchievementDisabled(achievement)">
                        </div>
                      </div>
                      <div class="col-md-3">
                        <div class="form-group">
                          <label>Achievement Text</label>
                          <input type="text" class="form-control"
                                 [(ngModel)]="achievement.text"
                                 [ngModelOptions]="{standalone: true}"
                                 [disabled]="isAchievementDisabled(achievement)">
                        </div>
                      </div>
                      <div class="col-md-5">
                        <div class="form-group">
                          <label>Value (JSON)</label>
                          <textarea class="form-control" rows="3"
                                    [(ngModel)]="achievement.valueString"
                                    [ngModelOptions]="{standalone: true}"
                                    (ngModelChange)="updateAchievementValue(i)"
                                    [disabled]="isAchievementDisabled(achievement)"
                                    placeholder="Enter JSON value..."></textarea>
                        </div>
                      </div>
                      <div class="col-md-1">
                        <div class="form-group">
                          <label>&nbsp;</label>
                          <button type="button" class="btn btn-sm btn-danger"
                                  (click)="removeAchievement(i)">
                            <i class="fa fa-trash"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="no-items-message" *ngIf="!race.achievements || race.achievements.length === 0">
                    <p class="text-muted">No achievements added yet. Click "Add Achievement" to get started.</p>
                  </div>
                </div>
              </div>
            </form>
          </div>

          <div class="modal-footer modern-modal-footer">
            <div class="footer-actions">
              <button class="btn btn-secondary modern-btn" (click)="cancel()">
                <i class="fa fa-times"></i>
                Cancel
              </button>
              <button class="btn btn-primary modern-btn"
                      (click)="save()"
                      [disabled]="!isFormValid() || saving">
                <i class="fa fa-save"></i>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop.fade.in { opacity: 0.5; }
    .modal.fade.in { display: block; background: transparent; }
    .section-header.collapsible { cursor: pointer; user-select: none; display: flex; align-items: center; justify-content: space-between; padding: 8px 0; }
    .section-header.collapsible h4 { margin: 0; display: inline-flex; align-items: center; gap: 8px; }
    .item-count { color: #999; font-size: 0.85em; font-weight: normal; }
    .photo-link-item, .custom-option-item, .achievement-item { padding: 10px 0; border-bottom: 1px solid #eee; }
    .photo-link-item:last-child, .custom-option-item:last-child, .achievement-item:last-child { border-bottom: none; }
    .no-items-message, .no-results-message { padding: 10px 0; }
    .dropdown.open .dropdown-menu { display: block; }
  `]
})
export class RaceEditModalComponent implements OnChanges {
  @Input() visible = false;
  @Input() raceInput: any = null;

  @Output() saved = new EventEmitter<any>();
  @Output() closed = new EventEmitter<void>();

  race: any = null;
  raceDateString = '';

  racetypesList: any[] = [];
  countries: any[] = [];
  states: any[] = [];

  selectedCountry: any = null;
  selectedState: any = null;

  autoconvert = true;

  achievementsCollapsed = true;
  customOptionsCollapsed = true;
  photoLinksCollapsed = true;
  resultsCollapsed = true;

  openPresetIndex: number | null = null;

  raceResults: any[] = [];
  loadingResults = false;
  resultsModified = false;

  saving = false;

  constructor(
    private resultsService: ResultsService,
    private utilsService: UtilsService
  ) {
    this.states = this.utilsService.states;
    this.countries = this.utilsService.countries;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible && this.raceInput) {
      this.initRace();
      this.loadRaceTypes();
      this.loadRaceResults();
    }
    if (!this.visible) {
      this.openPresetIndex = null;
    }
  }

  // =========================================================================
  // Init
  // =========================================================================

  private initRace(): void {
    // Deep copy to avoid mutating the original
    this.race = JSON.parse(JSON.stringify(this.raceInput));

    // Ensure achievements array and convert values to JSON strings for display
    if (!this.race.achievements) {
      this.race.achievements = [];
    } else {
      this.race.achievements.forEach((a: any) => {
        if (a.value !== undefined && a.value !== null) {
          a.valueString = typeof a.value === 'object' ? JSON.stringify(a.value, null, 2) : String(a.value);
        } else {
          a.valueString = '';
        }
      });
    }

    // Ensure customOptions array and convert values to JSON strings for display
    if (!this.race.customOptions) {
      this.race.customOptions = [];
    } else {
      this.race.customOptions.forEach((o: any) => {
        if (o.value !== undefined && o.value !== null) {
          o.valueString = typeof o.value === 'object' ? JSON.stringify(o.value, null, 2) : String(o.value);
        } else {
          o.valueString = '';
        }
      });
    }

    // Ensure photoLinks array
    if (!this.race.photoLinks) {
      this.race.photoLinks = [];
    }

    // Ensure location object
    if (!this.race.location) {
      this.race.location = { country: '', state: '' };
    }

    // Ensure racetype object
    if (!this.race.racetype) {
      this.race.racetype = {
        name: '',
        surface: 'road',
        miles: 0,
        isVariable: false
      };
    }

    // Convert date to ISO string for the date picker (YYYY-MM-DD)
    if (this.race.racedate) {
      const d = new Date(this.race.racedate);
      this.race.racedate = d;
      this.raceDateString = this.toDateString(d);
    }

    if (this.race.isMultisport === undefined) {
      this.race.isMultisport = false;
    }

    // Init collapse state based on content
    this.customOptionsCollapsed = !(this.race.customOptions && this.race.customOptions.length > 0);
    this.photoLinksCollapsed = !(this.race.photoLinks && this.race.photoLinks.length > 0);
    this.achievementsCollapsed = true;
    this.resultsCollapsed = true;

    // Sync selected country/state objects for typeahead
    this.selectedCountry = this.countries.find(c => c.code === this.race.location.country) || null;
    this.selectedState = this.states.find(s => s.code === this.race.location.state) || null;

    this.resultsModified = false;
  }

  private loadRaceTypes(): void {
    this.resultsService.getRaceTypes({ sort: 'meters' }).then((racetypes: any[]) => {
      this.racetypesList = racetypes || [];
      // Re-sync race.racetype to a reference inside the list so the typeahead shows a match
      if (this.race && this.race.racetype && this.race.racetype._id) {
        const match = this.racetypesList.find(rt => rt._id === this.race.racetype._id);
        if (match) {
          this.race.racetype = match;
        }
      }
    });
  }

  private loadRaceResults(): void {
    if (!this.race || !this.race._id) {
      console.log('No race ID available');
      return;
    }
    this.loadingResults = true;
    this.resultsService.getResults({ filters: { raceid: this.race._id } }).then((results: any[]) => {
      this.raceResults = results || [];
      this.raceResults.forEach(result => {
        if (!result.ranking) {
          result.ranking = {};
        }
        if (result.time || result.time === 0) {
          result.timeExp = {
            hours: Math.floor(result.time / 360000),
            minutes: Math.floor(((result.time % 8640000) % 360000) / 6000),
            seconds: Math.floor((((result.time % 8640000) % 360000) % 6000) / 100),
            centiseconds: Math.floor((((result.time % 8640000) % 360000) % 6000) % 100)
          };
        } else {
          result.timeExp = { hours: 0, minutes: 0, seconds: 0, centiseconds: 0 };
        }
      });
      this.raceResults.sort((a, b) => {
        if (a.time < b.time) return -1;
        if (a.time > b.time) return 1;
        return 0;
      });
      this.loadingResults = false;
    }).catch(error => {
      console.error('Error loading race results:', error);
      this.loadingResults = false;
    });
  }

  // =========================================================================
  // Form helpers
  // =========================================================================

  get raceNameInvalid(): boolean {
    return !this.race?.racename || this.race.racename.trim() === '';
  }

  get raceDateInvalid(): boolean {
    return !this.raceDateString;
  }

  isFormValid(): boolean {
    if (this.raceNameInvalid || this.raceDateInvalid) return false;
    if (!this.race?.racetype) return false;
    if (this.race.location?.country === 'USA' && !this.race.location?.state) return false;
    if (this.race.racetype?.isVariable && this.race.racetype?.surface !== 'multiple') {
      if (!this.race.distanceName || !this.race.racetype.meters || !this.race.racetype.miles) return false;
    }
    return true;
  }

  private toDateString(d: Date): string {
    if (!d || isNaN(d.getTime())) return '';
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  onRaceDateChange(value: string): void {
    if (value) {
      const [y, m, d] = value.split('-').map(Number);
      this.race.racedate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    } else {
      this.race.racedate = null;
    }
  }

  // =========================================================================
  // Typeahead display functions
  // =========================================================================

  racetypeDisplay = (rt: any): string => {
    if (!rt) return '';
    return `${rt.name} (${rt.surface})`;
  };

  countryDisplay = (c: any): string => {
    if (!c) return '';
    return `${c.name} (${c.code})`;
  };

  stateDisplay = (s: any): string => {
    if (!s) return '';
    return `${s.name} (${s.code})`;
  };

  onCountryChange(country: any): void {
    this.selectedCountry = country;
    const newCountryCode = country?.code || '';
    const prev = this.race.location.country;
    this.race.location.country = newCountryCode;
    if (newCountryCode !== prev && newCountryCode !== 'USA') {
      this.race.location.state = null;
      this.selectedState = null;
    }
  }

  onStateChange(state: any): void {
    this.selectedState = state;
    this.race.location.state = state?.code || null;
  }

  setLocation(country: string, state: string): void {
    this.race.location.country = country;
    this.race.location.state = state;
    this.selectedCountry = this.countries.find(c => c.code === country) || null;
    this.selectedState = this.states.find(s => s.code === state) || null;
  }

  // =========================================================================
  // Distance conversion
  // =========================================================================

  onMetersChange(): void {
    if (this.autoconvert && this.race.racetype.meters) {
      this.race.racetype.miles = +(this.race.racetype.meters * 0.000621371).toFixed(2);
    }
  }

  onMilesChange(): void {
    if (this.autoconvert && this.race.racetype.miles) {
      this.race.racetype.meters = Math.round(this.race.racetype.miles * 1609.34);
    }
  }

  // =========================================================================
  // Achievements
  // =========================================================================

  addAchievement(): void {
    this.race.achievements.push({ name: '', text: '', value: '', valueString: '' });
    this.achievementsCollapsed = false;
  }

  removeAchievement(index: number): void {
    this.race.achievements.splice(index, 1);
  }

  updateAchievementValue(index: number): void {
    const achievement = this.race.achievements[index];
    try {
      if (achievement.valueString && achievement.valueString.trim()) {
        achievement.value = JSON.parse(achievement.valueString);
      } else {
        achievement.value = '';
      }
    } catch (e) {
      achievement.value = achievement.valueString;
    }
  }

  isAchievementDisabled(achievement: any): boolean {
    return achievement.name === 'newLocation';
  }

  // =========================================================================
  // Custom Options
  // =========================================================================

  addCustomOption(): void {
    this.race.customOptions.push({ name: '', text: '', value: '', valueString: '' });
    this.customOptionsCollapsed = false;
  }

  removeCustomOption(index: number): void {
    this.race.customOptions.splice(index, 1);
  }

  updateCustomOptionValue(index: number): void {
    const option = this.race.customOptions[index];
    try {
      if (option.valueString && option.valueString.trim()) {
        option.value = JSON.parse(option.valueString);
      } else {
        option.value = '';
      }
    } catch (e) {
      option.value = option.valueString;
    }
  }

  togglePresetDropdown(index: number): void {
    this.openPresetIndex = this.openPresetIndex === index ? null : index;
  }

  setRaceCustomOptionPreset(index: number, presetName: string): void {
    const option = this.race.customOptions[index];
    const PRESETS: Record<string, any> = {
      raceIcon: { name: 'raceIcon', text: '', value: '' },
      raceText: { name: 'raceText', text: '', value: '' }
    };
    const preset = PRESETS[presetName];
    if (preset) {
      option.name = preset.name;
      option.text = preset.text;
      option.value = preset.value;
      option.valueString = typeof preset.value === 'object' ? JSON.stringify(preset.value) : String(preset.value);
    }
    this.openPresetIndex = null;
  }

  // =========================================================================
  // Photo Links
  // =========================================================================

  addPhotoLink(): void {
    this.race.photoLinks.push({ url: '', label: '' });
    this.photoLinksCollapsed = false;
  }

  removePhotoLink(index: number): void {
    this.race.photoLinks.splice(index, 1);
  }

  // =========================================================================
  // Results editing
  // =========================================================================

  markResultsModified(): void {
    this.resultsModified = true;
  }

  updateTime(result: any): void {
    result.timeExp.hours = parseInt(result.timeExp.hours, 10) || 0;
    result.timeExp.minutes = parseInt(result.timeExp.minutes, 10) || 0;
    result.timeExp.seconds = parseInt(result.timeExp.seconds, 10) || 0;
    result.timeExp.centiseconds = parseInt(result.timeExp.centiseconds, 10) || 0;

    result.time = (result.timeExp.hours * 3600 +
                   result.timeExp.minutes * 60 +
                   result.timeExp.seconds) * 100 +
                  result.timeExp.centiseconds;
    this.markResultsModified();
  }

  formatTime(t: number): string {
    if (t === null || t === undefined) return '';
    const hours = Math.floor(t / 360000);
    const minutes = Math.floor(((t % 8640000) % 360000) / 6000);
    const seconds = Math.floor((((t % 8640000) % 360000) % 6000) / 100);
    const cs = Math.floor((((t % 8640000) % 360000) % 6000) % 100);
    const pad = (n: number) => String(n).padStart(2, '0');
    if (hours > 0) {
      return `${hours}:${pad(minutes)}:${pad(seconds)}.${pad(cs)}`;
    }
    return `${minutes}:${pad(seconds)}.${pad(cs)}`;
  }

  // =========================================================================
  // Collapse toggles
  // =========================================================================

  toggleAchievements(): void { this.achievementsCollapsed = !this.achievementsCollapsed; }
  toggleCustomOptions(): void { this.customOptionsCollapsed = !this.customOptionsCollapsed; }
  togglePhotoLinks(): void { this.photoLinksCollapsed = !this.photoLinksCollapsed; }
  toggleResults(): void { this.resultsCollapsed = !this.resultsCollapsed; }

  // =========================================================================
  // Save / Cancel
  // =========================================================================

  async save(): Promise<void> {
    if (!this.isFormValid() || this.saving) return;
    this.saving = true;

    // Process all achievement values
    if (this.race.achievements) {
      this.race.achievements.forEach((_: any, i: number) => this.updateAchievementValue(i));
    }
    // Process all custom option values
    if (this.race.customOptions) {
      this.race.customOptions.forEach((_: any, i: number) => this.updateCustomOptionValue(i));
    }

    try {
      const updatedRace = await this.resultsService.updateRace(this.race);
      if (!updatedRace) {
        this.saving = false;
        return;
      }

      if (this.resultsModified && this.raceResults && this.raceResults.length > 0) {
        const resultsToUpdate = this.raceResults.map((result: any) => ({
          _id: result._id,
          time: result.time,
          ranking: result.ranking,
          members: result.members,
          legs: result.legs,
          comments: result.comments,
          resultlink: result.resultlink,
          isRecordEligible: result.isRecordEligible,
          customOptions: result.customOptions,
          achievements: result.achievements
        }));

        try {
          const response = await this.resultsService.updateResultsBulk(resultsToUpdate);
          updatedRace.results = response?.results;
        } catch (error) {
          console.error('Error updating results:', error);
          // Still close the modal on results-update failure
        }
      }

      this.saving = false;
      this.saved.emit(updatedRace);
      this.close();
    } catch (error) {
      console.error('Error saving race:', error);
      this.saving = false;
    }
  }

  cancel(): void {
    this.close();
  }

  private close(): void {
    this.visible = false;
    this.closed.emit();
  }

  // =========================================================================
  // Misc
  // =========================================================================

  trackByIndex(index: number): number {
    return index;
  }
}
