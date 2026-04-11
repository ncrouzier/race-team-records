import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, AfterViewInit, OnChanges, OnDestroy, SimpleChanges, HostListener } from '@angular/core';

declare var d3: any;
declare var Datamap: any;

@Component({
  selector: 'app-world-map',
  standalone: true,
  template: `<div #mapContainer style="width: 100%; min-height: 400px;"></div>`
})
export class WorldMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() countryData: [string, number][] = [];
  @Output() countryClick = new EventEmitter<string>();

  @ViewChild('mapContainer', { static: true }) mapContainerRef!: ElementRef;

  private map: any;
  private initialized = false;

  ngAfterViewInit(): void {
    this.initialized = true;
    if (this.countryData && this.countryData.length > 0) {
      this.renderMap();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.initialized && changes['countryData'] && this.countryData && this.countryData.length > 0) {
      this.renderMap();
    }
  }

  ngOnDestroy(): void {
    this.map = null;
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.map) {
      this.map.resize();
    }
  }

  private renderMap(): void {
    if (typeof Datamap === 'undefined' || typeof d3 === 'undefined') return;

    const container = this.mapContainerRef.nativeElement;
    container.innerHTML = '';

    const dataset: Record<string, any> = {};
    const onlyValues = this.countryData.map(item => item[1]);
    const minValue = Math.min(...onlyValues);
    const maxValue = Math.max(...onlyValues);

    const paletteScale = d3.scale.log()
      .domain([minValue, maxValue])
      .range(['#007196', 'red']);

    this.countryData.forEach(item => {
      const iso = item[0];
      const value = item[1];
      dataset[iso] = { count: value, fillColor: paletteScale(value) };
    });

    this.map = new Datamap({
      element: container,
      projection: 'mercator',
      scope: 'world',
      responsive: true,
      fills: { defaultFill: '#afafaf' },
      data: dataset,
      geographyConfig: {
        highlightBorderWidth: 2,
        highlightFillColor: (geo: any) => geo.fillColor || '#afafaf',
        highlightBorderColor: 'red',
        popupTemplate: (_geo: any, data: any) => {
          const label = data.count > 1 ? 'races' : 'race';
          return '<div class="hoverinfo"><strong>' +
            data.count + ' ' + label + ' ran in ' + _geo.properties.name +
            '</strong></div>';
        }
      },
      done: (datamap: any) => {
        datamap.svg.call(d3.behavior.zoom().on('zoom', () => {
          datamap.svg.selectAll('g').attr('transform', 'translate(' + d3.event.translate + ')scale(' + d3.event.scale + ')');
        }));

        datamap.svg.selectAll('.datamaps-subunit').each((d: any) => {
          if (dataset[d.id] && dataset[d.id].count > 0) {
            d3.select(datamap.svg.selectAll('.datamaps-subunit').filter((_dd: any) => _dd.id === d.id)[0][0])
              .style('cursor', 'pointer')
              .on('click', () => {
                this.countryClick.emit(d.id);
              });
          }
        });
      }
    });
  }
}
