import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthStateService } from '../../core/services/auth-state.service';
import { ResultsService } from '../../core/services/results.service';
import { MembersService } from '../../core/services/members.service';
import { getTeamRequirementsForYear } from '../../core/data/team-requirements';
import { RaceListComponent } from '../../shared/components/race-list/race-list.component';
import { SecondsToTimeStringPipe } from '../../shared/pipes/seconds-to-time-string.pipe';
import { AddOrdinalSuffixPipe } from '../../shared/pipes/add-ordinal-suffix.pipe';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RaceListComponent, SecondsToTimeStringPipe, AddOrdinalSuffixPipe],
  template: `
<div class="jumbotron">

  <!-- Dashboard for logged-in members -->
  <div *ngIf="user && user.member" class="well"
    style="margin-bottom: 15px; background: #fff; border: 1px solid #ddd;">
    <h4 style="margin-top: 0;">
      Welcome back, {{user.member.firstname}}!
      <a href="/members/{{user.member.username}}/bio" style="margin-left: 8px; font-weight: 600; font-size: 14px;">My Page &raquo;</a>
    </h4>

    <div class="row">
      <!-- Latest Race -->
      <div class="col-sm-4" style="border-right: 1px solid #eee;">
        <h5><i class="fa fa-flag-checkered"></i> Latest Race</h5>
        <hr style="margin: 5px 0 10px;">
        <div *ngIf="latestResult">
          <a class="hoverhand" (click)="showRaceByIdModal(latestResult.race._id)">
            <b>{{latestResult.race.racename}}</b>
          </a>
          <br>
          <small class="text-muted">{{latestResult.race.racedate | date:'mediumDate':'UTC'}}</small>
          <br>
          <span>Time: <span class="time">{{latestResult.time | secondsToTimeString}}</span></span>
          <span *ngIf="latestResult.agegrade"> | AG: {{latestResult.agegrade}}%</span>
        </div>
        <p *ngIf="!latestResult && dashboardLoaded" class="text-muted"><small>No race results yet.</small></p>
      </div>

      <!-- Requirement Status -->
      <div class="col-sm-8" *ngIf="dashboardMember?.teamRequirementStats">
        <h5><i class="fa fa-check-square-o"></i> {{currentYear}} Requirements</h5>
        <hr style="margin: 5px 0 10px;">
        <div class="row">
          <div class="col-sm-6">
            <span [ngClass]="meetsRaceReq ? 'text-success' : 'text-warning'">
              <i class="fa" [ngClass]="meetsRaceReq ? 'fa-check-circle' : 'fa-circle-o'"></i>
            </span>
            Races + Volunteer:
            <b>{{dashboardMember.teamRequirementStats.raceCount +
                dashboardMember.teamRequirementStats.volunteerJobCount}} / {{reqConfig.minRaceAndVolunteerCount}}</b>
            <br>
            <small class="text-muted">
              ({{dashboardMember.teamRequirementStats.raceCount}} races,
              {{dashboardMember.teamRequirementStats.volunteerJobCount}} vol.)
            </small>
          </div>
          <div class="col-sm-6">
            <span [ngClass]="meetsAgeGradeReq ? 'text-success' : 'text-warning'">
              <i class="fa" [ngClass]="meetsAgeGradeReq ? 'fa-check-circle' : 'fa-circle-o'"></i>
            </span>
            Best Age Grade:
            <b *ngIf="dashboardMember.teamRequirementStats.maxAgeGrade !== 'N/A'">
              {{dashboardMember.teamRequirementStats.maxAgeGrade}}%
              <span *ngIf="meetsAgeGradeReq">&ge; {{reqConfig.minAgeGrade}}%</span>
              <span *ngIf="!meetsAgeGradeReq">&lt; {{reqConfig.minAgeGrade}}%</span>
            </b>
            <span *ngIf="dashboardMember.teamRequirementStats.maxAgeGrade === 'N/A'" class="text-muted">
              N/A
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Welcome for non-members / anonymous visitors -->
  <div *ngIf="!user || !user.member">
    <p class="text-left">Welcome to the MCRRC racing team results and records site.</p>
    <p class="introtext"><small><i>The MCRRC racing team was established in the spring of 2013 to assemble and
          recognize
          highly talented and competitive members of MCRRC, promote competitive distance running among club
          members, and increase the visibility of MCRRC within the broader running community. The program
          establishes racing teams to compete at races in the metropolitan Washington, DC area. <a
              href="https://www.mcrrc.org/teams/competitive-racing-team" target="_blank"><b>learn
                  more...</b></a></i></small>
    </p>
  </div>

  <div class="row">
    <div class="col-md-12">
      <h4>Last 5 Races <small> <a href="/results">View all results</a></small></h4>
      <div class="row">
        <div class="col-md-12">
          <app-race-list [racesList]="recentRaces" [searchQuery]="searchQuery"
            [resultsTableProperties]="resultsTableProperties" [user]="user">
          </app-race-list>
        </div>
      </div>
    </div>
  </div>

  <div class="row">
    <div class="col-md-6">
      <h4>Latest Achievements</h4>
      <ul class="list-group" *ngIf="recentAchievements.length > 0">
        <li class="list-group-item" *ngFor="let ach of recentAchievements">
          <div *ngIf="ach.achievements.length === 1">
            <ng-container [ngSwitch]="ach.achievements[0].name.toLowerCase()">
              <span *ngSwitchCase="'pb'">
                <b><a href="/members/{{ach.result.members[0].username}}/bio">
                    {{ach.result.members[0].firstname}}
                    {{ach.result.members[0].lastname}}</a></b> achieved a new
                {{ach.race.racetype.name}} ({{ach.race.racetype.surface}}) PR of <span
                    class="time">{{ach.achievements[0].value.time | secondsToTimeString}}</span> with
                the team at <b><a class="hoverhand" (click)="showRaceModal(ach.race)">
                    {{ach.race.racename}}</a></b>!
              </span>
              <span *ngSwitchCase="'racecount'">
                <b><a href="/members/{{ach.result.members[0].username}}/bio">
                    {{ach.result.members[0].firstname}}
                    {{ach.result.members[0].lastname}}</a></b> ran their
                {{ach.achievements[0].value.raceCount | addOrdinalSuffix}} race with the team at <b><a
                    class="hoverhand" (click)="showRaceModal(ach.race)">
                    {{ach.race.racename}}</a></b>!
              </span>
              <span *ngSwitchCase="'agegrade'">
                <b><a href="/members/{{ach.result.members[0].username}}/bio">
                    {{ach.result.members[0].firstname}}
                    {{ach.result.members[0].lastname}}</a></b> achieved a new age grade
                performance best of {{ach.achievements[0].value.agegrade}}% at <b><a class="hoverhand"
                    (click)="showRaceModal(ach.race)"> {{ach.race.racename}}</a></b>.
              </span>
            </ng-container>
          </div>
          <div *ngIf="ach.achievements.length > 1">
            <b><a href="/members/{{ach.result.members[0].username}}/bio">
                {{ach.result.members[0].firstname}} {{ach.result.members[0].lastname}}</a></b>
            <span> had the following achievements at </span>
            <b><a class="hoverhand" (click)="showRaceModal(ach.race)"> {{ach.race.racename}}</a></b>:
            <ul>
              <li *ngFor="let a of ach.achievements">
                <ng-container *ngIf="a.name.toLowerCase() !== 'birthday'" [ngSwitch]="a.name.toLowerCase()">
                  <span *ngSwitchCase="'pb'">
                    Achieved a new {{ach.race.racetype.name}} ({{ach.race.racetype.surface}}) PR of
                    <span class="time">{{a.value.time | secondsToTimeString}}</span>.
                  </span>
                  <span *ngSwitchCase="'racecount'">
                    Ran their {{a.value.raceCount | addOrdinalSuffix}} race with the team.
                  </span>
                  <span *ngSwitchCase="'agegrade'">
                    Achieved a new age grade performance best of {{a.value.agegrade}}%.
                  </span>
                </ng-container>
              </li>
            </ul>
          </div>
        </li>
      </ul>
      <p *ngIf="allAchievements.length === 0" class="text-muted">No recent achievements.</p>
      <div *ngIf="achievementsTotalPages > 1" class="text-center">
        <ul class="pagination pagination-sm">
          <li [ngClass]="{disabled: achievementsPage === 1}">
            <a href (click)="achievementsPrevPage(); $event.preventDefault()">&laquo;</a>
          </li>
          <li class="active"><a href (click)="$event.preventDefault()">{{achievementsPage}} / {{achievementsTotalPages}}</a></li>
          <li [ngClass]="{disabled: achievementsPage === achievementsTotalPages}">
            <a href (click)="achievementsNextPage(); $event.preventDefault()">&raquo;</a>
          </li>
        </ul>
      </div>
    </div>
    <div class="col-md-6">
      <h4>Recent Team Ins & Outs <small>(last 60 days)</small></h4>
      <ul class="list-group" *ngIf="recentStatusChanges.length > 0">
        <li class="list-group-item" *ngFor="let change of recentStatusChanges">
          <b><a href="/members/{{change.member.username}}/bio">{{change.member.firstname}}
              {{change.member.lastname}}</a></b>
          <span *ngIf="change.type === 'entry'">joined</span>
          <span *ngIf="change.type === 'exit'">left</span>
          <span>the team on {{change.date | date:'mediumDate':'UTC'}}</span>
        </li>
      </ul>
      <p *ngIf="allStatusChanges.length === 0" class="text-muted">No changes in the last 60 days.</p>
      <div *ngIf="statusChangesTotalPages > 1" class="text-center">
        <ul class="pagination pagination-sm">
          <li [ngClass]="{disabled: statusChangesPage === 1}">
            <a href (click)="statusChangesPrevPage(); $event.preventDefault()">&laquo;</a>
          </li>
          <li class="active"><a href (click)="$event.preventDefault()">{{statusChangesPage}} / {{statusChangesTotalPages}}</a></li>
          <li [ngClass]="{disabled: statusChangesPage === statusChangesTotalPages}">
            <a href (click)="statusChangesNextPage(); $event.preventDefault()">&raquo;</a>
          </li>
        </ul>
      </div>
    </div>
  </div>
</div>
  `
})
export class HomeComponent implements OnInit {
  user: any = null;
  currentYear = new Date().getFullYear();
  reqConfig = getTeamRequirementsForYear(this.currentYear);
  dashboardLoaded = false;
  dashboardMember: any = null;
  latestResult: any = null;
  meetsRaceReq = false;
  meetsAgeGradeReq = false;

  recentRaces: any[] = [];
  racesList: any[] = [];
  searchQuery = '';
  resultsTableProperties = { pageSize: 5 };

  // Achievements pagination
  allAchievements: any[] = [];
  recentAchievements: any[] = [];
  achievementsPage = 1;
  achievementsPageSize = 10;
  achievementsTotalPages = 1;

  // Status changes pagination
  allStatusChanges: any[] = [];
  recentStatusChanges: any[] = [];
  statusChangesPage = 1;
  statusChangesPageSize = 10;
  statusChangesTotalPages = 1;

  constructor(
    private authState: AuthStateService,
    private resultsService: ResultsService,
    private membersService: MembersService
  ) {}

  ngOnInit(): void {
    this.user = this.authState.isLoggedIn() || null;
    this.authState.user$.subscribe(user => {
      this.user = user;
      this.loadDashboard();
    });

    this.loadRecentRaces();
    this.loadStatusChanges();
  }

  private loadDashboard(): void {
    if (!this.user?.member || this.dashboardLoaded) return;
    this.dashboardLoaded = true;

    // Fetch full member data
    this.membersService.getMember(this.user.member.username).then((member: any) => {
      this.dashboardMember = member;
      if (member?.teamRequirementStats) {
        const stats = member.teamRequirementStats;
        this.meetsRaceReq = (stats.raceCount + stats.volunteerJobCount) >= this.reqConfig.minRaceAndVolunteerCount;
        this.meetsAgeGradeReq = stats.maxAgeGrade !== 'N/A' && stats.maxAgeGrade >= this.reqConfig.minAgeGrade;
      }
    });

    // Find latest result
    this.resultsService.getRaceResultsWithCacheSupport({
      sort: '-racedate -order racename',
      preload: false
    }).then((races: any[]) => {
      const memberId = this.user.member._id;
      for (const race of races) {
        if (!race.results) continue;
        for (const result of race.results) {
          if (!result.members) continue;
          for (const member of result.members) {
            if (member._id === memberId) {
              this.latestResult = { ...result, race };
              return;
            }
          }
        }
        if (this.latestResult) break;
      }
    });
  }

  private loadRecentRaces(): void {
    const now = new Date();
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    sixtyDaysAgo.setUTCHours(0, 0, 0, 0);

    this.resultsService.getRaceResultsWithCacheSupport({
      filters: { dateFrom: sixtyDaysAgo.getTime() },
      sort: '-racedate -order racename',
      type: 'last60'
    }).then((races: any[]) => {
      this.racesList = races;
      this.recentRaces = races.slice(0, 5);
      const recentAchievementsRaces = races.slice(0, 25);

      // Gather achievements
      const allAchievements: any[] = [];
      recentAchievementsRaces.forEach((race: any) => {
        if (race.results?.length > 0) {
          race.results.forEach((result: any) => {
            if (result.achievements && result.members?.length === 1 && result.achievements.length > 0) {
              allAchievements.push({
                race,
                result,
                achievements: result.achievements
              });
            }
          });
        }
      });
      this.allAchievements = allAchievements;
      this.achievementsTotalPages = Math.ceil(allAchievements.length / this.achievementsPageSize) || 1;
      this.updateAchievementsPage();

      // Preload full cache if initial call returned < 200 results
      if (races.length < 200) {
        this.resultsService.getRaceResultsWithCacheSupport({
          sort: '-racedate -order racename',
          preload: false
        }).then((allRaces: any[]) => {
          this.racesList = allRaces;
        });
      }
    });
  }

  private loadStatusChanges(): void {
    this.membersService.getMembersWithCacheSupport({
      sort: '-membershipDates.start',
      select: '-bio -personalBests'
    }).then((members: any[]) => {
      const now = new Date();
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      const statusChanges: any[] = [];

      members.forEach((member: any) => {
        if (Array.isArray(member.membershipDates)) {
          member.membershipDates.forEach((md: any) => {
            if (md.start) {
              const startDate = new Date(md.start);
              if (startDate >= sixtyDaysAgo) {
                statusChanges.push({ member, type: 'entry', date: startDate });
              }
            }
            if (md.end) {
              const endDate = new Date(md.end);
              if (endDate >= sixtyDaysAgo) {
                statusChanges.push({ member, type: 'exit', date: endDate });
              }
            }
          });
        }
      });

      statusChanges.sort((a, b) => b.date.getTime() - a.date.getTime());
      this.allStatusChanges = statusChanges;
      this.statusChangesTotalPages = Math.ceil(statusChanges.length / this.statusChangesPageSize) || 1;
      this.updateStatusChangesPage();
    });
  }

  // Achievements pagination
  updateAchievementsPage(): void {
    const start = (this.achievementsPage - 1) * this.achievementsPageSize;
    this.recentAchievements = this.allAchievements.slice(start, start + this.achievementsPageSize);
  }

  achievementsNextPage(): void {
    if (this.achievementsPage < this.achievementsTotalPages) {
      this.achievementsPage++;
      this.updateAchievementsPage();
    }
  }

  achievementsPrevPage(): void {
    if (this.achievementsPage > 1) {
      this.achievementsPage--;
      this.updateAchievementsPage();
    }
  }

  // Status changes pagination
  updateStatusChangesPage(): void {
    const start = (this.statusChangesPage - 1) * this.statusChangesPageSize;
    this.recentStatusChanges = this.allStatusChanges.slice(start, start + this.statusChangesPageSize);
  }

  statusChangesNextPage(): void {
    if (this.statusChangesPage < this.statusChangesTotalPages) {
      this.statusChangesPage++;
      this.updateStatusChangesPage();
    }
  }

  statusChangesPrevPage(): void {
    if (this.statusChangesPage > 1) {
      this.statusChangesPage--;
      this.updateStatusChangesPage();
    }
  }

  showRaceModal(race: any): void {
    if (race) {
      this.resultsService.showRaceModal(race);
    }
  }

  showRaceByIdModal(raceId: string): void {
    if (raceId) {
      this.resultsService.showRaceFromRaceIdModal(raceId);
    }
  }

}
