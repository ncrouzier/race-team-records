import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private containerEl: HTMLElement | null = null;

  private getContainer(): HTMLElement {
    if (!this.containerEl) {
      this.containerEl = document.createElement('div');
      this.containerEl.style.cssText = 'position:fixed;top:10px;right:10px;z-index:10000;max-width:350px;';
      document.body.appendChild(this.containerEl);
    }
    return this.containerEl;
  }

  private show(html: string, cssClass: string, duration = 2000): void {
    const container = this.getContainer();
    const el = document.createElement('div');
    el.className = cssClass;
    el.innerHTML = html;
    el.style.cssText = 'padding:10px 15px;margin-bottom:5px;border-radius:4px;font-size:12px;text-align:left;cursor:pointer;';
    if (cssClass === 'notify-message-success') {
      el.style.cssText += 'background:#dff0d8;color:#3c763d;border:1px solid #d6e9c6;';
    } else {
      el.style.cssText += 'background:#f2dede;color:#a94442;border:1px solid #ebccd1;';
    }
    el.addEventListener('click', () => el.remove());
    container.appendChild(el);
    setTimeout(() => el.remove(), duration);
  }

  showNotifiction(successful: boolean, text: string): void {
    const html = '<div style="text-align: left; font-size: 12px;">' + text + '</div>';
    this.show(html, successful ? 'notify-message-success' : 'notify-message-failure');
  }

  clipboardCopyNotifiction(successful: boolean, data: string): void {
    const msg = successful
      ? 'Text copied to clipboard successfully! <BR>' + data
      : 'Error trying to copy to clipboard! <BR>' + data;
    const html = '<div style="text-align: left; font-size: 12px;">' + msg + '</div>';
    this.show(html, successful ? 'notify-message-success' : 'notify-message-failure');
  }
}
