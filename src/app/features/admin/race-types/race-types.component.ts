import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ResultsService } from '../../../core/services/results.service';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { RaceTypeModalComponent } from '../modals/race-type-modal.component';

@Component({
  selector: 'app-race-types',
  standalone: true,
  imports: [CommonModule, FormsModule, RaceTypeModalComponent],
  template: `
<div class="jumbotron">
  <div class="racetypes-header">
    <div class="row">
      <div class="col-md-8">
        <h2><i class="fa fa-flag-checkered"></i> Race Types</h2>
        <p class="text-muted">Manage and configure different types of races and their properties</p>
      </div>
      <div class="col-md-4 text-right">
        <div class="stats-summary">
          <div class="stat-item">
            <span class="stat-number">{{racetypesList.length}}</span>
            <span class="stat-label">Race Types</span>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="racetypes-content">
    <div class="row">
      <div class="col-md-8">
        <div class="panel panel-default">
          <div class="panel-heading">
            <h4><i class="fa fa-list"></i> All Race Types</h4>
            <div class="header-actions" *ngIf="user?.role === 'admin'">
              <button class="btn btn-primary btn-sm" (click)="showAddRaceTypeModal()">
                <i class="fa fa-plus"></i> Add Race Type
              </button>
            </div>
          </div>
          <div class="panel-body" style="padding: 0;">
            <div class="racetypes-list">
              <div class="racetype-item" *ngFor="let racetype of sortedRaceTypes"
                   [ngClass]="{ 'tracksurface-bg': racetype.surface === 'track', 'trailsurface-bg': racetype.surface === 'trail', 'roadsurface-bg': racetype.surface === 'road', 'ultrasurface-bg': racetype.surface === 'ultra', 'othersurface-bg': racetype.surface === 'other', 'multiplesurface-bg': racetype.surface === 'multiple' }">
                <div class="racetype-info">
                  <div class="racetype-name"><i class="fa fa-flag"></i> {{racetype.name}}</div>
                  <div class="racetype-details">
                    <span class="surface-badge" [ngClass]="getSurfaceClass(racetype.surface)">{{racetype.surface}}</span>
                    <span class="agegrade-status" [ngClass]="getAgeGradeStatusClass(racetype.hasAgeGradedInfo)">
                      <i class="fa" [ngClass]="getAgeGradeIcon(racetype.hasAgeGradedInfo)"></i>
                      {{getAgeGradeText(racetype.hasAgeGradedInfo)}}
                    </span>
                  </div>
                </div>
                <div class="racetype-actions" *ngIf="user?.role === 'admin'">
                  <button class="btn btn-sm btn-outline-primary" (click)="editRaceType(racetype)" title="Edit"><i class="fa fa-pencil"></i></button>
                  <button class="btn btn-sm btn-outline-danger" (click)="removeRaceType(racetype)" title="Remove"><i class="fa fa-trash"></i></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="panel panel-default">
          <div class="panel-heading"><h4><i class="fa fa-chart-pie"></i> Summary</h4></div>
          <div class="panel-body">
            <div class="summary-stats">
              <div class="summary-item"><div class="summary-number">{{racetypesList.length}}</div><div class="summary-label">Total Types</div></div>
              <div class="summary-item"><div class="summary-number">{{cachedStats.ageGradedCount}}</div><div class="summary-label">Age Graded</div></div>
              <div class="summary-item"><div class="summary-number">{{cachedStats.surfaceTypesCount}}</div><div class="summary-label">Surfaces</div></div>
            </div>
            <div class="surface-breakdown">
              <h5><i class="fa fa-tags"></i> Surface Types</h5>
              <div class="surface-item" *ngFor="let surface of cachedStats.surfaceBreakdown">
                <div class="surface-info">
                  <span class="surface-color" [ngClass]="getSurfaceClass(surface.name)"></span>
                  <span class="surface-name">{{surface.name}}</span>
                </div>
                <span class="surface-count">{{surface.count}}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <app-race-type-modal [raceType]="editingRaceType" [visible]="showModal" (saved)="onModalSaved($event)" (cancelled)="onModalCancelled()"></app-race-type-modal>
</div>
  `
})
export class RaceTypesComponent implements OnInit {
  racetypesList: any[] = [];
  cachedStats = { ageGradedCount: 0, surfaceTypesCount: 0, surfaceBreakdown: [] as any[] };
  showModal = false;
  editingRaceType: any = null;
  user: any;

  private _sortedRaceTypes: any[] = [];

  constructor(
    private resultsService: ResultsService,
    private authStateService: AuthStateService
  ) {}

  async ngOnInit(): Promise<void> {
    this.user = this.authStateService.currentUser;
    try {
      this.racetypesList = await this.resultsService.getRaceTypes({ sort: 'meters' });
      this.updateSortedRaceTypes();
      this.updateCachedStats();
    } catch (err) {
      console.error('Error loading race types:', err);
    }
  }

  get sortedRaceTypes(): any[] {
    return this._sortedRaceTypes;
  }

  private updateSortedRaceTypes(): void {
    this._sortedRaceTypes = [...this.racetypesList].sort((a, b) => (a.meters || 0) - (b.meters || 0));
  }

  updateCachedStats(): void {
    const ageGradedCount = this.racetypesList.filter(rt => rt.hasAgeGradedInfo === true).length;

    const surfaceMap: Record<string, number> = {};
    for (const rt of this.racetypesList) {
      if (rt.surface) {
        surfaceMap[rt.surface] = (surfaceMap[rt.surface] || 0) + 1;
      }
    }

    const surfaceBreakdown = Object.entries(surfaceMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    this.cachedStats = {
      ageGradedCount,
      surfaceTypesCount: Object.keys(surfaceMap).length,
      surfaceBreakdown
    };
  }

  getSurfaceClass(surface: string): string {
    return 'surface-' + surface.toLowerCase().replace(/\s+/g, '-');
  }

  getAgeGradeStatusClass(hasAgeGradedInfo: boolean | undefined): string {
    if (hasAgeGradedInfo === true) return 'agegrade-enabled';
    if (hasAgeGradedInfo === false) return 'agegrade-disabled';
    return 'agegrade-undefined';
  }

  getAgeGradeIcon(hasAgeGradedInfo: boolean | undefined): string {
    if (hasAgeGradedInfo === true) return 'fa-check-circle';
    if (hasAgeGradedInfo === false) return 'fa-times-circle';
    return 'fa-question-circle';
  }

  getAgeGradeText(hasAgeGradedInfo: boolean | undefined): string {
    if (hasAgeGradedInfo === true) return 'Age Graded';
    if (hasAgeGradedInfo === false) return 'Not Age Graded';
    return 'Age Graded Not Defined';
  }

  showAddRaceTypeModal(): void {
    this.editingRaceType = null;
    this.showModal = true;
  }

  editRaceType(racetype: any): void {
    this.editingRaceType = racetype;
    this.showModal = true;
  }

  async onModalSaved(formData: any): Promise<void> {
    try {
      if (this.editingRaceType) {
        await this.resultsService.editRaceType(this.editingRaceType._id, formData);
      } else {
        const newRaceType = await this.resultsService.createRaceType(formData);
        this.racetypesList.push(newRaceType);
      }
      this.showModal = false;
      this.updateSortedRaceTypes();
      this.updateCachedStats();
    } catch (err) {
      console.error('Error saving race type:', err);
    }
  }

  onModalCancelled(): void {
    this.showModal = false;
  }

  async removeRaceType(racetype: any): Promise<void> {
    if (!window.confirm('Are you sure you want to remove this race type?')) {
      return;
    }
    try {
      await this.resultsService.deleteRaceType(racetype);
      const index = this.racetypesList.indexOf(racetype);
      if (index > -1) {
        this.racetypesList.splice(index, 1);
      }
      this.updateSortedRaceTypes();
      this.updateCachedStats();
    } catch (err) {
      console.error('Error removing race type:', err);
    }
  }
}
