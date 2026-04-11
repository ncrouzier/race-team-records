import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-member-search',
  imports: [CommonModule, FormsModule],
  template: `
    <div style="position: relative;">
      <input type="text" class="form-control" [placeholder]="placeholder"
             [(ngModel)]="searchQuery"
             (focus)="showDropdown = true"
             (blur)="onBlur()"
             (ngModelChange)="filterMembers()">
      <div *ngIf="showDropdown && filteredMembers.length > 0"
           class="dropdown-menu" style="display: block; max-height: 300px; overflow-y: auto; width: 100%;">
        <a *ngFor="let member of filteredMembers" class="dropdown-item hoverhand"
           style="display: block; padding: 5px 10px; cursor: pointer;"
           [class.text-muted]="member.memberStatus === 'past'"
           (mousedown)="selectMember(member)">
          <strong>{{ member.firstname }} {{ member.lastname }}</strong>
          <span *ngIf="member.memberStatus === 'past'" class="text-muted"> (past)</span>
        </a>
      </div>
    </div>
  `
})
export class MemberSearchComponent {
  @Input() members: any[] = [];
  @Input() placeholder = 'Search members...';
  @Input() selectedMember: any = null;
  @Output() memberSelected = new EventEmitter<any>();

  searchQuery = '';
  showDropdown = false;
  filteredMembers: any[] = [];

  filterMembers(): void {
    if (!this.searchQuery || this.searchQuery.length < 1) {
      this.filteredMembers = [];
      return;
    }
    const q = this.searchQuery.toLowerCase();
    this.filteredMembers = this.members.filter(m => {
      const name = (m.firstname + ' ' + m.lastname).toLowerCase();
      return name.includes(q);
    }).slice(0, 20);
  }

  selectMember(member: any): void {
    this.searchQuery = member.firstname + ' ' + member.lastname;
    this.showDropdown = false;
    this.filteredMembers = [];
    this.memberSelected.emit(member);
  }

  onBlur(): void {
    setTimeout(() => { this.showDropdown = false; }, 200);
  }
}
