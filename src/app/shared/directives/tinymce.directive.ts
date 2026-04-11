import { Directive, ElementRef, Input, OnDestroy, AfterViewInit, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

declare var tinymce: any;

@Directive({
  selector: '[appTinymce]',
  standalone: true,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => TinymceDirective),
    multi: true
  }]
})
export class TinymceDirective implements AfterViewInit, OnDestroy, ControlValueAccessor {
  @Input() appTinymce: any = {}; // TinyMCE config object

  private editor: any = null;
  private value = '';
  private onChange: (val: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private el: ElementRef) {}

  ngAfterViewInit(): void {
    const config = {
      ...this.appTinymce,
      target: this.el.nativeElement,
      setup: (editor: any) => {
        this.editor = editor;
        editor.on('init', () => {
          if (this.value) {
            editor.setContent(this.value);
          }
        });
        editor.on('change keyup', () => {
          const content = editor.getContent();
          this.value = content;
          this.onChange(content);
        });
        editor.on('blur', () => {
          this.onTouched();
        });
      }
    };
    tinymce.init(config);
  }

  ngOnDestroy(): void {
    if (this.editor) {
      tinymce.remove(this.editor);
      this.editor = null;
    }
  }

  writeValue(val: string): void {
    this.value = val || '';
    if (this.editor) {
      this.editor.setContent(this.value);
    }
  }

  registerOnChange(fn: (val: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
}
