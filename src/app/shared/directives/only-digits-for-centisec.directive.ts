import { Directive, ElementRef, HostListener, Optional } from '@angular/core';
import { NgControl } from '@angular/forms';

@Directive({ selector: '[onlyDigitsForCentisec]', standalone: true })
export class OnlyDigitsForCentisecDirective {
  constructor(private el: ElementRef, @Optional() private control: NgControl) {}

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'Home', 'End',
         'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      return;
    }
    if ((event.ctrlKey || event.metaKey) && ['a', 'c', 'v', 'x'].includes(event.key.toLowerCase())) {
      return;
    }
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
    if (digits < 0) digits = 0;
    if (digits > 99) digits = 99;
    this.el.nativeElement.value = digits;
    this.control.control?.setValue(digits, { emitEvent: true });
  }
}
