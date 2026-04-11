import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ResultsService } from '../../../core/services/results.service';
import { SecondsToTimeStringPipe } from '../../../shared/pipes/seconds-to-time-string.pipe';

@Component({
  selector: 'app-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="jumbotron">
      <!-- Report Generator (shown on /report route) -->
      <div *ngIf="!isMcrrcReport">
        <div class="row">
          <div class="col-md-5">
            <label>From:</label>
            <input type="date" class="form-control" [(ngModel)]="dateFrom">
          </div>
          <div class="col-md-5">
            <label>To:</label>
            <input type="date" class="form-control" [(ngModel)]="dateTo">
          </div>
          <div class="col-md-2">
            <button type="button" style="margin-top:34px" class="btn btn-primary"
                    (click)="getReports()" [disabled]="!dateFrom || !dateTo">
              Generate Reports
            </button>
          </div>
        </div>
        <div class="row" *ngIf="raceInfosList">
          The team raced {{numberOfResults}} times in {{raceInfosList.length}} races!
        </div>
        <br><br>
        <div class="row" *ngIf="reportHTML">
          <div class="col-md-6">
            HTML
            <textarea class="form-control" style="height:200px;" [(ngModel)]="reportHTML"></textarea>
          </div>
          <div class="col-md-6">
            Rendered HTML
            <div style="background-color:#FFF;height:200px;overflow: scroll;" [innerHTML]="reportHTML"></div>
          </div>
        </div>
        <div class="row" *ngIf="reportText">
          <div class="col-md-12">
            Text
            <textarea class="form-control" rows="30" [(ngModel)]="reportText"></textarea>
          </div>
        </div>
      </div>

      <!-- MCRRC Report (auto-loaded from query params) -->
      <div *ngIf="isMcrrcReport">
        <div class="col-md-12">
          Report
          <div style="background-color:#FFF;width:430px;height:600px;overflow: scroll;" [innerHTML]="reportHTML"></div>
        </div>
      </div>
    </div>
  `
})
export class ReportComponent implements OnInit {
  dateFrom = '';
  dateTo = '';
  raceInfosList: any[] | null = null;
  numberOfResults = 0;
  reportText = '';
  reportHTML = '';
  isMcrrcReport = false;

  private timePipe = new SecondsToTimeStringPipe();

  constructor(
    private resultsService: ResultsService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const path = this.route.snapshot.routeConfig?.path;

    if (path === 'mcrrcreport') {
      this.isMcrrcReport = true;
      const from = this.route.snapshot.queryParamMap.get('from');
      const to = this.route.snapshot.queryParamMap.get('to');
      if (from && to) {
        this.loadMcrrcReport(from, to);
      }
    } else {
      // Default date range: 7 days ago to today
      const today = new Date();
      const weekAgo = new Date();
      weekAgo.setDate(today.getDate() - 6);
      this.dateTo = this.formatDate(today);
      this.dateFrom = this.formatDate(weekAgo);
    }
  }

  getReports(): void {
    this.getResults();
  }

  private async getResults(): Promise<void> {
    const raceInfosList = await this.resultsService.getRacesInfos({
      filters: {
        dateFrom: new Date(this.dateFrom).getTime(),
        dateTo: new Date(this.dateTo).getTime()
      },
      sort: '-race.racedate -race.order race.racename'
    });

    this.raceInfosList = raceInfosList;
    this.numberOfResults = raceInfosList.reduce((res: number, ri: any) => res + ri.results.length, 0);

    // Build plain text report
    let reportText = '';
    raceInfosList.forEach((raceinfo: any) => {
      reportText += raceinfo.racename + ' -- ' + this.formatDate(raceinfo.racedate) + '\n';
      raceinfo.results.forEach((result: any) => {
        const members = result.members.map((m: any) => m.firstname + ' ' + m.lastname).join(' & ');
        reportText += members + ' ' + this.timePipe.transform(result.time);
        const rankLine = this.rankTooltipOneLine(result.ranking);
        if (result.ranking && rankLine !== '') {
          reportText += ' (' + rankLine + ')';
        }
        reportText += '\n';
      });
      reportText += '\n';
    });
    this.reportText = reportText;

    // Build HTML report
    let html = '<table style="width:400px;border:1px;border-collapse: collapse;color:#646464;">';
    raceInfosList.forEach((raceinfo: any) => {
      html += '<thead><tr style="color: #FA4D19; font-size: 18px;border-bottom-width: 1px;border-bottom-style: dashed;"><th style="text-align:center;" colspan="5">'
        + raceinfo.racename + ' - ' + this.formatDate(raceinfo.racedate)
        + '</th></tr><tr style="color: #19c6fa; font-weight:bold"><th style="text-align:center;border-bottom: 1px solid #E6E6E6;font-size: 16px;" rowspan="2">Racer</th><th style="text-align:center;font-size: 14px;" colspan="3">Finish Place</th><th style="text-align:center;border-bottom: 1px solid #E6E6E6;font-size: 16px;" rowspan="2">Time</th></tr><tr style="border-bottom: 1px solid #E6E6E6;" ><th style="text-align:center;font-weight:normal;font-size:12px;">Age</th><th style="text-align:center;font-weight:normal;font-size:12px;">Gender</th><th style="text-align:center;font-weight:normal;font-size:12px;">Overall</th></tr></thead>';
      raceinfo.results.forEach((result: any) => {
        const members = result.members.map((m: any) => m.firstname + ' ' + m.lastname).join(' & ');
        html += '<tr><td style="font-weight:bold;">' + members + '</td>'
          + this.rankTooltipTd(result.ranking)
          + '<td style="text-align: center;"><span style="cursor:pointer;" title="pace: ' + this.resultToPace(result, raceinfo) + '">'
          + this.timePipe.transform(result.time) + '</span></td></tr>';
      });
    });
    html += '</table><span style="color:#646464;font-size:12px;">See all results from the MCRRC racing team at <a href="http://raceteam.mcrrc.org" target="_blank">raceteam.mcrrc.org</a></span>';
    this.reportHTML = html;
  }

  private async loadMcrrcReport(from: string, to: string): Promise<void> {
    const results = await this.resultsService.getResults({
      filters: {
        datefrom: from,
        dateto: to
      },
      sort: '-race.racedate -race.order race.racename time ranking.overallrank members.firstname'
    });

    let html = '<table style="width:400px;border:1px;border-collapse: collapse;color:#646464;">';
    let lastEvent = '';
    let lastDate = '';

    results.forEach((result: any) => {
      const members = result.members.map((m: any) => m.firstname + ' ' + m.lastname).join(' & ');

      if (result.race.racename !== lastEvent || result.race.racedate !== lastDate) {
        if (html !== '<table style="width:400px;border:1px;border-collapse: collapse;color:#646464;">') {
          html += '<tr style="height: 30px;"></tr>';
        }
        html += '<thead><tr style="color: #FA4D19; font-size: 18px;border-bottom-width: 1px;border-bottom-style: dashed;"><th style="text-align:center;" colspan="5">'
          + result.race.racename + ' - ' + this.formatDate(result.race.racedate)
          + '</th></tr><tr style="color: #19c6fa; font-weight:bold"><th style="text-align:center;border-bottom: 1px solid #E6E6E6;font-size: 16px;" rowspan="2">Racer</th><th style="text-align:center;font-size: 14px;" colspan="3">Finish Place</th><th style="text-align:center;border-bottom: 1px solid #E6E6E6;font-size: 16px;" rowspan="2">Time</th></tr><tr style="border-bottom: 1px solid #E6E6E6;" ><th style="text-align:center;font-weight:normal;font-size:12px;">Age</th><th style="text-align:center;font-weight:normal;font-size:12px;">Gender</th><th style="text-align:center;font-weight:normal;font-size:12px;">Overall</th></tr></thead>';
      }

      html += '<tr><td style="font-weight:bold;">' + members + '</td>'
        + this.rankTooltipTd(result.ranking)
        + '<td style="text-align: center;"><span style="cursor:pointer;" title="pace: ' + this.resultToPace(result, null) + '">'
        + this.timePipe.transform(result.time) + '</span></td></tr>';

      lastEvent = result.race.racename;
      lastDate = result.race.racedate;
    });

    html += '</table><span style="color:#646464;font-size:12px;">See all results from the MCRRC racing team at <a href="http://raceteam.mcrrc.org" target="_blank">raceteam.mcrrc.org</a></span>';
    this.reportHTML = html;
  }

  // =====================================
  // Helper methods
  // =====================================

  private formatDate(d: any): string {
    return new Date(d).toISOString().split('T')[0];
  }

  private resultToPace(result: any, raceinfo: any): string {
    const seconds = Math.ceil(result.time / 100);
    const distance = raceinfo ? raceinfo.racetype?.miles : result.race?.racetype?.miles;
    if (!distance) {
      return '';
    }
    let m = Math.floor((seconds / 60) / distance);
    let s = Math.round((((seconds / 60) / distance) % 1) * 60);
    if (s === 60) {
      m++;
      s = 0;
    }
    return m + ':' + (s < 10 ? '0' : '') + s + ' /mi';
  }

  private rankTooltipOneLine(ranking: any): string {
    if (!ranking) {
      return '';
    }
    let res = '';
    if (ranking.agerank) {
      res += 'Age group rank: ' + this.ordinalSuffix(ranking.agerank);
      if (ranking.agetotal) {
        res += ' of ' + ranking.agetotal;
      }
      res += ', ';
    }
    if (ranking.genderrank) {
      res += 'Gender rank: ' + this.ordinalSuffix(ranking.genderrank);
      if (ranking.gendertotal) {
        res += ' of ' + ranking.gendertotal;
      }
      res += ', ';
    }
    if (ranking.overallrank) {
      res += 'Overall rank: ' + this.ordinalSuffix(ranking.overallrank);
      if (ranking.overalltotal) {
        res += ' of ' + ranking.overalltotal;
      }
      res += ', ';
    }
    return res.slice(0, -2);
  }

  private rankTooltipTd(ranking: any): string {
    if (!ranking) {
      return '<td></td><td></td><td></td>';
    }
    let res = '';
    if (ranking.agerank) {
      res += '<td style="text-align: center;"><span style="cursor:pointer;" title="out of ' + ranking.agetotal + '">' + this.inlineOrdinalSuffix(ranking.agerank) + '</span></td>';
    } else {
      res += '<td></td>';
    }
    if (ranking.genderrank) {
      res += '<td style="text-align: center;"><span style="cursor:pointer;" title="out of ' + ranking.gendertotal + '">' + this.inlineOrdinalSuffix(ranking.genderrank) + '</span></td>';
    } else {
      res += '<td></td>';
    }
    if (ranking.overallrank) {
      res += '<td style="text-align: center;"><span style="cursor:pointer;" title="out of ' + ranking.overalltotal + '">' + this.inlineOrdinalSuffix(ranking.overallrank) + '</span></td>';
    } else {
      res += '<td></td>';
    }
    return res;
  }

  private ordinalSuffix(i: number): string {
    const j = i % 10;
    const k = i % 100;
    if (j === 1 && k !== 11) {
      return i + 'st';
    }
    if (j === 2 && k !== 12) {
      return i + 'nd';
    }
    if (j === 3 && k !== 13) {
      return i + 'rd';
    }
    return i + 'th';
  }

  private inlineOrdinalSuffix(i: number): string {
    const j = i % 10;
    const k = i % 100;
    if (j === 1 && k !== 11) {
      return i + '<span style="font-style: italic;vertical-align: super;font-size: 0.6em;">st</span>';
    }
    if (j === 2 && k !== 12) {
      return i + '<span style="font-style: italic;vertical-align: super;font-size: 0.6em;">nd</span>';
    }
    if (j === 3 && k !== 13) {
      return i + '<span style="font-style: italic;vertical-align: super;font-size: 0.6em;">rd</span>';
    }
    return i + '<span style="font-style: italic;vertical-align: super;font-size: 0.6em;">th</span>';
  }
}
