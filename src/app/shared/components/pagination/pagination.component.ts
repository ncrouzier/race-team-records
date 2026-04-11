import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pagination',
  imports: [CommonModule],
  template: `
    <nav *ngIf="totalPages > 1">
      <ul class="pagination">
        <li [class.disabled]="currentPage <= 1">
          <a (click)="previousPage()" class="hoverhand">&laquo;</a>
        </li>
        <li *ngFor="let page of visiblePages" [class.active]="page === currentPage" [class.disabled]="page === -1">
          <a *ngIf="page !== -1" (click)="goToPage(page)" class="hoverhand">{{ page }}</a>
          <span *ngIf="page === -1">...</span>
        </li>
        <li [class.disabled]="currentPage >= totalPages">
          <a (click)="nextPage()" class="hoverhand">&raquo;</a>
        </li>
      </ul>
    </nav>
  `
})
export class PaginationComponent implements OnChanges {
  @Input() totalItems = 0;
  @Input() itemsPerPage = 10;
  @Input() currentPage = 1;
  @Output() pageChange = new EventEmitter<number>();

  totalPages = 0;
  visiblePages: number[] = [];

  ngOnChanges(): void {
    this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
    this.buildVisiblePages();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.pageChange.emit(page);
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) this.goToPage(this.currentPage - 1);
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) this.goToPage(this.currentPage + 1);
  }

  private buildVisiblePages(): void {
    const pages: number[] = [];
    const total = this.totalPages;
    const current = this.currentPage;

    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push(-1); // ellipsis
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (current < total - 2) pages.push(-1); // ellipsis
      pages.push(total);
    }
    this.visiblePages = pages;
  }
}
