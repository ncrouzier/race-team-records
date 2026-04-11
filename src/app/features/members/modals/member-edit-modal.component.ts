import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-member-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop fade in" *ngIf="visible" (click)="cancel()"></div>
    <div class="modal fade in" *ngIf="visible" style="display: block;" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <button type="button" class="close" (click)="cancel()">&times;</button>
            <h4 class="modal-title">{{ editMode ? 'Edit' : 'Add' }} Member</h4>
          </div>
          <div class="modal-body">
            <form>
              <div class="row">
                <div class="col-md-6">
                  <div class="form-group">
                    <label>First Name</label>
                    <input type="text" class="form-control" [(ngModel)]="formData.firstname" name="firstname" required>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="form-group">
                    <label>Last Name</label>
                    <input type="text" class="form-control" [(ngModel)]="formData.lastname" name="lastname" required>
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col-md-6">
                  <div class="form-group">
                    <label>Username</label>
                    <input type="text" class="form-control" [(ngModel)]="formData.username" name="username" required>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="form-group">
                    <label>Sex</label>
                    <select class="form-control" [(ngModel)]="formData.sex" name="sex">
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                </div>
              </div>
              <div class="row">
                <div class="col-md-6">
                  <div class="form-group">
                    <label>Date of Birth</label>
                    <input type="date" class="form-control" [(ngModel)]="formData.dateofbirthStr" name="dob">
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="form-group">
                    <label>Member Status</label>
                    <select class="form-control" [(ngModel)]="formData.memberStatus" name="memberStatus">
                      <option value="current">Current</option>
                      <option value="past">Past</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Membership Dates -->
              <div class="form-group">
                <label>Membership Dates</label>
                <div *ngFor="let period of formData.membershipDates; let i = index" class="row" style="margin-bottom: 5px;">
                  <div class="col-md-5">
                    <input type="date" class="form-control" [(ngModel)]="period.startStr" [name]="'start' + i">
                  </div>
                  <div class="col-md-5">
                    <input type="date" class="form-control" [(ngModel)]="period.endStr" [name]="'end' + i" placeholder="Present">
                  </div>
                  <div class="col-md-2">
                    <button class="btn btn-xs btn-danger" (click)="formData.membershipDates.splice(i, 1)"><i class="fa fa-times"></i></button>
                  </div>
                </div>
                <button class="btn btn-xs btn-default" (click)="addMembershipDates()"><i class="fa fa-plus"></i> Add Period</button>
              </div>

              <!-- Alternate Names -->
              <div class="form-group">
                <label>Alternate Full Names</label>
                <div *ngFor="let name of formData.alternateFullNames; let i = index" style="margin-bottom: 3px;">
                  <span>{{ name }}</span>
                  <button class="btn btn-xs btn-danger" (click)="formData.alternateFullNames.splice(i, 1)"><i class="fa fa-times"></i></button>
                </div>
                <div class="input-group" style="max-width: 400px;">
                  <input type="text" class="form-control" [(ngModel)]="newAlternateName" name="newAltName" placeholder="Add alternate name">
                  <span class="input-group-btn">
                    <button class="btn btn-default" (click)="addAlternateName()"><i class="fa fa-plus"></i></button>
                  </span>
                </div>
              </div>

              <!-- Achievements -->
              <div class="form-group">
                <label>Achievements</label>
                <div *ngFor="let ach of formData.achievements; let i = index" class="row" style="margin-bottom: 5px;">
                  <div class="col-md-2">
                    <input type="text" class="form-control" [(ngModel)]="ach.name" [name]="'achName' + i" placeholder="Name">
                  </div>
                  <div class="col-md-4">
                    <input type="text" class="form-control" [(ngModel)]="ach.text" [name]="'achText' + i" placeholder="Description text">
                  </div>
                  <div class="col-md-3">
                    <input type="text" class="form-control" [(ngModel)]="ach.valueJson" [name]="'achVal' + i" placeholder='{"img":"/images/..."}'>
                  </div>
                  <div class="col-md-2">
                    <button class="btn btn-xs btn-info" (click)="setAchievementPreset(i, 'ROY')" title="ROY preset">ROY</button>
                    <button class="btn btn-xs btn-info" (click)="setAchievementPreset(i, 'MUTROY')" title="MUTROY preset">MUTROY</button>
                  </div>
                  <div class="col-md-1">
                    <button class="btn btn-xs btn-danger" (click)="formData.achievements.splice(i, 1)"><i class="fa fa-times"></i></button>
                  </div>
                </div>
                <button class="btn btn-xs btn-default" (click)="addAchievement()"><i class="fa fa-plus"></i> Add Achievement</button>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-default" (click)="cancel()">Cancel</button>
            <button class="btn btn-primary" (click)="save()">{{ editMode ? 'Save Changes' : 'Add Member' }}</button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class MemberEditModalComponent implements OnChanges {
  @Input() member: any = null; // null = add mode
  @Input() visible = false;
  @Output() saved = new EventEmitter<any>();
  @Output() cancelled = new EventEmitter<void>();

  formData: any = {};
  editMode = false;
  newAlternateName = '';

  private DEFAULT_ICONS: Record<string, any> = {
    'ROY': { img: '/images/roy.svg' },
    'MUTROY': { img: '/images/mutroy.svg' }
  };
  private DEFAULT_TEXT: Record<string, string> = {
    'ROY': 'Runner of the Year',
    'MUTROY': 'Mountain/Ultra/Trail Runner of the Year'
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible) {
      this.initForm();
    }
  }

  private initForm(): void {
    if (this.member) {
      this.editMode = true;
      this.formData = { ...this.member };
      this.formData.dateofbirthStr = this.toDateStr(this.member.dateofbirth);
      this.formData.membershipDates = (this.member.membershipDates || []).map((p: any) => ({
        ...p,
        startStr: this.toDateStr(p.start),
        endStr: p.end ? this.toDateStr(p.end) : ''
      }));
      if (!this.formData.alternateFullNames) this.formData.alternateFullNames = [];
      if (!this.formData.achievements) this.formData.achievements = [];
      this.formData.achievements.forEach((ach: any) => {
        ach.valueJson = ach.value ? JSON.stringify(ach.value) : '';
      });
    } else {
      this.editMode = false;
      const now = new Date();
      this.formData = {
        firstname: '', lastname: '', username: '', sex: 'Male',
        memberStatus: 'current',
        dateofbirthStr: this.toDateStr(now),
        membershipDates: [{ startStr: this.toDateStr(now), endStr: '' }],
        alternateFullNames: [],
        achievements: []
      };
    }
  }

  private toDateStr(d: any): string {
    if (!d) return '';
    const date = new Date(d);
    return date.toISOString().split('T')[0];
  }

  addMembershipDates(): void {
    if (!this.formData.membershipDates) this.formData.membershipDates = [];
    const now = this.toDateStr(new Date());
    this.formData.membershipDates.push({ startStr: now, endStr: now });
  }

  addAlternateName(): void {
    if (this.newAlternateName && this.newAlternateName.trim()) {
      if (!this.formData.alternateFullNames) this.formData.alternateFullNames = [];
      this.formData.alternateFullNames.push(this.newAlternateName.trim());
      this.newAlternateName = '';
    }
  }

  addAchievement(): void {
    this.formData.achievements.push({ name: '', text: '', value: null, valueJson: '' });
  }

  setAchievementPreset(index: number, presetName: string): void {
    const ach = this.formData.achievements[index];
    ach.name = presetName;
    ach.text = this.DEFAULT_TEXT[presetName];
    ach.value = this.DEFAULT_ICONS[presetName];
    ach.valueJson = JSON.stringify(this.DEFAULT_ICONS[presetName]);
  }

  save(): void {
    // Convert date strings back
    this.formData.dateofbirth = this.formData.dateofbirthStr ? new Date(this.formData.dateofbirthStr + 'T00:00:00Z') : null;
    this.formData.membershipDates = (this.formData.membershipDates || []).map((p: any) => ({
      start: p.startStr ? new Date(p.startStr + 'T00:00:00Z') : null,
      end: p.endStr ? new Date(p.endStr + 'T00:00:00Z') : undefined
    }));
    // Parse achievement values
    if (this.formData.achievements) {
      this.formData.achievements.forEach((ach: any) => {
        if (ach.valueJson && ach.valueJson.trim()) {
          try { ach.value = JSON.parse(ach.valueJson); } catch (e) { ach.value = ach.valueJson; }
        } else { ach.value = null; }
        delete ach.valueJson;
      });
      this.formData.achievements = this.formData.achievements.filter((ach: any) => ach.name || ach.text);
    }
    // Clean up temp fields
    delete this.formData.dateofbirthStr;
    this.saved.emit(this.formData);
  }

  cancel(): void {
    this.cancelled.emit();
  }
}
