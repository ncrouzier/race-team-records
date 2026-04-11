import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatsNavComponent } from '../stats-nav/stats-nav.component';
import { UsaMapComponent } from '../../../shared/components/usa-map/usa-map.component';
import { UtilsService } from '../../../core/services/utils.service';
import { StatsService } from '../../../core/services/stats.service';

@Component({
  selector: 'app-us-map-stats',
  standalone: true,
  imports: [CommonModule, StatsNavComponent, UsaMapComponent],
  template: `
    <div class="jumbotron">
      <app-stats-nav></app-stats-nav>

      <div class="row text-left">
        <app-usa-map
          [stateData]="stateMapData"
          (stateClick)="onStateClick($event)"
          style="min-height: 700px; display: block;">
        </app-usa-map>
      </div>

      <div class="row text-left" style="margin-top: 20px;">
        <div class="col-md-8 col-md-offset-2">
          <div class="panel panel-default">
            <div class="panel-heading">
              <h4><i class="fa fa-list"></i> States with Races</h4>
            </div>
            <div class="panel-body" style="padding: 0;">
              <table class="table table-striped table-condensed" style="margin-bottom: 0;">
                <thead>
                  <tr>
                    <th style="width: 30px;">#</th>
                    <th>State</th>
                    <th style="width: 100px;"># Races</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let state of stateStats; let i = index">
                    <td>{{ i + 1 }}</td>
                    <td>
                      <img *ngIf="state.flag" [src]="state.flag" alt="State flag"
                           style="width: 20px; height: 15px;"
                           (error)="$any($event.target).style.display='none'">
                      {{ state.name }} ({{ state.code }})
                    </td>
                    <td>
                      <a class="hoverhandandunderline" (click)="goToResults({states: [state.code]})">
                        {{ state.count }}
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class UsMapStatsComponent implements OnInit {
  stateMapData: [string, number][] = [];
  stateStats: any[] = [];

  constructor(
    private utilsService: UtilsService,
    private statsService: StatsService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  private async loadData(): Promise<void> {
    // Load map data from API for the map component
    const locationData = await this.utilsService.getLocationInfo({ type: 'state' });
    this.stateMapData = locationData;

    // Load stats for the table
    const stats = await this.statsService.getStats('All Time');
    this.stateStats = stats.stateStats;
  }

  onStateClick(stateCode: string): void {
    this.goToResults({ states: [stateCode] });
  }

  goToResults(query: any): void {
    window.location.href = '/results?search=' + encodeURIComponent(JSON.stringify(query));
  }
}
