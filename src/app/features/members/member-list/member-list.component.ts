import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MembersService } from '../../../core/services/members.service';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { MemberSearchComponent } from '../../../shared/components/member-search/member-search.component';
import { TeamRequirementsBadgeComponent } from '../../../shared/components/team-requirements-badge/team-requirements-badge.component';
import { MemberEditModalComponent } from '../modals/member-edit-modal.component';
import { getTeamRequirementsForYear } from '../../../core/data/team-requirements';

@Component({
  selector: 'app-member-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MemberSearchComponent, TeamRequirementsBadgeComponent, MemberEditModalComponent],
  template: `
    <div class="jumbotron">
      <div class="row btn-row">
        <div class="col-md-3 col-sm-3 btn-col-member">
          <span>Search members:</span>
          <i class="hoverhand fa fa-user-plus" style="color:#03C03C;"
             *ngIf="user?.role === 'admin'" (click)="showAddMemberModal()" title="Add member"></i>
          <br>
          <app-member-search [members]="membersList" placeholder="Select a member"
                             (memberSelected)="onSelectMember($event)"></app-member-search>
        </div>
        <div class="col-md-3 col-sm-3 btn-col-member">
          <span>Gender:</span><br>
          <div class="btn-group">
            <button class="btn-member btn btn-primary" [class.active]="paramModel.sex === 'Male'" (click)="paramModel.sex = 'Male'; getMembers()">Men</button>
            <button class="btn-member btn btn-primary" [class.active]="paramModel.sex === 'Female'" (click)="paramModel.sex = 'Female'; getMembers()">Women</button>
            <button class="btn-member btn btn-primary" [class.active]="paramModel.sex === '.*'" (click)="paramModel.sex = '.*'; getMembers()">Both</button>
          </div>
        </div>
        <div class="col-md-3 col-sm-3 btn-col-member">
          <span>Category:</span><br>
          <div class="btn-group">
            <button class="btn-member btn btn-primary" [class.active]="paramModel.category === 'Open'" (click)="paramModel.category = 'Open'; getMembers()">Open</button>
            <button class="btn-member btn btn-primary" [class.active]="paramModel.category === 'Master'" (click)="paramModel.category = 'Master'; getMembers()">Master</button>
            <button class="btn-member btn btn-primary" [class.active]="paramModel.category === '.*'" (click)="paramModel.category = '.*'; getMembers()">Both</button>
          </div>
        </div>
        <div class="col-md-3 col-sm-3 btn-col-member">
          <span>Member Status:</span><br>
          <div class="btn-group">
            <button class="btn-member btn btn-primary" [class.active]="paramModel.memberStatus === 'current'" (click)="paramModel.memberStatus = 'current'; getMembers()">Current</button>
            <button class="btn-member btn btn-primary" [class.active]="paramModel.memberStatus === 'past'" (click)="paramModel.memberStatus = 'past'; getMembers()">Past</button>
            <button class="btn-member btn btn-primary" [class.active]="paramModel.memberStatus === 'all'" (click)="paramModel.memberStatus = 'all'; getMembers()">Both</button>
          </div>
        </div>
      </div>
      <div *ngIf="user?.role === 'admin'" class="row btn-row">
        <small>
          <div class="col-md-3 col-sm-3 btn-col-member">
            <span>Show team requirements progress:</span>
            <div class="btn-group">
              <button style="font-size: 12px; padding: 0px;" type="button" class="btn btn-primary"
                      (click)="paramModel.showTeamRequirementProgress = !paramModel.showTeamRequirementProgress">
                {{ paramModel.showTeamRequirementProgress ? 'ON' : 'OFF' }}
              </button>
            </div>
          </div>
        </small>
      </div>
      <div class="row">
        <div class="col-sm-12">
          <table class="memberListTable">
            <thead>
              <tr style="font-size:15px; font-weight: bold; line-height: 33px;">
                <th class="memberListHeader">
                  <span title="Under 40">Open Men</span>
                  <span class="hoverhand" *ngIf="paramModel.memberStatus === 'current' && user?.role === 'admin' && paramModel.showTeamRequirementProgress">
                    ({{ getRequirementFulfilledCount(memberListColumns[0]) }}/{{ memberListColumns[0]?.length || 0 }})
                  </span>
                </th>
                <th class="memberListHeader">
                  <span title="Under 40">Open Women</span>
                  <span class="hoverhand" *ngIf="paramModel.memberStatus === 'current' && user?.role === 'admin' && paramModel.showTeamRequirementProgress">
                    ({{ getRequirementFulfilledCount(memberListColumns[1]) }}/{{ memberListColumns[1]?.length || 0 }})
                  </span>
                </th>
                <th class="memberListHeader">
                  <span title="40 and over">Masters Men</span>
                  <span class="hoverhand" *ngIf="paramModel.memberStatus === 'current' && user?.role === 'admin' && paramModel.showTeamRequirementProgress">
                    ({{ getRequirementFulfilledCount(memberListColumns[2]) }}/{{ memberListColumns[2]?.length || 0 }})
                  </span>
                </th>
                <th class="memberListHeader">
                  <span title="40 and over">Masters Women</span>
                  <span class="hoverhand" *ngIf="paramModel.memberStatus === 'current' && user?.role === 'admin' && paramModel.showTeamRequirementProgress">
                    ({{ getRequirementFulfilledCount(memberListColumns[3]) }}/{{ memberListColumns[3]?.length || 0 }})
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of rowIndices" style="font-size:15px;">
                <td *ngFor="let col of [0,1,2,3]"
                    [class.memberListCell]="memberListColumns[col]?.[row]"
                    [class.hoverhand]="memberListColumns[col]?.[row]"
                    [class.my-member-cell]="user?.member?._id && memberListColumns[col]?.[row]?._id === user.member._id"
                    (click)="memberListColumns[col]?.[row] && goToMember(memberListColumns[col][row])">
                  <span *ngIf="memberListColumns[col]?.[row]">
                    {{ memberListColumns[col][row].firstname }} {{ memberListColumns[col][row].lastname }}
                    <a *ngIf="user?.role === 'admin'" (click)="$event.stopPropagation()"
                       [routerLink]="['/members', memberListColumns[col][row].username, 'stats']" class="hoverhand">
                      <i class="fa fa-bar-chart"></i>
                    </a>
                    <a *ngIf="user?.role === 'admin'" (click)="$event.stopPropagation()"
                       [routerLink]="['/members', memberListColumns[col][row].username, 'head-to-head']" class="hoverhand">
                      <i class="fa fa-trophy"></i>
                    </a>
                    <app-team-requirements-badge
                      *ngIf="user?.role === 'admin' && paramModel.showTeamRequirementProgress && memberListColumns[col][row].teamRequirementStats"
                      [member]="memberListColumns[col][row]">
                    </app-team-requirements-badge>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <app-member-edit-modal
      [member]="editingMember"
      [visible]="showEditModal"
      (saved)="onMemberSaved($event)"
      (cancelled)="showEditModal = false">
    </app-member-edit-modal>
  `
})
export class MemberListComponent implements OnInit {
  membersList: any[] = [];
  memberListColumns: any[][] = [[], [], [], []];
  rowIndices: number[] = [];
  user: any = null;
  paramModel: any = {};
  reqConfig: any;

  showEditModal = false;
  editingMember: any = null;

  constructor(
    private membersService: MembersService,
    private authStateService: AuthStateService,
    private router: Router
  ) {
    this.reqConfig = getTeamRequirementsForYear(new Date().getFullYear());
    // Load saved params from localStorage
    const saved = localStorage.getItem('members.options');
    if (saved) {
      try { this.paramModel = JSON.parse(saved); } catch (e) { this.initDefaultParams(); }
    } else {
      this.initDefaultParams();
    }
  }

  private initDefaultParams(): void {
    this.paramModel = { sex: '.*', category: '.*', memberStatus: 'current', showTeamRequirementProgress: false };
  }

  ngOnInit(): void {
    this.user = this.authStateService.currentUser;
    this.getMembers();
  }

  async getMembers(): Promise<void> {
    // Save params to localStorage
    localStorage.setItem('members.options', JSON.stringify(this.paramModel));

    const params: any = {
      'filters[sex]': this.paramModel.sex,
      'filters[category]': this.paramModel.category,
      'filters[memberStatus]': this.paramModel.memberStatus,
      select: '-bio -personalBests',
      sort: 'firstname'
    };

    const members = await this.membersService.getMembersWithCacheSupport(params);
    this.membersList = members;
    this.memberListColumns = [[], [], [], []];

    members.forEach((person: any) => {
      const colIdx = this.getColumnIndex(person);
      if (colIdx !== undefined) {
        this.memberListColumns[colIdx].push(person);
      }
    });

    this.moveLoggedInMemberToTop();
    this.updateRowIndices();
  }

  private getColumnIndex(member: any): number | undefined {
    const cat = this.getCategory(member.dateofbirth);
    if (member.sex === 'Male' && cat === 'Open') return 0;
    if (member.sex === 'Female' && cat === 'Open') return 1;
    if (member.sex === 'Male' && cat === 'Master') return 2;
    if (member.sex === 'Female' && cat === 'Master') return 3;
    return undefined;
  }

  private getCategory(dob: string): string {
    if (!dob) return 'Open';
    const d = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
    return age >= 40 ? 'Master' : 'Open';
  }

  private moveLoggedInMemberToTop(): void {
    if (this.user?.member?._id) {
      this.memberListColumns.forEach(column => {
        const idx = column.findIndex((m: any) => m._id === this.user.member._id);
        if (idx > 0) {
          const myMember = column.splice(idx, 1)[0];
          column.unshift(myMember);
        }
      });
    }
  }

  private updateRowIndices(): void {
    const maxLen = Math.max(...this.memberListColumns.map(c => c.length), 0);
    this.rowIndices = Array.from({ length: maxLen }, (_, i) => i);
  }

  onSelectMember(member: any): void {
    this.goToMember(member);
  }

  goToMember(member: any): void {
    this.router.navigate(['/members', member.username, 'bio']);
  }

  getRequirementFulfilledCount(list: any[]): number {
    if (!list) return 0;
    return list.filter(m => this.hasTeamRequirementFulfilled(m)).length;
  }

  hasTeamRequirementFulfilled(member: any): boolean {
    if (!member.teamRequirementStats) return false;
    const total = (member.teamRequirementStats.raceCount || 0) + (member.teamRequirementStats.volunteerJobCount || 0);
    return total >= this.reqConfig.minRaceAndVolunteerCount && member.teamRequirementStats.maxAgeGrade >= this.reqConfig.minAgeGrade;
  }

  showAddMemberModal(): void {
    this.editingMember = null;
    this.showEditModal = true;
  }

  async onMemberSaved(formData: any): Promise<void> {
    this.showEditModal = false;
    try {
      if (this.editingMember) {
        await this.membersService.editMember(this.editingMember._id, formData);
      } else {
        const newMember = await this.membersService.createMember(formData);
        if (newMember) this.membersList.push(newMember);
      }
      await this.getMembers();
    } catch (e) {
      console.error('Error saving member:', e);
    }
  }
}
