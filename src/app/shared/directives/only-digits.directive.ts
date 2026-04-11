import { Directive, ElementRef, HostListener, Input, Optional } from '@angular/core';
import { NgControl } from '@angular/forms';

@Directive({ selector: '[onlyDigits]', standalone: true })
export class OnlyDigitsDirective {
  @Input() dirMin?: string;
  @Input() dirMax?: string;

  constructor(private el: ElementRef, @Optional() private control: NgControl) {}

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    // Allow: backspace, delete, tab, escape, enter, home, end, arrows
    if (['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'Home', 'End',
         'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      return;
    }
    // Allow Ctrl/Cmd + A, C, V, X
    if ((event.ctrlKey || event.metaKey) && ['a', 'c', 'v', 'x'].includes(event.key.toLowerCase())) {
      return;
    }
    // Block non-digit keys
    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
    }
  }

  @HostListener('input')
  onInput(): void {
    let val = this.el.nativeElement.value;
    if (val === '') {
      this.control.control?.setValue(null, { emitEvent: true });
      return;
    }
    let digits = parseInt(val.replace(/[^0-9]/g, ''), 10);
    if (isNaN(digits)) {
      this.control.control?.setValue(null, { emitEvent: true });
      return;
    }
    const min = this.dirMin ? parseInt(this.dirMin, 10) : null;
    const max = this.dirMax ? parseInt(this.dirMax, 10) : null;
    if (min != null && digits < min) digits = min;
    if (max != null && digits > max) digits = max;
    this.el.nativeElement.value = digits;
    this.control.control?.setValue(digits, { emitEvent: true });
  }
}
