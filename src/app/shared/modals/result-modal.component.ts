import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LocalStorageService } from 'ngx-webstorage';

import { MembersService } from '../../core/services/members.service';
import { ResultsService } from '../../core/services/results.service';
import { UtilsService } from '../../core/services/utils.service';
import { TypeaheadSelectComponent } from '../components/typeahead-select/typeahead-select.component';

/**
 * ResultModalComponent
 *
 * Replaces AJS `ResultModalInstanceController` + `views/modals/resultModal.html`.
 *
 * Add/edit a single result record. Supports:
 *  - create new result (with optional duplicate-from-existing prefill)
 *  - edit existing result
 *  - multisport (variable legs) with triathlon template button
 *  - auto-conversion between meters/miles for variable distances
 *  - custom options with JSON value parsing + presets
 *  - localStorage persistence of last-used race / location / rankings
 *
 * Usage:
 *   <app-result-modal
 *     [visible]="show"
 *     [editmode]="false"
 *     [resultInput]="resultToDuplicateOrEdit"
 *     (saved)="onSaved($event)"
 *     (savedAndAddAnother)="onSavedAddAnother($event)"
 *     (closed)="show = false">
 *   </app-result-modal>
 */
@Component({
  selector: 'app-result-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TypeaheadSelectComponent],
  template: `
    <div class="modal-backdrop fade in" *ngIf="visible" (click)="cancel()"></div>
    <div class="modal fade in" *ngIf="visible" style="display: block;" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title" *ngIf="!editmode">
              Add Result
              <i class="red hoverhand fa fa-trash-o" (click)="clearForm()" title="Clear form"></i>
            </h3>
            <h3 class="modal-title" *ngIf="editmode">
              Edit Result
              <i class="red hoverhand fa fa-trash-o" (click)="clearForm()" title="Clear form"></i>
            </h3>
            <button type="button" class="close" (click)="cancel()" style="position: absolute; right: 15px; top: 10px;">&times;</button>
          </div>

          <div class="modal-body" style="overflow: visible;">
            <form #formresult="ngForm">

              <!-- Race name / date / order / type -->
              <div class="row">
                <div class="col-md-4">
                  <div class="form-group" [class.has-error]="raceName?.invalid && raceName?.touched">
                    <label class="text-left">Race name:</label>
                    <input type="text" name="racename" #raceName="ngModel"
                           class="form-control text-left"
                           [(ngModel)]="formData.race.racename" required>
                  </div>
                </div>
                <div class="col-md-3">
                  <div class="form-group">
                    <label class="text-left">Race date:</label>
                    <input type="date" name="racedate"
                           class="form-control input-md"
                           [class.redbg]="isOlderDateCheck(raceDateString)"
                           [(ngModel)]="raceDateString"
                           (ngModelChange)="onRaceDateChange($event)"
                           required>
                  </div>
                </div>
                <div class="col-md-1">
                  <label class="text-left">Order:</label>
                  <input type="text" name="order"
                         [(ngModel)]="formData.race.order"
                         class="form-control input-md text-left" placeholder="0">
                </div>
                <div class="col-md-4">
                  <div class="form-group">
                    <label class="text-left">Race Type:</label>
                    <app-typeahead-select
                      [items]="racetypesList"
                      [displayFn]="racetypeDisplayFn"
                      [searchFields]="['name', 'surface']"
                      [(ngModel)]="formData.race.racetype"
                      [ngModelOptions]="{standalone: true}"
                      placeholder="Select a race type">
                    </app-typeahead-select>
                  </div>
                </div>
              </div>

              <!-- Variable distance (only for variable racetype, non-multiple) -->
              <div class="row" *ngIf="formData.race.racetype?.isVariable && formData.race.racetype?.surface !== 'multiple'">
                <div class="col-md-3">
                  <div class="form-group">
                    <label class="text-left">Distance Display Name:</label>
                    <input type="text" name="distanceName"
                           [(ngModel)]="formData.race.distanceName"
                           class="form-control input-md text-left" required>
                  </div>
                </div>
                <div class="col-md-4">
                  <div class="form-group">
                    <label class="text-left">Distance in meters:</label>
                    <input type="text" name="meters"
                           [(ngModel)]="formData.race.racetype.meters"
                           (ngModelChange)="onMetersChange()"
                           class="form-control input-md text-left" required>
                  </div>
                </div>
                <div class="col-md-1 text-center">
                  <label><small>Auto convert</small></label>
                  <input type="checkbox" name="autoconvert" [(ngModel)]="autoconvert">
                </div>
                <div class="col-md-4">
                  <div class="form-group">
                    <label class="text-left">Distance in miles:</label>
                    <input type="text" name="miles"
                           [(ngModel)]="formData.race.racetype.miles"
                           (ngModelChange)="onMilesChange()"
                           class="form-control input-md text-left" required>
                  </div>
                </div>
              </div>

              <!-- Country / state / shortcuts -->
              <div class="row">
                <div class="col-md-4">
                  <div class="form-group">
                    <label class="control-label text-left">Country:</label>
                    <app-typeahead-select
                      [items]="countries"
                      [displayFn]="countryDisplayFn"
                      [searchFields]="['name', 'code']"
                      [ngModel]="selectedCountry"
                      [ngModelOptions]="{standalone: true}"
                      (itemSelected)="onCountrySelected($event)"
                      placeholder="Select a country">
                    </app-typeahead-select>
                  </div>
                </div>
                <div class="col-md-4">
                  <div class="form-group">
                    <label class="control-label text-left">State:</label>
                    <app-typeahead-select
                      [items]="states"
                      [displayFn]="stateDisplayFn"
                      [searchFields]="['name', 'code']"
                      [ngModel]="selectedState"
                      [ngModelOptions]="{standalone: true}"
                      (itemSelected)="onStateSelected($event)"
                      placeholder="Select a state">
                    </app-typeahead-select>
                  </div>
                </div>
                <div class="col-md-4">
                  <div class="form-group">
                    <label class="control-label text-left">Shortcuts:</label>
                    <br>
                    <button type="button" class="btn btn-primary" (click)="setLocation('USA','MD')">MD</button>
                    <button type="button" class="btn btn-primary" (click)="setLocation('USA','DC')">DC</button>
                    <button type="button" class="btn btn-primary" (click)="setLocation('USA','VA')">VA</button>
                    <button type="button" class="btn btn-primary" (click)="setLocation('USA','PA')">PA</button>
                    <button type="button" class="btn btn-primary" (click)="setLocation('USA','DE')">DE</button>
                  </div>
                </div>
              </div>

              <!-- Members + time -->
              <div class="row">
                <div class="col-md-5">
                  <div class="form-group">
                    <label class="control-label text-left">Racer:</label>
                    <i class="hoverhand fa fa-user-plus" (click)="addNbMembers()" title="Add a racer"></i>
                    <br>
                    <div *ngFor="let member of formData.members; let i = index; trackBy: trackByIndex" style="margin-bottom: 5px;">
                      <app-typeahead-select
                        [items]="membersList"
                        [displayFn]="memberDisplayFn"
                        [searchFields]="['firstname', 'lastname']"
                        [ngModel]="formData.members[i]"
                        [ngModelOptions]="{standalone: true}"
                        (itemSelected)="onMemberSelected(i, $event)"
                        placeholder="Select a member">
                      </app-typeahead-select>
                      <i *ngIf="i !== 0" class="hoverhand fa fa-times" (click)="removeMember(i)" title="Delete member"></i>
                    </div>
                  </div>
                </div>

                <div class="col-md-1 time-entry">
                  <label class="text-left">Hours:</label>
                  <input type="number" min="0" name="hours"
                         [(ngModel)]="time.hours"
                         class="form-control input-md text-left" placeholder="0">
                </div>
                <div class="col-md-1 time-entry">
                  <label class="text-left">Minutes:</label>
                  <input type="number" min="0" max="59" name="minutes"
                         [(ngModel)]="time.minutes"
                         class="form-control input-md text-left" placeholder="0">
                </div>
                <div class="col-md-1 time-entry">
                  <label class="text-left">Seconds:</label>
                  <input type="number" min="0" max="59" name="seconds"
                         [(ngModel)]="time.seconds"
                         class="form-control input-md text-left" placeholder="0">
                </div>
                <div class="col-md-1 time-entry">
                  <label class="text-left">Centiseconds:</label>
                  <input type="number" min="0" max="99" name="centiseconds"
                         [(ngModel)]="time.centiseconds"
                         class="form-control input-md text-left" placeholder="0">
                </div>
              </div>

              <!-- Rankings -->
              <div class="row">
                <div class="col-md-4">
                  <label class="text-left">Age group:</label>
                  <input type="text" name="agerank" [(ngModel)]="formData.ranking.agerank"
                         class="form-inline input-md text-left" style="width: 50px;">
                  <input type="text" name="agetotal" [(ngModel)]="formData.ranking.agetotal"
                         class="form-inline input-md text-left" style="width: 50px;">
                </div>
                <div class="col-md-4">
                  <label class="text-left">Gender:</label>
                  <input type="text" name="genderrank" [(ngModel)]="formData.ranking.genderrank"
                         class="form-inline input-md text-left" style="width: 50px;">
                  <input type="text" name="gendertotal" [(ngModel)]="formData.ranking.gendertotal"
                         class="form-inline input-md text-left" style="width: 50px;">
                </div>
                <div class="col-md-4">
                  <label class="text-left">Overall:</label>
                  <input type="text" name="overallrank" [(ngModel)]="formData.ranking.overallrank"
                         class="form-inline input-md text-left" style="width: 50px;">
                  <input type="text" name="overalltotal" [(ngModel)]="formData.ranking.overalltotal"
                         class="form-inline input-md text-left" style="width: 50px;">
                </div>
              </div>

              <!-- Multisport toggle -->
              <div class="row">
                <div class="col-md-12">
                  <label class="text-left">Is MultiSport?</label>
                  <input type="checkbox" name="isMultisport"
                         [(ngModel)]="formData.race.isMultisport"
                         (ngModelChange)="toggleIsMultisport()">
                  <i class="fa fa-plus hoverhand" *ngIf="formData.race.isMultisport"
                     (click)="addLeg()" title="Add leg"></i>
                  <span title="Create Triathlon template" class="hoverhand"
                        *ngIf="formData.race.isMultisport" (click)="createTriTemplate()">🏊🚴🏃</span>
                </div>
              </div>

              <!-- Legs editor -->
              <div *ngIf="formData.race.isMultisport && formData.legs">
                <div class="row" *ngFor="let leg of formData.legs; let i = index; trackBy: trackByIndex"
                     [class.lightbluebg]="i % 2 === 1">
                  <div class="col-md-12">
                    <div class="row">
                      <div class="col-md-1 text-center">
                        <div class="form-group">
                          <label class="text-left">Transition?</label>
                          <input type="checkbox" [name]="'isTransition_' + i" [(ngModel)]="leg.isTransition">
                        </div>
                      </div>
                      <div class="col-md-3">
                        <div class="form-group">
                          <label class="text-left">Leg name:</label>
                          <input type="text" [name]="'legname_' + i" class="form-control text-left"
                                 [(ngModel)]="leg.legName" required>
                        </div>
                      </div>
                      <div class="col-md-2">
                        <div class="form-group">
                          <label class="text-left">Sport type:</label>
                          <select [name]="'legtype_' + i" class="form-control"
                                  [(ngModel)]="leg.legType" [disabled]="leg.isTransition">
                            <option *ngFor="let s of sportList" [value]="s">{{ s }}</option>
                          </select>
                        </div>
                      </div>
                      <div class="col-md-2">
                        <div class="form-group">
                          <label class="text-left">Miles:</label>
                          <input type="text" [name]="'legmiles_' + i" class="form-control text-left"
                                 [(ngModel)]="leg.miles" (ngModelChange)="updateLegMeters(leg)"
                                 [disabled]="leg.isTransition">
                        </div>
                      </div>
                      <div class="col-md-2">
                        <div class="form-group">
                          <label class="text-left">Meters:</label>
                          <input type="text" [name]="'legmeters_' + i" class="form-control text-left"
                                 [(ngModel)]="leg.meters" (ngModelChange)="updateLegMiles(leg)"
                                 [disabled]="leg.isTransition">
                        </div>
                      </div>
                      <div class="col-md-2">
                        <div class="form-group">
                          <label class="text-left">Distance Name:</label>
                          <input type="text" [name]="'legdistname_' + i" class="form-control text-left"
                                 [(ngModel)]="leg.distanceName" [disabled]="leg.isTransition">
                        </div>
                      </div>
                    </div>
                    <div class="row">
                      <div class="col-md-2">
                        <div class="form-group">
                          <label class="text-left">Hours:</label>
                          <input type="text" [name]="'leghours_' + i" class="form-control input-md text-left"
                                 [(ngModel)]="leg.timeExp.hours" placeholder="0">
                        </div>
                      </div>
                      <div class="col-md-2">
                        <div class="form-group">
                          <label class="text-left">Minutes:</label>
                          <input type="text" [name]="'legmin_' + i" class="form-control input-md text-left"
                                 [(ngModel)]="leg.timeExp.minutes" placeholder="0">
                        </div>
                      </div>
                      <div class="col-md-2">
                        <div class="form-group">
                          <label class="text-left">Seconds:</label>
                          <input type="text" [name]="'legsec_' + i" class="form-control input-md text-left"
                                 [(ngModel)]="leg.timeExp.seconds" placeholder="0">
                        </div>
                      </div>
                      <div class="col-md-2">
                        <div class="form-group">
                          <label class="text-left">Centiseconds:</label>
                          <input type="text" [name]="'legcs_' + i" class="form-control input-md text-left"
                                 [(ngModel)]="leg.timeExp.centiseconds" placeholder="0">
                        </div>
                      </div>
                      <div class="col-md-4">
                        <div class="form-group">
                          <label class="text-left">Controls</label><br>
                          <i *ngIf="i > 0" class="red hoverhand fa fa-trash-o"
                             (click)="removeLeg(i)" title="Remove leg"></i>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Comments -->
              <div class="row">
                <div class="col-md-12">
                  <label class="text-left">Comments/remarks</label>
                  <textarea class="form-control" rows="3" name="comments"
                            [(ngModel)]="formData.comments"></textarea>
                </div>
              </div>

              <!-- Result link -->
              <div class="row">
                <div class="col-md-12">
                  <label class="text-left">Result web link:</label>
                  <input type="text" name="resultlink" [(ngModel)]="formData.resultlink"
                         class="form-control input-md text-left">
                </div>
              </div>

              <!-- Show more toggle -->
              <span *ngIf="showMore" class="hoverhand" (click)="showMore = !showMore">
                <i class="fa fa-chevron-up"></i>show less<i class="fa fa-chevron-up"></i>
              </span>
              <span *ngIf="!showMore" class="hoverhand" (click)="showMore = !showMore">
                <i class="fa fa-chevron-down"></i>show more<i class="fa fa-chevron-down"></i>
              </span>

              <div class="row" *ngIf="showMore">
                <div class="col-md-3">
                  <div class="row">
                    <label class="text-left">Include result in records:</label>
                    <input type="checkbox" name="isRecordEligible" [(ngModel)]="formData.isRecordEligible">
                  </div>
                </div>
                <div class="col-md-9">
                  <label class="text-left">Custom Options:</label>
                  <i class="hoverhand fa fa-plus" style="color:#03C03C;"
                     (click)="addResultCustomOption()" title="Add custom option"></i>
                  <div *ngFor="let option of formData.customOptions; let i = index; trackBy: trackByIndex"
                       style="border: 1px solid #ddd; border-radius: 4px; padding: 8px; margin-bottom: 6px; background: #f9f9f9;">
                    <div class="row">
                      <div class="col-sm-3">
                        <label style="font-weight: normal; font-size: 12px;">Name:</label>
                        <div class="input-group">
                          <div class="input-group-btn dropdown" [class.open]="openPresetDropdown === i">
                            <button type="button" class="btn btn-default btn-sm"
                                    (click)="openPresetDropdown = (openPresetDropdown === i ? -1 : i)">
                              <span class="caret"></span>
                            </button>
                            <ul class="dropdown-menu">
                              <li><a (click)="setResultCustomOptionPreset(i, 'resultIcon'); openPresetDropdown = -1">resultIcon</a></li>
                              <li><a (click)="setResultCustomOptionPreset(i, 'resultText'); openPresetDropdown = -1">resultText</a></li>
                            </ul>
                          </div>
                          <input type="text" class="form-control input-sm"
                                 [name]="'optname_' + i"
                                 [(ngModel)]="option.name" placeholder="e.g. resultIcon">
                        </div>
                      </div>
                      <div class="col-sm-4">
                        <label style="font-weight: normal; font-size: 12px;">Text (tooltip):</label>
                        <input type="text" class="form-control input-sm"
                               [name]="'opttext_' + i"
                               [(ngModel)]="option.text" placeholder="Tooltip text">
                      </div>
                      <div class="col-sm-4">
                        <label style="font-weight: normal; font-size: 12px;">Value:</label>
                        <input type="text" class="form-control input-sm"
                               [name]="'optval_' + i"
                               [(ngModel)]="option.valueString"
                               (ngModelChange)="updateResultCustomOptionValue(i)"
                               placeholder="Value (URL or text)">
                      </div>
                      <div class="col-sm-1">
                        <label style="font-weight: normal; font-size: 12px;">&nbsp;</label>
                        <button type="button" class="btn btn-danger btn-sm"
                                (click)="removeResultCustomOption(i)" title="Remove" style="display:block;">
                          <i class="fa fa-times"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Footer -->
              <div class="modal-result-footer">
                <button type="button" class="btn btn-danger" (click)="cancel()">Cancel</button>

                <button *ngIf="!editmode" type="button" class="btn btn-primary"
                        style="float: right; margin-right: 10px"
                        [disabled]="formresult.invalid || !checkMembers() || isSaving"
                        (click)="addResult(false)">
                  Save Result and close
                </button>

                <button *ngIf="!editmode" type="button" class="btn btn-primary"
                        style="float: right; margin-right: 10px;"
                        [disabled]="formresult.invalid || !checkMembers() || isSaving"
                        (click)="addResult(true)">
                  Save Result and add another
                </button>

                <button *ngIf="editmode" type="button" class="btn btn-primary"
                        style="float: right;"
                        [disabled]="formresult.invalid || !checkMembers() || isSaving"
                        (click)="editResult()">
                  Edit Result
                </button>
              </div>

            </form>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ResultModalComponent implements OnInit, OnChanges {
  /** Show / hide */
  @Input() visible = false;
  /** True for edit mode, false for create */
  @Input() editmode = false;
  /**
   * For edit mode: the result to edit (will be mutated as user edits).
   * For create mode: optional pre-filled result to duplicate from.
   */
  @Input() resultInput: any = null;

  /** Emitted when a result is created/saved (close modal pattern) */
  @Output() saved = new EventEmitter<any>();
  /** Emitted when "Save & add another" is clicked — modal stays open */
  @Output() savedAndAddAnother = new EventEmitter<any>();
  /** Emitted on cancel/dismiss */
  @Output() closed = new EventEmitter<void>();

  formData: any = this.makeEmptyFormData();
  time: any = {};
  raceDateString = '';
  nbOfMembers = 1;
  showMore = false;
  isSaving = false;
  autoconvert = true;
  openPresetDropdown = -1;

  membersList: any[] = [];
  racetypesList: any[] = [];
  multisportRacetype: any = null;
  sportList = ['swim', 'bike', 'run'];
  states: any[] = [];
  countries: any[] = [];

  selectedCountry: any = null;
  selectedState: any = null;

  // Display functions for typeahead components
  racetypeDisplayFn = (rt: any) => rt ? `${rt.name} (${rt.surface})` : '';
  countryDisplayFn = (c: any) => c ? `${c.name} (${c.code})` : '';
  stateDisplayFn = (s: any) => s ? `${s.name} (${s.code})` : '';
  memberDisplayFn = (m: any) => m && m.firstname ? `${m.firstname} ${m.lastname}` : '';

  constructor(
    private membersService: MembersService,
    private resultsService: ResultsService,
    private utilsService: UtilsService,
    private localStorage: LocalStorageService
  ) {
    this.states = this.utilsService.states;
    this.countries = this.utilsService.countries;
  }

  trackByIndex(index: number): number {
    return index;
  }

  async ngOnInit(): Promise<void> {
    // Load members + race types
    try {
      this.membersList = await this.membersService.getMembers({
        sort: 'memberStatus firstname',
        select: '-bio -personalBests -teamRequirementStats'
      });
    } catch { /* ignore */ }

    try {
      const racetypes = await this.resultsService.getRaceTypes({ sort: 'meters' });
      this.racetypesList = racetypes;
      this.multisportRacetype = racetypes.find((r: any) => r.name === 'Multisport') || null;
    } catch { /* ignore */ }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible) {
      this.initFormData();
    }
  }

  // =====================================
  // FORM INIT ===========================
  // =====================================

  private makeEmptyFormData(): any {
    return {
      race: { location: {}, racetype: null, racename: '', racedate: null },
      ranking: {},
      members: [{}],
      customOptions: [],
      isRecordEligible: true
    };
  }

  private initFormData(): void {
    this.openPresetDropdown = -1;
    this.showMore = false;

    if (this.editmode && this.resultInput) {
      // Edit existing result — mutate input directly (matches AJS behavior)
      this.formData = this.resultInput;
      if (this.formData.race.racedate) {
        this.formData.race.racedate = new Date(this.formData.race.racedate);
        this.raceDateString = this.toDateString(this.formData.race.racedate);
      }
      if (this.formData.race.location === undefined) {
        this.formData.race.location = {};
      }

      this.nbOfMembers = (this.resultInput.members || []).length || 1;
      this.time = this.timeToExp(this.formData.time || 0);

      if (this.formData.legs) {
        this.formData.legs.forEach((l: any) => {
          l.timeExp = this.timeToExp(l.time || 0);
        });
      }

      if (this.resultInput.customOptions !== undefined) {
        this.formData.customOptions = this.deleteIdFromSubdocs(this.resultInput.customOptions, true);
        this.formData.customOptions.forEach((option: any) => {
          if (option.value !== undefined && option.value !== null) {
            option.valueString = typeof option.value === 'object'
              ? JSON.stringify(option.value)
              : String(option.value);
          } else {
            option.valueString = '';
          }
        });
      }
      if (!this.formData.customOptions) {
        this.formData.customOptions = [];
      }
      if (this.formData.isRecordEligible === false || this.formData.customOptions.length > 0) {
        this.showMore = true;
      }
    } else if (this.resultInput) {
      // Duplicate from existing result (new result, prefilled)
      const original = JSON.parse(JSON.stringify(this.resultInput));
      this.formData = this.makeEmptyFormData();
      this.formData.isRecordEligible = original.isRecordEligible;
      this.formData.race = original.race;
      this.formData.race.location = original.race.location || {};
      this.formData.race.racedate = new Date(original.race.racedate);
      this.raceDateString = this.toDateString(this.formData.race.racedate);
      this.formData.race.order = original.race.order;
      this.formData.legs = original.legs;
      if (this.formData.legs) {
        this.formData.legs.forEach((l: any) => { l.timeExp = {}; });
      }
      this.time = {};
      this.nbOfMembers = 1;
      if (this.formData.isRecordEligible === false) {
        this.showMore = true;
      }
    } else {
      // Brand new result — restore from localStorage if available
      this.formData = this.makeEmptyFormData();

      const savedRace = this.localStorage.retrieve('race');
      if (savedRace) {
        this.formData.race = savedRace;
        this.formData.race.racedate = new Date(savedRace.racedate);
      } else {
        const now = new Date();
        this.formData.race.racedate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0));
      }
      this.raceDateString = this.toDateString(this.formData.race.racedate);

      if (!this.formData.race.location) {
        this.formData.race.location = {};
      }
      this.formData.race.location.country = this.localStorage.retrieve('country') || 'USA';
      this.formData.race.location.state = this.localStorage.retrieve('state') || 'MD';

      this.formData.resultlink = this.localStorage.retrieve('resultLink') || '';
      this.formData.ranking = {
        agetotal: this.localStorage.retrieve('agetotal'),
        gendertotal: this.localStorage.retrieve('gendertotal'),
        overalltotal: this.localStorage.retrieve('overalltotal')
      };

      this.time = {};

      if (this.formData.race.isMultisport) {
        this.formData.legs = this.localStorage.retrieve('legs') || [{}];
        if (this.formData.legs) {
          this.formData.legs.forEach((l: any) => { l.timeExp = {}; });
        }
      }
    }

    this.syncSelectedLocation();
  }

  private syncSelectedLocation(): void {
    const country = this.formData.race?.location?.country;
    const state = this.formData.race?.location?.state;
    this.selectedCountry = country ? this.countries.find(c => c.code === country) || null : null;
    this.selectedState = state ? this.states.find(s => s.code === state) || null : null;
  }

  // =====================================
  // HELPERS =============================
  // =====================================

  private timeToExp(t: number): { hours: number; minutes: number; seconds: number; centiseconds: number } {
    return {
      hours: Math.floor(t / 360000),
      minutes: Math.floor(((t % 8640000) % 360000) / 6000),
      seconds: Math.floor((((t % 8640000) % 360000) % 6000) / 100),
      centiseconds: Math.floor((((t % 8640000) % 360000) % 6000) % 100)
    };
  }

  private expToTime(exp: any): number {
    const h = +(exp.hours || 0);
    const m = +(exp.minutes || 0);
    const s = +(exp.seconds || 0);
    const cs = +(exp.centiseconds || 0);
    return h * 360000 + m * 6000 + s * 100 + cs;
  }

  private deleteIdFromSubdocs(obj: any, isRoot: boolean): any {
    for (const key in obj) {
      if (!isRoot && key === '_id') {
        delete obj[key];
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.deleteIdFromSubdocs(obj[key], false);
      }
    }
    return obj;
  }

  private toDateString(d: Date): string {
    if (!d) return '';
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  onRaceDateChange(value: string): void {
    if (!value) {
      this.formData.race.racedate = null;
      return;
    }
    const [y, m, d] = value.split('-').map(Number);
    this.formData.race.racedate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  }

  isOlderDateCheck(dateString: string): boolean {
    if (!dateString) return false;
    const today = new Date();
    const oldDate = new Date();
    oldDate.setDate(today.getDate() - 30);
    const raceDate = new Date(dateString);
    return raceDate < oldDate;
  }

  // =====================================
  // RACE TYPE / DISTANCE ================
  // =====================================

  onMetersChange(): void {
    if (this.autoconvert && this.formData.race?.racetype) {
      this.formData.race.racetype.miles = parseFloat(this.formData.race.racetype.meters) * 0.000621371;
    }
  }

  onMilesChange(): void {
    if (this.autoconvert && this.formData.race?.racetype) {
      this.formData.race.racetype.meters = parseFloat(this.formData.race.racetype.miles) * 1609.3440;
    }
  }

  updateLegMeters(leg: any): void {
    leg.meters = leg.miles * 1609.3440;
  }

  updateLegMiles(leg: any): void {
    leg.miles = leg.meters * 0.000621371;
  }

  // =====================================
  // LOCATION ============================
  // =====================================

  onCountrySelected(country: any): void {
    this.selectedCountry = country;
    if (!this.formData.race.location) this.formData.race.location = {};
    this.formData.race.location.country = country?.code || null;
    if (country?.code !== 'USA') {
      this.formData.race.location.state = null;
      this.selectedState = null;
    }
  }

  onStateSelected(state: any): void {
    this.selectedState = state;
    if (!this.formData.race.location) this.formData.race.location = {};
    this.formData.race.location.state = state?.code || null;
  }

  setLocation(countryCode: string, stateCode: string): void {
    if (!this.formData.race.location) this.formData.race.location = {};
    this.formData.race.location.country = countryCode;
    this.formData.race.location.state = stateCode;
    this.syncSelectedLocation();
  }

  // =====================================
  // MEMBERS =============================
  // =====================================

  addNbMembers(): void {
    this.formData.members.push({});
    this.nbOfMembers = this.formData.members.length;
  }

  removeMember(index: number): void {
    this.formData.members.splice(index, 1);
    this.nbOfMembers = this.formData.members.length;
  }

  onMemberSelected(index: number, member: any): void {
    this.formData.members[index] = member;
  }

  checkMembers(): boolean {
    if (!this.formData.members || this.formData.members.length === 0) return false;
    return this.formData.members.every((m: any) => m && m._id);
  }

  // =====================================
  // MULTISPORT / LEGS ===================
  // =====================================

  toggleIsMultisport(): void {
    if (this.formData.race.isMultisport) {
      this.formData.legs = [{ timeExp: {} }];
      this.formData.race.racetype = this.multisportRacetype;
    } else {
      this.formData.legs = null;
    }
  }

  addLeg(): void {
    if (!this.formData.legs) this.formData.legs = [];
    this.formData.legs.push({ timeExp: {} });
  }

  removeLeg(index: number): void {
    this.formData.legs.splice(index, 1);
  }

  createTriTemplate(): void {
    if (!this.formData.race.isMultisport) return;
    this.formData.race.racetype = this.multisportRacetype;
    this.formData.legs = [
      { order: 0, legName: 'Swim', legType: 'swim', timeExp: {} },
      { order: 1, legName: 'Transition 1', isTransition: true, timeExp: {} },
      { order: 2, legName: 'Bike', legType: 'bike', timeExp: {} },
      { order: 3, legName: 'Transition 2', isTransition: true, timeExp: {} },
      { order: 4, legName: 'Run', legType: 'run', timeExp: {} }
    ];
  }

  // =====================================
  // CUSTOM OPTIONS ======================
  // =====================================

  addResultCustomOption(): void {
    if (!this.formData.customOptions) this.formData.customOptions = [];
    this.formData.customOptions.push({ name: '', text: '', value: '', valueString: '' });
  }

  removeResultCustomOption(index: number): void {
    this.formData.customOptions.splice(index, 1);
  }

  updateResultCustomOptionValue(index: number): void {
    const option = this.formData.customOptions[index];
    try {
      if (option.valueString && option.valueString.trim()) {
        option.value = JSON.parse(option.valueString);
      } else {
        option.value = '';
      }
    } catch {
      option.value = option.valueString;
    }
  }

  setResultCustomOptionPreset(index: number, presetName: string): void {
    const option = this.formData.customOptions[index];
    const PRESETS: any = {
      resultIcon: { name: 'resultIcon', text: '', value: '' },
      resultText: { name: 'resultText', text: '', value: '' }
    };
    const preset = PRESETS[presetName];
    if (preset) {
      option.name = preset.name;
      option.text = preset.text;
      option.value = preset.value;
      option.valueString = typeof preset.value === 'object'
        ? JSON.stringify(preset.value)
        : String(preset.value);
    }
  }

  // =====================================
  // SAVE / EDIT =========================
  // =====================================

  private prepareFormDataForSave(): void {
    this.formData.time = this.expToTime(this.time);

    const r = this.formData.ranking;
    const rankingEmpty = !r ||
      ((!r.agerank && !r.agetotal && !r.genderrank && !r.gendertotal && !r.overallrank && !r.overalltotal));
    if (rankingEmpty) {
      this.formData.ranking = {};
    }

    if (this.formData.legs) {
      this.formData.legs.forEach((l: any, i: number) => {
        l.order = i;
        if (!l.timeExp) l.timeExp = {};
        l.time = this.expToTime(l.timeExp);
      });
    }

    if (this.formData.race.isMultisport === undefined) {
      this.formData.race.isMultisport = false;
    }

    if (!this.formData.race.isMultisport && this.formData.race.racetype?.isVariable === false) {
      this.formData.race.distanceName = undefined;
    }

    if (this.formData.race.racetype?.surface === 'multiple') {
      this.formData.race.racetype.meters = 0;
      this.formData.race.racetype.miles = 0;
    }

    if (this.formData.customOptions) {
      this.formData.customOptions.forEach((_: any, idx: number) => {
        this.updateResultCustomOptionValue(idx);
      });
    }
  }

  async addResult(addAnother: boolean): Promise<void> {
    this.prepareFormDataForSave();

    // Persist last-used values
    this.localStorage.store('race', this.formData.race);
    this.localStorage.store('resultLink', this.formData.resultlink);
    this.localStorage.store('agetotal', this.formData.ranking.agetotal);
    this.localStorage.store('gendertotal', this.formData.ranking.gendertotal);
    this.localStorage.store('overalltotal', this.formData.ranking.overalltotal);
    this.localStorage.store('country', this.formData.race.location.country);
    this.localStorage.store('state', this.formData.race.location.state);
    this.localStorage.store('legs', this.formData.legs);

    this.isSaving = true;
    try {
      const savedResult = await this.resultsService.createResult(this.formData);
      if (!savedResult) return;

      if (addAnother) {
        this.savedAndAddAnother.emit(savedResult);
        // Clear personal fields, keep race info
        this.formData.members = [{}];
        this.time = {};
        this.formData.ranking.agerank = null;
        this.formData.ranking.genderrank = null;
        this.formData.ranking.overallrank = null;
        this.formData.comments = undefined;
      } else {
        this.saved.emit(savedResult);
        this.closed.emit();
      }
    } finally {
      this.isSaving = false;
    }
  }

  async editResult(): Promise<void> {
    this.prepareFormDataForSave();

    this.isSaving = true;
    try {
      const savedResult = await this.resultsService.editResult(this.formData._id, this.formData);
      if (savedResult) {
        this.saved.emit(savedResult);
        this.closed.emit();
      }
    } finally {
      this.isSaving = false;
    }
  }

  clearForm(): void {
    this.formData = this.makeEmptyFormData();
    this.time = {};
    this.nbOfMembers = 1;
    this.raceDateString = '';

    this.localStorage.clear('race');
    this.localStorage.clear('resultLink');
    this.localStorage.clear('agetotal');
    this.localStorage.clear('gendertotal');
    this.localStorage.clear('overalltotal');
    this.localStorage.clear('legs');
  }

  cancel(): void {
    this.closed.emit();
  }
}
