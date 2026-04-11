import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatsNavComponent } from '../stats-nav/stats-nav.component';
import { MembersService } from '../../../core/services/members.service';

@Component({
  selector: 'app-awards',
  standalone: true,
  imports: [CommonModule, StatsNavComponent],
  template: `
    <div class="jumbotron">
      <app-stats-nav></app-stats-nav>

      <div style="margin-top: 20px;">
        <h2><i class="fa fa-trophy"></i> ROY & MUTROY Awards</h2>

        <div *ngIf="loading" class="text-center" style="padding: 40px;">
          <i class="fa fa-spinner fa-spin fa-2x"></i>
        </div>

        <div *ngIf="!loading && awardsByYear.length === 0" class="text-muted text-center" style="padding: 40px;">
          No awards found.
        </div>

        <div *ngFor="let yearGroup of awardsByYear" style="margin-bottom: 25px;">
          <h5 style="border-bottom: 2px solid #ddd; padding-bottom: 5px; margin-bottom: 10px;">
            {{ yearGroup.year }}
          </h5>
          <div class="row">
            <div class="col-sm-6 col-md-4" *ngFor="let award of yearGroup.awards" style="margin-bottom: 12px;">
              <div style="display: flex; align-items: center; gap: 10px; padding: 10px; background: #f9f9f9; border-radius: 4px; border: 1px solid #eee;">
                <img *ngIf="award.img" [src]="award.img" style="width: 32px; height: 32px;">
                <div>
                  <a [href]="'/members/member/' + award.member.username" style="font-weight: 600;">
                    {{ award.member.firstname }} {{ award.member.lastname }}
                  </a>
                  <br>
                  <small class="text-muted">
                    {{ award.typeName }}
                    <span *ngIf="award.category"> - {{ award.category }}</span>
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AwardsComponent implements OnInit {
  loading = true;
  awardsByYear: any[] = [];

  constructor(private membersService: MembersService) {}

  ngOnInit(): void {
    this.loadAwards();
  }

  private loadAwards(): void {
    this.loading = true;
    this.membersService.getMembersWithCacheSupport({
      select: 'firstname lastname username achievements sex'
    }).then((members: any[]) => {
      const awards: any[] = [];
      members.forEach((member: any) => {
        if (!member.achievements || member.achievements.length === 0) return;
        member.achievements.forEach((ach: any) => {
          if (ach.name !== 'ROY' && ach.name !== 'MUTROY') return;
          const yearMatch = ach.text && ach.text.match(/\b(20\d{2})\b/);
          const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
          let category = '';
          if (ach.text) {
            category = ach.text
              .replace(/Runner of the Year\s*/i, '')
              .replace(/Mountain\/Ultra\/Trail Runner of the Year\s*/i, '')
              .replace(/\b20\d{2}\b/, '')
              .trim();
          }
          awards.push({
            type: ach.name,
            typeName: ach.name === 'ROY' ? 'Runner of the Year' : 'Mountain/Ultra/Trail Runner of the Year',
            category,
            year,
            member: {
              firstname: member.firstname,
              lastname: member.lastname,
              username: member.username
            },
            img: ach.value && ach.value.img ? ach.value.img : null,
            text: ach.text
          });
        });
      });

      const yearMap: Record<string, any[]> = {};
      awards.forEach(award => {
        const key = award.year ? String(award.year) : 'Unknown';
        if (!yearMap[key]) yearMap[key] = [];
        yearMap[key].push(award);
      });

      const sortedYears = Object.keys(yearMap).sort((a, b) => {
        if (a === 'Unknown') return 1;
        if (b === 'Unknown') return -1;
        return parseInt(b, 10) - parseInt(a, 10);
      });

      this.awardsByYear = sortedYears.map(year => {
        const yearAwards = yearMap[year].sort((a: any, b: any) => {
          if (a.type !== b.type) return a.type === 'ROY' ? -1 : 1;
          return a.category.localeCompare(b.category);
        });
        return { year, awards: yearAwards };
      });

      this.loading = false;
    });
  }
}
