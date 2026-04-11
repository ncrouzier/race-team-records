import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { UtilsService } from '../../../core/services/utils.service';
import { SecondsToTimeStringPipe } from '../../../shared/pipes/seconds-to-time-string.pipe';
import { TimeToAgeGradePipe } from '../../../shared/pipes/time-to-age-grade.pipe';
import { RacenameToDistancePipe } from '../../../shared/pipes/racename-to-distance.pipe';
import { MilesToPacePipe } from '../../../shared/pipes/miles-to-pace.pipe';
import { MilesAndTimeToPacePipe } from '../../../shared/pipes/miles-and-time-to-pace.pipe';
import { OnlyDigitsDirective } from '../../../shared/directives/only-digits.directive';
import { OnlyDigitsForMinSecDirective } from '../../../shared/directives/only-digits-for-min-sec.directive';

interface TimeInput {
  hours?: number;
  minutes?: number;
  seconds?: number;
}

@Component({
  selector: 'app-age-grade',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    SecondsToTimeStringPipe, TimeToAgeGradePipe, RacenameToDistancePipe,
    MilesToPacePipe, MilesAndTimeToPacePipe,
    OnlyDigitsDirective, OnlyDigitsForMinSecDirective
  ],
  template: `
<div class="jumbotron">
  <form name="myForm" (ngSubmit)="submitForm()">
    <div class="row btn-row">
      <div class="col-md-12 col-sm-12 btn-col-member">
        <span>Select age and gender:</span>
      </div>
    </div>
    <div class="row btn-row" style="display: flex;">
      <div class="col-md-12 col-sm-12" style="display: inline-flex;">
        <div style="margin-right: 10px;">
          <span>Age:</span><br>
          <input class="agegradeAgeInput form-control" type="number" id="age" name="age"
            [(ngModel)]="formData.age" onlyDigits dirMax="110" min="5" max="110" required
            (ngModelChange)="onAgeChange()">
        </div>
        <div style="margin-right: 10px; min-width: 140px;">
          <span>Gender:</span><br>
          <div class="btn-group">
            <label class="btn-ag-gender btn btn-primary"
              [class.active]="formData.sex === 'Male'"
              (click)="formData.sex = 'Male'; submitForm()">Men</label>
            <label class="btn-ag-gender btn btn-primary"
              [class.active]="formData.sex === 'Female'"
              (click)="formData.sex = 'Female'; submitForm()">Women</label>
          </div>
        </div>
        <div *ngIf="user?.member?.dateofbirth && user?.member?.sex" style="margin-right: 10px;">
          <br>
          <button type="button" class="btn btn-default" (click)="selectMyInfo()">
            <i class="fa fa-user"></i> Select my info
          </button>
        </div>
        <div *ngIf="hasOtherType()" style="margin-left: auto">
          <br>
          <button type="button" class="btn btn-primary" (click)="switchType()">Switch to {{currentType === 'Road' ? 'track' : 'road'}} distances</button>
        </div>
      </div>
    </div>
    <div class="row btn-row">
      <div class="col-md-12 col-sm-2" style="display: inline-flex;">
        <small>
          <span *ngIf="formData.age != null && formData.age < 5">Age must be at least 5</span>
          <span *ngIf="formData.age != null && formData.age > 110">Age must be no more than 110</span>
        </small>
      </div>
    </div>
  </form>
  <div *ngIf="roadTableData || trackTableData">
    <table class="agegradeTable">
      <thead>
        <th colspan="9" class="agegradeHeader top">Displaying time standards for a {{currentAge}} year old {{formData.sex === 'Male' ? 'man' : 'woman'}} in {{currentType === 'Road' ? 'road' : 'track'}} distances</th>
      </thead>
      <thead>
        <th class="agegradeHeader bottom">Distances ({{currentType === 'Road' ? 'road' : 'track'}})</th>
        <th colspan="2" class="agegradeHeader bottom">70% Time and Pace <i class="ageregional fa fa-star"></i></th>
        <th colspan="2" class="agegradeHeader bottom">80% Time and Pace <i class="agenational fa fa-star"></i></th>
        <th colspan="2" class="agegradeHeader bottom">90% Time and Pace <i class="ageworld fa fa-star"></i></th>
        <th colspan="2" class="agegradeHeader bottom">Calculate your age-grade %</th>
      </thead>
      <tbody>
        <tr class="agegradeRow" *ngFor="let entry of distanceEntries">
          <td class="agegradeCell distanceName nowrap">{{(entry.key | racenameToDistance)?.name}}</td>
          <td class="agegradeCell time">{{entry.value*100/0.70 | secondsToTimeString}}</td>
          <td class="agegradeCell pace">{{(entry.key | racenameToDistance)?.miles | milesToPace:entry.value*100/0.70}} <small class="resultPaceTxt">min/mi</small></td>
          <td class="agegradeCell time">{{entry.value*100/0.80 | secondsToTimeString}}</td>
          <td class="agegradeCell pace">{{(entry.key | racenameToDistance)?.miles | milesToPace:entry.value*100/0.80}} <small class="resultPaceTxt">min/mi</small></td>
          <td class="agegradeCell time">{{entry.value*100/0.90 | secondsToTimeString}}</td>
          <td class="agegradeCell pace">{{(entry.key | racenameToDistance)?.miles | milesToPace:entry.value*100/0.90}} <small class="resultPaceTxt">min/mi</small></td>
          <td class="agegradeCell customtime nowrap">
            <input type="number" min="0" style="width: 29px;" [(ngModel)]="time.hours" onlyDigits class="text-left" placeholder="0">:<input
              type="number" min="0" style="width: 29px;" [(ngModel)]="time.minutes" onlyDigitsForMinSec class="text-left" placeholder="0">:<input
              type="number" min="0" style="width: 29px;" [(ngModel)]="time.seconds" onlyDigitsForMinSec class="text-left" placeholder="0">
          </td>
          <td class="agegradeCell custompace">
            <div *ngIf="time && (time.seconds != null || time.minutes != null || time.hours != null)" class="resultPaceTxt">
              {{time | timeToAgeGrade:entry.value:true}}
              <i *ngIf="getAgeGradeValue(time, entry.value) >= 70 && getAgeGradeValue(time, entry.value) < 80" class="ageregional fa fa-star"></i>
              <i *ngIf="getAgeGradeValue(time, entry.value) >= 80 && getAgeGradeValue(time, entry.value) < 90" class="agenational fa fa-star"></i>
              <i *ngIf="getAgeGradeValue(time, entry.value) >= 90" class="ageworld fa fa-star"></i>
              <span><div>{{(entry.key | racenameToDistance)?.miles | milesAndTimeToPace:time}} <small class="resultPaceTxt">min/mi</small></div></span>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
  `
})
export class AgeGradeComponent implements OnInit {
  formData: any = {};
  user: any = null;
  currentType = 'Road';
  currentAge = 0;
  roadTableData: any = null;
  trackTableData: any = null;
  time: TimeInput = {};
  distanceEntries: Array<{ key: string; value: number }> = [];

  private readonly STORAGE_KEY = 'mcrrcApp.tools.agegrade.options';

  constructor(
    private authState: AuthStateService,
    private utilsService: UtilsService
  ) {}

  ngOnInit(): void {
    this.user = this.authState.isLoggedIn() || null;
    this.authState.user$.subscribe(user => { this.user = user; });

    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        this.formData = JSON.parse(saved);
        if (this.formData.age && this.formData.sex) {
          this.submitForm();
        }
      } catch { /* ignore */ }
    }
  }

  onAgeChange(): void {
    if (this.formData.age >= 5 && this.formData.age <= 110 && this.formData.sex) {
      this.submitForm();
    }
  }

  selectMyInfo(): void {
    if (this.user?.member?.dateofbirth && this.user?.member?.sex) {
      this.formData.age = this.utilsService.calculateAge(this.user.member.dateofbirth);
      this.formData.sex = this.user.member.sex;
      this.submitForm();
    }
  }

  submitForm(): void {
    if (this.formData.age >= 5 && this.formData.age <= 110 && this.formData.sex) {
      this.utilsService.getAgeGrade({
        sex: this.formData.sex,
        surface: this.formData.surface,
        age: this.formData.age
      }).then((agegrade: any) => {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.formData));
        this.roadTableData = agegrade[0];
        this.trackTableData = agegrade[1];
        if (!this.roadTableData) {
          this.currentType = 'Track';
        } else if (!this.trackTableData) {
          this.currentType = 'Road';
        }
        this.currentAge = this.formData.age;
        this.updateDistanceEntries();
      });
    }
  }

  switchType(): void {
    this.currentType = this.currentType === 'Road' ? 'Track' : 'Road';
    this.updateDistanceEntries();
  }

  hasOtherType(): boolean {
    if (this.currentType === 'Road' && this.trackTableData) return true;
    if (this.currentType === 'Track' && this.roadTableData) return true;
    return false;
  }

  updateDistanceEntries(): void {
    const data = this.currentType === 'Road' ? this.roadTableData : this.trackTableData;
    if (!data) {
      this.distanceEntries = [];
      return;
    }
    const keys = Object.keys(data);
    this.distanceEntries = keys.slice(5).map(key => ({ key, value: data[key] }));
  }

  getAgeGradeValue(time: TimeInput, ref: number): number {
    const timeInSeconds = (time.hours ? time.hours * 3600 : 0) +
                          (time.minutes ? time.minutes * 60 : 0) +
                          (time.seconds ? time.seconds : 0);
    if (timeInSeconds === 0) return 0;
    return ref / timeInSeconds * 100;
  }
}
