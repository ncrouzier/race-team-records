import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { NavComponent } from './shared/components/nav/nav.component';
import { RaceModalComponent } from './shared/modals/race-modal.component';
import { ResultDetailsModalComponent } from './shared/modals/result-details-modal.component';
import { RaceEditModalComponent } from './shared/modals/race-edit-modal.component';
import { ResultsService, RaceModalRequest } from './core/services/results.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavComponent, RaceModalComponent, ResultDetailsModalComponent, RaceEditModalComponent],
  template: `
<app-nav></app-nav>
<router-outlet></router-outlet>
<footer>
  <div class="row">
    <div class="col-sm-5 text-left">Site by <a class="hoverhand"
        href="/members/nicolascrouzier/bio">Nicolas Crouzier</a>. <span class="">Want to
        support the site and its creator? <a class="bold red"
          href="https://www.paypal.com/donate/?business=KN2D558FKKYQQ&no_recurring=1&item_name=Support+the+maintenance+of+the+team+result+site+by+buying+me+a+coffee+or+helping+me+pay+Strava+premium+membership!+Thank+you!&currency_code=USD">Buy
          me a coffee!</a></span></div>
    <div class="col-sm-2 text-center"><a class="transparent" href="/login">login</a></div>
    <div class="col-sm-5 text-right"><a href="/about">About Age Grading</a> --- <a
        title="Montgomery County Road Runners Club" href="https://www.mcrrc.org"
        target="_blank">MCRRC</a></div>
  </div>
</footer>

<!-- Global race modal host (triggered by ResultsService.showRaceModal) -->
<app-race-modal
  [visible]="globalRaceModalVisible"
  [raceinfo]="globalRaceModalRace"
  (closed)="globalRaceModalVisible = false"
  (showResultDetails)="onGlobalShowResultDetails($event)"
  (editRace)="onGlobalEditRace($event)">
</app-race-modal>
<app-result-details-modal
  [visible]="globalResultDetailsVisible"
  [result]="globalResultDetailsResult"
  [race]="globalResultDetailsRace"
  (closed)="globalResultDetailsVisible = false">
</app-result-details-modal>
<app-race-edit-modal
  [visible]="globalRaceEditModalVisible"
  [raceInput]="globalRaceEditInput"
  (saved)="onGlobalRaceEditSaved($event)"
  (closed)="globalRaceEditModalVisible = false">
</app-race-edit-modal>
  `
})
export class AppComponent implements OnInit, OnDestroy {
  globalRaceModalVisible = false;
  globalRaceModalRace: any = null;
  globalResultDetailsVisible = false;
  globalResultDetailsResult: any = null;
  globalResultDetailsRace: any = null;
  globalRaceEditModalVisible = false;
  globalRaceEditInput: any = null;

  private sub?: Subscription;

  constructor(private resultsService: ResultsService) {}

  ngOnInit(): void {
    this.sub = this.resultsService.raceModalRequest$.subscribe(async (req: RaceModalRequest) => {
      if (req.raceinfo) {
        this.globalRaceModalRace = req.raceinfo;
        this.globalRaceModalVisible = true;
      } else if (req.raceId) {
        // Fetch the race by ID then show the modal
        const race = await this.resultsService.getRaceById(req.raceId);
        if (race) {
          this.globalRaceModalRace = race;
          this.globalRaceModalVisible = true;
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onGlobalShowResultDetails(event: { result: any; race: any }): void {
    this.globalResultDetailsResult = event.result;
    this.globalResultDetailsRace = event.race;
    this.globalResultDetailsVisible = true;
  }

  onGlobalEditRace(race: any): void {
    this.globalRaceModalVisible = false;
    this.globalRaceEditInput = race;
    this.globalRaceEditModalVisible = true;
  }

  onGlobalRaceEditSaved(_updatedRace: any): void {
    // Could refresh data if needed — for now just close
  }
}
