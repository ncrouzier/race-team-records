import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

const BASE_VALUES = Array.from({ length: 11 }, (_, i) => 50 + i * 5);
const STORAGE_KEY = 'mcrrcApp.ageAdjustment.pace';

@Component({
  selector: 'app-temp-adjustment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="temp-adjustment-tool jumbotron">

  <div class="temp-adjustment-input-panel">
    <h2 class="mb-4">Pace Adjustment Calculator</h2>
    <div class="card">
      <div class="card-body">
        <form class="form-inline">
          <div class="form-group mr-4">
            <label for="tempInput" class="d-block mb-2 text-muted">Temperature (&deg;F)</label>
            <div class="input-group">
              <input id="tempInput" type="number" class="form-control"
                [(ngModel)]="inputTemp" [ngModelOptions]="{standalone: true}"
                [ngClass]="{'border-danger': inputError}" style="width: 100px;"
                (ngModelChange)="onTempChange()">
            </div>
          </div>
          <div class="form-group mr-4">
            <label for="dewInput" class="d-block mb-2 text-muted">Dew Point (&deg;F)</label>
            <div class="input-group">
              <input id="dewInput" type="number" class="form-control"
                [(ngModel)]="inputDew" [ngModelOptions]="{standalone: true}"
                [ngClass]="{'border-danger': inputError}" style="width: 100px;"
                (ngModelChange)="onDewChange()">
            </div>
          </div>
          <div class="form-group">
            <label for="paceInput" class="d-block mb-2 text-muted">Pace (min:sec)</label>
            <div class="input-group">
              <input id="paceInput" type="text" class="form-control"
                [(ngModel)]="pace" [ngModelOptions]="{standalone: true}" style="width: 120px;"
                placeholder="e.g., 7:30" (keydown)="adjustPace($event)"
                (ngModelChange)="onPaceChange()">
            </div>
          </div>
        </form>

        <div class="text-danger mt-2" *ngIf="inputError" style="font-size: 14px; font-weight: 500;">
          <i class="fa fa-exclamation-circle mr-2"></i>{{ inputError }}
        </div>

        <div class="mt-4 p-3 border rounded bg-light" *ngIf="!inputError">
          <label class="mb-0">
            Adjusted Pace: <strong>{{ adjustedPace }}</strong>
            <span *ngIf="adjustedPace !== null" class="ml-2" style="font-size: 1.5rem;">{{ paceEmoji }}</span>
          </label>
        </div>
      </div>
    </div>
  </div>

  <div class="table-responsive">
    <table class="table text-center">
      <thead class="thead-light">
        <tr>
          <th style="width: 120px;">Dew &darr; / Temp &rarr;</th>
          <th *ngFor="let colTemp of temperatures" [ngClass]="{
            'highlight-col': hoveredTemp === colTemp && hoveredDew !== null && hoveredTemp !== null && hoveredDew <= hoveredTemp
          }">{{ colTemp }}&deg;</th>
        </tr>
      </thead>
      <tr *ngFor="let rowDew of dews" [ngClass]="{
        'highlight-row': hoveredDew === rowDew && hoveredDew !== null && hoveredTemp !== null && hoveredDew <= hoveredTemp
      }">
        <th [ngClass]="{
          'highlight-row': hoveredDew === rowDew && hoveredDew !== null && hoveredTemp !== null && hoveredDew <= hoveredTemp
        }">{{ rowDew }}&deg;</th>
        <td *ngFor="let colTemp of temperatures"
          (mouseenter)="setHoveredCell(colTemp, rowDew)"
          (mouseleave)="clearHoveredCell()"
          (click)="setInputsFromCell(colTemp, rowDew)"
          [ngClass]="getCellClasses(colTemp, rowDew)"
          [title]="rowDew <= colTemp ? getCellTooltip(colTemp, rowDew) : ''">
          <span *ngIf="rowDew <= colTemp">{{ getAdjustment(colTemp, rowDew, false).short }}</span>
        </td>
      </tr>
    </table>
  </div>

  <div class="temp-adjustment-explainer">
    The above are the pace adjustment percentages to use for continuous runs.
    For repeat workouts such as 400's, 800's, or mile repeats,
    use half of the continuous run adjustment, as the body has a chance to cool somewhat during the recovery
    between repeats.
  </div>

  <p class="temp-adjustment-source-note">
    Pace adjustment guidance adapted from
    <a href="https://maximumperformancerunning.blogspot.com/2013/07/temperature-dew-point.html" target="_blank" rel="noopener">
      Maximum Performance Running: Temperature &amp; Dew Point
    </a>.
  </p>
</div>
  `
})
export class TempAdjustmentComponent implements OnInit {
  temperatures: number[] = BASE_VALUES.slice();
  dews: number[] = BASE_VALUES.slice();
  inputTemp: number | null = null;
  inputDew: number | null = null;
  pace = '';
  inputError: string | null = null;
  hoveredTemp: number | null = null;
  hoveredDew: number | null = null;
  adjustedPace: string | null = null;
  paceEmoji = '';

  private previousCustomTemp: number | null = null;
  private previousCustomDew: number | null = null;

  ngOnInit(): void {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        this.pace = JSON.parse(saved) || '';
      } catch {
        this.pace = saved || '';
      }
    }
  }

  onTempChange(): void {
    const temp = this.inputTemp != null ? Math.floor(this.inputTemp) : NaN;
    if (isNaN(temp) || this.inputDew == null) {
      this.inputDew = null;
      this.inputError = null;
      this.removeCustomValues();
    } else {
      this.isTempValid();
    }
    this.recalculate();
  }

  onDewChange(): void {
    if (this.inputDew != null) {
      this.isDewValid();
      if (this.inputError) {
        this.removeCustomValues();
      }
    } else {
      this.inputError = null;
      if (this.previousCustomTemp) {
        this.removeValue(this.temperatures, this.previousCustomTemp);
        this.previousCustomTemp = null;
      }
    }
    this.recalculate();
  }

  onPaceChange(): void {
    this.recalculate();
  }

  private recalculate(): void {
    const temp = this.inputTemp != null ? Math.floor(this.inputTemp) : NaN;
    const dew = this.inputDew != null ? Math.floor(this.inputDew) : NaN;
    const paceSec = this.parsePace(this.pace);

    if (!this.isTempValid() || !this.isDewValid()) {
      this.adjustedPace = null;
      this.paceEmoji = '';
      this.removeCustomValues();
      return;
    }

    if (paceSec !== null || this.pace === '') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.pace));
    }

    const bothValid = !isNaN(temp) && !isNaN(dew);

    if (bothValid && !BASE_VALUES.includes(temp)) {
      if (this.previousCustomTemp && this.previousCustomTemp !== temp) {
        this.removeValue(this.temperatures, this.previousCustomTemp);
      }
      this.insertSorted(this.temperatures, temp);
      this.previousCustomTemp = temp;
    } else if (this.previousCustomTemp && this.previousCustomTemp !== temp) {
      this.removeValue(this.temperatures, this.previousCustomTemp);
      this.previousCustomTemp = null;
    }

    if (bothValid && !BASE_VALUES.includes(dew)) {
      if (this.previousCustomDew && this.previousCustomDew !== dew) {
        this.removeValue(this.dews, this.previousCustomDew);
      }
      this.insertSorted(this.dews, dew);
      this.previousCustomDew = dew;
    } else if (this.previousCustomDew && this.previousCustomDew !== dew) {
      this.removeValue(this.dews, this.previousCustomDew);
      this.previousCustomDew = null;
    }

    if (!isNaN(temp) && !isNaN(dew) && dew <= temp) {
      const sum = temp + dew;
      const adj = this.getAdjustmentPercent(sum);
      if (adj !== null) {
        this.adjustedPace = this.getAdjustment(temp, dew, paceSec === null).long;
        this.paceEmoji = this.getPaceFeelingEmoji(sum);
      } else {
        this.adjustedPace = 'Not recommended to run hard.';
        this.paceEmoji = '\uD83D\uDC80';
      }
    } else {
      this.adjustedPace = null;
      this.paceEmoji = '';
    }
  }

  isTempValid(): boolean {
    const temp = this.inputTemp != null ? Math.floor(this.inputTemp) : NaN;
    if (isNaN(temp) && this.inputDew != null && this.inputTemp != null) {
      this.inputError = 'Please enter a valid temperature';
      return false;
    }
    this.inputError = null;
    return true;
  }

  isDewValid(): boolean {
    const dew = this.inputDew != null ? Math.floor(this.inputDew) : NaN;
    const temp = this.inputTemp != null ? Math.floor(this.inputTemp) : NaN;
    if (isNaN(dew) && this.inputTemp != null && this.inputDew != null) {
      this.inputError = 'Please enter a valid dew point';
      return false;
    }
    if (!isNaN(dew) && !isNaN(temp) && dew > temp) {
      this.inputError = 'Dew point cannot be higher than temperature';
      return false;
    }
    this.inputError = null;
    return true;
  }

  setHoveredCell(temp: number, dew: number): void {
    if (dew <= temp) {
      this.hoveredTemp = temp;
      this.hoveredDew = dew;
    } else {
      this.hoveredTemp = null;
      this.hoveredDew = null;
    }
  }

  clearHoveredCell(): void {
    this.hoveredTemp = null;
    this.hoveredDew = null;
  }

  setInputsFromCell(temp: number, dew: number): void {
    if (dew <= temp) {
      this.inputTemp = temp;
      this.inputDew = dew;
      this.recalculate();
    }
  }

  adjustPace(event: KeyboardEvent): void {
    const paceSec = this.parsePace(this.pace);
    if (paceSec === null) return;

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.pace = this.formatPace(paceSec + 1);
      this.recalculate();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (paceSec > 1) {
        this.pace = this.formatPace(paceSec - 1);
        this.recalculate();
      }
    }
  }

  getAdjustment(temp: number, dew: number, showPercentage?: boolean): { short: string; long: string } {
    if (dew > temp) return { short: '', long: '' };

    const sum = temp + dew;
    const paceSec = this.parsePace(this.pace);

    if (paceSec !== null && !showPercentage) {
      const adj = this.getAdjustmentPercent(sum);
      if (adj === null) return { short: 'Not rec.', long: 'Not recommended to run hard.' };
      if (adj === 0) return { short: this.formatPace(paceSec), long: this.formatPace(paceSec) };
      const range = adj as { low: number; high: number };
      const newLowPace = this.formatPace(paceSec * (1 + range.low));
      const newHighPace = this.formatPace(paceSec * (1 + range.high));
      return { short: newLowPace + '\u2013' + newHighPace, long: newLowPace + '\u2013' + newHighPace };
    } else {
      if (sum <= 100) return { short: 'No adj.', long: 'No adjustment needed' };
      if (sum <= 110) return { short: '0\u20130.5%', long: '0\u20130.5% slower' };
      if (sum <= 120) return { short: '0.5\u20131%', long: '0.5\u20131% slower' };
      if (sum <= 130) return { short: '1\u20132%', long: '1\u20132% slower' };
      if (sum <= 140) return { short: '2\u20133%', long: '2\u20133% slower' };
      if (sum <= 150) return { short: '3\u20134.5%', long: '3\u20134.5% slower' };
      if (sum <= 160) return { short: '4.5\u20136%', long: '4.5\u20136% slower' };
      if (sum <= 170) return { short: '6\u20138%', long: '6\u20138% slower' };
      if (sum <= 180) return { short: '8\u201310%', long: '8\u201310% slower' };
      return { short: 'Not rec.', long: 'Not recommended to run hard.' };
    }
  }

  getAdjustmentClass(sum: number): string {
    if (sum <= 110) return 'adj-safe';
    if (sum <= 130) return 'adj-moderate';
    if (sum <= 170) return 'adj-high';
    return 'adj-extreme';
  }

  getCellClasses(colTemp: number, rowDew: number): Record<string, boolean> {
    const isValid = rowDew <= colTemp;
    return {
      [isValid ? this.getAdjustmentClass(colTemp + rowDew) : 'adj-impossible']: true,
      'highlight-cell':
        (this.hoveredTemp === colTemp && this.hoveredDew === rowDew && rowDew <= colTemp) ||
        (this.inputTemp === colTemp && this.inputDew === rowDew && this.inputDew != null && this.inputDew <= this.inputTemp!),
      'highlight-row': this.hoveredDew === rowDew && this.hoveredDew !== null && this.hoveredDew <= (this.hoveredTemp ?? 0),
      'highlight-col': this.hoveredTemp === colTemp && this.hoveredDew !== null && this.hoveredDew <= (this.hoveredTemp ?? 0)
    };
  }

  getCellTooltip(temp: number, dew: number): string {
    const adj = this.getAdjustment(temp, dew, true);
    const emoji = this.getPaceFeelingEmoji(temp + dew);
    return adj.long + ' ' + emoji;
  }

  private parsePace(paceStr: string): number | null {
    if (typeof paceStr !== 'string' || !paceStr.trim()) return null;
    const trimmed = paceStr.trim();
    if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10) * 60;
    if (/^\d+:$/.test(trimmed)) return parseInt(trimmed, 10) * 60;
    const parts = trimmed.split(':');
    if (parts.length !== 2) return null;
    const min = parseInt(parts[0], 10);
    const secRaw = parts[1].trim();
    if (isNaN(min)) return null;
    if (secRaw === '') return min * 60;
    let sec = parseInt(secRaw, 10);
    if (secRaw.length === 1 && !isNaN(sec)) sec *= 10;
    if (isNaN(sec) || sec < 0 || sec >= 60) return null;
    return min * 60 + sec;
  }

  private formatPace(seconds: number): string {
    const min = Math.floor(seconds / 60);
    const sec = Math.round(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  }

  private getAdjustmentPercent(sum: number): 0 | { low: number; high: number } | null {
    if (sum <= 100) return 0;
    if (sum <= 110) return { low: 0, high: 0.005 };
    if (sum <= 120) return { low: 0.005, high: 0.01 };
    if (sum <= 130) return { low: 0.01, high: 0.02 };
    if (sum <= 140) return { low: 0.02, high: 0.03 };
    if (sum <= 150) return { low: 0.03, high: 0.045 };
    if (sum <= 160) return { low: 0.045, high: 0.06 };
    if (sum <= 170) return { low: 0.06, high: 0.08 };
    if (sum <= 180) return { low: 0.08, high: 0.10 };
    return null;
  }

  private getPaceFeelingEmoji(sum: number): string {
    if (sum <= 100) return '\uD83E\uDD29';
    if (sum <= 110) return '\uD83D\uDE0E';
    if (sum <= 120) return '\uD83D\uDE42';
    if (sum <= 130) return '\uD83D\uDE05';
    if (sum <= 140) return '\uD83D\uDE16';
    if (sum <= 160) return '\uD83E\uDD75';
    if (sum <= 180) return '\uD83E\uDEE0';
    return '\uD83D\uDC80';
  }

  private insertSorted(arr: number[], value: number): void {
    if (arr.includes(value)) return;
    arr.push(value);
    arr.sort((a, b) => a - b);
  }

  private removeValue(arr: number[], value: number): void {
    const index = arr.indexOf(value);
    if (index > -1) arr.splice(index, 1);
  }

  private removeCustomValues(): void {
    if (this.previousCustomTemp) {
      this.removeValue(this.temperatures, this.previousCustomTemp);
      this.previousCustomTemp = null;
    }
    if (this.previousCustomDew) {
      this.removeValue(this.dews, this.previousCustomDew);
      this.previousCustomDew = null;
    }
  }
}
