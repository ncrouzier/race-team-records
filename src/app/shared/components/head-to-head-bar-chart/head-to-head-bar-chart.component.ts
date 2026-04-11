declare var Chart: any;

import {
  Component,
  Input,
  ViewChild,
  ElementRef,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';

@Component({
  selector: 'app-head-to-head-bar-chart',
  standalone: true,
  template:
    '<div style="position: relative; height: 300px;"><canvas #canvas></canvas></div>',
})
export class HeadToHeadBarChartComponent implements OnChanges, OnDestroy {
  @Input() data: any; // { labels, member1Wins, member2Wins, ties }
  @Input() member1Name!: string;
  @Input() member2Name!: string;
  @Input() colors: any; // optional { member1, member2, tie }

  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private chart: any = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (this.data) {
      // Small delay to ensure DOM is ready, mirroring the original $timeout
      setTimeout(() => this.buildChart(), 100);
    }
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  private buildChart(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }

    if (!this.data || !this.data.labels || this.data.labels.length === 0) {
      return;
    }

    const labels: string[] = this.data.labels;
    const m1Wins: number[] = this.data.member1Wins;
    const m2Wins: number[] = this.data.member2Wins;
    const ties: number[] = this.data.ties;

    // Calculate percentages for 100% stacked bar
    const m1Pct: number[] = [];
    const m2Pct: number[] = [];
    const tiesPct: number[] = [];

    for (let i = 0; i < labels.length; i++) {
      const total = m1Wins[i] + m2Wins[i] + ties[i];
      m1Pct.push(total > 0 ? (m1Wins[i] / total) * 100 : 0);
      m2Pct.push(total > 0 ? (m2Wins[i] / total) * 100 : 0);
      tiesPct.push(total > 0 ? (ties[i] / total) * 100 : 0);
    }

    const member1Color = this.colors ? this.colors.member1 : '#008cba';
    const member2Color = this.colors ? this.colors.member2 : '#ee8d5e';
    const tieColor = this.colors ? this.colors.tie : 'grey';

    const datasets: any[] = [
      {
        label: this.member1Name + ' Wins',
        data: m1Pct,
        backgroundColor: member1Color,
        _rawData: m1Wins,
      },
      {
        label: this.member2Name + ' Wins',
        data: m2Pct,
        backgroundColor: member2Color,
        _rawData: m2Wins,
      },
    ];

    const hasTies = ties.some((t: number) => t > 0);
    if (hasTies) {
      datasets.push({
        label: 'Ties',
        data: tiesPct,
        backgroundColor: tieColor,
        _rawData: ties,
      });
    }

    // Custom plugin for bar labels and 50% line
    const barLabelsPlugin = {
      id: 'h2hBarLabels',
      afterDraw(chartInstance: any) {
        const ctx = chartInstance.ctx;
        ctx.save();
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const yScale = chartInstance.scales.y;
        const lineY = yScale.getPixelForValue(50);
        const textHeight = 14;
        const safeZone = textHeight / 2 + 3;

        chartInstance.data.datasets.forEach((dataset: any, dsIndex: number) => {
          const meta = chartInstance.getDatasetMeta(dsIndex);
          meta.data.forEach((bar: any, index: number) => {
            const raw = dataset._rawData[index];
            if (raw > 0 && bar.height > 16) {
              let labelY = bar.y + bar.height / 2;
              if (Math.abs(labelY - lineY) < safeZone) {
                if (bar.y < lineY) {
                  labelY = lineY - safeZone;
                } else {
                  labelY = lineY + safeZone;
                }
              }
              ctx.fillStyle = '#fff';
              ctx.fillText(raw, bar.x, labelY);
            }
          });
        });

        // Draw 50% dotted line
        ctx.beginPath();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.moveTo(chartInstance.chartArea.left, lineY);
        ctx.lineTo(chartInstance.chartArea.right, lineY);
        ctx.stroke();
        ctx.restore();
      },
    };

    const canvas = this.canvasRef.nativeElement;

    this.chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels.map(String),
        datasets,
      },
      plugins: [barLabelsPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label(context: any) {
                const raw = context.dataset._rawData[context.dataIndex];
                const pct = context.parsed.y.toFixed(0);
                return context.dataset.label + ': ' + raw + ' (' + pct + '%)';
              },
            },
          },
        },
        scales: {
          x: { stacked: true },
          y: {
            stacked: true,
            min: 0,
            max: 100,
            ticks: {
              callback(value: number) {
                return value + '%';
              },
            },
          },
        },
      },
    });
  }
}
