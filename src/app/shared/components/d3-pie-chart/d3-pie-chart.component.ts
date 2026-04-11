import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, AfterViewInit, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';

declare var d3: any;

@Component({
  selector: 'app-d3-pie-chart',
  standalone: true,
  template: `
    <div class="d3-pie-chart-container" style="display: flex; flex-direction: column; align-items: center; width: 100%;">
      <div #svgContainer class="d3-pie-svg"></div>
      <div #legendContainer class="d3-pie-legend"></div>
    </div>
  `
})
export class D3PieChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data: any[] = [];
  @Input() width = 300;
  @Input() height = 300;
  @Output() sliceClick = new EventEmitter<any>();

  @ViewChild('svgContainer', { static: true }) svgContainerRef!: ElementRef;
  @ViewChild('legendContainer', { static: true }) legendContainerRef!: ElementRef;

  private tooltip: any;
  private initialized = false;

  ngAfterViewInit(): void {
    this.initialized = true;
    if (this.data && this.data.length > 0) {
      this.updateChart();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.initialized && changes['data'] && this.data && this.data.length > 0) {
      this.updateChart();
    }
  }

  ngOnDestroy(): void {
    if (this.tooltip) {
      this.tooltip.remove();
    }
    d3.select('body').selectAll('.d3-tooltip').remove();
  }

  private updateChart(): void {
    if (typeof d3 === 'undefined' || !this.data || !this.data.length) return;

    const svgContainer = this.svgContainerRef.nativeElement;
    const legendContainer = this.legendContainerRef.nativeElement;

    // Clear existing
    d3.select(svgContainer).selectAll('*').remove();
    d3.select(legendContainer).selectAll('*').remove();
    if (this.tooltip) {
      this.tooltip.remove();
    }

    const width = this.width;
    const height = this.height;
    const radius = Math.min(width, height) / 2;

    const svg = d3.select(svgContainer)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .style('overflow', 'visible')
      .append('g')
      .attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')');

    const pie = d3.layout.pie()
      .value((d: any) => d.count)
      .sort(null);

    const arc = d3.svg.arc()
      .innerRadius(0)
      .outerRadius(radius);

    const color = d3.scale.ordinal()
      .domain(this.data.map((_: any, i: number) => i))
      .range([
        '#007bff', '#28a745', '#ffc107', '#fd7e14', '#e83e8c', '#dc3545', '#6f42c1', '#6c757d',
        '#20c997', '#17a2b8', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3',
        '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43', '#10ac84', '#ee5a24', '#0abde3', '#48dbfb',
        '#2ecc71', '#9b59b6', '#f39c12', '#1abc9c', '#34495e', '#e67e22', '#3498db', '#8e44ad',
        '#16a085', '#c0392b', '#d35400', '#27ae60', '#2980b9', '#f1c40f', '#7f8c8d', '#95a5a6'
      ]);

    this.tooltip = d3.select('body').append('div')
      .attr('class', 'd3-tooltip')
      .style('position', 'absolute')
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('z-index', 1000);

    const pieData = pie(this.data);
    const tooltip = this.tooltip;
    const emitter = this.sliceClick;

    const slices = svg.selectAll('.slice')
      .data(pieData)
      .enter()
      .append('g')
      .attr('class', 'slice')
      .style('cursor', 'pointer');

    // Legend
    const legendDiv = d3.select(legendContainer)
      .style('display', 'flex')
      .style('flex-direction', 'row')
      .style('flex-wrap', 'wrap')
      .style('justify-content', 'left')
      .style('align-items', 'flex-start')
      .style('overflow-y', 'visible')
      .style('margin-top', '8px')
      .style('padding', '15px')
      .style('background-color', '#f8f9fa')
      .style('border-radius', '6px')
      .style('border', '1px solid #dee2e6')
      .style('min-height', '120px')
      .style('min-width', '200px')
      .style('max-width', '500px');

    slices.append('path')
      .attr('d', arc)
      .attr('fill', (_d: any, i: number) => color(i))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('transition', 'all 0.3s ease')
      .on('mouseover', function(this: any, d: any, i: number) {
        d3.select(this)
          .attr('transform', 'scale(1.10)')
          .style('opacity', 0.85);

        legendDiv.selectAll('.legend-item')
          .style('background-color', (_ld: any, li: number) => li === i ? 'rgba(0, 123, 255, 0.1)' : 'transparent')
          .style('border-radius', (_ld: any, li: number) => li === i ? '4px' : '0px')
          .style('padding', (_ld: any, li: number) => li === i ? '2px 4px' : '2px 0');

        tooltip.transition().duration(200).style('opacity', 1);
        tooltip.html(
          '<strong>' + d.data.name + '</strong><br/>' +
          d.data.count + ' races (' + d.data.percentage + '%)'
        )
        .style('left', (d3.event.pageX + 10) + 'px')
        .style('top', (d3.event.pageY - 10) + 'px');
      })
      .on('mouseout', function(this: any) {
        d3.select(this)
          .attr('transform', 'scale(1)')
          .style('opacity', 1);

        legendDiv.selectAll('.legend-item')
          .style('background-color', 'transparent')
          .style('border-radius', '0px')
          .style('padding', '2px 0');

        tooltip.transition().duration(500).style('opacity', 0);
      })
      .on('click', (d: any) => {
        emitter.emit(d.data);
      });

    slices.append('text')
      .attr('transform', (d: any) => {
        const centroid = arc.centroid(d);
        return 'translate(' + centroid[0] + ',' + centroid[1] + ')';
      })
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('fill', 'white')
      .style('text-shadow', '1px 1px 2px rgba(0,0,0,0.8)');

    const legendItems = legendDiv.selectAll('.legend-item')
      .data(this.data)
      .enter()
      .append('div')
      .attr('class', 'legend-item')
      .style('display', 'flex')
      .style('align-items', 'center')
      .style('margin', '4px 0')
      .style('cursor', 'pointer')
      .style('padding', '2px 0')
      .style('transition', 'all 0.2s ease')
      .on('mouseenter', function(this: any, _d: any, i: number) {
        svg.selectAll('.slice')
          .each(function(this: any, _sd: any, si: number) {
            if (si === i) {
              d3.select(this).select('path')
                .attr('transform', 'scale(1.10)')
                .style('opacity', 0.85);
            }
          });

        d3.select(this)
          .style('background-color', 'rgba(0, 123, 255, 0.1)')
          .style('border-radius', '4px')
          .style('padding', '2px 4px');
      })
      .on('mouseleave', function(this: any) {
        svg.selectAll('.slice path')
          .attr('transform', 'scale(1)')
          .style('opacity', 1);

        d3.select(this)
          .style('background-color', 'transparent')
          .style('padding', '2px 0');
      })
      .on('click', (d: any) => {
        emitter.emit(d);
      });

    legendItems.append('span')
      .style('display', 'inline-block')
      .style('width', '14px')
      .style('height', '14px')
      .style('margin-left', '5px')
      .style('background-color', (_d: any, i: number) => color(i))
      .style('border', '1px solid #fff')
      .style('border-radius', '2px');

    legendItems.append('span')
      .style('font-size', '12px')
      .style('color', 'black')
      .style('font-weight', '500')
      .text((d: any) => {
        const displayName = d.name.length > 16 ? d.name.substring(0, 16) + '...' : d.name;
        return displayName + ' (' + d.count + ')';
      });
  }
}
