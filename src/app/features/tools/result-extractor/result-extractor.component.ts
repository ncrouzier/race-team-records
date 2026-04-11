import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { NotificationService } from '../../../core/services/notification.service';
import { UtilsService } from '../../../core/services/utils.service';
import { ResultsService } from '../../../core/services/results.service';
import { MembersService } from '../../../core/services/members.service';
import { SecondsToTimeStringPipe } from '../../../shared/pipes/seconds-to-time-string.pipe';
import { OnlyDigitsDirective } from '../../../shared/directives/only-digits.directive';
import { OnlyDigitsForMinSecDirective } from '../../../shared/directives/only-digits-for-min-sec.directive';
import { OnlyDigitsForCentisecDirective } from '../../../shared/directives/only-digits-for-centisec.directive';

declare function gtag(...args: any[]): void;

@Component({
  selector: 'app-result-extractor',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    SecondsToTimeStringPipe,
    OnlyDigitsDirective, OnlyDigitsForMinSecDirective, OnlyDigitsForCentisecDirective
  ],
  template: `
<div class="result-extractor-tool jumbotron">
  <h2 class="mb-4">Result Extractor</h2>

  <div class="card mb-4">
    <div class="card-body">
      <form (ngSubmit)="loadTable()">
        <div class="form-group">
          <div class="row">
            <div class="col-md-6">
              <label for="urlInput">URL of Results Page</label>
              <input type="url" class="form-control" id="urlInput" [(ngModel)]="url" name="url"
                placeholder="Enter URL of the results page" [disabled]="!!htmlSource">
            </div>
            <div class="col-md-6">
              <label for="htmlSourceInput">Parkrun HTML Source Code</label>
              <textarea rows="2" class="form-control" id="htmlSourceInput" [(ngModel)]="htmlSource" name="htmlSource"
                placeholder="Paste Parkrun HTML source code here" [disabled]="!!url"></textarea>
            </div>
          </div>
        </div>
        <button type="submit" class="btn btn-primary" [disabled]="!url && !htmlSource">
          Load Table
        </button>
      </form>
    </div>
  </div>

  <div class="fetched-data card" *ngIf="tableData">
    <div class="card-body">
      <h4 class="card-title mb-3">Map Table Columns {{tableData.length}}</h4>

      <div class="table-responsive mb-3">
        <table class="table table-bordered table-striped">
          <thead class="thead-light">
            <tr>
              <th *ngFor="let header of tableHeaders; trackBy: trackByIndex"
                class="header text-center align-middle"
                [hidden]="isColumnHidden(header)"
                (click)="hideColumn(header)">
                {{header}}
              </th>
            </tr>
            <tr>
              <th *ngFor="let header of tableHeaders; trackBy: trackByIndex" class="text-center"
                [hidden]="isColumnHidden(header)">
                <select class="form-control form-control-sm" [(ngModel)]="columnMapping[header]"
                  [ngModelOptions]="{standalone: true}" (ngModelChange)="onColumnMappingChange(header)">
                  <option value="">??</option>
                  <option *ngFor="let field of mappableFields" [value]="field.value">{{field.label}}</option>
                </select>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of tableData.slice(0, 5)" class="align-middle">
              <td *ngFor="let header of tableHeaders; trackBy: trackByIndex" class="text-center"
                [hidden]="isColumnHidden(header)">
                {{row[header]}}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="form-group">
        <div class="row">
          <div class="col-md-6">
            <label>Race Name:</label>
            <input type="text" class="form-control" [(ngModel)]="formData.raceName" name="raceName" required
              (ngModelChange)="onFormDataChange()">
          </div>
          <div class="col-md-6">
            <label>Race Date:</label>
            <input type="date" class="form-control input-md" [(ngModel)]="formData.raceDateStr" name="raceDate"
              [ngClass]="{'redbg': isOlderDateCheck()}" min="2013-01-01"
              (ngModelChange)="onRaceDateChange()">
          </div>
        </div>
      </div>
    </div>

    <div class="form-group" style="padding: 0 15px;">
      <label>Race Type:</label><br>
      <div style="position: relative; min-width: 280px; display: inline-block;">
        <input type="text" class="form-control" [(ngModel)]="raceTypeSearch" [ngModelOptions]="{standalone: true}"
          placeholder="Search race types..." (focus)="raceTypeDropdownOpen = true"
          (input)="filterRaceTypes()">
        <div *ngIf="raceTypeDropdownOpen && filteredRaceTypes.length" class="dropdown-menu show"
          style="max-height: 250px; overflow-y: auto; width: 100%; display: block;">
          <a class="dropdown-item" *ngFor="let rt of filteredRaceTypes" (click)="selectRaceType(rt)"
            style="cursor: pointer;">
            <span [innerHTML]="rt.name + ' (' + rt.surface + ')'"></span>
            <small *ngIf="!rt.isVariable"> - {{rt.meters | number}} m / {{rt.miles | number}} mi</small>
            <small *ngIf="rt.isVariable"> - variable distance</small>
          </a>
        </div>
      </div>
      <span *ngIf="formData.raceType" class="ml-2">
        Selected: <strong>{{formData.raceType.name}}</strong> ({{formData.raceType.surface}})
        <button class="btn btn-sm btn-default" (click)="formData.raceType = null; raceTypeSearch = ''; onFormDataChange()">x</button>
      </span>
    </div>

    <div class="form-group" style="padding: 0 15px;" *ngIf="formData.raceType?.isVariable && formData.raceType?.surface !== 'multiple'">
      <div class="row">
        <div class="col-md-4">
          <label>Distance Display Name:</label>
          <input type="text" class="form-control" [(ngModel)]="formData.distanceName" name="distanceName"
            [required]="formData.raceType?.isVariable && formData.raceType?.surface !== 'multiple'"
            (ngModelChange)="onFormDataChange()">
        </div>
        <div class="col-md-4">
          <label>Distance in meters:</label>
          <input type="text" class="form-control" [(ngModel)]="formData.meters" name="meters"
            [required]="formData.raceType?.isVariable && formData.raceType?.surface !== 'multiple'"
            (ngModelChange)="onMetersChange()">
        </div>
        <div class="col-md-4">
          <label>Distance in miles:</label>
          <input type="text" class="form-control" [(ngModel)]="formData.miles" name="miles"
            [required]="formData.raceType?.isVariable && formData.raceType?.surface !== 'multiple'"
            (ngModelChange)="onMilesChange()">
        </div>
      </div>
    </div>

    <div class="form-group" style="padding: 0 15px;">
      <div class="row">
        <div class="col-md-5">
          <label>Country:</label><br>
          <select class="form-control" [(ngModel)]="formData.location.country" [ngModelOptions]="{standalone: true}"
            (ngModelChange)="onCountryChange()">
            <option value="">Select a country</option>
            <option *ngFor="let country of countries" [value]="country.code">{{country.name}} ({{country.code}})</option>
          </select>
        </div>
        <div class="col-md-3">
          <label>State:</label><br>
          <select class="form-control" [(ngModel)]="formData.location.state" [ngModelOptions]="{standalone: true}"
            [disabled]="formData.location.country !== 'USA'" (ngModelChange)="onFormDataChange()">
            <option value="">Select a state</option>
            <option *ngFor="let state of states" [value]="state.code">{{state.name}} ({{state.code}})</option>
          </select>
        </div>
        <div class="col-md-4">
          <label>Shortcuts:</label><br>
          <button class="btn btn-primary" (click)="setLocation('USA','MD')">MD</button>
          <button class="btn btn-primary" (click)="setLocation('USA','DC')">DC</button>
          <button class="btn btn-primary" (click)="setLocation('USA','VA')">VA</button>
          <button class="btn btn-primary" (click)="setLocation('USA','PA')">PA</button>
          <button class="btn btn-primary" (click)="setLocation('USA','DE')">DE</button>
        </div>
      </div>
    </div>

    <div class="form-group" style="padding: 0 15px;">
      <div class="row">
        <div class="col-md-8">
          <label>Result web link:</label>
          <input type="text" [(ngModel)]="formData.resultlink" [ngModelOptions]="{standalone: true}"
            class="form-control input-md text-left">
        </div>
        <div class="col-md-4">
          <label>&nbsp;</label>
          <div class="checkbox" style="margin-top: 8px;">
            <label>
              <input type="checkbox" [(ngModel)]="formData.isRecordEligible" [ngModelOptions]="{standalone: true}"
                (ngModelChange)="onFormDataChange()"> Record Eligible
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="alert alert-info" *ngIf="!canProcessResult().canProcess" [innerHTML]="canProcessResult().message"
      style="margin: 0 15px;"></div>
    <button class="btn btn-success" (click)="processResults()" [disabled]="!canProcessResult().canProcess"
      style="margin: 0 15px 15px;">
      Process Results <span *ngIf="processedResults.length > 0">- {{processedResults.length}}</span>
    </button>
  </div>

  <div class="fetched-data card mt-4" *ngIf="processedResults.length > 0">
    <div class="card-body">
      <h4 class="card-title mb-3">Processed Results</h4>
      <div class="table-responsive">
        <table class="table table-striped">
          <thead>
            <tr>
              <th>Select</th>
              <th>Name</th>
              <th>Time</th>
              <th>Time Details</th>
              <th>Overall</th>
              <th>Gender</th>
              <th>Age</th>
              <th>Debug</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let result of processedResults">
              <td><input type="checkbox" [(ngModel)]="result.selected" [ngModelOptions]="{standalone: true}"></td>
              <td>{{result.members[0].firstname}} {{result.members[0].lastname}}</td>
              <td><span class="resultTime">{{result.time | secondsToTimeString}}</span></td>
              <td class="agegradeCell customtime nowrap">
                <div class="input-group input-group-sm" style="width: 100px;">
                  <input type="number" min="0" style="width: 29px;" [(ngModel)]="result.timeExp.hours"
                    [ngModelOptions]="{standalone: true}" onlyDigits class="text-left"
                    (ngModelChange)="updateTime(result)" placeholder="0">:<input type="number" min="0"
                    style="width: 29px;" [(ngModel)]="result.timeExp.minutes"
                    [ngModelOptions]="{standalone: true}" onlyDigitsForMinSec class="text-left"
                    (ngModelChange)="updateTime(result)" placeholder="0">:<input type="number" min="0"
                    style="width: 29px;" [(ngModel)]="result.timeExp.seconds"
                    [ngModelOptions]="{standalone: true}" onlyDigitsForMinSec class="text-left"
                    (ngModelChange)="updateTime(result)" placeholder="0">.<input type="number" min="0"
                    style="width: 29px;" [(ngModel)]="result.timeExp.centiseconds"
                    [ngModelOptions]="{standalone: true}" onlyDigitsForCentisec class="text-left"
                    (ngModelChange)="updateTime(result)" placeholder="0">
                </div>
              </td>
              <td>
                <div class="input-group input-group-sm" style="width: 120px;">
                  <input type="text" [(ngModel)]="result.ranking.overallrank" [ngModelOptions]="{standalone: true}"
                    onlyDigits class="form-inline input-md text-left" style="width: 50px;">
                  <span>/</span>
                  <input type="text" [(ngModel)]="result.ranking.overalltotal" [ngModelOptions]="{standalone: true}"
                    onlyDigits class="form-inline input-md text-left" style="width: 50px;">
                </div>
              </td>
              <td>
                <div class="input-group input-group-sm" style="width: 120px;">
                  <input type="text" [(ngModel)]="result.ranking.genderrank" [ngModelOptions]="{standalone: true}"
                    onlyDigits class="form-inline input-md text-left" style="width: 50px;">
                  <span>/</span>
                  <input type="text" [(ngModel)]="result.ranking.gendertotal" [ngModelOptions]="{standalone: true}"
                    onlyDigits class="form-inline input-md text-left" style="width: 50px;">
                </div>
              </td>
              <td>
                <div class="input-group input-group-sm" style="width: 120px;">
                  <input type="text" [(ngModel)]="result.ranking.agerank" [ngModelOptions]="{standalone: true}"
                    onlyDigits class="form-inline input-md text-left" style="width: 50px;">
                  <span>/</span>
                  <input type="text" [(ngModel)]="result.ranking.agetotal" [ngModelOptions]="{standalone: true}"
                    onlyDigits class="form-inline input-md text-left" style="width: 50px;">
                </div>
              </td>
              <td>
                <button class="btn btn-sm btn-info" (click)="debugResult(result)">
                  <i class="fa fa-code"></i> Debug
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="row mb-3">
        <div class="col-md-6">
          <button class="btn btn-default" (click)="selectAll()">Select All</button>
          <button class="btn btn-default" (click)="deselectAll()">Deselect All</button>
        </div>
        <div class="col-md-6 text-right">
          <div class="save-section">
            <div class="saving-indicator" *ngIf="isLoading">
              <i class="fa fa-spinner fa-spin"></i>
              <span class="saving-text">{{savingMessage}}</span>
            </div>
            <button class="btn btn-primary" (click)="saveResults()"
              [disabled]="isLoading || !hasSelectedResults()">
              {{isLoading ? 'Saving...' : 'Save Selected Results'}}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
  `
})
export class ResultExtractorComponent implements OnInit {
  user: any = null;
  formData: any = {
    raceName: '',
    raceDate: null,
    raceDateStr: '',
    raceType: null,
    location: { country: 'USA', state: '' },
    isRecordEligible: true,
    distanceName: '',
    meters: '',
    miles: '',
    resultlink: ''
  };
  tableData: any[] | null = null;
  tableHeaders: string[] | null = null;
  columnMapping: Record<string, string> = {};
  processedResults: any[] = [];
  currentTeamMembers: any[] = [];
  isLoading = false;
  savingMessage = '';
  url = '';
  htmlSource = '';
  racetypesList: any[] = [];
  filteredRaceTypes: any[] = [];
  raceTypeSearch = '';
  raceTypeDropdownOpen = false;
  hiddenColumns: Record<string, boolean> = {};

  states: any[];
  countries: any[];

  mappableFields = [
    { value: 'place', label: 'Overall Ranking' },
    { value: 'genderRank', label: 'Gender Ranking' },
    { value: 'ageRank', label: 'Age Ranking' },
    { value: 'name', label: 'Full Name' },
    { value: 'firstname', label: 'First Name' },
    { value: 'lastname', label: 'Last Name' },
    { value: 'time', label: 'Time' },
    { value: 'gender', label: 'Gender/Sex' },
    { value: 'ageGroup', label: 'Age/Division Group' }
  ];

  constructor(
    private http: HttpClient,
    private authState: AuthStateService,
    private notification: NotificationService,
    private utilsService: UtilsService,
    private resultsService: ResultsService,
    private membersService: MembersService
  ) {
    this.states = utilsService.states;
    this.countries = utilsService.countries;
  }

  ngOnInit(): void {
    this.user = this.authState.isLoggedIn() || null;
    this.authState.user$.subscribe(user => { this.user = user; });

    // Load team members
    this.membersService.getMembers({
      'filters[memberStatus]': 'current',
      sort: 'firstname lastname'
    }).then((members: any[]) => {
      this.currentTeamMembers = members;
    });

    // Load race types
    this.resultsService.getRaceTypes({ sort: 'meters' }).then((racetypes: any[]) => {
      this.racetypesList = racetypes;
      this.filteredRaceTypes = racetypes;
    });

    // Close dropdown on outside click
    document.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dropdown-menu') && !target.closest('input[type="text"]')) {
        this.raceTypeDropdownOpen = false;
      }
    });
  }

  trackByIndex(index: number): number {
    return index;
  }

  filterRaceTypes(): void {
    const search = this.raceTypeSearch.toLowerCase();
    this.filteredRaceTypes = this.racetypesList.filter(rt =>
      rt.name.toLowerCase().includes(search) || rt.surface.toLowerCase().includes(search)
    );
    this.raceTypeDropdownOpen = true;
  }

  selectRaceType(rt: any): void {
    this.formData.raceType = rt;
    this.raceTypeSearch = rt.name + ' (' + rt.surface + ')';
    this.raceTypeDropdownOpen = false;
    this.onRaceTypeSelect(rt);
    this.onFormDataChange();
  }

  onRaceTypeSelect(selected: any): void {
    if (selected.isVariable && selected.surface !== 'multiple') {
      this.formData.meters = selected.meters;
      this.formData.miles = selected.miles;
    } else {
      this.formData.meters = '';
      this.formData.miles = '';
    }
  }

  onMetersChange(): void {
    if (this.formData.meters && !isNaN(this.formData.meters)) {
      this.formData.miles = (this.formData.meters * 0.000621371).toFixed(2);
      if (this.formData.raceType?.isVariable) {
        this.formData.raceType.meters = parseInt(this.formData.meters);
        this.formData.raceType.miles = parseFloat(this.formData.miles);
      }
    }
    this.onFormDataChange();
  }

  onMilesChange(): void {
    if (this.formData.miles && !isNaN(this.formData.miles)) {
      this.formData.meters = Math.round(this.formData.miles * 1609.34);
      if (this.formData.raceType?.isVariable) {
        this.formData.raceType.meters = parseInt(this.formData.meters);
        this.formData.raceType.miles = parseFloat(this.formData.miles);
      }
    }
    this.onFormDataChange();
  }

  onCountryChange(): void {
    if (this.formData.location.country !== 'USA') {
      this.formData.location.state = '';
    }
    this.onFormDataChange();
  }

  setLocation(country: string, state: string): void {
    this.formData.location.country = country;
    this.formData.location.state = state;
    this.onFormDataChange();
  }

  onRaceDateChange(): void {
    if (this.formData.raceDateStr) {
      this.formData.raceDate = new Date(this.formData.raceDateStr + 'T00:00:00Z');
    } else {
      this.formData.raceDate = null;
    }
    this.onFormDataChange();
  }

  isOlderDateCheck(): boolean {
    if (!this.formData.raceDate) return false;
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    return this.formData.raceDate < oneYearAgo;
  }

  onFormDataChange(): void {
    if (this.tableData && this.canProcessResult().canProcess) {
      this.processResults();
    } else {
      this.processedResults = [];
    }
  }

  onColumnMappingChange(header: string): void {
    const newValue = this.columnMapping[header];
    if (newValue) {
      for (const otherHeader of Object.keys(this.columnMapping)) {
        if (otherHeader !== header && this.columnMapping[otherHeader] === newValue) {
          this.columnMapping[otherHeader] = '';
          this.notification.showNotifiction(false, 'Field "' + newValue + '" was unmapped from previous column');
        }
      }
    }
    this.onFormDataChange();
  }

  loadTable(): void {
    this.isLoading = true;
    let endpoint = '/api/extract-table';
    let data: any = { url: this.url };

    if (this.htmlSource) {
      endpoint = '/api/extract-parkrun';
      data = { htmlSource: this.htmlSource };
    }

    this.http.post<any>(endpoint, data).subscribe({
      next: (response) => {
        if (response.success) {
          this.formData.raceType = null;
          this.raceTypeSearch = '';
          this.hiddenColumns = {};
          this.tableHeaders = response.headers;
          this.tableData = response.data;

          if (response.raceDate) {
            this.formData.raceDate = new Date(response.raceDate);
            this.formData.raceDateStr = this.formData.raceDate.toISOString().split('T')[0];
          }

          // Set race type to road 5K for Parkrun
          if (this.htmlSource || this.url.includes('parkrun.')) {
            const fiveK = this.racetypesList.find(rt => rt.name === '5k' && rt.surface === 'road');
            if (fiveK) {
              this.formData.raceType = fiveK;
              this.raceTypeSearch = fiveK.name + ' (' + fiveK.surface + ')';
            }
          }

          // Filter out header-like first row
          this.tableData = response.data.filter((row: any, index: number) => {
            if (index === 0) {
              let isHeaderRow = true;
              for (const header in row) {
                if (typeof row[header] !== 'string' || /\d/.test(row[header])) {
                  isHeaderRow = false;
                  break;
                }
              }
              return !isHeaderRow;
            }
            return true;
          });

          this.columnMapping = {};
          this.autoMapColumns();

          if (response.pageTitle) {
            const title = response.pageTitle
              .replace(/results?/i, '')
              .replace(/race/i, '')
              .replace(/202[0-9]/g, '')
              .trim();
            if (title) this.formData.raceName = title;
          }
          this.formData.resultlink = this.url;
        } else {
          this.notification.showNotifiction(false, 'Failed to load table data: ' + response.error);
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.notification.showNotifiction(false, err.error?.error || 'Failed to load table');
        this.tableData = null;
        this.processedResults = [];
        this.isLoading = false;
      }
    });
  }

  private autoMapColumns(): void {
    if (!this.tableHeaders) return;

    if (this.url.includes('runsignup.com')) {
      this.tableHeaders.forEach(header => {
        const h = header.toLowerCase();
        if (h.includes('name')) this.columnMapping[header] = 'name';
        else if (h.includes('chip time') || h.includes('finish')) this.columnMapping[header] = 'time';
        else if (h === 'place' || h.includes('overall')) this.columnMapping[header] = 'place';
        else if (h.includes('gender place') || h.includes('gender rank')) this.columnMapping[header] = 'genderRank';
        else if (h.includes('gender') || h.includes('sex')) this.columnMapping[header] = 'gender';
        else if (h.includes('age place') || h.includes('age rank')) this.columnMapping[header] = 'ageRank';
      });
    } else if (this.htmlSource || this.url.includes('parkrun.')) {
      this.tableHeaders.forEach(header => {
        const h = header.toLowerCase();
        if (h.includes('name') || h.includes('runner') || h.includes('parkrunner')) this.columnMapping[header] = 'name';
        else if (h.includes('time') || h.includes('finish')) this.columnMapping[header] = 'time';
        else if (h.includes('position') || h.includes('place')) this.columnMapping[header] = 'place';
        else if (h === 'gender') this.columnMapping[header] = 'gender';
        else if (h === 'gender rank') this.columnMapping[header] = 'genderRank';
        else if (h.includes('age position') || h.includes('age place')) this.columnMapping[header] = 'ageRank';
      });
    } else if (this.url.includes('mcrrc.org')) {
      this.tableHeaders.forEach(header => {
        const h = header.toLowerCase();
        if (h === 'name') this.columnMapping[header] = 'name';
        else if (h === 'net time') this.columnMapping[header] = 'time';
        else if (h.includes('place') || h.includes('overall')) this.columnMapping[header] = 'place';
        else if (h.includes('gender') || h.includes('sex')) this.columnMapping[header] = 'gender';
        else if (h.includes('gen/tot') || h.includes('gender place') || h.includes('gender rank')) this.columnMapping[header] = 'genderRank';
        else if (h.includes('div/tot') || h.includes('age place') || h.includes('age rank')) this.columnMapping[header] = 'ageRank';
      });
    } else if (this.url.includes('athlinks.com')) {
      this.tableHeaders.forEach(header => {
        const h = header.toLowerCase();
        if (h === 'name') this.columnMapping[header] = 'name';
        else if (h === 'time') this.columnMapping[header] = 'time';
        else if (h === 'place') this.columnMapping[header] = 'place';
        else if (h === 'gender') this.columnMapping[header] = 'gender';
        else if (h === 'gender place') this.columnMapping[header] = 'genderRank';
        else if (h === 'division place') this.columnMapping[header] = 'ageRank';
      });
    }
  }

  hasRequiredFields(): boolean {
    let hasName = false, hasFirstName = false, hasLastName = false, hasTime = false;
    for (const header in this.columnMapping) {
      if (this.columnMapping[header] === 'name') hasName = true;
      if (this.columnMapping[header] === 'firstname') hasFirstName = true;
      if (this.columnMapping[header] === 'lastname') hasLastName = true;
      if (this.columnMapping[header] === 'time') hasTime = true;
    }
    return (hasName || (hasFirstName && hasLastName)) && hasTime;
  }

  canProcessResult(): { canProcess: boolean; message: string } {
    const missing: string[] = [];
    if (!this.hasRequiredFields()) missing.push('Name and Time fields are required');
    if (!this.formData.raceType) missing.push('Please select a race type');
    if (!this.formData.raceName) missing.push('Please select a race Name');
    if (!this.formData.raceDate) missing.push('Please select a race Date');
    if (!this.formData.location.country) missing.push('Please select a country');
    if (this.formData.location.country === 'USA' && !this.formData.location.state) missing.push('Please select a state for USA');
    return { canProcess: missing.length === 0, message: missing.join('<br>') };
  }

  processResults(): void {
    if (!this.canProcessResult().canProcess || !this.tableData) return;

    this.processedResults = this.tableData
      .map(row => {
        const result: any = {
          selected: true,
          member: {},
          time: 0,
          timeExp: { hours: 0, minutes: 0, seconds: 0, centiseconds: 0 },
          race: {
            racename: this.formData.raceName,
            racedate: this.formData.raceDate ? new Date(this.formData.raceDate).getTime() : null,
            racetype: this.formData.raceType,
            location: this.formData.location,
            isMultisport: false,
            distanceName: this.formData.distanceName
          },
          ranking: {},
          resultlink: this.formData.resultlink,
          isRecordEligible: this.formData.isRecordEligible || false
        };

        // Name parsing
        const nameCol = this.findMappedColumn('name');
        const firstCol = this.findMappedColumn('firstname');
        const lastCol = this.findMappedColumn('lastname');

        if (nameCol && row[nameCol]) {
          const parts = row[nameCol].trim().split(/\s+/);
          if (parts.length >= 2) {
            result.member.firstname = parts[0];
            result.member.lastname = parts.slice(1).join(' ');
          } else return null;
        } else if (firstCol && lastCol && row[firstCol] && row[lastCol]) {
          result.member.firstname = row[firstCol].trim();
          result.member.lastname = row[lastCol].trim();
        } else return null;

        // Time parsing
        const timeCol = this.findMappedColumn('time');
        if (timeCol && row[timeCol]) {
          let timeStr = row[timeCol].toString().trim();
          if (this.htmlSource || this.url.includes('parkrun.')) {
            timeStr = timeStr.split('PB')[0].trim();
          }
          result.time = this.cleanTime(timeStr);
          const totalSec = result.time / 100;
          result.timeExp.hours = Math.floor(totalSec / 3600);
          result.timeExp.minutes = Math.floor((totalSec % 3600) / 60);
          result.timeExp.seconds = Math.floor(totalSec % 60);
          result.timeExp.centiseconds = Math.floor(result.time % 100);
        } else return null;

        // Rankings
        this.parseGenderRanking(result, row);
        this.parseAgeRanking(result, row);
        this.parseOverallRanking(result, row);

        return result;
      })
      .filter((result: any) => {
        if (!result) return false;
        const isMatch = this.currentTeamMembers.some(member => {
          const normalize = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/\s+/g, '');
          const resultName = normalize(result.member.firstname + ' ' + result.member.lastname);
          const memberName = normalize(member.firstname + ' ' + member.lastname);

          let altMatch = false;
          if (member.alternateFullNames?.length) {
            altMatch = member.alternateFullNames.some((alt: string) => {
              const normAlt = normalize(alt);
              return resultName === normAlt || resultName.includes(normAlt) || normAlt.includes(resultName);
            });
          }

          if (resultName === memberName || resultName.includes(memberName) || memberName.includes(resultName) || altMatch) {
            result.members = [member];
            return true;
          }
          return false;
        });
        return isMatch;
      });

    this.processedResults.forEach(r => delete r.member);
  }

  private findMappedColumn(field: string): string | null {
    return Object.keys(this.columnMapping).find(k => this.columnMapping[k] === field) || null;
  }

  private parseGenderRanking(result: any, row: any): void {
    const genderRankCol = this.findMappedColumn('genderRank');
    const genderCol = this.findMappedColumn('gender');

    if (genderRankCol && row[genderRankCol]) {
      const str = row[genderRankCol].toString().trim();
      if (str.includes('/')) {
        const parts = str.split('/');
        const rank = parseInt(parts[0]); const total = parseInt(parts[1]);
        if (!isNaN(rank)) result.ranking.genderrank = rank;
        if (!isNaN(total)) result.ranking.gendertotal = total;
      } else {
        const rank = parseInt(str);
        if (!isNaN(rank)) {
          result.ranking.genderrank = rank;
          if (genderCol && row[genderCol]) {
            const gender = row[genderCol].toString().trim();
            result.ranking.gendertotal = this.tableData!.filter(r => r[genderCol!].toString().trim() === gender).length;
          }
        }
      }
    } else if (genderCol && row[genderCol]) {
      const isParkrun = this.htmlSource || this.url.includes('parkrun.');
      const currentGender = isParkrun ? row[genderCol].toString().replace(/[0-9]/g, '').trim() : row[genderCol].toString().trim();
      const genderTotal = this.tableData!.filter(r => {
        const g = isParkrun ? r[genderCol!].toString().replace(/[0-9]/g, '').trim() : r[genderCol!].toString().trim();
        return g === currentGender;
      }).length;
      const genderRank = this.tableData!
        .filter(r => r[genderCol!].toString().replace(/[0-9]/g, '').trim() === currentGender)
        .findIndex(r => r === row) + 1;
      if (genderRank > 0) {
        result.ranking.genderrank = genderRank;
        result.ranking.gendertotal = genderTotal;
      }
    }
  }

  private parseAgeRanking(result: any, row: any): void {
    const ageRankCol = this.findMappedColumn('ageRank');
    const ageGroupCol = this.findMappedColumn('ageGroup');

    if (ageRankCol && row[ageRankCol]) {
      const str = row[ageRankCol].toString().trim();
      if (str.includes('/')) {
        const parts = str.split('/');
        const rank = parseInt(parts[0]); const total = parseInt(parts[1]);
        if (!isNaN(rank)) result.ranking.agerank = rank;
        if (!isNaN(total)) result.ranking.agetotal = total;
      } else {
        const rank = parseInt(str);
        if (!isNaN(rank)) {
          result.ranking.agerank = rank;
          if (ageGroupCol && row[ageGroupCol]) {
            const group = row[ageGroupCol].toString().trim();
            result.ranking.agetotal = this.tableData!.filter(r => r[ageGroupCol!].toString().trim() === group).length;
          }
        }
      }
    } else if (ageGroupCol && row[ageGroupCol]) {
      const group = row[ageGroupCol].toString().trim();
      const total = this.tableData!.filter(r => r[ageGroupCol!].toString().trim() === group).length;
      const rank = this.tableData!.filter(r => r[ageGroupCol!].toString().trim() === group).findIndex(r => r === row) + 1;
      if (rank > 0) {
        result.ranking.agerank = rank;
        result.ranking.agetotal = total;
      }
    }
  }

  private parseOverallRanking(result: any, row: any): void {
    const placeCol = this.findMappedColumn('place');
    if (placeCol && row[placeCol]) {
      const place = parseInt(row[placeCol]);
      if (!isNaN(place)) result.ranking.overallrank = place;
    }
    if (placeCol) {
      const total = Math.max(...this.tableData!.map(r => {
        const p = parseInt(r[placeCol!]);
        return isNaN(p) ? 0 : p;
      }));
      result.ranking.overalltotal = total;
    }
  }

  cleanTime(timeStr: string): number {
    if (!timeStr) return 0;
    timeStr = timeStr.replace(/[^0-9:.]/g, '');
    if (timeStr.includes(':')) {
      const parts = timeStr.split(':');
      if (parts.length === 2) return (parseInt(parts[0]) * 60 + parseFloat(parts[1])) * 100;
      if (parts.length === 3) return (parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2])) * 100;
    }
    return parseFloat(timeStr) * 100;
  }

  updateTime(result: any): void {
    result.timeExp.hours = parseInt(result.timeExp.hours) || 0;
    result.timeExp.minutes = parseInt(result.timeExp.minutes) || 0;
    result.timeExp.seconds = parseInt(result.timeExp.seconds) || 0;
    result.timeExp.centiseconds = parseInt(result.timeExp.centiseconds) || 0;
    result.time = (result.timeExp.hours * 3600 + result.timeExp.minutes * 60 + result.timeExp.seconds) * 100 + result.timeExp.centiseconds;
  }

  selectAll(): void { this.processedResults.forEach(r => r.selected = true); }
  deselectAll(): void { this.processedResults.forEach(r => r.selected = false); }
  hasSelectedResults(): boolean { return this.processedResults.some(r => r.selected); }

  hideColumn(header: string): void { this.hiddenColumns[header] = true; }
  isColumnHidden(header: string): boolean { return this.hiddenColumns[header] || false; }

  debugResult(result: any): void { console.log('Debug Result:', result); }

  saveResults(): void {
    if (!this.processedResults.length) {
      this.notification.showNotifiction(false, 'No results to save');
      return;
    }
    let resultsToSave = this.processedResults.filter(r => r.selected);
    if (!resultsToSave.length) {
      this.notification.showNotifiction(false, 'Please select at least one result to save');
      return;
    }

    resultsToSave = resultsToSave.map(result => {
      if (result.timeExp) {
        result.time = (result.timeExp.hours * 3600 + result.timeExp.minutes * 60 + result.timeExp.seconds) * 100 + result.timeExp.centiseconds;
      }
      if (result.ranking) {
        result.ranking.overallrank = parseInt(result.ranking.overallrank) || undefined;
        result.ranking.overalltotal = parseInt(result.ranking.overalltotal) || undefined;
        result.ranking.genderrank = parseInt(result.ranking.genderrank) || undefined;
        result.ranking.gendertotal = parseInt(result.ranking.gendertotal) || undefined;
        result.ranking.agerank = parseInt(result.ranking.agerank) || undefined;
        result.ranking.agetotal = parseInt(result.ranking.agetotal) || undefined;
      }
      const res = JSON.parse(JSON.stringify(result));
      delete res.timeExp;
      delete res.selected;
      delete res.member;
      return res;
    });

    this.isLoading = true;
    this.savingMessage = 'Saving ' + resultsToSave.length + ' results...';

    this.resultsService.saveResults(resultsToSave)
      .then((savedResults: any) => {
        if (typeof gtag !== 'undefined') {
          gtag('event', 'save_results', { results_count: savedResults.length });
        }
        this.processedResults = [];
        this.isLoading = false;
        this.savingMessage = '';
      })
      .catch((error: any) => {
        console.error('Error saving results:', error);
        this.isLoading = false;
        this.savingMessage = '';
      });
  }
}
