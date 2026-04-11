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
import { HeadToHeadBarChartComponent } from '../../../shared/components/head-to-head-bar-chart/head-to-head-bar-chart.component';
import { SecondsToTimeStringPipe } from '../../../shared/pipes/seconds-to-time-string.pipe';

declare var gtag: any;

@Component({
  selector: 'app-member-h2h-compare',
  standalone: true,
  imports: [CommonModule, FormsModule, MemberNavComponent, MemberSearchComponent, HeadToHeadBarChartComponent, SecondsToTimeStringPipe],
  template: `
    <app-member-nav *ngIf="member1" [member]="member1" activeTab="head-to-head" [user]="user"></app-member-nav>

    <!-- Loading Spinner -->
    <div class="jumbotron" *ngIf="loading">
      <div class="text-center" style="padding: 50px;">
        <i class="fa fa-spinner fa-spin fa-3x"></i>
        <p>Loading head-to-head comparison...</p>
      </div>
    </div>

    <div class="head-to-head-page" *ngIf="!loading && member1">

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
                  <div style="display: inline-block; min-width: 250px; vertical-align: middle;">
                    <app-member-search
                      [members]="teamMembersForDropdown"
                      [placeholder]="'Select team member...'"
                      (memberSelected)="onCompareMemberSelected($event)">
                    </app-member-search>
                  </div>
                  <button type="button"
                          *ngIf="member2 && topTeamMembers && topTeamMembers.length > 0"
                          class="btn btn-sm btn-primary"
                          (click)="showTeamMembersList()">
                    <i class="fa fa-list"></i> View All Team Members
                  </button>
                </div>
                <div class="col-sm-4 text-right">
                  <div class="age-grade-mode-toggle btn-group" role="group" style="margin-bottom: 10px;">
                    <button style="margin-right: 5px" type="button" class="btn btn-sm"
                            [class.activated]="!ageGradeMode"
                            [class.deactivated]="ageGradeMode"
                            (click)="toggleAgeGradeMode(false)"
                            title="Switch to regular time-based comparison">
                      <i class="fa fa-clock-o"></i> Regular Mode
                    </button>
                    <button type="button" class="btn btn-sm"
                            [class.activated]="ageGradeMode"
                            [class.deactivated]="!ageGradeMode"
                            (click)="toggleAgeGradeMode(true)"
                            title="Switch to age grade-based comparison">
                      <i class="fa fa-percent"></i> Age Grade Mode
                    </button>
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col-sm-12 text-right">
                  <label class="control-label" style="margin-right: 5px;">
                    <i class="fa fa-calendar"></i> Year:
                  </label>
                  <select [(ngModel)]="yearFilter" (ngModelChange)="onYearChange()"
                          class="form-control" style="min-width: 90px; display: inline-block; width: auto;">
                    <option *ngFor="let year of yearsList" [ngValue]="year">{{ year }}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Head-to-Head Record Panel -->
        <div class="row" *ngIf="member2">
          <div class="col-md-12">
            <div class="panel panel-default">
              <div class="panel-heading">
                <h4><i class="fa fa-trophy"></i>
                  <span *ngIf="!ageGradeMode">Head-to-Head Record - {{ yearFilter }}</span>
                  <span *ngIf="ageGradeMode">Head-to-Head Record for Age-Graded Races - {{ yearFilter }}</span>
                </h4>
              </div>
              <div class="panel-body">
                <div class="row text-center" *ngIf="sharedRaces.length > 0">
                  <!-- Member 1 -->
                  <div class="col-md-4">
                    <h3 class="member-1-color">{{ member1.firstname }} {{ member1.lastname }}</h3>
                    <div class="win-count">
                      <h2 class="member-1-color">{{ headToHeadRecord.member1Wins }}</h2>
                      <p>Wins</p>
                    </div>
                  </div>

                  <!-- VS and Ties -->
                  <div class="col-md-4">
                    <div class="vs-section">
                      <h2 class="text-muted">VS</h2>
                      <div class="ties-count" *ngIf="headToHeadRecord.ties > 0">
                        <span class="member-tie-color number">{{ headToHeadRecord.ties }}</span><span class="text"> Ties</span>
                      </div>
                    </div>
                  </div>

                  <!-- Member 2 -->
                  <div class="col-md-4">
                    <h3 class="member-2-color hoverhand"
                        title="View head-to-head records for {{ member2.firstname }} {{ member2.lastname }}"
                        (click)="goToMemberHeadToHead(member2)">
                      {{ member2.firstname }} {{ member2.lastname }}
                    </h3>
                    <div class="win-count">
                      <h2 class="member-2-color">{{ headToHeadRecord.member2Wins }}</h2>
                      <p>Wins</p>
                    </div>
                  </div>
                </div>

                <!-- No Shared Races Message -->
                <div class="row" *ngIf="sharedRaces.length === 0">
                  <div class="col-md-12">
                    <div class="text-center">
                      <div class="no-races-message">
                        <i class="fa fa-users fa-3x text-muted"></i>
                        <h4 class="text-muted">No Head-to-Head Yet!</h4>
                        <p class="text-muted" *ngIf="yearFilter === 'All Time'">
                          {{ member1.firstname }} and {{ member2.firstname }} haven't raced together yet.
                        </p>
                        <p class="text-muted" *ngIf="yearFilter !== 'All Time'">
                          {{ member1.firstname }} and {{ member2.firstname }} didn't race together in {{ yearFilter }}.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Yearly Head-to-Head Bar Chart (All Time only) -->
        <div class="row" *ngIf="member2 && yearFilter === 'All Time' && yearlyHeadToHeadData">
          <div class="col-md-12">
            <div class="panel panel-default">
              <div class="panel-heading">
                <h4><i class="fa fa-bar-chart"></i> Head-to-Head by Year</h4>
              </div>
              <div class="panel-body">
                <app-head-to-head-bar-chart
                  [data]="yearlyHeadToHeadData"
                  [member1Name]="member1.firstname"
                  [member2Name]="member2.firstname"
                  [colors]="h2hColors">
                </app-head-to-head-bar-chart>
              </div>
            </div>
          </div>
        </div>

        <!-- Statistics Comparison -->
        <div class="row" *ngIf="member2">
          <div class="col-md-12">
            <div class="panel panel-default comparison-table">
              <div class="panel-heading">
                <h4><i class="fa fa-bar-chart"></i> Statistics Comparison</h4>
              </div>
              <div class="panel-body">
                <div class="table-responsive head-to-head-tables">
                  <table class="table">
                    <thead>
                      <tr>
                        <th>Statistic</th>
                        <th class="member-1-color">{{ member1.firstname }}</th>
                        <th class="member-2-color">{{ member2.firstname }}</th>
                        <th>Winner</th>
                      </tr>
                    </thead>
                    <tbody>
                      <!-- Total Races -->
                      <tr>
                        <td><strong>Total Races</strong></td>
                        <td class="text-center"
                            [class.winning-cell]="comparisonStats.member1?.totalRaces > comparisonStats.member2?.totalRaces">
                          {{ comparisonStats.member1?.totalRaces }}
                        </td>
                        <td class="text-center"
                            [class.winning-cell]="comparisonStats.member2?.totalRaces > comparisonStats.member1?.totalRaces">
                          {{ comparisonStats.member2?.totalRaces }}
                        </td>
                        <td class="text-center">
                          <span *ngIf="comparisonStats.member1?.totalRaces > comparisonStats.member2?.totalRaces" class="member-1-color">
                            <i class="fa fa-trophy"></i> {{ member1.firstname }}
                          </span>
                          <span *ngIf="comparisonStats.member2?.totalRaces > comparisonStats.member1?.totalRaces" class="member-2-color">
                            <i class="fa fa-trophy"></i> {{ member2.firstname }}
                          </span>
                          <span *ngIf="comparisonStats.member1?.totalRaces === comparisonStats.member2?.totalRaces" class="member-tie-color">
                            <i class="fa fa-equals"></i> Tie
                          </span>
                        </td>
                      </tr>

                      <!-- Years Racing -->
                      <tr>
                        <td><strong>Years Racing</strong></td>
                        <td class="text-center"
                            [class.winning-cell]="comparisonStats.member1?.yearsRacing > comparisonStats.member2?.yearsRacing">
                          {{ comparisonStats.member1?.yearsRacing }}
                        </td>
                        <td class="text-center"
                            [class.winning-cell]="comparisonStats.member2?.yearsRacing > comparisonStats.member1?.yearsRacing">
                          {{ comparisonStats.member2?.yearsRacing }}
                        </td>
                        <td class="text-center">
                          <span *ngIf="comparisonStats.member1?.yearsRacing > comparisonStats.member2?.yearsRacing" class="member-1-color">
                            <i class="fa fa-trophy"></i> {{ member1.firstname }}
                          </span>
                          <span *ngIf="comparisonStats.member2?.yearsRacing > comparisonStats.member1?.yearsRacing" class="member-2-color">
                            <i class="fa fa-trophy"></i> {{ member2.firstname }}
                          </span>
                          <span *ngIf="comparisonStats.member1?.yearsRacing === comparisonStats.member2?.yearsRacing" class="member-tie-color">
                            <i class="fa fa-equals"></i> Tie
                          </span>
                        </td>
                      </tr>

                      <!-- Avg Races/Year -->
                      <tr>
                        <td><strong>Avg Races/Year</strong></td>
                        <td class="text-center"
                            [class.winning-cell]="comparisonStats.member1?.avgRacesPerYear > comparisonStats.member2?.avgRacesPerYear">
                          {{ comparisonStats.member1?.avgRacesPerYear | number:'1.1-1' }}
                        </td>
                        <td class="text-center"
                            [class.winning-cell]="comparisonStats.member2?.avgRacesPerYear > comparisonStats.member1?.avgRacesPerYear">
                          {{ comparisonStats.member2?.avgRacesPerYear | number:'1.1-1' }}
                        </td>
                        <td class="text-center">
                          <span *ngIf="comparisonStats.member1?.avgRacesPerYear > comparisonStats.member2?.avgRacesPerYear" class="member-1-color">
                            <i class="fa fa-trophy"></i> {{ member1.firstname }}
                          </span>
                          <span *ngIf="comparisonStats.member2?.avgRacesPerYear > comparisonStats.member1?.avgRacesPerYear" class="member-2-color">
                            <i class="fa fa-trophy"></i> {{ member2.firstname }}
                          </span>
                          <span *ngIf="comparisonStats.member1?.avgRacesPerYear === comparisonStats.member2?.avgRacesPerYear" class="member-tie-color">
                            <i class="fa fa-equals"></i> Tie
                          </span>
                        </td>
                      </tr>

                      <!-- Total Wins -->
                      <tr>
                        <td><strong>Total Wins</strong></td>
                        <td class="text-center"
                            [class.winning-cell]="comparisonStats.member1?.wins > comparisonStats.member2?.wins">
                          {{ comparisonStats.member1?.wins }}
                        </td>
                        <td class="text-center"
                            [class.winning-cell]="comparisonStats.member2?.wins > comparisonStats.member1?.wins">
                          {{ comparisonStats.member2?.wins }}
                        </td>
                        <td class="text-center">
                          <span *ngIf="comparisonStats.member1?.wins > comparisonStats.member2?.wins" class="member-1-color">
                            <i class="fa fa-trophy"></i> {{ member1.firstname }}
                          </span>
                          <span *ngIf="comparisonStats.member2?.wins > comparisonStats.member1?.wins" class="member-2-color">
                            <i class="fa fa-trophy"></i> {{ member2.firstname }}
                          </span>
                          <span *ngIf="comparisonStats.member1?.wins === comparisonStats.member2?.wins" class="member-tie-color">
                            <i class="fa fa-equals"></i> Tie
                          </span>
                        </td>
                      </tr>

                      <!-- Top 3 Finishes -->
                      <tr>
                        <td><strong>Top 3 Finishes</strong></td>
                        <td class="text-center"
                            [class.winning-cell]="comparisonStats.member1?.top3Finishes > comparisonStats.member2?.top3Finishes">
                          {{ comparisonStats.member1?.top3Finishes }}
                        </td>
                        <td class="text-center"
                            [class.winning-cell]="comparisonStats.member2?.top3Finishes > comparisonStats.member1?.top3Finishes">
                          {{ comparisonStats.member2?.top3Finishes }}
                        </td>
                        <td class="text-center">
                          <span *ngIf="comparisonStats.member1?.top3Finishes > comparisonStats.member2?.top3Finishes" class="member-1-color">
                            <i class="fa fa-trophy"></i> {{ member1.firstname }}
                          </span>
                          <span *ngIf="comparisonStats.member2?.top3Finishes > comparisonStats.member1?.top3Finishes" class="member-2-color">
                            <i class="fa fa-trophy"></i> {{ member2.firstname }}
                          </span>
                          <span *ngIf="comparisonStats.member1?.top3Finishes === comparisonStats.member2?.top3Finishes" class="member-tie-color">
                            <i class="fa fa-equals"></i> Tie
                          </span>
                        </td>
                      </tr>

                      <!-- Best Age Grade -->
                      <tr>
                        <td><strong>Best Age Grade</strong></td>
                        <td class="text-center"
                            [class.winning-cell]="comparisonStats.member1?.bestAgeGrade > comparisonStats.member2?.bestAgeGrade">
                          <span class="hoverhand" (click)="showRaceModal(comparisonStats.comparison?.bestAgeGrade?.member1Race)">
                            {{ comparisonStats.member1?.bestAgeGrade | number:'1.1-1' }}%
                          </span>
                        </td>
                        <td class="text-center"
                            [class.winning-cell]="comparisonStats.member2?.bestAgeGrade > comparisonStats.member1?.bestAgeGrade">
                          <span class="hoverhand" (click)="showRaceModal(comparisonStats.comparison?.bestAgeGrade?.member2Race)">
                            {{ comparisonStats.member2?.bestAgeGrade | number:'1.1-1' }}%
                          </span>
                        </td>
                        <td class="text-center">
                          <span *ngIf="comparisonStats.member1?.bestAgeGrade > comparisonStats.member2?.bestAgeGrade" class="member-1-color">
                            <i class="fa fa-trophy"></i> {{ member1.firstname }}
                          </span>
                          <span *ngIf="comparisonStats.member2?.bestAgeGrade > comparisonStats.member1?.bestAgeGrade" class="member-2-color">
                            <i class="fa fa-trophy"></i> {{ member2.firstname }}
                          </span>
                          <span *ngIf="comparisonStats.member1?.bestAgeGrade === comparisonStats.member2?.bestAgeGrade" class="member-tie-color">
                            <i class="fa fa-equals"></i> Tie
                          </span>
                        </td>
                      </tr>

                      <!-- Avg Age Grade -->
                      <tr>
                        <td><strong>Avg Age Grade</strong></td>
                        <td class="text-center"
                            [class.winning-cell]="comparisonStats.member1?.avgAgeGrade > comparisonStats.member2?.avgAgeGrade">
                          {{ comparisonStats.member1?.avgAgeGrade | number:'1.1-1' }}%
                        </td>
                        <td class="text-center"
                            [class.winning-cell]="comparisonStats.member2?.avgAgeGrade > comparisonStats.member1?.avgAgeGrade">
                          {{ comparisonStats.member2?.avgAgeGrade | number:'1.1-1' }}%
                        </td>
                        <td class="text-center">
                          <span *ngIf="comparisonStats.member1?.avgAgeGrade > comparisonStats.member2?.avgAgeGrade" class="member-1-color">
                            <i class="fa fa-trophy"></i> {{ member1.firstname }}
                          </span>
                          <span *ngIf="comparisonStats.member2?.avgAgeGrade > comparisonStats.member1?.avgAgeGrade" class="member-2-color">
                            <i class="fa fa-trophy"></i> {{ member2.firstname }}
                          </span>
                          <span *ngIf="comparisonStats.member1?.avgAgeGrade === comparisonStats.member2?.avgAgeGrade" class="member-tie-color">
                            <i class="fa fa-equals"></i> Tie
                          </span>
                        </td>
                      </tr>

                      <!-- Total Miles -->
                      <tr>
                        <td><strong>Total Miles</strong></td>
                        <td class="text-center"
                            [class.winning-cell]="comparisonStats.member1?.totalMiles > comparisonStats.member2?.totalMiles">
                          {{ comparisonStats.member1?.totalMiles | number:'1.1-1' }}
                        </td>
                        <td class="text-center"
                            [class.winning-cell]="comparisonStats.member2?.totalMiles > comparisonStats.member1?.totalMiles">
                          {{ comparisonStats.member2?.totalMiles | number:'1.1-1' }}
                        </td>
                        <td class="text-center">
                          <span *ngIf="comparisonStats.member1?.totalMiles > comparisonStats.member2?.totalMiles" class="member-1-color">
                            <i class="fa fa-trophy"></i> {{ member1.firstname }}
                          </span>
                          <span *ngIf="comparisonStats.member2?.totalMiles > comparisonStats.member1?.totalMiles" class="member-2-color">
                            <i class="fa fa-trophy"></i> {{ member2.firstname }}
                          </span>
                          <span *ngIf="comparisonStats.member1?.totalMiles === comparisonStats.member2?.totalMiles" class="member-tie-color">
                            <i class="fa fa-equals"></i> Tie
                          </span>
                        </td>
                      </tr>

                      <!-- States Raced In -->
                      <tr>
                        <td><strong>States Raced In</strong></td>
                        <td class="text-center"
                            [class.winning-cell]="comparisonStats.member1?.uniqueStates > comparisonStats.member2?.uniqueStates">
                          {{ comparisonStats.member1?.uniqueStates }}
                        </td>
                        <td class="text-center"
                            [class.winning-cell]="comparisonStats.member2?.uniqueStates > comparisonStats.member1?.uniqueStates">
                          {{ comparisonStats.member2?.uniqueStates }}
                        </td>
                        <td class="text-center">
                          <span *ngIf="comparisonStats.member1?.uniqueStates > comparisonStats.member2?.uniqueStates" class="member-1-color">
                            <i class="fa fa-trophy"></i> {{ member1.firstname }}
                          </span>
                          <span *ngIf="comparisonStats.member2?.uniqueStates > comparisonStats.member1?.uniqueStates" class="member-2-color">
                            <i class="fa fa-trophy"></i> {{ member2.firstname }}
                          </span>
                          <span *ngIf="comparisonStats.member1?.uniqueStates === comparisonStats.member2?.uniqueStates" class="member-tie-color">
                            <i class="fa fa-equals"></i> Tie
                          </span>
                        </td>
                      </tr>

                      <!-- Countries Raced In -->
                      <tr>
                        <td><strong>Countries Raced In</strong></td>
                        <td class="text-center"
                            [class.winning-cell]="comparisonStats.member1?.uniqueCountries > comparisonStats.member2?.uniqueCountries">
                          {{ comparisonStats.member1?.uniqueCountries }}
                        </td>
                        <td class="text-center"
                            [class.winning-cell]="comparisonStats.member2?.uniqueCountries > comparisonStats.member1?.uniqueCountries">
                          {{ comparisonStats.member2?.uniqueCountries }}
                        </td>
                        <td class="text-center">
                          <span *ngIf="comparisonStats.member1?.uniqueCountries > comparisonStats.member2?.uniqueCountries" class="member-1-color">
                            <i class="fa fa-trophy"></i> {{ member1.firstname }}
                          </span>
                          <span *ngIf="comparisonStats.member2?.uniqueCountries > comparisonStats.member1?.uniqueCountries" class="member-2-color">
                            <i class="fa fa-trophy"></i> {{ member2.firstname }}
                          </span>
                          <span *ngIf="comparisonStats.member1?.uniqueCountries === comparisonStats.member2?.uniqueCountries" class="member-tie-color">
                            <i class="fa fa-equals"></i> Tie
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Shared Races Table -->
        <div class="row" *ngIf="member2 && sharedRaces.length > 0">
          <div class="col-md-12">
            <div class="panel panel-default shared-races-table">
              <div class="panel-heading">
                <h4><i class="fa fa-flag-checkered"></i>
                  <span *ngIf="!ageGradeMode">Races They Both Participated In</span>
                  <span *ngIf="ageGradeMode">Age-Graded Races They Both Participated In</span>
                </h4>
              </div>
              <div class="panel-body">
                <div class="table-responsive head-to-head-tables">
                  <table class="table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Date</th>
                        <th>Race Name</th>
                        <th>Distance</th>
                        <th class="member-1-color">{{ member1.firstname }}</th>
                        <th class="member-2-color">{{ member2.firstname }}</th>
                        <th *ngIf="!ageGradeMode">Margin</th>
                        <th *ngIf="ageGradeMode">Age Grade Diff</th>
                        <th>Winner</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let race of sharedRaces; let i = index"
                          [ngClass]="race.winner === 'member1' ? 'member-1-bg' : (race.winner === 'member2' ? 'member-2-bg' : 'member-tie-bg')">
                        <td>{{ sharedRaces.length - i }}</td>
                        <td>{{ formatDate(race.race.racedate) }}</td>
                        <td>
                          <a (click)="showRaceModal(race.race)" class="hoverhand">
                            {{ race.race.racename }}
                          </a>
                        </td>
                        <td>{{ race.race.distanceName || race.race.racetype?.name }}</td>

                        <!-- Member 1 result -->
                        <td>
                          <div *ngIf="!ageGradeMode">
                            <strong class="time">{{ race.member1Result.time | secondsToTimeString }}</strong>
                            <br>
                            <small *ngIf="race.member1Result.agegrade">({{ race.member1Result.agegrade | number:'1.1-1' }}%)</small>
                          </div>
                          <div *ngIf="ageGradeMode">
                            <strong class="time" *ngIf="race.member1Result.agegrade">{{ race.member1Result.agegrade | number:'1.1-1' }}%</strong>
                            <strong class="time" *ngIf="!race.member1Result.agegrade">N/A</strong>
                            <br>
                            <small>{{ race.member1Result.time | secondsToTimeString }}</small>
                          </div>
                        </td>

                        <!-- Member 2 result -->
                        <td>
                          <div *ngIf="!ageGradeMode">
                            <strong class="time">{{ race.member2Result.time | secondsToTimeString }}</strong>
                            <br>
                            <small *ngIf="race.member2Result.agegrade">({{ race.member2Result.agegrade | number:'1.1-1' }}%)</small>
                          </div>
                          <div *ngIf="ageGradeMode">
                            <strong class="time" *ngIf="race.member2Result.agegrade">{{ race.member2Result.agegrade | number:'1.1-1' }}%</strong>
                            <strong class="time" *ngIf="!race.member2Result.agegrade">N/A</strong>
                            <br>
                            <small>{{ race.member2Result.time | secondsToTimeString }}</small>
                          </div>
                        </td>

                        <!-- Margin -->
                        <td>
                          <span *ngIf="!race.isTie" class="time"
                                [class.ranking-tiebreaker]="race.timeDifference === 0">
                            <span *ngIf="!ageGradeMode">{{ race.timeDifference | secondsToTimeString }}</span>
                            <span *ngIf="ageGradeMode">{{ race.timeDifference | number:'1.1-1' }}%</span>
                          </span>
                          <span *ngIf="race.isTie">-</span>
                        </td>

                        <!-- Winner -->
                        <td>
                          <span *ngIf="race.winner === 'member1'" class="member-1-color">
                            <i class="fa fa-trophy"></i> {{ member1.firstname }}
                          </span>
                          <span *ngIf="race.winner === 'member2'" class="member-2-color">
                            <i class="fa fa-trophy"></i> {{ member2.firstname }}
                          </span>
                          <span *ngIf="race.isTie" class="member-tie-color">
                            <i class="fa fa-equals"></i> Tie
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  `
})
export class MemberH2hCompareComponent implements OnInit, OnDestroy {
  member1: any = null;
  member2: any = null;
  user: any;
  loading = true;

  member1Results: any[] = [];
  member2Results: any[] = [];
  sharedRaces: any[] = [];
  comparisonStats: any = {};
  headToHeadRecord = { member1Wins: 0, member2Wins: 0, ties: 0 };
  yearlyHeadToHeadData: any = null;

  ageGradeMode = false;
  yearFilter: string | number = 'All Time';
  yearsList: (string | number)[] = ['All Time'];

  topTeamMembers: any[] = [];
  teamMembersForDropdown: any[] = [];
  h2hColors: any = { member1: '', member2: '', tie: '' };

  private _cachedRaceList: any[] = [];
  private _cachedAllMembers: any[] = [];
  private routeSub: Subscription | null = null;

  constructor(
    private membersService: MembersService,
    private h2hService: HeadToHeadService,
    private authStateService: AuthStateService,
    private route: ActivatedRoute,
    private router: Router,
    private resultsService: ResultsService
  ) {}

  ngOnInit(): void {
    this.user = this.authStateService.currentUser;

    // Load age grade mode from localStorage
    try {
      const stored = localStorage.getItem('ls.headToHeadAgeGradeMode');
      if (stored) {
        this.ageGradeMode = JSON.parse(stored) === true;
      }
    } catch (e) {
      // ignore parse errors
    }

    // Read CSS colors for the bar chart
    this.h2hColors = {
      member1: this.getCssColor('member-1-color'),
      member2: this.getCssColor('member-2-color'),
      tie: this.getCssColor('member-tie-color')
    };

    // Subscribe to route params so navigating to a new comparison re-loads
    this.routeSub = this.route.paramMap.subscribe(params => {
      const username1 = params.get('member');
      const username2 = params.get('member2');

      if (!username1 || !username2) {
        this.router.navigate(['/members']);
        return;
      }

      this.loadData(username1, username2);
    });
  }

  ngOnDestroy(): void {
    if (this.routeSub) {
      this.routeSub.unsubscribe();
    }
  }

  private async loadData(username1: string, username2: string): Promise<void> {
    this.loading = true;

    try {
      // Load all members with cache support
      const allMembers = await this.membersService.getMembersWithCacheSupport();

      // Find both members
      const member1 = allMembers.find((m: any) => m.username === username1);
      const member2 = allMembers.find((m: any) => m.username === username2);

      if (!member1 || !member2) {
        this.router.navigate(['/members']);
        return;
      }

      this.member1 = member1;
      this.member2 = member2;

      // Load race data
      const raceList = await this.resultsService.getRaceResultsWithCacheSupport({
        sort: '-racedate -order racename',
        preload: false
      });

      // Cache the full unfiltered data
      this._cachedRaceList = raceList;
      this._cachedAllMembers = allMembers;

      // Build years list from member1's race data
      this.buildYearsList(raceList);

      // Apply year filter
      const filteredRaceList = this.filterRaceListByYear(raceList);

      // Calculate top team members for the dropdown
      this.topTeamMembers = this.h2hService.calculateTopTeamMembers(
        filteredRaceList, allMembers, this.member1._id, this.ageGradeMode
      );
      this.teamMembersForDropdown = this.topTeamMembers
        .slice()
        .sort((a: any, b: any) => b.count - a.count);

      // Calculate comparison data
      this.recalculateComparison(filteredRaceList);

      this.loading = false;

      if (typeof gtag !== 'undefined') {
        gtag('event', 'view_head_to_head', {
          member1: member1.firstname + ' ' + member1.lastname,
          member2: member2.firstname + ' ' + member2.lastname
        });
      }
    } catch (error) {
      console.error('Error loading head-to-head data:', error);
      this.loading = false;
      this.router.navigate(['/members']);
    }
  }

  recalculateComparison(raceList: any[]): void {
    this.member1Results = [];
    this.member2Results = [];

    raceList.forEach((race: any) => {
      if (race.results && race.results.length > 0) {
        race.results.forEach((result: any) => {
          if (result.members) {
            result.members.forEach((member: any) => {
              if (member._id === this.member1._id) {
                this.member1Results.push({ ...result, race: race });
              }
              if (member._id === this.member2._id) {
                this.member2Results.push({ ...result, race: race });
              }
            });
          }
        });
      }
    });

    this.comparisonStats = this.h2hService.calculateComparisonStats(this.member1Results, this.member2Results);
    this.sharedRaces = this.h2hService.findSharedRaces(this.member1Results, this.member2Results, this.ageGradeMode);
    this.headToHeadRecord = this.h2hService.calculateHeadToHeadRecord(this.sharedRaces);
    this.yearlyHeadToHeadData = this.h2hService.buildYearlyHeadToHeadData(this.sharedRaces);
  }

  toggleAgeGradeMode(mode: boolean): void {
    this.ageGradeMode = mode;

    // Persist to localStorage (using same key as AngularJS localStorageService)
    try {
      localStorage.setItem('ls.headToHeadAgeGradeMode', JSON.stringify(this.ageGradeMode));
    } catch (e) {
      // ignore storage errors
    }

    if (this._cachedRaceList.length > 0 && this._cachedAllMembers.length > 0) {
      const filteredRaceList = this.filterRaceListByYear(this._cachedRaceList);

      if (this.member1 && this.member2) {
        this.recalculateComparison(filteredRaceList);
      }

      if (this.member1) {
        this.topTeamMembers = this.h2hService.calculateTopTeamMembers(
          filteredRaceList, this._cachedAllMembers, this.member1._id, this.ageGradeMode
        );
        this.teamMembersForDropdown = this.topTeamMembers
          .slice()
          .sort((a: any, b: any) => b.count - a.count);
      }
    }
  }

  onYearChange(): void {
    if (this._cachedRaceList.length > 0 && this._cachedAllMembers.length > 0) {
      const filteredRaceList = this.filterRaceListByYear(this._cachedRaceList);

      if (this.member1) {
        this.topTeamMembers = this.h2hService.calculateTopTeamMembers(
          filteredRaceList, this._cachedAllMembers, this.member1._id, this.ageGradeMode
        );
        this.teamMembersForDropdown = this.topTeamMembers
          .slice()
          .sort((a: any, b: any) => b.count - a.count);
      }

      if (this.member1 && this.member2) {
        this.recalculateComparison(filteredRaceList);
      }
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
    const selectedYear = typeof this.yearFilter === 'string'
      ? parseInt(this.yearFilter, 10)
      : this.yearFilter;
    return raceList.filter((race: any) => {
      return new Date(race.racedate).getUTCFullYear() === selectedYear;
    });
  }

  onCompareMemberSelected(member: any): void {
    if (member && member.username) {
      this.router.navigate(['/members', this.member1.username, 'head-to-head', member.username]);
    }
  }

  showTeamMembersList(): void {
    this.router.navigate(['/members', this.member1.username, 'head-to-head']);
  }

  showRaceModal(race: any): void {
    if (race) {
      this.resultsService.showRaceModal(race);
    }
  }

  goToMemberHeadToHead(member: any): void {
    if (member && member.username) {
      this.router.navigate(['/members', member.username, 'head-to-head']);
    }
  }

  formatTime(timeInCentiseconds: number): string {
    if (timeInCentiseconds == null) return '';
    const hours = Math.floor(timeInCentiseconds / 360000);
    const minutes = Math.floor(((timeInCentiseconds % 8640000) % 360000) / 6000);
    let seconds: number | string = Math.floor((((timeInCentiseconds % 8640000) % 360000) % 6000) / 100);
    let centiseconds: number | string = Math.floor((((timeInCentiseconds % 8640000) % 360000) % 6000) % 100);

    if (hours === 0) {
      if (seconds < 10) seconds = '0' + seconds;
      if (centiseconds !== 0) {
        if (centiseconds < 10) centiseconds = '0' + centiseconds;
        return minutes + ':' + seconds + '.' + centiseconds;
      } else {
        return minutes + ':' + seconds;
      }
    } else {
      let min: number | string = minutes;
      if (min < 10) min = '0' + min;
      if (seconds < 10) seconds = '0' + seconds;
      if (centiseconds !== 0) {
        if (centiseconds < 10) centiseconds = '0' + centiseconds;
        return hours + ':' + min + ':' + seconds + '.' + centiseconds;
      } else {
        return hours + ':' + min + ':' + seconds;
      }
    }
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString();
  }

  private getCssColor(className: string): string {
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
