import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-race-photos',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span *ngIf="photoLinks.length === 1" style="margin-left: 5px;">
      <a [href]="photoLinks[0].url" target="_blank" class="hoverhand" [title]="photoLinks[0].label || 'Photos'">
        <i class="fa fa-camera race-photos-icon"></i>
      </a>
    </span>
    <span *ngIf="photoLinks.length > 1" style="margin-left: 5px; display: inline-block; position: relative;"
          (click)="dropdownOpen = !dropdownOpen; $event.stopPropagation()">
      <a class="hoverhand" title="Race Photos">
        <i class="fa fa-camera race-photos-icon"></i>
        <span class="caret" style="margin-left: 2px;"></span>
      </a>
      <ul *ngIf="dropdownOpen" class="dropdown-menu" style="display: block;">
        <li *ngFor="let link of photoLinks">
          <a [href]="link.url" target="_blank"><i class="fa fa-external-link"></i> {{link.label || 'Photos'}}</a>
        </li>
      </ul>
    </span>
  `
})
export class RacePhotosComponent implements OnChanges {
  @Input() race: any;
  photoLinks: any[] = [];
  dropdownOpen = false;

  ngOnChanges(): void {
    this.photoLinks = this.race?.photoLinks?.filter((l: any) => l.url?.trim()) || [];
  }
}
