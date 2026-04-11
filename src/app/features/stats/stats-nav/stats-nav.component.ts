import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthStateService } from '../../../core/services/auth-state.service';

@Component({
  selector: 'app-stats-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <ul class="nav nav-tabs">
      <li role="presentation" routerLinkActive="active">
        <a routerLink="/stats/team">Team Stats</a>
      </li>
      <li role="presentation" routerLinkActive="active">
        <a routerLink="/stats/us-map">US Races Map</a>
      </li>
      <li role="presentation" routerLinkActive="active">
        <a routerLink="/stats/world-map">World Races Map</a>
      </li>
      <li role="presentation" routerLinkActive="active">
        <a routerLink="/stats/progress-map">Progress Map</a>
      </li>
      <li role="presentation" routerLinkActive="active">
        <a routerLink="/stats/awards">Awards</a>
      </li>
      @if (isAdmin()) {
        <li role="presentation" routerLinkActive="active">
          <a routerLink="/stats/participation">Participation Stats</a>
        </li>
        <li role="presentation" routerLinkActive="active">
          <a routerLink="/stats/members">Team Members Stats</a>
        </li>
      }
      <li role="presentation" routerLinkActive="active">
        <a routerLink="/stats/requirements">Requirements</a>
      </li>
    </ul>
  `
})
export class StatsNavComponent {
  constructor(private authStateService: AuthStateService) {}

  isAdmin(): boolean {
    const user = this.authStateService.currentUser;
    return user && user.role === 'admin';
  }
}
