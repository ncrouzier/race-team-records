import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TinymceDirective } from '../../../shared/directives/tinymce.directive';

@Component({
  selector: 'app-bio-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TinymceDirective],
  template: `
    <div class="modal-backdrop fade in" *ngIf="visible" (click)="cancel()"></div>
    <div class="modal fade in" *ngIf="visible" style="display: block;" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <button type="button" class="close" (click)="cancel()">&times;</button>
            <h4 class="modal-title">Edit Bio</h4>
          </div>
          <div class="modal-body">
            <div *ngFor="let field of bioFields" class="form-group">
              <label>{{ field.label }}</label>
              <textarea [appTinymce]="field.options" [(ngModel)]="formData[field.key]" [name]="field.key"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-default" (click)="cancel()">Cancel</button>
            <button class="btn btn-primary" (click)="saveBio()">Save Bio</button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class BioEditModalComponent implements OnChanges {
  @Input() member: any = null;
  @Input() visible = false;
  @Output() saved = new EventEmitter<string>();
  @Output() cancelled = new EventEmitter<void>();

  formData: Record<string, string> = {};

  private simpleOptions = {
    forced_root_block: false, plugins: 'link image',
    toolbar: 'bold italic underline | link image',
    menubar: false, statusbar: false, height: 80, branding: false,
    base_url: '/libs/tinymce', suffix: '.min',
    content_style: 'body { margin: 0.5em; }'
  };
  private mediumOptions = { ...this.simpleOptions, height: 120 };
  private tallOptions = { ...this.simpleOptions, height: 150 };
  private runningLogsOptions = {
    ...this.simpleOptions,
    toolbar: 'bold italic underline | link image | strava garmin'
  };

  bioFields = [
    { key: 'occupation', label: 'Occupation', options: this.simpleOptions },
    { key: 'college', label: 'College/Grad School Attended', options: this.simpleOptions },
    { key: 'hometown', label: 'Hometown', options: this.simpleOptions },
    { key: 'favoriteRace', label: 'Favorite race', options: this.simpleOptions },
    { key: 'bestMoment', label: 'Best running moment', options: this.mediumOptions },
    { key: 'goals', label: 'Running goals', options: this.mediumOptions },
    { key: 'gear', label: "Running gear I can't live without", options: this.simpleOptions },
    { key: 'funFact', label: 'Fun fact', options: this.mediumOptions },
    { key: 'prs', label: 'All Time PRs', options: this.tallOptions },
    { key: 'runningLogs', label: 'Running logs', options: this.runningLogsOptions }
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible && this.member) {
      const parsed = this.parseBio(this.member.bio || '');
      this.formData = {};
      this.bioFields.forEach(f => { this.formData[f.key] = parsed[f.key] || ''; });
    }
  }

  private parseBio(html: string): Record<string, string> {
    const result: Record<string, string> = {};
    if (!html) return result;
    for (const field of this.bioFields) {
      const escaped = field.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = '<span class="bold">' + escaped + ':?\\s*</span>';
      const regex = new RegExp(pattern, 'i');
      const match = html.match(regex);
      if (match) {
        const startIdx = html.indexOf(match[0]) + match[0].length;
        const nextBold = html.indexOf('<span class="bold">', startIdx);
        let content = nextBold > -1 ? html.substring(startIdx, nextBold) : html.substring(startIdx);
        content = content.replace(/^(\s|<br\s*\/?>|<\/?div>|<\/?p>)+/gi, '');
        content = content.replace(/(\s|<br\s*\/?>|<\/?div>|<\/?p>)+$/gi, '');
        result[field.key] = content;
      }
    }
    return result;
  }

  private assembleBio(): string {
    const parts: string[] = [];
    for (const field of this.bioFields) {
      const value = (this.formData[field.key] || '').trim();
      if (value) {
        if (field.key === 'runningLogs' || field.key === 'prs') {
          parts.push('<br><span class="bold">' + field.label + ': </span><br>');
          parts.push(value + '<br>');
        } else {
          parts.push('<span class="bold">' + field.label + ': </span>' + value + '<br>');
        }
      }
    }
    return parts.join('\n');
  }

  saveBio(): void {
    this.saved.emit(this.assembleBio());
  }

  cancel(): void {
    this.cancelled.emit();
  }
}
