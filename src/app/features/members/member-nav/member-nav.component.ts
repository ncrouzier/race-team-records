import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-member-nav',
  imports: [CommonModule, RouterLink],
  template: `
    <div class="jumbotron" *ngIf="member">
      <div class="row">
        <div class="col-sm-12">
          <div class="detailscontainer" style="position: relative;">

            <!-- Achievement icons -->
            <div *ngIf="member.achievements && member.achievements.length > 0"
                 style="position: absolute; top: 10px; right: 15px; z-index: 1; background:#006484; border-radius: 6px; padding: 4px 6px; display: inline-flex; align-items: center; gap: 6px;">
              <span *ngFor="let ach of member.achievements" [title]="ach.text"
                    style="display: inline-flex; align-items: center;">
                <a *ngIf="ach.name === 'ROY' || ach.name === 'MUTROY'" [routerLink]="['/stats/awards']"
                   style="display: inline-flex; align-items: center;">
                  <img *ngIf="ach.value?.img" [src]="ach.value.img"
                       style="height: 32px; vertical-align: top;" [alt]="ach.name">
                  <i *ngIf="!ach.value?.img && ach.value?.icon" class="fa" [ngClass]="ach.value.icon"
                     style="font-size: 32px;" [ngStyle]="{ 'color': ach.value.color || '#333' }"></i>
                  <span *ngIf="!ach.value?.img && !ach.value?.icon" class="label label-default">{{ ach.name }}</span>
                </a>
                <span *ngIf="ach.name !== 'ROY' && ach.name !== 'MUTROY'">
                  <img *ngIf="ach.value?.img" [src]="ach.value.img"
                       style="height: 32px; vertical-align: top;" [alt]="ach.name">
                  <i *ngIf="!ach.value?.img && ach.value?.icon" class="fa" [ngClass]="ach.value.icon"
                     style="font-size: 32px;" [ngStyle]="{ 'color': ach.value.color || '#333' }"></i>
                  <span *ngIf="!ach.value?.img && !ach.value?.icon" class="label label-default">{{ ach.name }}</span>
                </span>
              </span>
            </div>

            <div class="row text-center">
              <h2 class="bold">{{ member.firstname }} {{ member.lastname }}</h2>
              <h4>
                ({{ getCategory(member.dateofbirth) }} {{ member.sex }}
                <span *ngIf="isAdminOrCaptain">, {{ getMemberAge(member.dateofbirth) }}</span>)
                <i class="hoverhand fa fa-pencil-square-o"
                   *ngIf="user?.role === 'admin'"
                   (click)="editMember.emit(member)"
                   title="edit user"></i>
                <i class="hoverhand fa fa-trash"
                   *ngIf="user?.role === 'admin'"
                   (click)="deleteMember.emit(member)"
                   title="remove user"></i>
              </h4>
              <h6 class="italic">
                member
                <span *ngFor="let membershipdate of sortedMembershipDates; let i = index; let last = last">
                  <span *ngIf="!membershipdate.end">since</span>
                  <span *ngIf="membershipdate.end">from</span>
                  {{ membershipdate.start | date:'M/d/y':'UTC' }}
                  <span *ngIf="membershipdate.end">to {{ membershipdate.end | date:'M/d/y':'UTC' }}</span>
                  <span *ngIf="sortedMembershipDates.length > 1 && i < sortedMembershipDates.length - 2">, </span>
                  <span *ngIf="sortedMembershipDates.length > 1 && i === sortedMembershipDates.length - 2"> and </span>
                </span>
              </h6>
            </div>

            <!-- View Toggle Buttons -->
            <div class="row text-center member-navigation-buttons" style="margin-bottom: 20px;">
              <div class="btn-group" role="group">
                <a [routerLink]="['/members', member.username, 'bio']"
                   class="btn btn-primary" [class.active]="activeTab === 'bio'">
                  <i class="fa fa-user"></i> Bio &amp; Results
                </a>
                <a [routerLink]="['/members', member.username, 'stats']"
                   class="btn btn-primary" [class.active]="activeTab === 'stats'">
                  <i class="fa fa-bar-chart"></i> Statistics
                </a>
                <a [routerLink]="['/members', member.username, 'head-to-head']"
                   class="btn btn-primary" [class.active]="activeTab === 'head-to-head'">
                  <i class="fa fa-trophy"></i> Head-to-Head
                </a>
                <a *ngIf="canViewVolunteerJobs"
                   [routerLink]="['/members', member.username, 'volunteer-jobs']"
                   class="btn btn-primary" [class.active]="activeTab === 'volunteer-jobs'">
                  <i class="fa fa-heart"></i> Volunteer Jobs
                </a>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  `
})
export class MemberNavComponent {
  @Input() member: any;
  @Input() activeTab: string = 'bio';
  @Input() user: any;
  @Output() editMember = new EventEmitter<any>();
  @Output() deleteMember = new EventEmitter<any>();

  get isAdminOrCaptain(): boolean {
    return this.user?.role === 'admin' || this.user?.role === 'captain';
  }

  get canViewVolunteerJobs(): boolean {
    if (!this.user) return false;
    if (this.user.role === 'admin' || this.user.role === 'captain') return true;
    return !!(this.user.member?._id && this.user.member._id === this.member?._id);
  }

  get sortedMembershipDates(): any[] {
    if (!this.member?.membershipDates) return [];
    return [...this.member.membershipDates].sort((a: any, b: any) =>
      new Date(a.start).getTime() - new Date(b.start).getTime()
    );
  }

  getCategory(dateofbirth: string): string {
    if (!dateofbirth) return '';
    const dob = new Date(dateofbirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age >= 40 ? 'Master' : 'Open';
  }

  getMemberAge(dateofbirth: string): string {
    if (!dateofbirth) return '';
    const dob = new Date(dateofbirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age + ' years old';
  }
}
