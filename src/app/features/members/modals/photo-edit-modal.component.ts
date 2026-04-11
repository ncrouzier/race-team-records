import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-photo-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop fade in" *ngIf="visible" (click)="cancel()"></div>
    <div class="modal fade in" *ngIf="visible" style="display: block;" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <button type="button" class="close" (click)="cancel()">&times;</button>
            <h4 class="modal-title">Edit Photo - {{ memberName }}</h4>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Picture URL</label>
              <input type="text" class="form-control" [(ngModel)]="pictureLink" name="pictureLink" placeholder="Enter image URL">
            </div>
            <div *ngIf="pictureLink" class="text-center" style="margin-top: 10px;">
              <img [src]="pictureLink" style="max-width: 100%; max-height: 300px;" alt="Preview">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-default" (click)="cancel()">Cancel</button>
            <button class="btn btn-primary" (click)="savePhoto()">Save Photo</button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class PhotoEditModalComponent implements OnChanges {
  @Input() member: any = null;
  @Input() visible = false;
  @Output() saved = new EventEmitter<string>();
  @Output() cancelled = new EventEmitter<void>();

  pictureLink = '';
  memberName = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible && this.member) {
      this.pictureLink = this.member.pictureLink || '';
      this.memberName = this.member.firstname + ' ' + this.member.lastname;
    }
  }

  savePhoto(): void {
    this.saved.emit(this.pictureLink);
  }

  cancel(): void {
    this.cancelled.emit();
  }
}
