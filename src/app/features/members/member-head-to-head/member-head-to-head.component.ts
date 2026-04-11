import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MembersService } from '../../../core/services/members.service';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { HeadToHeadService } from '../services/head-to-head.service';
import { ResultsService } from '../../../core/services/results.service';
import { MemberNavComponent } from '../member-nav/member-nav.component';
import { MemberSearchComponent } from '../../../shared/components/member-search/member-search.component';

declare var gtag: any;

@Component({
  selector: 'app-member-head-to-head',
  standalone: true,
  imports: [CommonModule, FormsModule, MemberNavComponent, MemberSearchComponent],
  template: `
    <div class="head-to-head-page">

      <!-- Loading Spinner -->
      <div *ngIf="loading" class="text-center" style="padding: 50px;">
        <i class="fa fa-spinner fa-spin fa-3x"></i>
        <p>Loading head-to-head comparison...</p>
      </div>

      <div *ngIf="!loading && member1">
        <!-- Member Nav Header -->
        <app-member-nav [member]="member1" activeTab="head-to-head" [user]="user"></app-member-nav>

        <!-- Toolbar Well -->
        <div class="jumbotron">
          <div class="row">
            <div class="col-md-12">
              <div class="well well-sm">
                <div class="row">
                  <div class="col-sm-8">
                    <label class="control-label">
                      <i class="fa fa-users"></i> Compare with:
                    </label>
                    <app-member-search
                      [members]="teamMembersForDropdown"
                      placeholder="Select team member..."
                      (memberSelected)="onCompareMemberSelected($event)">
                    </app-member-search>
                  </div>
                  <div class="col-sm-4 text-right">
                    <div class="age-grade-mode-toggle btn-group" role="group" style="margin-bottom: 10px;">
                      <button style="margin-right: 5px" type="button" class="btn btn-sm"
                              [ngClass]="{'activated': !ageGradeMode, 'deactivated': ageGradeMode}"
                              (click)="toggleAgeGradeMode(false)"
                              title="Switch to regular time-based comparison">
                        <i class="fa fa-clock-o"></i>
                        Regular Mode
                      </button>
                      <button type="button" class="btn btn-sm"
                              [ngClass]="{'activated': ageGradeMode, 'deactivated': !ageGradeMode}"
                              (click)="toggleAgeGradeMode(true)"
                              title="Switch to age grade-based comparison">
                        <i class="fa fa-percent"></i>
                        Age Grade Mode
                      </button>
                    </div>
                  </div>
                </div>
                <div class="row">
                  <div class="col-sm-12 text-right">
                    <label class="control-label" style="margin-right: 5px;">
                      <i class="fa fa-calendar"></i> Year:
                    </label>
                    <select class="form-control" style="display: inline-block; width: auto; min-width: 120px;"
                            [(ngModel)]="yearFilter" (ngModelChange)="onYearChange()">
                      <option *ngFor="let year of yearsList" [ngValue]="year">{{ year }}</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Team Members H2H Overview Table -->
          <div class="row" *ngIf="topTeamMembers && topTeamMembers.length > 0">
            <div class="col-md-12">
              <div class="panel panel-default shared-races-table">
                <div class="panel-heading">
                  <div class="panel-heading-content">
                    <h4>
                      <i class="fa fa-users"></i> Head-to-Head Records vs Team Members
                      - {{ yearFilter }}
                      ({{ filteredTeamMembers.length }})
                    </h4>
                    <!-- Gender Filter -->
                    <div class="gender-filter-container">
                      <div class="btn-group" role="group">
                        <button type="button" class="btn btn-sm"
                                [ngClass]="{'btn-primary': !teamMemberGenderFilter, 'btn-outline-primary': teamMemberGenderFilter}"
                                (click)="setGenderFilter(null)">
                          <i class="fa fa-users"></i>
                          All Members
                        </button>
                        <button type="button" class="btn btn-sm"
                                [ngClass]="{'btn-primary': teamMemberGenderFilter === 'Female', 'btn-outline-primary': teamMemberGenderFilter !== 'Female'}"
                                (click)="setGenderFilter('Female')"
                                title="Show only female team members">
                          <i class="fa fa-venus"></i>
                          Women Only
                        </button>
                        <button type="button" class="btn btn-sm"
                                [ngClass]="{'btn-primary': teamMemberGenderFilter === 'Male', 'btn-outline-primary': teamMemberGenderFilter !== 'Male'}"
                                (click)="setGenderFilter('Male')"
                                title="Show only male team members">
                          <i class="fa fa-mars"></i>
                          Men Only
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="panel-body">
                  <div class="table-responsive head-to-head-tables">
                    <table class="table">
                      <thead>
                        <tr>
                          <th (click)="sortTeamMembersBy('firstname')" class="hoverhand">
                            Team Member
                            <i *ngIf="teamMemberSortCriteria === 'firstname'"
                               class="fa" [ngClass]="teamMemberSortDirection ? 'fa-sort-asc' : 'fa-sort-desc'"></i>
                            <i *ngIf="teamMemberSortCriteria !== 'firstname'" class="fa fa-sort"></i>
                          </th>
                          <th (click)="sortTeamMembersBy('count')" class="hoverhand text-center">
                            Races Together
                            <i *ngIf="teamMemberSortCriteria === 'count'"
                               class="fa" [ngClass]="teamMemberSortDirection ? 'fa-sort-asc' : 'fa-sort-desc'"></i>
                            <i *ngIf="teamMemberSortCriteria !== 'count'" class="fa fa-sort"></i>
                          </th>
                          <th (click)="sortTeamMembersBy('wins')" class="hoverhand member-1-color text-center">
                            {{ member1.firstname }} Wins
                            <i *ngIf="teamMemberSortCriteria === 'wins'"
                               class="fa" [ngClass]="teamMemberSortDirection ? 'fa-sort-asc' : 'fa-sort-desc'"></i>
                            <i *ngIf="teamMemberSortCriteria !== 'wins'" class="fa fa-sort"></i>
                          </th>
                          <th (click)="sortTeamMembersBy('losses')" class="hoverhand member-2-color text-center">
                            Losses
                            <i *ngIf="teamMemberSortCriteria === 'losses'"
                               class="fa" [ngClass]="teamMemberSortDirection ? 'fa-sort-asc' : 'fa-sort-desc'"></i>
                            <i *ngIf="teamMemberSortCriteria !== 'losses'" class="fa fa-sort"></i>
                          </th>
                          <th (click)="sortTeamMembersBy('ties')" class="hoverhand text-center">
                            Ties
                            <i *ngIf="teamMemberSortCriteria === 'ties'"
                               class="fa" [ngClass]="teamMemberSortDirection ? 'fa-sort-asc' : 'fa-sort-desc'"></i>
                            <i *ngIf="teamMemberSortCriteria !== 'ties'" class="fa fa-sort"></i>
                          </th>
                          <th (click)="sortTeamMembersBy('winRate')" class="hoverhand text-center">
                            Win Rate
                            <i *ngIf="teamMemberSortCriteria === 'winRate'"
                               class="fa" [ngClass]="teamMemberSortDirection ? 'fa-sort-asc' : 'fa-sort-desc'"></i>
                            <i *ngIf="teamMemberSortCriteria !== 'winRate'" class="fa fa-sort"></i>
                          </th>
                          <th class="text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr *ngFor="let member of filteredTeamMembers; trackBy: trackByMemberId">
                          <td>
                            <span [ngClass]="{'past-member': member.memberStatus === 'past'}"
                                  class="hoverhand"
                                  (click)="navigateToMember(member)">
                              <strong>{{ member.firstname }} {{ member.lastname }}</strong>
                              {{ member.memberStatus === 'past' ? '(past)' : '' }}
                            </span>
                          </td>
                          <td class="text-center">{{ member.count }}</td>
                          <td class="text-center member-1-color">
                            <strong>{{ member.headToHeadRecord.wins }}</strong>
                          </td>
                          <td class="text-center member-2-color">
                            <strong>{{ member.headToHeadRecord.losses }}</strong>
                          </td>
                          <td class="text-center text-warning">
                            <strong>{{ member.headToHeadRecord.ties }}</strong>
                          </td>
                          <td class="text-center">
                            <strong>{{ member.headToHeadRecord.winRate | number:'1.1-1' }}%</strong>
                          </td>
                          <td class="text-center">
                            <button class="btn btn-primary btn-sm"
                                    (click)="onCompareMemberSelected(member)"
                                    title="Compare head-to-head">
                              <i class="fa fa-trophy"></i> Compare
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- No Team Members for Selected Year -->
          <div class="row" *ngIf="topTeamMembers && topTeamMembers.length === 0 && !loading">
            <div class="col-md-12 text-center" style="padding: 30px;">
              <i class="fa fa-calendar-times-o fa-3x text-muted"></i>
              <h4 class="text-muted" *ngIf="yearFilter !== 'All Time'">
                No head-to-head records found for {{ yearFilter }}.
              </h4>
              <h4 class="text-muted" *ngIf="yearFilter === 'All Time'">
                No head-to-head records found.
              </h4>
            </div>
          </div>

        </div>
      </div>

    </div>
  `
})
export class MemberHeadToHeadComponent implements OnInit, OnDestroy {
  member1: any = null;
  user: any;
  loading = true;

  topTeamMembers: any[] = [];
  sortedTeamMembers: any[] = [];
  filteredTeamMembers: any[] = [];
  teamMembersForDropdown: any[] = [];

  ageGradeMode = false;
  yearFilter: string | number = 'All Time';
  yearsList: (string | number)[] = ['All Time'];
  teamMemberGenderFilter: string | null = null;
  teamMemberSortCriteria = 'wins';
  teamMemberSortDirection = false; // false = desc

  h2hColors: any = { member1: '', member2: '', tie: '' };

  private _cachedRaceList: any[] = [];
  private _cachedAllMembers: any[] = [];
  private routeSub: Subscription | null = null;

  constructor(
    private membersService: MembersService,
    private headToHeadService: HeadToHeadService,
    private authStateService: AuthStateService,
    private route: ActivatedRoute,
    private router: Router,
    private resultsService: ResultsService
  ) {}

  ngOnInit(): void {
    this.user = this.authStateService.currentUser;

    // Load age grade mode from localStorage
    const savedMode = localStorage.getItem('headToHeadAgeGradeMode');
    if (savedMode !== null) {
      this.ageGradeMode = JSON.parse(savedMode);
    }

    // Read H2H colors from CSS
    this.h2hColors = {
      member1: this.getCssColor('member-1-color'),
      member2: this.getCssColor('member-2-color'),
      tie: this.getCssColor('member-tie-color')
    };

    this.routeSub = this.route.paramMap.subscribe(params => {
      const username = params.get('member');
      if (username) {
        this.loadData(username);
      } else {
        this.router.navigate(['/members']);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.routeSub) {
      this.routeSub.unsubscribe();
    }
  }

  private async loadData(username: string): Promise<void> {
    this.loading = true;

    try {
      // Load all members with cache support
      const allMembers = await this.membersService.getMembersWithCacheSupport();

      // Find the current member
      const currentMember = allMembers.find((m: any) => m.username === username);
      if (!currentMember) {
        this.router.navigate(['/members']);
        return;
      }

      this.member1 = currentMember;

      // Load race data
      const raceList = await this.resultsService.getRaceResultsWithCacheSupport({
        sort: '-racedate -order racename',
        preload: false
      });

      // Cache full unfiltered data for year/filter changes
      this._cachedRaceList = raceList;
      this._cachedAllMembers = allMembers;

      // Build years list from races where member1 has results
      this.buildYearsList(raceList);

      // Apply year filter before calculations
      const filteredRaceList = this.filterRaceListByYear(raceList);

      // Calculate top team members
      this.calculateAndSetTopTeamMembers(filteredRaceList, allMembers);

      this.loading = false;

      if (typeof gtag !== 'undefined') {
        gtag('event', 'view_head_to_head', {
          member_name: currentMember.firstname + ' ' + currentMember.lastname
        });
      }
    } catch (error) {
      console.error('Error loading member head-to-head data:', error);
      this.loading = false;
      this.router.navigate(['/members']);
    }
  }

  toggleAgeGradeMode(mode: boolean): void {
    this.ageGradeMode = mode;

    // Save to localStorage
    localStorage.setItem('headToHeadAgeGradeMode', JSON.stringify(this.ageGradeMode));

    // Recalculate using cached data
    if (this._cachedRaceList.length > 0 && this._cachedAllMembers.length > 0) {
      const filteredRaceList = this.filterRaceListByYear(this._cachedRaceList);
      this.calculateAndSetTopTeamMembers(filteredRaceList, this._cachedAllMembers);
    }
  }

  onYearChange(): void {
    if (this._cachedRaceList.length > 0 && this._cachedAllMembers.length > 0) {
      const filteredRaceList = this.filterRaceListByYear(this._cachedRaceList);
      this.calculateAndSetTopTeamMembers(filteredRaceList, this._cachedAllMembers);
    }
  }

  buildYearsList(raceList: any[]): void {
    const yearsSet: Record<number, boolean> = {};
    const memberId = this.member1._id;

    raceList.forEach((race: any) => {
      if (race.results && race.results.length > 0) {
        for (let i = 0; i < race.results.length; i++) {
          const result = race.results[i];
          if (result.members) {
            for (let j = 0; j < result.members.length; j++) {
              if (result.members[j]._id === memberId) {
                yearsSet[new Date(race.racedate).getUTCFullYear()] = true;
                return; // found member in this race, move to next race
              }
            }
          }
        }
      }
    });

    const years = Object.keys(yearsSet).map(Number).sort((a, b) => b - a);
    this.yearsList = (['All Time'] as (string | number)[]).concat(years);
  }

  filterRaceListByYear(raceList: any[]): any[] {
    if (this.yearFilter === 'All Time') return raceList;
    const selectedYear = typeof this.yearFilter === 'string' ? parseInt(this.yearFilter, 10) : this.yearFilter;
    return raceList.filter((race: any) => {
      return new Date(race.racedate).getUTCFullYear() === selectedYear;
    });
  }

  private calculateAndSetTopTeamMembers(filteredRaceList: any[], allMembers: any[]): void {
    this.topTeamMembers = this.headToHeadService.calculateTopTeamMembers(
      filteredRaceList,
      allMembers,
      this.member1._id,
      this.ageGradeMode
    );

    // Sort and filter
    this.sortTeamMembers();
    this.updateFilteredTeamMembers();
    this.updateTeamMembersForDropdown();
  }

  sortTeamMembersBy(criteria: string): void {
    if (this.teamMemberSortCriteria === criteria) {
      this.teamMemberSortDirection = !this.teamMemberSortDirection;
    } else {
      this.teamMemberSortCriteria = criteria;
      this.teamMemberSortDirection = false; // Default to descending
    }
    this.sortTeamMembers();
    this.updateFilteredTeamMembers();
  }

  sortTeamMembers(): void {
    if (!this.topTeamMembers || this.topTeamMembers.length === 0) {
      this.sortedTeamMembers = [];
      return;
    }

    this.sortedTeamMembers = this.topTeamMembers.slice().sort((a: any, b: any) => {
      let aValue: any;
      let bValue: any;

      switch (this.teamMemberSortCriteria) {
        case 'firstname':
          aValue = a.firstname + ' ' + a.lastname;
          bValue = b.firstname + ' ' + b.lastname;
          break;
        case 'count':
          aValue = a.count;
          bValue = b.count;
          break;
        case 'wins':
          aValue = a.headToHeadRecord.wins;
          bValue = b.headToHeadRecord.wins;
          break;
        case 'losses':
          aValue = a.headToHeadRecord.losses;
          bValue = b.headToHeadRecord.losses;
          break;
        case 'ties':
          aValue = a.headToHeadRecord.ties;
          bValue = b.headToHeadRecord.ties;
          break;
        case 'winRate':
          aValue = a.headToHeadRecord.winRate;
          bValue = b.headToHeadRecord.winRate;
          break;
        default:
          aValue = a.headToHeadRecord.wins;
          bValue = b.headToHeadRecord.wins;
      }

      if (typeof aValue === 'string') {
        return this.teamMemberSortDirection
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return this.teamMemberSortDirection
          ? aValue - bValue
          : bValue - aValue;
      }
    });
  }

  setGenderFilter(gender: string | null): void {
    this.teamMemberGenderFilter = gender;
    this.updateFilteredTeamMembers();
  }

  private updateFilteredTeamMembers(): void {
    if (!this.sortedTeamMembers || this.sortedTeamMembers.length === 0) {
      this.filteredTeamMembers = [];
      return;
    }

    if (!this.teamMemberGenderFilter) {
      this.filteredTeamMembers = this.sortedTeamMembers;
      return;
    }

    this.filteredTeamMembers = this.sortedTeamMembers.filter(
      (member: any) => member.sex === this.teamMemberGenderFilter
    );
  }

  private updateTeamMembersForDropdown(): void {
    if (!this.topTeamMembers || this.topTeamMembers.length === 0) {
      this.teamMembersForDropdown = [];
      return;
    }

    // Sort by count (number of races together) in descending order
    this.teamMembersForDropdown = this.topTeamMembers.slice().sort(
      (a: any, b: any) => b.count - a.count
    );
  }

  onCompareMemberSelected(member: any): void {
    if (member && member.username) {
      this.router.navigate(['/members', this.member1.username, 'head-to-head', member.username]);
    }
  }

  navigateToMember(member: any): void {
    this.router.navigate(['/members', member.username, 'bio']);
  }

  trackByMemberId(index: number, member: any): string {
    return member._id;
  }

  getCssColor(className: string): string {
    const wrapper = document.createElement('div');
    wrapper.className = 'head-to-head-page';
    wrapper.style.display = 'none';
    const el = document.createElement('div');
    el.className = className;
    wrapper.appendChild(el);
    document.body.appendChild(wrapper);
    const color = window.getComputedStyle(el).color;
    document.body.removeChild(wrapper);
    return color;
  }
}
