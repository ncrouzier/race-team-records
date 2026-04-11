import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatsNavComponent } from '../stats-nav/stats-nav.component';
import { WorldMapComponent } from '../../../shared/components/world-map/world-map.component';
import { UtilsService } from '../../../core/services/utils.service';
import { StatsService } from '../../../core/services/stats.service';

@Component({
  selector: 'app-world-map-stats',
  standalone: true,
  imports: [CommonModule, StatsNavComponent, WorldMapComponent],
  template: `
    <div class="jumbotron">
      <app-stats-nav></app-stats-nav>

      <div class="row text-left">
        <app-world-map
          [countryData]="countryMapData"
          (countryClick)="onCountryClick($event)"
          style="min-height: 700px; display: block;">
        </app-world-map>
      </div>

      <div class="row text-left" style="margin-top: 20px;">
        <div class="col-md-8 col-md-offset-2">
          <div class="panel panel-default">
            <div class="panel-heading">
              <h4><i class="fa fa-globe"></i> Countries with Races</h4>
            </div>
            <div class="panel-body" style="padding: 0;">
              <table class="table table-striped table-condensed" style="margin-bottom: 0;">
                <thead>
                  <tr>
                    <th style="width: 30px;">#</th>
                    <th>Country</th>
                    <th style="width: 100px;"># Races</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let country of countryStats; let i = index">
                    <td>{{ i + 1 }}</td>
                    <td>
                      <span style="font-size: 16px;">{{ country.flag }}</span>
                      {{ country.name }} ({{ country.code }})
                    </td>
                    <td>
                      <a class="hoverhandandunderline" (click)="goToResults({countries: [country.code]})">
                        {{ country.count }}
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
export class WorldMapStatsComponent implements OnInit {
  countryMapData: [string, number][] = [];
  countryStats: any[] = [];

  constructor(
    private utilsService: UtilsService,
    private statsService: StatsService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  private async loadData(): Promise<void> {
    const locationData = await this.utilsService.getLocationInfo({ type: 'country' });
    this.countryMapData = locationData;

    const stats = await this.statsService.getStats('All Time');
    this.countryStats = stats.countryStats;
  }

  onCountryClick(countryCode: string): void {
    this.goToResults({ countries: [countryCode] });
  }

  goToResults(query: any): void {
    window.location.href = '/results?search=' + encodeURIComponent(JSON.stringify(query));
  }
}
