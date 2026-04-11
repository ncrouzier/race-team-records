import { Component, OnInit, OnDestroy, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { MembersService } from '../../../core/services/members.service';
import { StatsService } from '../../../core/services/stats.service';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
<div class="container">
  <div [ngClass]="navBgClass" class="row navimg" style="position: relative">
    <div class="">
      <div class="logo-stats">
        <div class="uib-dropdown" style="font-size: 13px;" [class.open]="submitDropdownOpen">
          <a href="javascript:void(0)" class="uib-dropdown-toggle submit-btn"
             (click)="toggleSubmitDropdown($event)">
            Submit <span class="caret"></span>
          </a>
          <ul class="dropdown-menu dropdown-menu-right">
            <li><a href="/submitresult" target="_blank" (click)="closeAllDropdowns()">Submit a Result</a></li>
            <li><a href="/submitvolunteer" target="_blank" (click)="closeAllDropdowns()">Submit a Volunteer Job</a></li>
          </ul>
        </div>
      </div>
    </div>
    <div class="birthdaytext" *ngIf="birthdays.length > 0">
      <span>🎂Happy Birthday <ng-container *ngFor="let m of birthdays; let i = index; let last = last"><a [href]="'/members/' + m.username + '/bio'">{{m.firstname}} {{m.lastname}}</a><span *ngIf="birthdays.length > 1 && i < birthdays.length - 2">, </span><span *ngIf="birthdays.length > 1 && !last && i === birthdays.length - 2"> and </span></ng-container>!🎂</span>
    </div>
    <div class="copyrightrow">
      <span [innerHTML]="navBgCr"></span>
    </div>
  </div>

  <!-- HEADER -->
  <nav class="navbar navbar-inverse">
    <div class="navbar-header">
      <button type="button" title="Navigation button" class="navbar-toggle"
              (click)="navCollapsed = !navCollapsed">
        <span class="icon-bar"></span>
        <span class="icon-bar"></span>
        <span class="icon-bar"></span>
      </button>
    </div>
    <div class="collapse navbar-collapse" [class.in]="!navCollapsed">

      <!-- ADMIN -->
      <ng-container *ngIf="user && user.role === 'admin'">
        <ul class="nav navbar-nav">
          <li routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}"><a routerLink="/">Home</a></li>
          <li routerLinkActive="active"><a routerLink="/records">Team Records <i class="fa fa-trophy"></i></a></li>
          <li [class.active]="isActive(['/results', '/races'])"><a routerLink="/results">Team Results <i class="fa fa-list"></i></a></li>
          <li routerLinkActive="active"><a routerLink="/members">Team Members <i class="fa fa-users"></i></a></li>
          <li routerLinkActive="active"><a routerLink="/stats">Stats <i class="fa fa-bar-chart"></i></a></li>
          <li class="uib-dropdown"
              [class.active]="isActive(['/tools/agegrade', '/tools/paceAdjustment', '/moist'])"
              [class.open]="toolsDropdownOpen">
            <a href="javascript:void(0)" style="padding:12px 5px 12px 5px;" class="uib-dropdown-toggle"
               (click)="toggleToolsDropdown($event)">Tools <i class="fa fa-wrench"></i> <span class="caret"></span></a>
            <ul class="dropdown-menu">
              <li routerLinkActive="active"><a routerLink="/tools/agegrade" (click)="closeAllDropdowns()">Age Grade</a></li>
              <li [class.active]="isActive(['/tools/paceAdjustment', '/moist'])"><a routerLink="/tools/paceAdjustment" (click)="closeAllDropdowns()">Temperature + Dew Point adjustment</a></li>
            </ul>
          </li>
          <li class="uib-dropdown"
              [class.active]="isActive(['/racetypes', '/report', '/pdf', '/activitylogs'])"
              [class.open]="adminDropdownOpen">
            <a href="javascript:void(0)" class="uib-dropdown-toggle" (click)="toggleAdminDropdown($event)">
              Admin tools <span class="caret"></span>
            </a>
            <ul class="dropdown-menu">
              <li><a routerLink="/bulk" (click)="closeAllDropdowns()">Bulk Operations</a></li>
              <li><a routerLink="/tools/result-extractor" (click)="closeAllDropdowns()">Result Extractor</a></li>
              <li><a routerLink="/racetypes" (click)="closeAllDropdowns()">Race Types</a></li>
              <li><a routerLink="/volunteer-jobs" (click)="closeAllDropdowns()">Volunteer Jobs</a></li>
              <li><a routerLink="/users" (click)="closeAllDropdowns()">Users</a></li>
              <li><a routerLink="/activitylogs" (click)="closeAllDropdowns()">Activity Log</a></li>
              <li><a routerLink="/stats/requirements" (click)="closeAllDropdowns()">Team Requirements</a></li>
              <li><a routerLink="/report" (click)="closeAllDropdowns()">Create Report</a></li>
              <li><a routerLink="/pdf" (click)="closeAllDropdowns()">Create PDF Report</a></li>
            </ul>
          </li>
          <li class="submitmenu"><a href="https://www.instagram.com/mcrrcracingteam/" target="_blank">Instagram <img src="/images/instagramicon.svg" width="13" height="100%"></a></li>
        </ul>
        <ul class="nav navbar-nav nav-submit-admin">
          <li class="uib-dropdown"
              [class.active]="isActive(['/profile'])"
              [class.open]="userDropdownOpen">
            <a href="javascript:void(0)" style="padding:12px 5px 12px 5px;" class="uib-dropdown-toggle"
               (click)="toggleUserDropdown($event)">
              {{user.username}} <span class="caret"></span>
            </a>
            <ul class="dropdown-menu">
              <li><a routerLink="/profile" (click)="closeAllDropdowns()">My Account</a></li>
              <li *ngIf="user.member"><a [href]="'/members/' + user.member.username + '/bio'" (click)="closeAllDropdowns()">My Page</a></li>
              <li><a href="/logout" (click)="closeAllDropdowns()">Logout</a></li>
            </ul>
          </li>
        </ul>
      </ng-container>

      <!-- CAPTAIN -->
      <ng-container *ngIf="user && user.role === 'captain'">
        <ul class="nav navbar-nav">
          <li routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}"><a routerLink="/">Home</a></li>
          <li routerLinkActive="active"><a routerLink="/records">Team Records <i class="fa fa-trophy"></i></a></li>
          <li [class.active]="isActive(['/results', '/races'])"><a routerLink="/results">Team Results <i class="fa fa-list"></i></a></li>
          <li routerLinkActive="active"><a routerLink="/members">Team Members <i class="fa fa-users"></i></a></li>
          <li routerLinkActive="active"><a routerLink="/stats">Stats <i class="fa fa-bar-chart"></i></a></li>
          <li class="uib-dropdown"
              [class.active]="isActive(['/tools/agegrade', '/tools/paceAdjustment', '/moist'])"
              [class.open]="toolsDropdownOpen">
            <a href="javascript:void(0)" style="padding:12px 5px 12px 5px;" class="uib-dropdown-toggle"
               (click)="toggleToolsDropdown($event)">Tools <i class="fa fa-wrench"></i> <span class="caret"></span></a>
            <ul class="dropdown-menu">
              <li routerLinkActive="active"><a routerLink="/tools/agegrade" (click)="closeAllDropdowns()">Age Grade</a></li>
              <li [class.active]="isActive(['/tools/paceAdjustment', '/moist'])"><a routerLink="/tools/paceAdjustment" (click)="closeAllDropdowns()">Temperature + Dew Point adjustment</a></li>
            </ul>
          </li>
          <li class="uib-dropdown"
              [class.active]="isActive(['/volunteer-jobs', '/stats/requirements'])"
              [class.open]="captainDropdownOpen">
            <a href="javascript:void(0)" class="uib-dropdown-toggle" (click)="toggleCaptainDropdown($event)">
              Captain tools <span class="caret"></span>
            </a>
            <ul class="dropdown-menu">
              <li><a routerLink="/volunteer-jobs" (click)="closeAllDropdowns()">Volunteer Jobs</a></li>
              <li [class.active]="isActive(['/stats/requirements'])"><a routerLink="/stats/requirements" (click)="closeAllDropdowns()">Team Requirements</a></li>
            </ul>
          </li>
          <li class="submitmenu"><a href="https://www.instagram.com/mcrrcracingteam/" target="_blank">Instagram <img src="/images/instagramicon.svg" width="13" height="100%"></a></li>
        </ul>
        <ul class="nav navbar-nav nav-submit-admin">
          <li class="uib-dropdown"
              [class.active]="isActive(['/profile'])"
              [class.open]="userDropdownOpen">
            <a href="javascript:void(0)" style="padding:12px 5px 12px 5px;" class="uib-dropdown-toggle"
               (click)="toggleUserDropdown($event)">
              {{user.username}} <span class="caret"></span>
            </a>
            <ul class="dropdown-menu">
              <li><a routerLink="/profile" (click)="closeAllDropdowns()">My Account</a></li>
              <li *ngIf="user.member"><a [href]="'/members/' + user.member.username + '/bio'" (click)="closeAllDropdowns()">My Page</a></li>
              <li><a href="/logout" (click)="closeAllDropdowns()">Logout</a></li>
            </ul>
          </li>
        </ul>
      </ng-container>

      <!-- REGULAR USER -->
      <ng-container *ngIf="user && user.role === 'user'">
        <ul class="nav navbar-nav">
          <li routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}"><a routerLink="/">Home</a></li>
          <li routerLinkActive="active"><a routerLink="/records">Team Records <i class="fa fa-trophy"></i></a></li>
          <li [class.active]="isActive(['/results', '/races'])"><a routerLink="/results">Team Results <i class="fa fa-list"></i></a></li>
          <li routerLinkActive="active"><a routerLink="/members">Team Members <i class="fa fa-users"></i></a></li>
          <li routerLinkActive="active"><a routerLink="/stats">Stats <i class="fa fa-bar-chart"></i></a></li>
          <li class="uib-dropdown"
              [class.active]="isActive(['/tools/agegrade', '/tools/paceAdjustment', '/moist'])"
              [class.open]="toolsDropdownOpen">
            <a href="javascript:void(0)" style="padding:12px 5px 12px 5px;" class="uib-dropdown-toggle"
               (click)="toggleToolsDropdown($event)">Tools <i class="fa fa-wrench"></i> <span class="caret"></span></a>
            <ul class="dropdown-menu">
              <li routerLinkActive="active"><a routerLink="/tools/agegrade" (click)="closeAllDropdowns()">Age Grade</a></li>
              <li [class.active]="isActive(['/tools/paceAdjustment', '/moist'])"><a routerLink="/tools/paceAdjustment" (click)="closeAllDropdowns()">Temperature + Dew Point adjustment</a></li>
            </ul>
          </li>
          <li class="submitmenu"><a href="https://www.instagram.com/mcrrcracingteam/" target="_blank">Instagram <img src="/images/instagramicon.svg" width="13" height="100%"></a></li>
        </ul>
        <ul class="nav navbar-nav nav-submit-admin">
          <li class="uib-dropdown"
              [class.active]="isActive(['/profile'])"
              [class.open]="userDropdownOpen">
            <a href="javascript:void(0)" style="padding:12px 5px 12px 5px;" class="uib-dropdown-toggle"
               (click)="toggleUserDropdown($event)">
              {{user.username}} <span class="caret"></span>
            </a>
            <ul class="dropdown-menu">
              <li><a routerLink="/profile" (click)="closeAllDropdowns()">My Account</a></li>
              <li *ngIf="user.member"><a [href]="'/members/' + user.member.username + '/bio'" (click)="closeAllDropdowns()">My Page</a></li>
              <li><a href="/logout" (click)="closeAllDropdowns()">Logout</a></li>
            </ul>
          </li>
        </ul>
      </ng-container>

      <!-- ANONYMOUS -->
      <ng-container *ngIf="!user">
        <ul class="nav navbar-nav">
          <li routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}"><a routerLink="/">Home</a></li>
          <li routerLinkActive="active"><a routerLink="/records">Team Records <i class="fa fa-trophy"></i></a></li>
          <li [class.active]="isActive(['/results', '/races'])"><a routerLink="/results">Team Results <i class="fa fa-list"></i></a></li>
          <li routerLinkActive="active"><a routerLink="/members">Team Members <i class="fa fa-users"></i></a></li>
          <li routerLinkActive="active"><a routerLink="/stats">Stats <i class="fa fa-bar-chart"></i></a></li>
          <li class="uib-dropdown"
              [class.active]="isActive(['/tools/agegrade', '/tools/paceAdjustment', '/moist'])"
              [class.open]="toolsDropdownOpen">
            <a href="javascript:void(0)" style="padding:12px 5px 12px 5px;" class="uib-dropdown-toggle"
               (click)="toggleToolsDropdown($event)">Tools <i class="fa fa-wrench"></i> <span class="caret"></span></a>
            <ul class="dropdown-menu">
              <li routerLinkActive="active"><a routerLink="/tools/agegrade" (click)="closeAllDropdowns()">Age Grade</a></li>
              <li [class.active]="isActive(['/tools/paceAdjustment', '/moist'])"><a routerLink="/tools/paceAdjustment" (click)="closeAllDropdowns()">Temperature + Dew Point adjustment</a></li>
            </ul>
          </li>
          <li class="submitmenu"><a href="https://www.instagram.com/mcrrcracingteam/" target="_blank">Instagram <img src="/images/instagramicon.svg" width="13" height="100%"></a></li>
        </ul>
        <ul class="nav navbar-nav nav-submit-admin">
          <li><a href="/login">Login <i class="fa fa-sign-in"></i></a></li>
        </ul>
      </ng-container>

    </div><!-- /.navbar-collapse -->
  </nav>
</div>
  `
})
export class NavComponent implements OnInit, OnDestroy {
  user: any = null;
  birthdays: any[] = [];
  milesRaced: number | null = null;
  currentYear = new Date().getFullYear();
  navCollapsed = true;

  // Random background + photo credit (ported verbatim from MainController)
  private navBackGround = ['navimg-2', 'navimg-3', 'navimg-4', 'navimg-5', 'navimg-6', 'navimg-7', 'navimg-8'];
  private navBackGroundCR = [
    '<a href="http://www.mcrrcphotos.com/2017-Photos/Race-Photos/Piece-of-Cake-10K5K/Piece-of-Cake-10K5K-BButters/i-5hgMqmQ/A" target="_blank" title="Photo by B.Butters at Piece of Cake 10K 2017">© B.Butters</a>',
    '<a href="https://www.facebook.com/pg/gburgmd/photos/?tab=album&album_id=10154376948800741" target="_blank" title="Photo by the City of Gaithersburg at La Milla de Mayo 2017">© City of Gaithersburg</a>',
    '<a href="https://www.mcrrcphotos.com/2019-Photos/Race-Photos/Going-Green-Track-Meet-/Going-Green-Track-Meet-DReichmann/i-MVnQgnh/A" target="_blank" title="Photo by D.Reichmann at Going Green Track Meet 2019">© D.Reichmann</a>',
    '<a href="https://www.mcrrcphotos.com/2018-Photos/Race-Photos/Midsummer-Nights-Mile-DReichmann/i-8rB2WKf/A" target="_blank" title="Photo by D.Reichmann at Midsummer Night\'s Mile 2018">© D.Reichmann</a>',
    '<a href="https://www.instagram.com/dwhitphoto/" target="_blank" title="Photo by Dustin Whitlow at Army 10 Miler 2018">© Dustin Whitlow</a>',
    '<a href="https://www.mcrrcphotos.com/2021-Photos/Race-Photos/Rileys-Rumble-Half-Marathon/Rileys-Rumble-Half-Marathon-DReichmann/i-w62wjJL/A" target="_blank" title="Photo by D.Reichmann at Riley\'s Rumble Half Marathon 2021">© D.Reichmann</a>',
    '<a href="https://www.mile90.com/Race-Photos/2021-Race-Events/Bighorn-Trail-Run-2021/On-Course/100-Mile/Dry-Fork-Inbound/i-S8WpdHd/buy" target="_blank" title="Photo by Mile 90 Photography at BigHorn 100 2021">© Mile 90 Photography</a>'
  ];
  navBgClass = '';
  navBgCr: SafeHtml = '';

  // Dropdown state
  submitDropdownOpen = false;
  toolsDropdownOpen = false;
  adminDropdownOpen = false;
  captainDropdownOpen = false;
  userDropdownOpen = false;

  private userSub?: Subscription;

  constructor(
    private authState: AuthStateService,
    private membersService: MembersService,
    private statsService: StatsService,
    private sanitizer: DomSanitizer,
    private elementRef: ElementRef
  ) {
    // Pick a random background + matching credit (done once at construction)
    const idx = Math.floor(Math.random() * this.navBackGround.length);
    this.navBgClass = this.navBackGround[idx];
    this.navBgCr = this.sanitizer.bypassSecurityTrustHtml(this.navBackGroundCR[idx]);
  }

  ngOnInit(): void {
    this.userSub = this.authState.user$.subscribe(user => {
      this.user = user;
    });

    // Load birthdays for today
    const today = new Date().toISOString();
    this.membersService.getMembersWithCacheSupport({
      'filters[dateofbirth]': today,
      'filters[memberStatus]': 'current',
      sort: 'dateofbirth'
    }).then(members => {
      this.birthdays = members || [];
    }).catch(() => {
      this.birthdays = [];
    });

    // Load miles raced for current year
    this.statsService.getStats(this.currentYear).then(stats => {
      this.milesRaced = stats?.basicStats?.milesRaced ?? null;
    }).catch(() => {
      this.milesRaced = null;
    });
  }

  ngOnDestroy(): void {
    this.userSub?.unsubscribe();
  }

  isActive(prefixes: string[]): boolean {
    const path = window.location.pathname;
    return prefixes.some(p => path === p || path.startsWith(p + '/') || path.startsWith(p));
  }

  toggleSubmitDropdown(event: Event): void {
    event.stopPropagation();
    const wasOpen = this.submitDropdownOpen;
    this.closeAllDropdowns();
    this.submitDropdownOpen = !wasOpen;
  }

  toggleToolsDropdown(event: Event): void {
    event.stopPropagation();
    const wasOpen = this.toolsDropdownOpen;
    this.closeAllDropdowns();
    this.toolsDropdownOpen = !wasOpen;
  }

  toggleAdminDropdown(event: Event): void {
    event.stopPropagation();
    const wasOpen = this.adminDropdownOpen;
    this.closeAllDropdowns();
    this.adminDropdownOpen = !wasOpen;
  }

  toggleCaptainDropdown(event: Event): void {
    event.stopPropagation();
    const wasOpen = this.captainDropdownOpen;
    this.closeAllDropdowns();
    this.captainDropdownOpen = !wasOpen;
  }

  toggleUserDropdown(event: Event): void {
    event.stopPropagation();
    const wasOpen = this.userDropdownOpen;
    this.closeAllDropdowns();
    this.userDropdownOpen = !wasOpen;
  }

  closeAllDropdowns(): void {
    this.submitDropdownOpen = false;
    this.toolsDropdownOpen = false;
    this.adminDropdownOpen = false;
    this.captainDropdownOpen = false;
    this.userDropdownOpen = false;
  }

  // Close dropdowns when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.closeAllDropdowns();
    }
  }
}
