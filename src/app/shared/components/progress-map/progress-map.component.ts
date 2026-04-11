import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, AfterViewInit, OnChanges, OnDestroy, SimpleChanges, NgZone } from '@angular/core';
import { DatePipe } from '@angular/common';

declare var L: any;

@Component({
  selector: 'app-progress-map',
  standalone: true,
  imports: [],
  template: `<div #mapContainer class="progress-map-container" style="height: 500px; width: 100%;"></div>`
})
export class ProgressMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() routeData: any;
  @Input() segments: any[] = [];
  @Input() waypoints: any[] = [];
  @Input() totalTeamMiles = 0;
  @Input() totalRouteMiles = 0;
  @Input() reachedEnd = false;
  @Output() raceClick = new EventEmitter<any>();

  @ViewChild('mapContainer', { static: true }) mapContainerRef!: ElementRef;

  private map: any = null;
  private layerGroup: any = null;
  private initialized = false;
  private datePipe = new DatePipe('en-US');

  constructor(private ngZone: NgZone) {}

  ngAfterViewInit(): void {
    this.initialized = true;
    if (this.routeData) {
      this.initMap();
      this.updateMap();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.initialized) return;
    if (changes['routeData'] || changes['segments']) {
      setTimeout(() => this.updateMap(), 100);
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  centerOnPoint(lat: number, lng: number, zoom = 8): void {
    if (this.map) {
      this.map.setView([lat, lng], zoom);
    }
  }

  fitBounds(bounds: [number, number][]): void {
    if (this.map && bounds && bounds.length >= 2) {
      this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }
  }

  resetView(): void {
    if (this.map && this.routeData && this.routeData.geometry) {
      const coords = this.routeData.geometry.coordinates.map((c: number[]) => [c[1], c[0]]);
      if (coords.length > 0) {
        this.map.fitBounds(L.latLngBounds(coords), { padding: [30, 30] });
      }
    }
  }

  private initMap(): void {
    if (typeof L === 'undefined') return;
    if (this.map) {
      this.map.remove();
    }
    const container = this.mapContainerRef.nativeElement;
    this.map = L.map(container).setView([39.5, -98.35], 4);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18
    }).addTo(this.map);

    this.layerGroup = L.layerGroup().addTo(this.map);
  }

  private updateMap(): void {
    if (!this.map) this.initMap();
    if (!this.map || !this.layerGroup) return;

    this.layerGroup.clearLayers();

    if (!this.routeData || !this.routeData.geometry) return;

    // Full route as gray background
    const fullRouteCoords = this.routeData.geometry.coordinates.map((c: number[]) => [c[1], c[0]]);
    L.polyline(fullRouteCoords, {
      color: '#6d6d6dff',
      weight: 4,
      opacity: 0.5,
      dashArray: '8, 8'
    }).addTo(this.layerGroup);

    // Colored segments
    if (this.segments && this.segments.length > 0) {
      this.segments.forEach((seg: any) => {
        if (seg.coords && seg.coords.length >= 2) {
          const latLngs = seg.coords.map((c: number[]) => [c[1], c[0]]);
          const polyline = L.polyline(latLngs, {
            color: seg.color,
            weight: 6,
            opacity: 0.85
          }).addTo(this.layerGroup);

          const dateStr = this.datePipe.transform(seg.raceDate, 'MMM d, yyyy', 'UTC');
          polyline.bindTooltip(
            '<strong>' + seg.raceName + '</strong><br>' +
            (dateStr ? dateStr + '<br>' : '') +
            (seg.raceTypeName ? seg.raceTypeName + '<br>' : '') +
            seg.teamMiles.toFixed(1) + ' team miles',
            { sticky: true }
          );

          polyline.on('click', () => {
            this.ngZone.run(() => {
              this.raceClick.emit(seg.race);
            });
          });
        }
      });

      // Progress flag marker
      let lastSegWithCoords: any = null;
      for (let i = this.segments.length - 1; i >= 0; i--) {
        if (this.segments[i].coords && this.segments[i].coords.length > 0) {
          lastSegWithCoords = this.segments[i];
          break;
        }
      }
      if (lastSegWithCoords) {
        const endCoord = lastSegWithCoords.coords[lastSegWithCoords.coords.length - 1];
        const progressIcon = L.divIcon({
          className: 'progress-marker',
          html: '<i class="fa fa-flag" style="color: #e83e8c; font-size: 20px; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);"></i>',
          iconSize: [20, 20],
          iconAnchor: [4, 18]
        });
        L.marker([endCoord[1], endCoord[0]], {
          icon: progressIcon,
          title: 'Current Progress',
          zIndexOffset: 1000
        }).bindPopup(
          '<strong>Current Progress</strong><br>' +
          this.totalTeamMiles.toFixed(0) + ' of ' +
          this.totalRouteMiles.toFixed(0) + ' miles'
        ).addTo(this.layerGroup);
      }
    }

    // Waypoint markers
    if (this.waypoints && this.waypoints.length > 0) {
      this.waypoints.forEach((wp: any, idx: number) => {
        if (idx === 0) return;
        const color = wp.reached ? '#28a745' : '#999';
        const icon = L.divIcon({
          className: 'waypoint-marker',
          html: '<div style="width:10px;height:10px;border-radius:50%;background:' + color +
            ';border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>',
          iconSize: [10, 10],
          iconAnchor: [5, 5]
        });
        L.marker([wp.lat, wp.lng], {
          icon,
          title: wp.name
        }).bindTooltip(wp.name + (wp.reached ? ' (reached)' : ''), {
          direction: 'top',
          offset: [0, -5]
        }).addTo(this.layerGroup);
      });
    }

    // Start marker
    const startIcon = L.divIcon({
      className: 'progress-marker',
      html: '<i class="fa fa-play-circle" style="color: #28a745; font-size: 22px; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);"></i>',
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });
    const startLabel = this.routeData.startLabel || 'Start';
    const startLat = this.routeData.startLat || 38.9784;
    const startLng = this.routeData.startLng || -77.1528;
    L.marker([startLat, startLng], { icon: startIcon, title: 'Start: ' + startLabel, zIndexOffset: 900 })
      .bindPopup('<strong>Start</strong><br>' + startLabel)
      .addTo(this.layerGroup);

    // Fit bounds
    if (fullRouteCoords.length > 0) {
      this.map.fitBounds(L.latLngBounds(fullRouteCoords), { padding: [30, 30] });
    }
  }
}
