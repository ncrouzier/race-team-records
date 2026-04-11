import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-race-type-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop fade in" *ngIf="visible" (click)="cancel()"></div>
    <div class="modal fade in" *ngIf="visible" style="display: block;" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <button type="button" class="close" (click)="cancel()">&times;</button>
            <h4 class="modal-title">{{ raceType ? 'Edit' : 'Add' }} Race Type</h4>
          </div>
          <div class="modal-body">
            <form>
              <div class="form-group">
                <label>Name</label>
                <input type="text" class="form-control" [(ngModel)]="formData.name" name="name" required>
              </div>
              <div class="form-group">
                <label>Surface</label>
                <select class="form-control" [(ngModel)]="formData.surface" name="surface">
                  <option *ngFor="let s of surfaceOptions" [value]="s">{{ s }}</option>
                </select>
              </div>
              <div class="form-group">
                <div class="checkbox">
                  <label>
                    <input type="checkbox" [(ngModel)]="formData.hasAgeGradedInfo" name="hasAgeGradedInfo">
                    Has Age Graded Info
                  </label>
                </div>
              </div>
              <div class="form-group">
                <div class="checkbox">
                  <label>
                    <input type="checkbox" [(ngModel)]="formData.isVariable" name="isVariable">
                    Variable Distance
                  </label>
                </div>
              </div>
              <div *ngIf="!formData.isVariable">
                <div class="form-group">
                  <label>Meters</label>
                  <input type="number" class="form-control" [(ngModel)]="formData.meters" name="meters"
                         (ngModelChange)="onMetersChange()">
                </div>
                <div class="form-group">
                  <label>Miles</label>
                  <input type="number" class="form-control" [(ngModel)]="formData.miles" name="miles" step="any"
                         (ngModelChange)="onMilesChange()">
                </div>
                <div class="form-group">
                  <div class="checkbox">
                    <label>
                      <input type="checkbox" [(ngModel)]="autoConvert" name="autoConvert">
                      Auto-convert between meters and miles
                    </label>
                  </div>
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-default" (click)="cancel()">Cancel</button>
            <button class="btn btn-primary" (click)="save()">{{ raceType ? 'Save Changes' : 'Add Race Type' }}</button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class RaceTypeModalComponent implements OnChanges {
  @Input() raceType: any = null;
  @Input() visible = false;
  @Output() saved = new EventEmitter<any>();
  @Output() cancelled = new EventEmitter<void>();

  formData: any = {};
  autoConvert = true;

  surfaceOptions: string[] = ['road', 'track', 'trail', 'ultra', 'other', 'multiple', 'pool', 'open water'];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible) {
      this.initForm();
    }
  }

  private initForm(): void {
    if (this.raceType) {
      this.formData = {
        name: this.raceType.name || '',
        surface: this.raceType.surface || 'road',
        hasAgeGradedInfo: this.raceType.hasAgeGradedInfo || false,
        isVariable: this.raceType.isVariable || false,
        meters: this.raceType.meters || null,
        miles: this.raceType.miles || null
      };
    } else {
      this.formData = {
        name: '',
        surface: 'road',
        hasAgeGradedInfo: false,
        isVariable: false,
        meters: null,
        miles: null
      };
    }
    this.autoConvert = true;
  }

  onMetersChange(): void {
    if (this.autoConvert && this.formData.meters != null) {
      this.formData.miles = +(this.formData.meters * 0.000621371).toFixed(6);
    }
  }

  onMilesChange(): void {
    if (this.autoConvert && this.formData.miles != null) {
      this.formData.meters = +(this.formData.miles * 1609.344).toFixed(2);
    }
  }

  save(): void {
    if (this.formData.isVariable) {
      this.formData.meters = null;
      this.formData.miles = null;
    }
    this.saved.emit({ ...this.formData });
  }

  cancel(): void {
    this.cancelled.emit();
  }
}
