import { Component, Input, Output, EventEmitter, ElementRef, HostListener, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';

@Component({
  selector: 'app-typeahead-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => TypeaheadSelectComponent),
    multi: true
  }],
  template: `
    <div class="typeahead-select" [class.open]="isOpen">
      <div class="typeahead-input-wrapper" (click)="openDropdown()">
        <input type="text"
               class="form-control"
               [(ngModel)]="searchText"
               (ngModelChange)="onSearchChange()"
               (focus)="openDropdown()"
               (keydown)="onKeydown($event)"
               [placeholder]="selectedItem ? displayFn(selectedItem) : placeholder">
        <span class="typeahead-clear" *ngIf="selectedItem && allowClear" (click)="clearSelection($event)">
          <i class="fa fa-times"></i>
        </span>
        <span class="typeahead-arrow">
          <i class="fa fa-caret-down"></i>
        </span>
      </div>
      <div class="typeahead-dropdown" *ngIf="isOpen && filteredItems.length > 0">
        <div class="typeahead-option"
             *ngFor="let item of filteredItems; let i = index"
             [class.active]="i === highlightedIndex"
             (mouseenter)="highlightedIndex = i"
             (mousedown)="selectItem(item, $event)">
          <span [innerHTML]="highlightMatch(displayFn(item), searchText)"></span>
        </div>
      </div>
      <div class="typeahead-dropdown" *ngIf="isOpen && filteredItems.length === 0 && searchText">
        <div class="typeahead-no-results">No results found</div>
      </div>
    </div>
  `,
  styles: [`
    .typeahead-select { position: relative; }
    .typeahead-input-wrapper { position: relative; cursor: pointer; }
    .typeahead-input-wrapper input { padding-right: 40px; cursor: pointer; }
    .typeahead-input-wrapper input:focus { cursor: text; }
    .typeahead-clear { position: absolute; right: 25px; top: 50%; transform: translateY(-50%); cursor: pointer; color: #999; z-index: 1; }
    .typeahead-clear:hover { color: #333; }
    .typeahead-arrow { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #999; pointer-events: none; }
    .typeahead-dropdown {
      position: absolute; top: 100%; left: 0; right: 0; z-index: 1050;
      max-height: 250px; overflow-y: auto;
      background: #fff; border: 1px solid #ccc; border-top: none;
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }
    .typeahead-option {
      padding: 6px 10px; cursor: pointer; font-size: 13px;
    }
    .typeahead-option:hover, .typeahead-option.active { background-color: #3875d7; color: #fff; }
    .typeahead-option.active :deep(.highlight) { color: #fff; }
    .typeahead-no-results { padding: 8px 10px; color: #999; font-style: italic; font-size: 13px; }
    :host ::ng-deep .highlight { font-weight: bold; }
  `]
})
export class TypeaheadSelectComponent implements ControlValueAccessor {
  @Input() items: any[] = [];
  @Input() placeholder = 'Select...';
  @Input() displayFn: (item: any) => string = (item) => String(item);
  @Input() searchFields: string[] = [];
  @Input() allowClear = true;
  /** When true, selection fires itemSelected and clears (for "add to filter" pattern) */
  @Input() fireAndClear = false;

  @Output() itemSelected = new EventEmitter<any>();

  searchText = '';
  isOpen = false;
  highlightedIndex = 0;
  filteredItems: any[] = [];
  selectedItem: any = null;

  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private elRef: ElementRef) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.closeDropdown();
    }
  }

  writeValue(value: any): void {
    this.selectedItem = value;
    this.searchText = '';
  }

  registerOnChange(fn: any): void { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }

  openDropdown(): void {
    this.isOpen = true;
    this.highlightedIndex = 0;
    this.filterItems();
  }

  closeDropdown(): void {
    this.isOpen = false;
    this.searchText = '';
    this.onTouched();
  }

  onSearchChange(): void {
    this.highlightedIndex = 0;
    this.filterItems();
  }

  filterItems(): void {
    if (!this.searchText) {
      this.filteredItems = this.items || [];
      return;
    }
    const search = this.searchText.toLowerCase();
    this.filteredItems = (this.items || []).filter(item => {
      if (this.searchFields.length > 0) {
        return this.searchFields.some(field => {
          const val = item[field];
          return val && String(val).toLowerCase().includes(search);
        });
      }
      return this.displayFn(item).toLowerCase().includes(search);
    });
  }

  selectItem(item: any, event?: MouseEvent): void {
    if (event) event.preventDefault();

    if (this.fireAndClear) {
      this.itemSelected.emit(item);
      this.searchText = '';
      this.isOpen = false;
      return;
    }

    this.selectedItem = item;
    this.searchText = '';
    this.isOpen = false;
    this.onChange(item);
    this.itemSelected.emit(item);
  }

  clearSelection(event: MouseEvent): void {
    event.stopPropagation();
    this.selectedItem = null;
    this.searchText = '';
    this.onChange(null);
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.isOpen) {
      if (event.key === 'ArrowDown' || event.key === 'Enter') {
        this.openDropdown();
        event.preventDefault();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        this.highlightedIndex = Math.min(this.highlightedIndex + 1, this.filteredItems.length - 1);
        event.preventDefault();
        break;
      case 'ArrowUp':
        this.highlightedIndex = Math.max(this.highlightedIndex - 1, 0);
        event.preventDefault();
        break;
      case 'Enter':
        if (this.filteredItems[this.highlightedIndex]) {
          this.selectItem(this.filteredItems[this.highlightedIndex]);
        }
        event.preventDefault();
        break;
      case 'Escape':
        this.closeDropdown();
        event.preventDefault();
        break;
    }
  }

  highlightMatch(text: string, search: string): string {
    if (!search) return text;
    const regex = new RegExp('(' + search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
  }
}
