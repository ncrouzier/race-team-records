import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ResultsService } from '../../../core/services/results.service';
import { MembersService } from '../../../core/services/members.service';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { TypeaheadSelectComponent } from '../../../shared/components/typeahead-select/typeahead-select.component';
import { MemberSearchComponent } from '../../../shared/components/member-search/member-search.component';
import { OnlyDigitsDirective } from '../../../shared/directives/only-digits.directive';
import { OnlyDigitsForMinSecDirective } from '../../../shared/directives/only-digits-for-min-sec.directive';
import { OnlyDigitsForCentisecDirective } from '../../../shared/directives/only-digits-for-centisec.directive';

@Component({
  selector: 'app-bulk-operations',
  standalone: true,
  imports: [CommonModule, FormsModule, TypeaheadSelectComponent, MemberSearchComponent,
            OnlyDigitsDirective, OnlyDigitsForMinSecDirective, OnlyDigitsForCentisecDirective],
  template: `
    <div class="jumbotron" *ngIf="user?.role === 'admin'" style="padding-left: 5px; padding-right: 5px;">
      <ul class="nav nav-tabs" style="margin-bottom: 15px;">
        <li [class.active]="selectedTab === 'add'">
          <a class="hoverhand" (click)="selectTab('add')">Add Results</a>
        </li>
        <li [class.active]="selectedTab === 'edit'">
          <a class="hoverhand" (click)="selectTab('edit')">Edit Race Results</a>
        </li>
      </ul>

      <!-- ADD TAB -->
      <div *ngIf="selectedTab === 'add'">
        <div style="overflow-x: auto;">
          <table class="bulkedit bulktable">
            <thead>
              <tr>
                <th>Race Name</th><th>Date</th><th>Type</th><th>Racer</th>
                <th>h</th><th>m</th><th>s</th><th>cs</th>
                <th>agroup</th><th>Gender</th><th>overall</th>
                <th>comments</th><th>link</th><th>actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let result of results; let i = index"
                  [ngClass]="{'greenbg': result.success === true, 'redbg': result.success === false}">
                <td>
                  <input type="text" class="form-control bulkinput" [(ngModel)]="result.race.racename"
                         [name]="'racename_'+i" required style="width: 100px;">
                </td>
                <td>
                  <input type="date" class="form-control bulkinput" [(ngModel)]="result.race.racedate"
                         [name]="'racedate_'+i" required style="width: 130px;">
                </td>
                <td>
                  <app-typeahead-select [items]="racetypesList"
                                        [displayFn]="raceTypeDisplayFn"
                                        [searchFields]="['name','surface']"
                                        placeholder="Select type"
                                        (itemSelected)="onRaceTypeSelected(i, $event)"
                                        [ngModel]="result.race.racetype"
                                        [name]="'racetype_'+i"
                                        style="width: 150px; display: inline-block;">
                  </app-typeahead-select>
                  <div *ngIf="result.race.racetype?.isVariable" style="margin-top: 3px;">
                    <input type="text" class="form-control bulkinput" [(ngModel)]="result.race.distanceName"
                           [name]="'distname_'+i" placeholder="distance name" style="width: 100px;">
                    <input type="text" class="form-control bulkinput" [(ngModel)]="result.race.racetype.meters"
                           [name]="'meters_'+i" placeholder="meters" style="width: 100px;">
                    <input type="text" class="form-control bulkinput" [(ngModel)]="result.race.racetype.miles"
                           [name]="'miles_'+i" placeholder="miles" style="width: 100px;">
                  </div>
                </td>
                <td>
                  <span *ngFor="let member of result.members; let mi = index" style="display: inline-block;">
                    <app-member-search [members]="membersList" placeholder="Select member"
                                        (memberSelected)="onMemberSelected(i, mi, $event)"
                                        style="width: 120px; display: inline-block;">
                    </app-member-search>
                    <i *ngIf="mi > 0" class="hoverhand fa fa-times" (click)="removeMember(i, mi)"></i>
                  </span>
                  <i class="hoverhand fa fa-plus" (click)="addMember(i)" title="Add member" style="margin-left: 3px;"></i>
                </td>
                <td><input type="text" [(ngModel)]="timeDetails[i].hours" [name]="'h_'+i" onlyDigits class="form-control bulkinput lightbluebg" placeholder="0" style="width: 50px;"></td>
                <td><input type="text" [(ngModel)]="timeDetails[i].minutes" [name]="'m_'+i" onlyDigitsForMinSec class="form-control bulkinput lightbluebg" placeholder="0" style="width: 50px;"></td>
                <td><input type="text" [(ngModel)]="timeDetails[i].seconds" [name]="'s_'+i" onlyDigitsForMinSec class="form-control bulkinput lightbluebg" placeholder="0" style="width: 50px;"></td>
                <td><input type="text" [(ngModel)]="timeDetails[i].centiseconds" [name]="'cs_'+i" onlyDigitsForCentisec class="form-control bulkinput lightbluebg" placeholder="0" style="width: 50px;"></td>
                <td>
                  <input type="text" [(ngModel)]="result.ranking.agerank" [name]="'ar_'+i" onlyDigits class="form-inline bulkinput" style="width: 50px;">
                  <input type="text" [(ngModel)]="result.ranking.agetotal" [name]="'at_'+i" onlyDigits class="form-inline bulkinput" style="width: 50px;">
                </td>
                <td>
                  <input type="text" [(ngModel)]="result.ranking.genderrank" [name]="'gr_'+i" onlyDigits class="form-inline bulkinput" style="width: 50px;">
                  <input type="text" [(ngModel)]="result.ranking.gendertotal" [name]="'gt_'+i" onlyDigits class="form-inline bulkinput" style="width: 50px;">
                </td>
                <td>
                  <input type="text" [(ngModel)]="result.ranking.overallrank" [name]="'or_'+i" onlyDigits class="form-inline bulkinput" style="width: 50px;">
                  <input type="text" [(ngModel)]="result.ranking.overalltotal" [name]="'ot_'+i" onlyDigits class="form-inline bulkinput" style="width: 50px;">
                </td>
                <td><textarea class="form-control bulkinput" rows="1" [(ngModel)]="result.comments" [name]="'cmt_'+i" style="width: 50px;"></textarea></td>
                <td><input type="text" [(ngModel)]="result.resultlink" [name]="'link_'+i" class="form-control bulkinput" style="width: 50px;"></td>
                <td style="font-size: 15px; padding-top: 3px;">
                  <i class="fa fa-plus hoverhand" (click)="addResultEntry(i)"></i>
                  <i *ngIf="results.length > 1" class="fa fa-minus-circle hoverhand" (click)="removeResultEntry(i)"></i>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <button class="btn btn-primary" (click)="saveResults('add')" [disabled]="saving">
          {{saving ? 'Saving...' : 'Add Results'}}
        </button>
      </div>

      <!-- EDIT TAB -->
      <div *ngIf="selectedTab === 'edit'">
        <div class="form-group">
          <app-typeahead-select [items]="racesList"
                                [displayFn]="raceDisplayFn"
                                [searchFields]="['racename']"
                                placeholder="Select a race"
                                (itemSelected)="onRaceSelected($event)"
                                style="min-width: 300px; display: inline-block;">
          </app-typeahead-select>
        </div>
        <div *ngIf="results.length > 0" style="overflow-x: auto;">
          <table class="bulkedit bulktable">
            <thead>
              <tr>
                <th>Race Name</th><th>Date</th><th>Type</th><th>Racer</th>
                <th>h</th><th>m</th><th>s</th><th>cs</th>
                <th>agroup</th><th>Gender</th><th>overall</th>
                <th>comments</th><th>link</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let result of results; let i = index"
                  [ngClass]="{'greenbg': result.success === true, 'redbg': result.success === false}">
                <td>
                  <input type="text" class="form-control bulkinput" [(ngModel)]="result.race.racename"
                         [name]="'e_rn_'+i" required style="width: 100px;">
                </td>
                <td>
                  <input type="date" class="form-control bulkinput" [(ngModel)]="result.race.racedateStr"
                         [name]="'e_rd_'+i" required style="width: 130px;">
                </td>
                <td>
                  <app-typeahead-select [items]="racetypesList"
                                        [displayFn]="raceTypeDisplayFn"
                                        [searchFields]="['name','surface']"
                                        placeholder="Select type"
                                        (itemSelected)="onRaceTypeSelected(i, $event)"
                                        [ngModel]="result.race.racetype"
                                        [name]="'e_rt_'+i"
                                        style="width: 150px; display: inline-block;">
                  </app-typeahead-select>
                  <div *ngIf="result.race.racetype?.isVariable" style="margin-top: 3px;">
                    <input type="text" class="form-control bulkinput" [(ngModel)]="result.race.distanceName"
                           [name]="'e_dn_'+i" placeholder="distance name" style="width: 100px;">
                    <input type="text" class="form-control bulkinput" [(ngModel)]="result.race.racetype.meters"
                           [name]="'e_me_'+i" placeholder="meters" style="width: 100px;">
                    <input type="text" class="form-control bulkinput" [(ngModel)]="result.race.racetype.miles"
                           [name]="'e_mi_'+i" placeholder="miles" style="width: 100px;">
                  </div>
                </td>
                <td>
                  <div *ngFor="let member of result.members; let mi = index" style="display: inline-block;">
                    <span *ngIf="member" style="margin-right: 5px;">{{member.firstname}} {{member.lastname}}</span>
                  </div>
                </td>
                <td><input type="text" [(ngModel)]="timeDetails[i].hours" [name]="'e_h_'+i" onlyDigits class="form-control bulkinput lightbluebg" placeholder="0" style="width: 50px;"></td>
                <td><input type="text" [(ngModel)]="timeDetails[i].minutes" [name]="'e_m_'+i" onlyDigitsForMinSec class="form-control bulkinput lightbluebg" placeholder="0" style="width: 50px;"></td>
                <td><input type="text" [(ngModel)]="timeDetails[i].seconds" [name]="'e_s_'+i" onlyDigitsForMinSec class="form-control bulkinput lightbluebg" placeholder="0" style="width: 50px;"></td>
                <td><input type="text" [(ngModel)]="timeDetails[i].centiseconds" [name]="'e_cs_'+i" onlyDigitsForCentisec class="form-control bulkinput lightbluebg" placeholder="0" style="width: 50px;"></td>
                <td>
                  <input type="text" [(ngModel)]="result.ranking.agerank" [name]="'e_ar_'+i" onlyDigits class="form-inline bulkinput" style="width: 50px;">
                  <input type="text" [(ngModel)]="result.ranking.agetotal" [name]="'e_at_'+i" onlyDigits class="form-inline bulkinput" style="width: 50px;">
                </td>
                <td>
                  <input type="text" [(ngModel)]="result.ranking.genderrank" [name]="'e_gr_'+i" onlyDigits class="form-inline bulkinput" style="width: 50px;">
                  <input type="text" [(ngModel)]="result.ranking.gendertotal" [name]="'e_gt_'+i" onlyDigits class="form-inline bulkinput" style="width: 50px;">
                </td>
                <td>
                  <input type="text" [(ngModel)]="result.ranking.overallrank" [name]="'e_or_'+i" onlyDigits class="form-inline bulkinput" style="width: 50px;">
                  <input type="text" [(ngModel)]="result.ranking.overalltotal" [name]="'e_ot_'+i" onlyDigits class="form-inline bulkinput" style="width: 50px;">
                </td>
                <td><textarea class="form-control bulkinput" rows="1" [(ngModel)]="result.comments" [name]="'e_cmt_'+i" style="width: 50px;"></textarea></td>
                <td><input type="text" [(ngModel)]="result.resultlink" [name]="'e_lnk_'+i" class="form-control bulkinput" style="width: 50px;"></td>
              </tr>
            </tbody>
          </table>
        </div>
        <button *ngIf="results.length > 0" class="btn btn-primary" (click)="saveResults('edit')" [disabled]="saving">
          {{saving ? 'Saving...' : 'Edit Results'}}
        </button>
      </div>
    </div>
  `
})
export class BulkOperationsComponent implements OnInit {
  user: any;
  selectedTab: 'add' | 'edit' = 'add';
  results: any[] = [];
  timeDetails: any[] = [];
  membersList: any[] = [];
  racetypesList: any[] = [];
  racesList: any[] = [];
  selectedRace: any = null;
  saving = false;

  raceTypeDisplayFn = (rt: any) => rt ? rt.name + ' (' + rt.surface + ')' : '';
  raceDisplayFn = (race: any) => race ? race.racename + ' - ' + this.formatDate(race.racedate) : '';

  constructor(
    private resultsService: ResultsService,
    private membersService: MembersService,
    private authStateService: AuthStateService
  ) {}

  async ngOnInit() {
    this.user = this.authStateService.currentUser;
    this.membersService.getMembersWithCacheSupport({ sort: 'firstname' }).then(m => this.membersList = m);
    this.resultsService.getRaceTypes({ sort: 'meters' }).then(rt => this.racetypesList = rt);
    this.resultsService.getRaces({ sort: '-racedate' }).then(r => this.racesList = r);
    this.initAdd();
  }

  selectTab(tab: 'add' | 'edit') {
    this.selectedTab = tab;
    if (tab === 'add') this.initAdd();
    else this.initEdit();
  }

  initAdd() {
    this.results = [];
    this.timeDetails = [];
    const today = new Date().toISOString().split('T')[0];
    this.results.push({
      race: { racename: '', racedate: today, racetype: null },
      members: [null],
      ranking: { agerank: null, agetotal: null, genderrank: null, gendertotal: null, overallrank: null, overalltotal: null },
      comments: '',
      resultlink: ''
    });
    this.timeDetails.push({ hours: null, minutes: null, seconds: null, centiseconds: null });
  }

  initEdit() {
    this.results = [];
    this.timeDetails = [];
    this.selectedRace = null;
  }

  async onRaceSelected(race: any) {
    this.selectedRace = race;
    if (!race) { this.results = []; this.timeDetails = []; return; }
    const results = await this.resultsService.getResults({
      sort: '-race.racedate time',
      filters: { raceid: race._id }
    });
    this.results = results.map((r: any) => ({
      ...r,
      race: { ...r.race, racedateStr: this.formatDate(r.race.racedate) }
    }));
    this.timeDetails = results.map((r: any) => ({
      hours: Math.floor((r.time / 360000) % 24),
      minutes: Math.floor((r.time / 6000) % 60),
      seconds: Math.floor((r.time / 100) % 60),
      centiseconds: Math.floor(r.time % 100)
    }));
  }

  addResultEntry(index: number) {
    if (index < 0 || index >= this.results.length) return;
    const last = this.results[index];
    this.results.push({
      race: { racename: last.race.racename, racedate: last.race.racedate, racetype: last.race.racetype },
      members: [null],
      ranking: {
        agerank: null, agetotal: last.ranking?.agetotal,
        genderrank: null, gendertotal: last.ranking?.gendertotal,
        overallrank: null, overalltotal: last.ranking?.overalltotal
      },
      comments: '',
      resultlink: ''
    });
    this.timeDetails.push({ hours: null, minutes: null, seconds: null, centiseconds: null });
  }

  removeResultEntry(index: number) {
    if (this.results.length > 1 && index >= 0) {
      this.results.splice(index, 1);
      this.timeDetails.splice(index, 1);
    }
  }

  onMemberSelected(resultIndex: number, memberIndex: number, member: any) {
    this.results[resultIndex].members[memberIndex] = member;
  }

  addMember(resultIndex: number) {
    this.results[resultIndex].members.push(null);
  }

  removeMember(resultIndex: number, memberIndex: number) {
    if (this.results[resultIndex].members.length > 1) {
      this.results[resultIndex].members.splice(memberIndex, 1);
    }
  }

  onRaceTypeSelected(resultIndex: number, raceType: any) {
    this.results[resultIndex].race.racetype = raceType;
  }

  async saveResults(mode: 'add' | 'edit') {
    this.saving = true;
    for (let i = 0; i < this.results.length; i++) {
      if (this.results[i].success !== undefined) continue;

      // Convert time
      const td = this.timeDetails[i];
      this.results[i].time = (td.hours || 0) * 360000 + (td.minutes || 0) * 6000 +
                              (td.seconds || 0) * 100 + (td.centiseconds || 0);

      // Format date
      if (mode === 'edit' && this.results[i].race.racedateStr) {
        this.results[i].race.racedate = this.results[i].race.racedateStr;
      } else if (this.results[i].race.racedate && typeof this.results[i].race.racedate !== 'string') {
        this.results[i].race.racedate = this.formatDate(this.results[i].race.racedate);
      }

      // Clean empty ranking
      const r = this.results[i].ranking;
      if (!r || (!r.agerank && !r.agetotal && !r.genderrank && !r.gendertotal && !r.overallrank && !r.overalltotal)) {
        this.results[i].ranking = {};
      }

      // Filter null members
      this.results[i].members = (this.results[i].members || []).filter((m: any) => m != null);

      try {
        let saved: any;
        if (mode === 'add') {
          saved = await this.resultsService.createResult(this.results[i]);
        } else {
          saved = await this.resultsService.editResult(this.results[i]._id, this.results[i]);
        }
        this.results[i].success = !!saved;
      } catch (e) {
        this.results[i].success = false;
      }
    }
    this.saving = false;
  }

  private formatDate(d: any): string {
    if (!d) return '';
    return new Date(d).toISOString().split('T')[0];
  }
}
