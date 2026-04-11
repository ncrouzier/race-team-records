import { Component, Input, Output, EventEmitter, ElementRef, OnChanges, OnDestroy, SimpleChanges, ViewChild, AfterViewInit } from '@angular/core';

declare var Chart: any;

@Component({
  selector: 'app-parkrun-yearly-chart',
  standalone: true,
  template: `<div style="position: relative; height: 250px;"><canvas #chartCanvas></canvas></div>`
})
export class ParkrunYearlyChartComponent implements OnChanges, OnDestroy, AfterViewInit {
  @Input() data: any[] = [];
  @Output() barClick = new EventEmitter<any>();
  @ViewChild('chartCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private chart: any = null;
  private initialized = false;

  ngAfterViewInit(): void {
    this.initialized = true;
    this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.initialized && changes['data']) {
      this.renderChart();
    }
  }

  ngOnDestroy(): void {
    if (this.chart) this.chart.destroy();
  }

  private renderChart(): void {
    if (!this.data || this.data.length === 0 || !this.canvasRef) return;

    if (this.chart) this.chart.destroy();

    const labels = this.data.map(d => d.year);
    const counts = this.data.map(d => d.count);

    this.chart = new Chart(this.canvasRef.nativeElement, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Parkruns Attended',
          data: counts,
          backgroundColor: '#00ceae',
          borderColor: '#00ceae',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onHover: (event: any, elements: any[]) => {
          event.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
        },
        onClick: (_event: any, elements: any[]) => {
          if (elements.length > 0) {
            this.barClick.emit({ year: labels[elements[0].index] });
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context: any) => context.parsed.y + ' parkruns'
            }
          }
        },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } }
        }
      }
    });
  }
}
