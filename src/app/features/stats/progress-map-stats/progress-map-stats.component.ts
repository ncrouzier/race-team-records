import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StatsNavComponent } from '../stats-nav/stats-nav.component';
import { ProgressMapComponent } from '../../../shared/components/progress-map/progress-map.component';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { MemoryCacheService } from '../../../core/services/memory-cache.service';
import { ResultsService } from '../../../core/services/results.service';
import { PROGRESS_ROUTES, ProgressRoute } from '../../../core/data/progress-routes';

@Component({
  selector: 'app-progress-map-stats',
  standalone: true,
  imports: [CommonModule, FormsModule, StatsNavComponent, ProgressMapComponent],
  template: `
    <div class="jumbotron">
      <app-stats-nav></app-stats-nav>

      <!-- Header -->
      <div class="row text-left" style="margin-top: 15px;">
        <div class="col-sm-6">
          <h2><img src="/images/route.svg" style="width: 1em; height: 1em; vertical-align: top;"> Team Progress Map</h2>
          <div class="text-muted">{{ selectedRoute?.description }}</div>
        </div>
        <div class="col-sm-6 text-right" style="margin-top: 20px;">
          <div style="display: inline-block; vertical-align: top; margin-left: 10px;">
            <select class="form-control" [(ngModel)]="selectedYear" (ngModelChange)="onYearChange()" style="min-width: 100px;">
              <option *ngFor="let y of yearsList" [ngValue]="y">{{ y }}</option>
            </select>
          </div>
          <div style="display: inline-block; vertical-align: top;">
            <select class="form-control" [(ngModel)]="selectedRoute" (ngModelChange)="onRouteChange()" style="min-width: 200px;">
              <option *ngFor="let r of routesList" [ngValue]="r">{{ r.name }}</option>
            </select>
          </div>
        </div>
      </div>

      <div *ngIf="loading" class="text-center" style="padding: 50px;">
        <i class="fa fa-spinner fa-spin fa-3x"></i>
        <p style="margin-top: 15px;">Loading progress map...</p>
      </div>

      <div *ngIf="!loading">
        <!-- Summary -->
        <div class="row" style="margin-bottom: 15px;">
          <div class="col-sm-3 col-xs-6">
            <div class="panel panel-default text-center"><div class="panel-body">
              <h3 style="margin: 5px 0;">{{ totalTeamMiles | number:'1.0-0' }}</h3>
              <p class="text-muted" style="margin: 0;">Team Miles</p>
            </div></div>
          </div>
          <div class="col-sm-3 col-xs-6">
            <div class="panel panel-default text-center"><div class="panel-body">
              <h3 style="margin: 5px 0;">{{ totalRouteMiles | number:'1.0-0' }}</h3>
              <p class="text-muted" style="margin: 0;">Route Miles</p>
            </div></div>
          </div>
          <div class="col-sm-2 col-xs-4">
            <div class="panel panel-default text-center"><div class="panel-body">
              <h3 style="margin: 5px 0;">{{ progressPercent }}%</h3>
              <p class="text-muted" style="margin: 0;">Progress</p>
            </div></div>
          </div>
          <div class="col-sm-2 col-xs-4">
            <div class="panel panel-default text-center"><div class="panel-body">
              <h3 style="margin: 5px 0;">{{ waypointsReachedCount }} / {{ waypointsTotalCount }}</h3>
              <p class="text-muted" style="margin: 0;">Waypoints Reached</p>
            </div></div>
          </div>
          <div class="col-sm-2 col-xs-4">
            <div class="panel panel-default text-center"><div class="panel-body">
              <h3 style="margin: 5px 0;">{{ segments.length }}</h3>
              <p class="text-muted" style="margin: 0;">{{ mapMode === 'members' ? 'Members' : 'Races' }}</p>
            </div></div>
          </div>
        </div>

        <!-- Progress bar -->
        <div class="progress" style="height: 25px; margin-bottom: 15px;">
          <div class="progress-bar" role="progressbar" [style.width]="progressPercent + '%'"
               [ngClass]="reachedEnd ? 'progress-bar-success' : 'progress-bar-info'">
            {{ progressPercent }}%
          </div>
        </div>

        <!-- Next waypoint -->
        <div *ngIf="nextWaypoint && !reachedEnd" class="alert alert-info" style="display: flex; align-items: center; justify-content: space-between;">
          <div>
            <i class="fa fa-compass"></i>
            <strong>Next waypoint:</strong> {{ nextWaypoint.name }}
            &mdash; {{ nextWaypoint.milesRemaining | number:'1.0-0' }} miles to go
          </div>
          <button class="btn btn-sm btn-info" (click)="centerOnWaypoint(nextWaypoint)">
            <i class="fa fa-crosshairs"></i> Show on map
          </button>
        </div>

        <div *ngIf="reachedEnd" class="alert alert-success text-center">
          <strong><i class="fa fa-trophy"></i> The team has visited all waypoints!</strong>
          Total team miles ({{ totalTeamMiles | number:'1.0-0' }}) exceeded the route distance ({{ totalRouteMiles | number:'1.0-0' }} miles).
        </div>

        <div *ngIf="segments.length === 0" class="alert alert-info text-center">
          No races found for {{ selectedYear }}. Select a different year.
        </div>

        <!-- Map mode toggle -->
        <div *ngIf="segments.length > 0" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div class="btn-group">
            <button class="btn btn-sm" [ngClass]="mapMode === 'races' ? 'btn-primary' : 'btn-default'" (click)="onMapModeChange('races')">
              <i class="fa fa-list"></i> Race Segments
            </button>
            <button class="btn btn-sm" [ngClass]="mapMode === 'members' ? 'btn-primary' : 'btn-default'" (click)="onMapModeChange('members')">
              <i class="fa fa-users"></i> Member Segments
            </button>
          </div>
          <button class="btn btn-sm btn-default" (click)="resetMap()"><i class="fa fa-arrows-alt"></i> Reset Map</button>
        </div>

        <!-- Map -->
        <app-progress-map #progressMap
          [routeData]="routeData"
          [segments]="segments"
          [waypoints]="waypoints"
          [totalTeamMiles]="totalTeamMiles"
          [totalRouteMiles]="totalRouteMiles"
          [reachedEnd]="reachedEnd"
          (raceClick)="showRaceModal($event)"
          style="min-height: 500px; margin-bottom: 20px; display: block;">
        </app-progress-map>

        <!-- Table toggles -->
        <div class="btn-group" style="margin-bottom: 15px;" *ngIf="segments.length > 0 || waypoints.length > 0">
          <button class="btn btn-sm" [ngClass]="tableView === 'segments' ? 'btn-primary' : 'btn-default'" (click)="tableView = 'segments'">
            <i class="fa" [ngClass]="mapMode === 'members' ? 'fa-users' : 'fa-list'"></i>
            {{ mapMode === 'members' ? 'Member Segments' : 'Race Segments' }}
          </button>
          <button class="btn btn-sm" [ngClass]="tableView === 'waypoints' ? 'btn-primary' : 'btn-default'" (click)="tableView = 'waypoints'">
            <i class="fa fa-map-marker"></i> Waypoints
          </button>
        </div>

        <!-- Race segments table -->
        <div class="panel panel-default" *ngIf="tableView === 'segments' && mapMode !== 'members' && raceSegmentsReversed.length > 0">
          <div class="panel-heading"><h4 style="margin: 0;"><i class="fa fa-list"></i> Race Segments</h4></div>
          <div class="panel-body" style="padding: 0;">
            <table class="table table-striped table-condensed" style="margin-bottom: 0;">
              <thead><tr>
                <th style="width:30px;">#</th><th style="width:20px;"></th><th>Race</th><th>Date</th><th>Distance</th><th>Members</th><th>Team Miles</th><th>Cumulative</th><th>Waypoints Reached</th>
              </tr></thead>
              <tbody>
                <tr *ngFor="let seg of raceSegmentsReversed; let i = index">
                  <td>{{ raceSegmentsReversed.length - i }}</td>
                  <td><a class="hoverhandandunderline" (click)="centerOnSegment(seg)"><span [style.background]="seg.color" style="display:inline-block;width:14px;height:14px;border-radius:2px;"></span></a></td>
                  <td><a class="hoverhandandunderline resultEvent" (click)="showRaceModal(seg.race)">{{ seg.raceName }}</a></td>
                  <td>{{ seg.raceDate | date:'M/d/yyyy':'UTC' }}</td>
                  <td>{{ seg.raceTypeName }}</td>
                  <td>{{ seg.memberCount }}</td>
                  <td>{{ seg.teamMiles | number:'1.1-1' }}</td>
                  <td>{{ seg.endMile | number:'1.1-1' }}</td>
                  <td>
                    <span *ngIf="seg.waypointsReached?.length">
                      <i class="fa fa-map-marker" style="color: #28a745;"></i>
                      <span *ngFor="let wp of seg.waypointsReached; let last = last">
                        <a class="hoverhandandunderline" (click)="centerOnWaypoint(wp)">{{ wp.name }}</a>{{ last ? '' : ', ' }}
                      </span>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Member segments table -->
        <div class="panel panel-default" *ngIf="tableView === 'segments' && mapMode === 'members' && memberSegments.length > 0">
          <div class="panel-heading"><h4 style="margin: 0;"><i class="fa fa-users"></i> Member Segments</h4></div>
          <div class="panel-body" style="padding: 0;">
            <table class="table table-striped table-condensed" style="margin-bottom: 0;">
              <thead><tr>
                <th style="width:30px;">#</th><th style="width:20px;"></th><th>Member</th><th>Races</th><th>Miles</th><th>% of Total</th><th>Cumulative</th><th>Waypoints Reached</th>
              </tr></thead>
              <tbody>
                <tr *ngFor="let seg of memberSegments; let i = index" [class.my-member-row]="isCurrentUser(seg.username)">
                  <td>{{ i + 1 }}</td>
                  <td><a class="hoverhandandunderline" (click)="centerOnSegment(seg)"><span [style.background]="seg.color" style="display:inline-block;width:14px;height:14px;border-radius:2px;"></span></a></td>
                  <td><a [href]="'/members/member/' + seg.username">{{ seg.memberName }}</a></td>
                  <td>{{ seg.raceCount }}</td>
                  <td>{{ seg.teamMiles | number:'1.1-1' }}</td>
                  <td>{{ totalTeamMiles > 0 ? (seg.teamMiles / totalTeamMiles * 100 | number:'1.1-1') : '0.0' }}%</td>
                  <td>{{ seg.endMile | number:'1.1-1' }}</td>
                  <td>
                    <span *ngIf="seg.waypointsReached?.length">
                      <i class="fa fa-map-marker" style="color: #28a745;"></i>
                      <span *ngFor="let wp of seg.waypointsReached; let last = last">
                        <a class="hoverhandandunderline" (click)="centerOnWaypoint(wp)">{{ wp.name }}</a>{{ last ? '' : ', ' }}
                      </span>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Waypoints table -->
        <div class="panel panel-default" *ngIf="tableView === 'waypoints' && waypoints.length > 0">
          <div class="panel-heading"><h4 style="margin: 0;"><i class="fa fa-map-marker"></i> Route Waypoints</h4></div>
          <div class="panel-body" style="padding: 0;">
            <table class="table table-striped table-condensed" style="margin-bottom: 0;">
              <thead><tr>
                <th style="width:30px;">#</th><th>Waypoint</th><th>Mile Marker</th><th>Status</th>
                <th>{{ mapMode === 'members' ? 'Reached By' : 'Reached On' }}</th><th>Miles Remaining</th>
              </tr></thead>
              <tbody>
                <ng-container *ngFor="let wp of waypoints">
                  <tr *ngIf="!wp.isStart" [ngClass]="{'success': wp.reached, 'my-member-row': mapMode === 'members' && isCurrentUser(wp.reachedByMemberUsername)}">
                    <td>{{ wp.order }}</td>
                    <td><a class="hoverhandandunderline" (click)="centerOnWaypoint(wp)">{{ wp.name }}</a></td>
                    <td>{{ wp.mileMarker | number:'1.0-0' }}</td>
                    <td>
                      <span *ngIf="wp.reached" class="label label-success"><i class="fa fa-check"></i> Reached</span>
                      <span *ngIf="!wp.reached" class="label label-default">Not yet</span>
                    </td>
                    <td>
                      <span *ngIf="wp.reached && mapMode !== 'members' && wp.reachedByRaceDate" class="hoverhand" [title]="wp.reachedByRaceName">
                        {{ wp.reachedByRaceDate | date:'M/d/yyyy':'UTC' }}
                      </span>
                      <span *ngIf="wp.reached && mapMode === 'members' && wp.reachedByMemberName">
                        <a [href]="'/members/member/' + wp.reachedByMemberUsername">{{ wp.reachedByMemberName }}</a>
                      </span>
                      <span *ngIf="!wp.reached" class="text-muted">-</span>
                    </td>
                    <td>
                      <span *ngIf="!wp.reached">{{ wp.milesRemaining | number:'1.0-0' }} mi</span>
                      <span *ngIf="wp.reached" class="text-muted">-</span>
                    </td>
                  </tr>
                </ng-container>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ProgressMapStatsComponent implements OnInit {
  @ViewChild('progressMap') progressMapRef!: ProgressMapComponent;

  routesList = PROGRESS_ROUTES;
  yearsList: number[] = [];
  selectedYear: number;
  selectedRoute: ProgressRoute;
  loading = true;
  mapMode = 'races';
  tableView = 'segments';

  routeData: any = null;
  allRaces: any[] = [];
  segments: any[] = [];
  raceSegments: any[] = [];
  raceSegmentsReversed: any[] = [];
  memberSegments: any[] = [];
  waypoints: any[] = [];
  totalTeamMiles = 0;
  totalRouteMiles = 0;
  progressPercent = '0.0';
  reachedEnd = false;
  nextWaypoint: any = null;
  waypointsReachedCount = 0;
  waypointsTotalCount = 0;

  constructor(
    private memoryCacheService: MemoryCacheService,
    private authStateService: AuthStateService,
    private resultsService: ResultsService
  ) {
    const currentYear = new Date().getFullYear();
    for (let i = currentYear; i >= 2013; i--) {
      this.yearsList.push(i);
    }
    this.selectedYear = currentYear;

    // Restore last route from localStorage
    const savedKey = localStorage.getItem('progressMapRouteKey');
    const savedMode = localStorage.getItem('progressMapMode');
    this.selectedRoute = PROGRESS_ROUTES[0];
    if (savedKey) {
      const found = PROGRESS_ROUTES.find(r => r.key === savedKey);
      if (found) this.selectedRoute = found;
    }
    if (savedMode === 'members') this.mapMode = 'members';
  }

  ngOnInit(): void {
    this.loadProgressMap();
  }

  onYearChange(): void {
    if (this.routeData && this.allRaces) {
      this.buildSegments(this.allRaces, this.routeData);
    }
  }

  onRouteChange(): void {
    if (!this.selectedRoute) return;
    localStorage.setItem('progressMapRouteKey', this.selectedRoute.key);
    this.loading = true;
    this.fetchRoute(this.selectedRoute).then(routeData => {
      this.routeData = routeData;
      if (this.allRaces) {
        this.buildSegments(this.allRaces, routeData);
      }
      this.loading = false;
    });
  }

  onMapModeChange(mode: string): void {
    this.mapMode = mode;
    this.segments = mode === 'members' ? this.memberSegments : this.raceSegments;
    this.tableView = 'segments';
    localStorage.setItem('progressMapMode', mode);
  }

  centerOnWaypoint(wp: any): void {
    if (this.progressMapRef) {
      this.progressMapRef.centerOnPoint(wp.lat, wp.lng);
    }
  }

  centerOnSegment(seg: any): void {
    if (seg.coords && seg.coords.length >= 2 && this.progressMapRef) {
      const bounds = seg.coords.map((c: number[]) => [c[1], c[0]] as [number, number]);
      this.progressMapRef.fitBounds(bounds);
    }
  }

  resetMap(): void {
    if (this.progressMapRef) {
      this.progressMapRef.resetView();
    }
  }

  showRaceModal(race: any): void {
    if (race) {
      this.resultsService.showRaceModal(race);
    }
  }

  isCurrentUser(username: string): boolean {
    const user = this.authStateService.currentUser;
    return user && user.member && user.member.username === username;
  }

  private async loadProgressMap(): Promise<void> {
    this.loading = true;
    try {
      const [routeData, races] = await Promise.all([
        this.fetchRoute(this.selectedRoute),
        this.resultsService.getRaceResultsWithCacheSupport({ sort: '-racedate -order racename', preload: false })
      ]);
      this.routeData = routeData;
      this.allRaces = races;
      this.buildSegments(races, routeData);
    } catch (e) {
      console.error('Error loading progress map:', e);
    }
    this.loading = false;
  }

  private async fetchRoute(routeConfig: ProgressRoute): Promise<any> {
    const cached = this.memoryCacheService.get('progressMapRoute', routeConfig.key);
    if (cached) return cached;

    const res = await fetch('data/routes/' + routeConfig.key + '.json');
    const routeData = await res.json();
    routeData.cumulativeMiles = this.buildCumulativeDistances(routeData.geometry.coordinates);
    this.memoryCacheService.set('progressMapRoute', routeConfig.key, routeData);
    return routeData;
  }

  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3958.8;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private buildCumulativeDistances(coords: number[][]): number[] {
    const cumulative = [0];
    for (let i = 1; i < coords.length; i++) {
      const d = this.haversineDistance(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
      cumulative.push(cumulative[i - 1] + d);
    }
    return cumulative;
  }

  private interpolatePosition(cumulativeMiles: number[], coords: number[][], targetMile: number): any {
    const maxMile = cumulativeMiles[cumulativeMiles.length - 1];
    if (targetMile >= maxMile) return { index: coords.length - 1, coord: coords[coords.length - 1], atEnd: true };
    if (targetMile <= 0) return { index: 0, coord: coords[0], atEnd: false };
    let lo = 0, hi = cumulativeMiles.length - 1;
    while (lo < hi - 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (cumulativeMiles[mid] <= targetMile) lo = mid; else hi = mid;
    }
    const segLen = cumulativeMiles[hi] - cumulativeMiles[lo];
    const fraction = segLen > 0 ? (targetMile - cumulativeMiles[lo]) / segLen : 0;
    const lng = coords[lo][0] + fraction * (coords[hi][0] - coords[lo][0]);
    const lat = coords[lo][1] + fraction * (coords[hi][1] - coords[lo][1]);
    return { index: lo, coord: [lng, lat], atEnd: false };
  }

  private extractSegmentCoords(cumulativeMiles: number[], coords: number[][], startMile: number, endMile: number): number[][] {
    const startPos = this.interpolatePosition(cumulativeMiles, coords, startMile);
    const endPos = this.interpolatePosition(cumulativeMiles, coords, endMile);
    const result = [startPos.coord];
    for (let i = startPos.index + 1; i <= endPos.index; i++) result.push(coords[i]);
    result.push(endPos.coord);
    return result;
  }

  private buildSegments(races: any[], routeData: any): void {
    const filteredRaces = races.filter((race: any) => {
      return new Date(race.racedate).getUTCFullYear() === this.selectedYear;
    });

    filteredRaces.sort((a: any, b: any) => {
      const d = new Date(a.racedate).getTime() - new Date(b.racedate).getTime();
      if (d !== 0) return d;
      const nameA = (a.racename || '').toLowerCase();
      const nameB = (b.racename || '').toLowerCase();
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return (a._id || '') < (b._id || '') ? -1 : 1;
    });

    const colors = [
      '#007bff', '#28a745', '#ffc107', '#fd7e14', '#e83e8c',
      '#dc3545', '#6f42c1', '#20c997', '#17a2b8', '#6c757d',
      '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57'
    ];

    const waypointMarkers: any[] = [];
    if (routeData.orderedStops) {
      for (let w = 1; w < routeData.orderedStops.length; w++) {
        const stop = routeData.orderedStops[w];
        waypointMarkers.push({ name: stop.name, lat: stop.lat, lng: stop.lng, mileMarker: stop.mileMarker });
      }
    }

    let cumulativeMile = 0;
    const segs: any[] = [];
    const maxRouteMiles = routeData.cumulativeMiles[routeData.cumulativeMiles.length - 1];
    const memberMap: Record<string, any> = {};

    filteredRaces.forEach((race: any, index: number) => {
      if (!race.racetype) return;
      const isVariable = race.racetype.isVariable;
      let raceMiles = 0;
      let memberCount = 0;

      if (race.results && race.results.length > 0) {
        race.results.forEach((result: any) => {
          if (result.members && result.members.length > 0) {
            memberCount += result.members.length;
            let milesPerResult = 0;
            if (result.legs && result.legs.length > 0) {
              result.legs.forEach((leg: any) => { if (leg.legType === 'run' && leg.miles) milesPerResult += leg.miles; });
            } else if (isVariable) {
              milesPerResult = result.miles || 0;
            } else if (race.racetype.miles) {
              milesPerResult = race.racetype.miles;
            }
            raceMiles += milesPerResult;
            if (milesPerResult > 0) {
              const milesPerMember = milesPerResult / result.members.length;
              result.members.forEach((member: any) => {
                if (!memberMap[member._id]) {
                  memberMap[member._id] = { _id: member._id, firstname: member.firstname, lastname: member.lastname, username: member.username, totalMiles: 0, raceCount: 0 };
                }
                memberMap[member._id].totalMiles += milesPerMember;
                memberMap[member._id].raceCount += 1;
              });
            }
          }
        });
      }
      if (raceMiles === 0) return;

      const startMile = cumulativeMile;
      const endMile = cumulativeMile + raceMiles;
      const wpReached: any[] = [];
      waypointMarkers.forEach(wm => { if (wm.mileMarker > startMile && wm.mileMarker <= endMile) wpReached.push({ name: wm.name, lat: wm.lat, lng: wm.lng }); });

      const cappedStart = Math.min(startMile, maxRouteMiles);
      const cappedEnd = Math.min(endMile, maxRouteMiles);
      let coords: number[][] = [];
      if (cappedStart < maxRouteMiles) {
        coords = this.extractSegmentCoords(routeData.cumulativeMiles, routeData.geometry.coordinates, cappedStart, cappedEnd);
      }

      let distanceDisplay = race.racetype.name || '';
      if (race.isMultisport) {
        const runLegs: string[] = [];
        if (race.results && race.results[0] && race.results[0].legs) {
          race.results[0].legs.forEach((leg: any) => { if (leg.legType === 'run' && leg.distanceName) runLegs.push(leg.distanceName); });
        }
        distanceDisplay = runLegs.length === 1 ? runLegs[0] : (runLegs.length > 1 ? 'various' : 'run');
      } else if (isVariable) {
        const perMemberMiles = race.results && race.results[0] ? (race.results[0].miles || 0) : 0;
        distanceDisplay = race.distanceName || (perMemberMiles.toFixed(1) + ' mi');
      }

      segs.push({ race, raceName: race.racename, raceDate: race.racedate, raceTypeName: distanceDisplay, teamMiles: raceMiles, memberCount, startMile, endMile, color: colors[index % colors.length], coords, waypointsReached: wpReached });
      cumulativeMile = endMile;
    });

    this.raceSegments = segs;
    this.raceSegmentsReversed = segs.slice().reverse();
    this.totalTeamMiles = cumulativeMile;
    this.totalRouteMiles = maxRouteMiles;
    this.progressPercent = maxRouteMiles > 0 ? Math.min(100, cumulativeMile / maxRouteMiles * 100).toFixed(1) : '0.0';
    this.reachedEnd = cumulativeMile >= maxRouteMiles;

    // Waypoint-race lookup
    const waypointReachedByRace: Record<string, any> = {};
    segs.forEach(seg => { (seg.waypointsReached || []).forEach((wp: any) => { waypointReachedByRace[wp.name] = { raceName: seg.raceName, raceDate: seg.raceDate }; }); });

    this.nextWaypoint = null;
    if (routeData.orderedStops) {
      this.waypoints = routeData.orderedStops.map((stop: any, idx: number) => {
        const isStart = idx === 0;
        const reached = isStart || cumulativeMile >= stop.mileMarker;
        const wp: any = { order: idx, name: stop.name, lat: stop.lat, lng: stop.lng, mileMarker: stop.mileMarker, reached, isStart, milesRemaining: reached ? 0 : stop.mileMarker - cumulativeMile };
        if (reached && !isStart && waypointReachedByRace[stop.name]) {
          wp.reachedByRaceName = waypointReachedByRace[stop.name].raceName;
          wp.reachedByRaceDate = waypointReachedByRace[stop.name].raceDate;
        }
        return wp;
      });
      for (let n = 1; n < this.waypoints.length; n++) {
        if (!this.waypoints[n].reached) { this.nextWaypoint = this.waypoints[n]; break; }
      }
    }

    this.waypointsReachedCount = this.waypoints.filter((wp: any) => wp.reached && !wp.isStart).length;
    this.waypointsTotalCount = this.waypoints.length > 0 ? this.waypoints.length - 1 : 0;

    // Member segments
    const memberContributions = Object.keys(memberMap).map(id => {
      const m = memberMap[id];
      m.percent = cumulativeMile > 0 ? (m.totalMiles / cumulativeMile * 100) : 0;
      return m;
    }).sort((a, b) => {
      const d = b.totalMiles - a.totalMiles;
      if (d !== 0) return d;
      const nameA = ((a.firstname || '') + ' ' + (a.lastname || '')).toLowerCase();
      const nameB = ((b.firstname || '') + ' ' + (b.lastname || '')).toLowerCase();
      return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
    });

    let memberCumMile = 0;
    this.memberSegments = memberContributions.map((member, idx) => {
      const mStart = memberCumMile;
      const mEnd = memberCumMile + member.totalMiles;
      const wpR: any[] = [];
      waypointMarkers.forEach(wm => { if (wm.mileMarker > mStart && wm.mileMarker <= mEnd) wpR.push({ name: wm.name, lat: wm.lat, lng: wm.lng }); });
      const cappedS = Math.min(mStart, maxRouteMiles);
      const cappedE = Math.min(mEnd, maxRouteMiles);
      let coords: number[][] = [];
      if (cappedS < maxRouteMiles) {
        coords = this.extractSegmentCoords(routeData.cumulativeMiles, routeData.geometry.coordinates, cappedS, cappedE);
      }
      memberCumMile = mEnd;
      return { memberName: member.firstname + ' ' + member.lastname, username: member.username, raceCount: member.raceCount, teamMiles: member.totalMiles, startMile: mStart, endMile: mEnd, color: colors[idx % colors.length], coords, waypointsReached: wpR, raceName: member.firstname + ' ' + member.lastname, raceDate: null, raceTypeName: member.raceCount + ' races', race: null };
    });

    // Attach member info to waypoints
    const waypointReachedByMember: Record<string, any> = {};
    this.memberSegments.forEach(seg => { (seg.waypointsReached || []).forEach((wp: any) => { waypointReachedByMember[wp.name] = { memberName: seg.memberName, username: seg.username }; }); });
    this.waypoints.forEach((wp: any) => {
      if (wp.reached && !wp.isStart && waypointReachedByMember[wp.name]) {
        wp.reachedByMemberName = waypointReachedByMember[wp.name].memberName;
        wp.reachedByMemberUsername = waypointReachedByMember[wp.name].username;
      }
    });

    this.segments = this.mapMode === 'members' ? this.memberSegments : this.raceSegments;
  }
}
