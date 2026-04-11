import {
  Component,
  Input,
  ViewChild,
  ElementRef,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

declare var Chart: any;

interface RaceTypeOption {
  _id: string;
  name: string;
  displayName: string;
  formattedDisplayName: string;
  yearsCount: number;
  totalResults: number;
  meters: number;
  surface: string;
}

interface ResultEntry {
  time: number;
  ageGrade: number | null;
  date: Date;
  raceName: string;
}

const AGE_GRADE_LEVELS = {
  REGIONAL: 70,
  NATIONAL: 80,
  WORLD: 90,
};

const TIME_CONSTANTS = {
  CENTISECONDS_PER_SECOND: 100,
  SECONDS_PER_HOUR: 3600,
  SECONDS_PER_MINUTE: 60,
};

@Component({
  selector: 'app-member-best-time-chart',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="chart-container">
      <canvas #canvas></canvas>
    </div>
    <div style="text-align: center;">
      <label>Select Race Type:</label>
      <select
        [(ngModel)]="selectedRaceTypeId"
        (ngModelChange)="onRaceTypeSelect()"
        style="min-width: 300px; text-align: left;"
      >
        <option [ngValue]="null" disabled>Select a race type...</option>
        <option
          *ngFor="let rt of availableRaceTypes"
          [ngValue]="rt._id"
        >
          {{ rt.displayName }}
        </option>
      </select>
      <button
        class="btn btn-primary"
        (click)="reloadChart()"
        style="margin-left: 10px;"
        title="Reload Graph"
      >
        <i class="fa fa-refresh"></i>
      </button>
      <div class="chart-controls">
        <div class="age-grade-toggle">
          <label>
            <input
              type="checkbox"
              [(ngModel)]="showAgeGradeLines"
              (ngModelChange)="updateChart()"
            />
            Show Age Grade Levels
          </label>
        </div>
        <div class="performance-mode-toggle">
          <label>
            <input
              type="radio"
              name="performanceMode"
              value="best"
              [(ngModel)]="performanceMode"
              (ngModelChange)="updateChart()"
            />
            Best per Year
          </label>
          <label>
            <input
              type="radio"
              name="performanceMode"
              value="all"
              [(ngModel)]="performanceMode"
              (ngModelChange)="updateChart()"
            />
            All Performances
          </label>
        </div>
      </div>
    </div>
  `,
})
export class MemberBestTimeChartComponent implements OnChanges, OnDestroy {
  @Input() raceTypeBreakdown: any;

  @ViewChild('canvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;

  selectedRaceTypeId: string | null = null;
  availableRaceTypes: RaceTypeOption[] = [];
  showAgeGradeLines = true;
  performanceMode: 'best' | 'all' = 'all';

  private chart: any = null;
  private removedPoints = new Set<number>();

  // ── Lifecycle ──────────────────────────────────────────────

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['raceTypeBreakdown']) {
      const newVal = changes['raceTypeBreakdown'].currentValue;
      if (newVal && newVal.yearly) {
        this.availableRaceTypes = this.getAvailableRaceTypes();
        if (this.availableRaceTypes.length > 0 && !this.selectedRaceTypeId) {
          const best = this.availableRaceTypes.reduce((prev, cur) =>
            cur.totalResults > prev.totalResults ? cur : prev
          );
          this.selectedRaceTypeId = best._id;
          this.removedPoints.clear();
          setTimeout(() => this.initializeChart(), 100);
        }
      }
    }
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  // ── Public actions (template) ──────────────────────────────

  onRaceTypeSelect(): void {
    this.removedPoints.clear();
    setTimeout(() => this.initializeChart(), 100);
  }

  updateChart(): void {
    if (this.selectedRaceTypeId) {
      this.removedPoints.clear();
      setTimeout(() => this.initializeChart(), 100);
    }
  }

  reloadChart(): void {
    if (this.selectedRaceTypeId) {
      this.removedPoints.clear();
      setTimeout(() => this.initializeChart(), 100);
    }
  }

  // ── Chart initialisation ──────────────────────────────────

  private initializeChart(): void {
    if (this.chart) {
      this.chart.destroy();
    }

    const ctx = this.canvasRef?.nativeElement;
    if (!ctx) {
      return;
    }

    const selectedRaceTypeId = this.selectedRaceTypeId;
    const years = this.getYearsWithData(selectedRaceTypeId);
    const allResultsData = this.getAllResultsForRaceType(selectedRaceTypeId);

    let timeData: (number | null)[];
    let ageGradeData: (number | null)[];

    if (this.performanceMode === 'best') {
      timeData = years.map((year) =>
        this.getBestTimeForYearAndRaceType(year, selectedRaceTypeId, allResultsData)
      );
      ageGradeData = years.map((year) =>
        this.getMaxAgeGradeForYearAndRaceType(year, selectedRaceTypeId, allResultsData)
      );
    } else {
      timeData = [];
      ageGradeData = [];
      allResultsData.forEach((result, index) => {
        if (!this.removedPoints.has(index)) {
          timeData.push(result.time);
          ageGradeData.push(result.ageGrade);
        }
      });
    }

    const selectedRaceType = this.getSelectedRaceType();
    const raceTypeName = selectedRaceType ? selectedRaceType.name : '';

    const hasAgeGradeData = ageGradeData.some(
      (value) => value !== null && value !== undefined
    );

    // Build datasets
    const datasets: any[] = [
      {
        label: raceTypeName + (this.performanceMode === 'best' ? ' Best Time' : ' Time'),
        data: timeData,
        borderColor: '#3498db',
        backgroundColor: '#3498db20',
        borderWidth: 2,
        fill: false,
        tension: 0.1,
        pointRadius: 4,
        pointHoverRadius: 6,
        yAxisID: 'y',
        spanGaps: false,
      },
    ];

    if (hasAgeGradeData) {
      datasets.push({
        label:
          raceTypeName +
          (this.performanceMode === 'best' ? ' Max Age Grade' : ' Age Grade'),
        data: ageGradeData,
        borderColor: '#e74c3c',
        backgroundColor: '#e74c3c20',
        borderWidth: 2,
        fill: false,
        tension: 0.1,
        pointRadius: 4,
        pointHoverRadius: 6,
        yAxisID: 'y1',
        spanGaps: false,
      });

      if (this.showAgeGradeLines) {
        const validAgeGrades = ageGradeData.filter(
          (v): v is number => v !== null && v !== undefined
        );
        const minAgeGrade = Math.min(...validAgeGrades);
        const minAxis = Math.floor(Math.max(0, minAgeGrade - 10));
        this.addAgeGradeReferenceLines(datasets, ageGradeData, minAxis);
      }
    }

    // Labels
    let labels: (number | string)[];
    if (this.performanceMode === 'best') {
      labels = years;
    } else {
      const seenYears = new Set<number>();
      labels = [];
      allResultsData.forEach((result, index) => {
        if (!this.removedPoints.has(index)) {
          const year = result.date.getUTCFullYear();
          if (!seenYears.has(year)) {
            seenYears.add(year);
            labels.push(year);
          } else {
            labels.push('');
          }
        }
      });
    }

    // Capture references for closures
    const self = this;
    const capturedSelectedRaceTypeId = selectedRaceTypeId;

    this.chart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Performance by Year - ' + raceTypeName,
            font: { size: 16, weight: 'bold' },
          },
          legend: {
            display: true,
            position: 'top',
            labels: { usePointStyle: true, padding: 20 },
            onClick(e: any, legendItem: any, legend: any) {
              const idx = legendItem.datasetIndex;
              const ci = legend.chart;
              const meta = ci.getDatasetMeta(idx);
              meta.hidden = !meta.hidden;
              self.updateAxisVisibility(ci);
              ci.update();
            },
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            filter(tooltipItem: any) {
              const label: string = tooltipItem.dataset.label;
              return (
                !label.includes('Regional Level') &&
                !label.includes('National Level') &&
                !label.includes('World Level')
              );
            },
            callbacks: {
              title(context: any[]) {
                if (self.performanceMode === 'best') {
                  return 'Year: ' + context[0].label;
                }
                const allResults = self.getAllResultsForRaceType(capturedSelectedRaceTypeId);
                let originalIndex = 0;
                let currentIndex = 0;
                while (
                  currentIndex <= context[0].dataIndex &&
                  originalIndex < allResults.length
                ) {
                  if (!self.removedPoints.has(originalIndex)) {
                    currentIndex++;
                  }
                  originalIndex++;
                }
                if (originalIndex > 0) {
                  originalIndex--;
                }
                if (allResults[originalIndex]) {
                  const r = allResults[originalIndex];
                  return r.raceName + ' - ' + r.date.toLocaleDateString();
                }
                return context[0].label;
              },
              label(context: any) {
                const value = context.parsed.y;
                if (value === null || value === undefined) {
                  return context.dataset.label + ': No data';
                }
                if (self.performanceMode === 'all') {
                  if (context.dataset.yAxisID === 'y') {
                    return 'Time: ' + formatTime(value);
                  }
                  return 'Age Grade: ' + value.toFixed(2) + '%';
                }
                if (context.dataset.yAxisID === 'y') {
                  return context.dataset.label + ': ' + formatTime(value);
                }
                return context.dataset.label + ': ' + value.toFixed(2) + '%';
              },
            },
          },
        },
        scales: {
          x: {
            display: true,
            title: { display: true, text: 'Year' },
            ticks: { stepSize: 1 },
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: { display: true, text: 'Time', color: '#3498db' },
            reverse: true,
            ticks: {
              callback(value: number) {
                if (value === null || value === undefined) {
                  return '';
                }
                return formatTime(value);
              },
              color: '#3498db',
            },
          },
          y1: {
            type: 'linear',
            display: hasAgeGradeData,
            position: 'right',
            title: {
              display: hasAgeGradeData,
              text: 'Age Grade (%)',
              color: '#e74c3c',
            },
            min: (() => {
              const validAgeGrades = ageGradeData.filter(
                (v): v is number => v !== null && v !== undefined
              );
              if (validAgeGrades.length === 0) return 0;
              const minVal = Math.min(...validAgeGrades);
              return Math.floor(Math.max(0, minVal - 10));
            })(),
            max: 100,
            ticks: {
              callback(value: number) {
                return value + '%';
              },
              color: '#e74c3c',
            },
            grid: { drawOnChartArea: false },
          },
        },
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
        onClick: (event: any, elements: any[]) => {
          if (elements.length > 0) {
            const element = elements[0];
            const datasetIndex = element.datasetIndex;
            const dataIndex = element.index;

            if (datasetIndex === 0 || datasetIndex === 1) {
              if (this.performanceMode === 'best') {
                const clickYears = this.getYearsWithData(capturedSelectedRaceTypeId);
                if (dataIndex < clickYears.length) {
                  const yearToRemove = clickYears[dataIndex];
                  allResultsData.forEach((result, index) => {
                    if (result.date.getUTCFullYear() === yearToRemove) {
                      this.removedPoints.add(index);
                    }
                  });
                }
              } else {
                let originalIndex = 0;
                let currentIndex = 0;
                while (
                  currentIndex <= dataIndex &&
                  originalIndex < allResultsData.length
                ) {
                  if (!this.removedPoints.has(originalIndex)) {
                    currentIndex++;
                  }
                  originalIndex++;
                }
                if (originalIndex > 0) {
                  originalIndex--;
                }
                this.removedPoints.add(originalIndex);
              }
              setTimeout(() => this.initializeChart(), 100);
            }
          }
        },
      },
    });

    this.updateAxisVisibility(this.chart);
  }

  // ── Axis visibility ───────────────────────────────────────

  private updateAxisVisibility(chart: any): void {
    let timeDatasetVisible = false;
    let ageGradeDatasetVisible = false;

    chart.data.datasets.forEach((dataset: any, index: number) => {
      const meta = chart.getDatasetMeta(index);
      if (!meta.hidden) {
        if (dataset.yAxisID === 'y') {
          timeDatasetVisible = true;
        } else if (dataset.yAxisID === 'y1' && !dataset.label.includes('Level')) {
          ageGradeDatasetVisible = true;
        }
      }
    });

    if (chart.options.scales.y) {
      chart.options.scales.y.display = timeDatasetVisible;
    }
    if (chart.options.scales.y1) {
      chart.options.scales.y1.display = ageGradeDatasetVisible;
    }

    chart.data.datasets.forEach((dataset: any, index: number) => {
      const meta = chart.getDatasetMeta(index);
      if (dataset.label && dataset.label.includes('Level')) {
        meta.hidden = !ageGradeDatasetVisible;
      }
    });
  }

  // ── Age grade reference lines ─────────────────────────────

  private addAgeGradeReferenceLines(
    datasets: any[],
    ageGradeData: (number | null)[],
    minAxis: number
  ): void {
    const referenceLines = [
      { level: AGE_GRADE_LEVELS.REGIONAL, label: 'Regional Level (70%)', color: '#cd7f32' },
      { level: AGE_GRADE_LEVELS.NATIONAL, label: 'National Level (80%)', color: '#c0c0c0' },
      { level: AGE_GRADE_LEVELS.WORLD, label: 'World Level (90%)', color: '#ffd700' },
    ];

    referenceLines.forEach((line) => {
      if (line.level >= minAxis) {
        datasets.push({
          label: line.label,
          data: ageGradeData.map(() => line.level),
          borderColor: line.color,
          backgroundColor: 'transparent',
          borderWidth: 1,
          fill: false,
          tension: 0,
          pointRadius: 0,
          pointHoverRadius: 0,
          yAxisID: 'y1',
          spanGaps: false,
          borderDash: [5, 1],
        });
      }
    });
  }

  // ── Data helpers ──────────────────────────────────────────

  private getSelectedRaceType(): RaceTypeOption | null {
    if (!this.selectedRaceTypeId) return null;
    return (
      this.availableRaceTypes.find((rt) => rt._id === this.selectedRaceTypeId) ?? null
    );
  }

  private getYearsWithData(selectedRaceTypeId: string | null): number[] {
    if (
      !this.raceTypeBreakdown ||
      !this.raceTypeBreakdown.yearly ||
      !selectedRaceTypeId
    ) {
      return [];
    }

    const yearsWithData: number[] = [];
    const yearly = this.raceTypeBreakdown.yearly;

    Object.keys(yearly).forEach((year) => {
      const yearData = yearly[year];
      let hasDataForRaceType = false;

      Object.keys(yearData).forEach((category) => {
        const raceTypeData = yearData[category];
        if (raceTypeData.results && raceTypeData.results.length > 0) {
          raceTypeData.results.forEach((result: any) => {
            if (
              result.race &&
              result.race.racetype &&
              result.race.racetype._id === selectedRaceTypeId
            ) {
              hasDataForRaceType = true;
            }
          });
        }
      });

      if (hasDataForRaceType) {
        yearsWithData.push(parseInt(year, 10));
      }
    });

    return yearsWithData.sort((a, b) => a - b);
  }

  private getAvailableRaceTypes(): RaceTypeOption[] {
    if (!this.raceTypeBreakdown || !this.raceTypeBreakdown.yearly) {
      return [];
    }

    const raceTypeYears: Record<string, { raceType: any; years: Set<number> }> = {};
    const raceTypeResults: Record<string, number> = {};
    const yearly = this.raceTypeBreakdown.yearly;

    const excludeKeywords = ['odd', 'multisport'];
    const excludeSurfaces = ['open water', 'pool', 'other'];

    Object.keys(yearly).forEach((year) => {
      const yearData = yearly[year];
      Object.keys(yearData).forEach((category) => {
        const raceTypeData = yearData[category];
        if (raceTypeData.results && raceTypeData.results.length > 0) {
          raceTypeData.results.forEach((result: any) => {
            if (result.race && result.race.racetype && result.race.racetype._id) {
              const raceType = result.race.racetype;
              const raceTypeId = raceType._id;

              // Count results
              raceTypeResults[raceTypeId] = (raceTypeResults[raceTypeId] || 0) + 1;

              // Check exclusions
              const shouldExclude =
                excludeKeywords.some((kw) =>
                  raceType.name.toLowerCase().includes(kw)
                ) || excludeSurfaces.includes(raceType.surface);

              if (!shouldExclude) {
                if (!raceTypeYears[raceTypeId]) {
                  raceTypeYears[raceTypeId] = {
                    raceType,
                    years: new Set<number>(),
                  };
                }
                const raceYear = new Date(result.race.racedate).getUTCFullYear();
                raceTypeYears[raceTypeId].years.add(raceYear);
              }
            }
          });
        }
      });
    });

    return Object.values(raceTypeYears)
      .map((data) => {
        const yearsCount = data.years.size;
        const raceType = data.raceType;
        const totalResults = raceTypeResults[raceType._id] || 0;

        const displayCount =
          this.performanceMode === 'all' ? totalResults : yearsCount;
        const displayLabel =
          this.performanceMode === 'all'
            ? 'result' + (totalResults !== 1 ? 's' : '')
            : 'year' + (yearsCount > 1 ? 's' : '');

        const surfaceClass = this.getRaceTypeClass(raceType.surface);

        return {
          _id: raceType._id,
          name: raceType.name,
          displayName:
            raceType.name +
            ' (' +
            raceType.surface +
            ') - ' +
            displayCount +
            ' ' +
            displayLabel,
          formattedDisplayName:
            raceType.name +
            ' <span class="' +
            surfaceClass +
            '">(' +
            raceType.surface +
            ')</span> - ' +
            displayCount +
            ' ' +
            displayLabel,
          yearsCount,
          totalResults,
          meters: raceType.meters,
          surface: raceType.surface,
        };
      })
      .sort((a, b) => a.meters - b.meters);
  }

  private getAllResultsForRaceType(raceTypeId: string | null): ResultEntry[] {
    if (!this.raceTypeBreakdown || !this.raceTypeBreakdown.yearly || !raceTypeId) {
      return [];
    }

    const allResults: ResultEntry[] = [];
    const yearly = this.raceTypeBreakdown.yearly;

    Object.keys(yearly).forEach((year) => {
      const yearData = yearly[year];
      Object.keys(yearData).forEach((category) => {
        const raceTypeData = yearData[category];
        if (raceTypeData.results && raceTypeData.results.length > 0) {
          raceTypeData.results.forEach((result: any) => {
            if (
              result.race &&
              result.race.racetype &&
              result.race.racetype._id === raceTypeId
            ) {
              const timeInCentiseconds = parseFloat(result.time);
              if (timeInCentiseconds && timeInCentiseconds > 0) {
                allResults.push({
                  time: timeInCentiseconds,
                  ageGrade: parseFloat(result.agegrade) || null,
                  date: new Date(result.race.racedate),
                  raceName: result.race.racename,
                });
              }
            }
          });
        }
      });
    });

    return allResults.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private createResultLookupMap(
    allResultsData: ResultEntry[]
  ): Map<string, number> {
    const lookupMap = new Map<string, number>();
    allResultsData.forEach((result, index) => {
      const key = result.time + '_' + result.date.getTime() + '_' + result.raceName;
      lookupMap.set(key, index);
    });
    return lookupMap;
  }

  private isResultRemoved(
    result: any,
    allResultsData: ResultEntry[],
    lookupMap: Map<string, number>
  ): boolean {
    const key =
      parseFloat(result.time) +
      '_' +
      new Date(result.race.racedate).getTime() +
      '_' +
      result.race.racename;
    const index = lookupMap.get(key);
    return index !== undefined && this.removedPoints.has(index);
  }

  private getBestTimeForYearAndRaceType(
    year: number,
    raceTypeId: string | null,
    allResultsData: ResultEntry[]
  ): number | null {
    if (
      !this.raceTypeBreakdown ||
      !this.raceTypeBreakdown.yearly ||
      !this.raceTypeBreakdown.yearly[year]
    ) {
      return null;
    }

    const yearData = this.raceTypeBreakdown.yearly[year];
    let bestTime: number | null = null;
    const lookupMap = this.createResultLookupMap(allResultsData);

    Object.keys(yearData).forEach((category) => {
      const raceTypeData = yearData[category];
      if (raceTypeData.results && raceTypeData.results.length > 0) {
        raceTypeData.results.forEach((result: any) => {
          if (
            result.race &&
            result.race.racetype &&
            result.race.racetype._id === raceTypeId
          ) {
            if (!this.isResultRemoved(result, allResultsData, lookupMap)) {
              const timeInCentiseconds = parseFloat(result.time);
              if (timeInCentiseconds && timeInCentiseconds > 0) {
                if (bestTime === null || timeInCentiseconds < bestTime) {
                  bestTime = timeInCentiseconds;
                }
              }
            }
          }
        });
      }
    });

    return bestTime;
  }

  private getMaxAgeGradeForYearAndRaceType(
    year: number,
    raceTypeId: string | null,
    allResultsData: ResultEntry[]
  ): number | null {
    if (
      !this.raceTypeBreakdown ||
      !this.raceTypeBreakdown.yearly ||
      !this.raceTypeBreakdown.yearly[year]
    ) {
      return null;
    }

    const yearData = this.raceTypeBreakdown.yearly[year];
    let maxAgeGrade: number | null = null;
    const lookupMap = this.createResultLookupMap(allResultsData);

    Object.keys(yearData).forEach((category) => {
      const raceTypeData = yearData[category];
      if (raceTypeData.results && raceTypeData.results.length > 0) {
        raceTypeData.results.forEach((result: any) => {
          if (
            result.race &&
            result.race.racetype &&
            result.race.racetype._id === raceTypeId
          ) {
            if (!this.isResultRemoved(result, allResultsData, lookupMap)) {
              const ageGrade = parseFloat(result.agegrade);
              if (ageGrade && ageGrade > 0) {
                if (maxAgeGrade === null || ageGrade > maxAgeGrade) {
                  maxAgeGrade = ageGrade;
                }
              }
            }
          }
        });
      }
    });

    return maxAgeGrade;
  }

  private getRaceTypeClass(surface: string | undefined): string {
    if (surface !== undefined) {
      return surface.replace(/ /g, '') + '-col';
    }
    return '';
  }
}

// ── Module-level helper ──────────────────────────────────────

function formatTime(centiseconds: number): string {
  if (!centiseconds || centiseconds <= 0) {
    return 'No data';
  }

  const totalSeconds = Math.floor(
    centiseconds / TIME_CONSTANTS.CENTISECONDS_PER_SECOND
  );
  const hours = Math.floor(totalSeconds / TIME_CONSTANTS.SECONDS_PER_HOUR);
  const minutes = Math.floor(
    (totalSeconds % TIME_CONSTANTS.SECONDS_PER_HOUR) /
      TIME_CONSTANTS.SECONDS_PER_MINUTE
  );
  const secs = totalSeconds % TIME_CONSTANTS.SECONDS_PER_MINUTE;

  if (hours > 0) {
    return (
      hours +
      ':' +
      (minutes < 10 ? '0' : '') +
      minutes +
      ':' +
      (secs < 10 ? '0' : '') +
      secs
    );
  }
  return minutes + ':' + (secs < 10 ? '0' : '') + secs;
}
