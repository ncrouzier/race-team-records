import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MembersService } from '../../../core/services/members.service';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { ResultsService } from '../../../core/services/results.service';
import { MemberNavComponent } from '../member-nav/member-nav.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { BioEditModalComponent } from '../modals/bio-edit-modal.component';
import { PhotoEditModalComponent } from '../modals/photo-edit-modal.component';

declare var gtag: any;

@Component({
  selector: 'app-member-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, MemberNavComponent, PaginationComponent, BioEditModalComponent, PhotoEditModalComponent],
  template: `
    <app-member-nav *ngIf="currentMember" [member]="currentMember" activeTab="bio" [user]="user"
                    (editMember)="onEditMember($event)" (deleteMember)="onDeleteMember($event)">
    </app-member-nav>

    <div class="jumbotron" *ngIf="!currentMember">
      <div class="text-center" style="padding: 40px;">
        <i class="fa fa-spinner fa-spin fa-2x"></i>
        <p>Loading member...</p>
      </div>
    </div>

    <div class="jumbotron" *ngIf="currentMember">
      <!-- Bio and Photo -->
      <div class="row">
        <div class="col-sm-7">
          <div class="row row-no-left-margin">
            <h3 style="display: flex; align-items: center; gap: 10px;">
              Member Bio:
              <button class="btn btn-default btn-xs"
                      *ngIf="user?.role === 'admin' || (user?.member?._id && user.member._id === currentMember._id)"
                      (click)="showBioEditModal = true">
                <i class="fa fa-pencil"></i> Edit Bio
              </button>
            </h3>
            <span class="black" [innerHTML]="currentMember.bio"></span>
          </div>
        </div>
        <div class="col-sm-5">
          <div class="row">
            <div class="col-sm-12">
              <div *ngIf="currentMember.pictureLink">
                <img class="member-picture" [src]="currentMember.pictureLink" alt="Member's Picture"
                     (load)="imageLoading = false" [hidden]="imageLoading">
                <div *ngIf="imageLoading">
                  <i style="font-size: 50px;" class="fa fa-spinner fa-spin"></i>
                </div>
              </div>
              <button class="btn btn-default btn-xs" style="margin-top: 8px;"
                      *ngIf="user?.role === 'admin' || (user?.member?._id && user.member._id === currentMember._id)"
                      (click)="showPhotoEditModal = true">
                <i class="fa fa-camera"></i> Edit Photo
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Results Section -->
      <div id="member-list" class="row">
        <div class="col-md-12">
          <h3 style="margin-top:10px">{{ currentMember.firstname }}'s Results ({{ filteredResults.length }}):</h3>
          <div class="btn-group" style="padding-bottom: 4px;">
            <div class="input-wrapper" style="display: inline-block;">
              <input [(ngModel)]="searchQuery" (ngModelChange)="applyFilters()" class="form-control" type="text"
                     placeholder="Filter results" style="width: 300px; display:inline;">
              <span class="searchclear fa fa-times-circle" *ngIf="searchQuery" (click)="searchQuery=''; applyFilters()"></span>
            </div>
            <select [(ngModel)]="selectedRaceType" (ngModelChange)="applyFilters()"
                    class="form-control" style="min-width: 300px; display: inline-block; margin-left: 5px;">
              <option [ngValue]="null">All race types</option>
              <option *ngFor="let rt of racetypesList" [ngValue]="rt._id">{{ rt.name }} ({{ rt.surface }})</option>
            </select>
            <span class="raceTypeClear fa fa-times-circle" *ngIf="selectedRaceType" (click)="selectedRaceType=null; applyFilters()" style="cursor:pointer;"></span>
          </div>

          <ul class="results-list list-group">
            <li class="list-group-item text-left resultlistheader" *ngIf="filteredResults.length > 0">
              <div class="row">
                <div class="col-sm-5">
                  <span (click)="sortBy('race.racedate')" class="listheader hoverhand" title="Sort by race date">EVENT</span>
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
                  <span (click)="sortBy('pace')" class="listheader hoverhand" title="Sort by pace">PACE</span>
                  <i (click)="sortBy('agegrade')" title="Sort by age grading" class="hoverhand agesort fa fa-star"></i>
                </div>
                <div [ngClass]="user?.role === 'admin' ? 'col-sm-1' : 'col-sm-2'" style="text-align: center;">
                  <span (click)="sortBy('time')" class="listheader hoverhand" title="Sort by net time">NET TIME</span>
                </div>
                <div class="col-sm-1" *ngIf="user?.role === 'admin'">
                  <span class="listheader">EDIT</span>
                </div>
              </div>
            </li>

            <li *ngFor="let result of paginatedResults" class="list-group-item text-left resultlistrow">
              <div class="row">
                <div class="col-sm-5" style="line-height: 1.1;">
                  <span class="hoverhandandunderline resultEvent" title="view race results"
                        (click)="showRaceModal(result.race)">{{ result.race.racename }}</span>
                  <i class="fa fa-comment-o hoverhand" *ngIf="result.comments" [title]="result.comments"></i>
                  <span [innerHTML]="getResultSportIcons(result)"></span>
                  <br>
                  <small>{{ result.race.racedate | date:'longDate':'UTC' }}
                    <span *ngIf="result.race.location?.state">-- {{ result.race.location.state }}</span>
                    <span *ngIf="!result.race.location?.state && result.race.location?.country">-- {{ result.race.location.country }}</span>
                  </small>
                </div>
                <div class="col-sm-1" style="text-align: center;">
                  <span *ngIf="result.ranking?.agerank" [innerHTML]="formatRank(result.ranking.agerank)"></span>
                </div>
                <div class="col-sm-1" style="text-align: center;">
                  <span *ngIf="result.ranking?.genderrank" [innerHTML]="formatRank(result.ranking.genderrank)"></span>
                </div>
                <div class="col-sm-1" style="text-align: center;">
                  <span *ngIf="result.ranking?.overallrank" [innerHTML]="formatRank(result.ranking.overallrank)"></span>
                </div>
                <div class="col-sm-2" style="text-align: center;">
                  <span *ngIf="!result.race.isMultisport">{{ getResultPace(result) }}</span>
                  <span *ngIf="result.agegrade" style="font-size: 11px; color: #888;"> ({{ result.agegrade | number:'1.1-1' }}%)</span>
                  <span *ngIf="result.race.isMultisport" class="hoverhandandunderline resultPace" title="View details">View details</span>
                </div>
                <div [ngClass]="user?.role === 'admin' ? 'col-sm-1' : 'col-sm-2'" style="text-align: center;">
                  <span class="resultTime">{{ formatTime(result.time) }}</span>
                  <a *ngIf="result.resultlink" [href]="result.resultlink" target="_blank"><i class="fa fa-link" title="view result"></i></a>
                </div>
                <div class="col-sm-1" *ngIf="user?.role === 'admin'">
                  <!-- Admin edit/delete buttons -->
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <!-- Pagination -->
      <div class="row text-center" *ngIf="filteredResults.length > itemsPerPage">
        <app-pagination [totalItems]="filteredResults.length" [itemsPerPage]="itemsPerPage"
                        [currentPage]="currentPage" (pageChange)="currentPage = $event">
        </app-pagination>
      </div>
    </div>

    <app-bio-edit-modal *ngIf="currentMember"
      [member]="currentMember" [visible]="showBioEditModal"
      (saved)="onBioSaved($event)" (cancelled)="showBioEditModal = false">
    </app-bio-edit-modal>

    <app-photo-edit-modal *ngIf="currentMember"
      [member]="currentMember" [visible]="showPhotoEditModal"
      (saved)="onPhotoSaved($event)" (cancelled)="showPhotoEditModal = false">
    </app-photo-edit-modal>
  `
})
export class MemberDetailComponent implements OnInit {
  currentMember: any = null;
  currentMemberResultList: any[] = [];
  filteredResults: any[] = [];
  paginatedResults: any[] = [];
  racetypesList: any[] = [];
  user: any = null;

  searchQuery = '';
  selectedRaceType: string | null = null;
  sortCriteria = 'race.racedate';
  sortDirection = false; // false = desc, true = asc
  currentPage = 1;
  itemsPerPage = 10;
  imageLoading = true;

  showBioEditModal = false;
  showPhotoEditModal = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private membersService: MembersService,
    private authStateService: AuthStateService,
    private resultsService: ResultsService
  ) { }

  ngOnInit(): void {
    this.user = this.authStateService.currentUser;
    this.loadData();
  }

  private async loadData(): Promise<void> {
    const username = this.route.snapshot.paramMap.get('member');
    if (!username) { this.router.navigate(['/members']); return; }

    try {
      const allMembers = await this.membersService.getMembersWithCacheSupport();
      const member = allMembers.find((m: any) => m.username === username);
      if (!member) { this.router.navigate(['/members']); return; }

      const fullMember = await this.membersService.getMember(member._id);

      const raceList = await this.resultsService.getRaceResultsWithCacheSupport({
        sort: '-racedate -order racename', preload: false
      });

      this.currentMemberResultList = [];
      raceList.forEach((race: any) => {
        if (race.results && race.results.length > 0) {
          race.results.forEach((result: any) => {
            if (result.members) {
              result.members.forEach((m: any) => {
                if (m._id === fullMember._id) {
                  this.currentMemberResultList.push({ ...result, race });
                }
              });
            }
          });
        }
      });

      this.currentMemberResultList.sort((a, b) => new Date(b.race.racedate).getTime() - new Date(a.race.racedate).getTime());

      // Extract unique race types
      const raceTypeMap: Record<string, any> = {};
      this.currentMemberResultList.forEach((result: any) => {
        if (result.race.racetype && !raceTypeMap[result.race.racetype._id]) {
          raceTypeMap[result.race.racetype._id] = result.race.racetype;
        }
      });
      this.racetypesList = Object.values(raceTypeMap).sort((a: any, b: any) => a.meters - b.meters);

      this.currentMember = fullMember;
      this.applyFilters();

      if (typeof gtag !== 'undefined') {
        gtag('event', 'view_member', { member_name: fullMember.firstname + ' ' + fullMember.lastname });
      }
    } catch (e) {
      console.error('Error loading member:', e);
      this.router.navigate(['/members']);
    }
  }

  applyFilters(): void {
    let results = [...this.currentMemberResultList];

    // Search filter
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      results = results.filter(r => {
        const racename = (r.race.racename || '').toLowerCase();
        const location = (r.race.location?.state || r.race.location?.country || '').toLowerCase();
        return racename.includes(q) || location.includes(q);
      });
    }

    // Race type filter
    if (this.selectedRaceType) {
      results = results.filter(r => r.race.racetype && r.race.racetype._id === this.selectedRaceType);
    }

    this.filteredResults = results;
    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination(): void {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    this.paginatedResults = this.filteredResults.slice(start, start + this.itemsPerPage);
  }

  sortBy(field: string): void {
    if (this.sortCriteria === field) {
      this.sortDirection = !this.sortDirection;
    } else {
      this.sortCriteria = field;
      this.sortDirection = true;
    }

    this.filteredResults.sort((a, b) => {
      let cmp = 0;
      if (field === 'race.racedate') {
        cmp = new Date(a.race.racedate).getTime() - new Date(b.race.racedate).getTime();
        if (cmp === 0) cmp = (a.race.order || 0) - (b.race.order || 0);
        if (cmp === 0) cmp = (a.race.racename || '').localeCompare(b.race.racename || '');
      } else if (field === 'time') {
        cmp = (a.time || 0) - (b.time || 0);
      } else if (field === 'agegrade') {
        cmp = (a.agegrade || 0) - (b.agegrade || 0);
      } else if (field === 'pace') {
        const paceA = a.race.isMultisport ? Infinity : (a.time || 0) / (a.race.racetype?.miles || 1);
        const paceB = b.race.isMultisport ? Infinity : (b.time || 0) / (b.race.racetype?.miles || 1);
        cmp = paceA - paceB;
      }
      return this.sortDirection ? cmp : -cmp;
    });
    this.currentPage = 1;
    this.updatePagination();
  }

  showRaceModal(race: any): void {
    if (race) {
      this.resultsService.showRaceFromResultModal(race._id);
    }
  }

  formatTime(centiseconds: number): string {
    if (!centiseconds || centiseconds <= 0) return '';
    const totalSeconds = Math.floor(centiseconds / 100);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hours > 0) return hours + ':' + (minutes < 10 ? '0' : '') + minutes + ':' + (secs < 10 ? '0' : '') + secs;
    return minutes + ':' + (secs < 10 ? '0' : '') + secs;
  }

  getResultPace(result: any): string {
    if (!result.time || !result.race.racetype?.miles || result.race.racetype.miles === 0) return '';
    const paceCs = result.time / result.race.racetype.miles;
    const totalSeconds = Math.floor(paceCs / 100);
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return minutes + ':' + (secs < 10 ? '0' : '') + secs + '/mi';
  }

  getResultSportIcons(result: any): string {
    // Simple sport icons based on race surface/type
    if (!result.race?.racetype) return '';
    const surface = result.race.racetype.surface;
    if (surface === 'trail') return ' 🌲';
    if (surface === 'track') return ' 🏟️';
    if (result.race.isMultisport) return ' 🏊🚴🏃';
    return '';
  }

  formatRank(rank: number): string {
    if (!rank) return '';
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const v = rank % 100;
    const suffix = suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0];
    const html = rank + '<sup>' + suffix + '</sup>';
    return rank <= 3 ? '<span style="color:red; font-weight:bold;">' + html + '</span>' : html;
  }

  onEditMember(member: any): void {
    // This would open edit modal - for now handled by MembersService
  }

  onDeleteMember(member: any): void {
    if (confirm('Are you sure you want to remove this member?')) {
      this.membersService.deleteMember(member._id).then(() => {
        this.router.navigate(['/members']);
      });
    }
  }

  async onBioSaved(bioHtml: string): Promise<void> {
    this.showBioEditModal = false;
    try {
      await this.membersService.editMemberBio(this.currentMember._id, bioHtml);
      this.currentMember.bio = bioHtml;
    } catch (e) {
      console.error('Error saving bio:', e);
    }
  }

  async onPhotoSaved(pictureLink: string): Promise<void> {
    this.showPhotoEditModal = false;
    try {
      await this.membersService.editMemberPhoto(this.currentMember._id, pictureLink);
      this.currentMember.pictureLink = pictureLink;
    } catch (e) {
      console.error('Error saving photo:', e);
    }
  }
}
