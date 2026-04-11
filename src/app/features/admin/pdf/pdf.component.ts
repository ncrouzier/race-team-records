import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ResultsService } from '../../../core/services/results.service';
import { SecondsToTimeStringPipe } from '../../../shared/pipes/seconds-to-time-string.pipe';

declare var jsPDF: any;

@Component({
  selector: 'app-pdf',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="jumbotron">
      <button type="button" class="btn btn-primary" (click)="generatePdf()" [disabled]="generating">
        {{ generating ? 'Generating...' : 'Generate PDF Report' }}
      </button>
    </div>
  `
})
export class PdfComponent {
  generating = false;

  private timePipe = new SecondsToTimeStringPipe();

  constructor(private resultsService: ResultsService) {}

  async generatePdf(): Promise<void> {
    this.generating = true;

    try {
      const pdfreport = await this.resultsService.getResultsForPdf();

      const doc = new jsPDF('p');

      // Page 1: Title page
      doc.setFont('courier');
      doc.setFontSize(30);
      doc.text(35, 25, 'MCRRC Race Team Records');

      // Load cover image at runtime
      const response = await fetch('/images/ogimage.jpg');
      const blob = await response.blob();
      const reader = new FileReader();
      const imgData = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      doc.addImage(imgData, 'JPEG', 60, 40, 100, 100);

      doc.setFontSize(8);
      doc.text(10, 290, 'Document generated on ' + new Date().toISOString().split('T')[0]);

      // Page 2: Open Male
      doc.addPage();
      doc.setFontSize(11);
      doc.setFontType('bold');
      doc.setTextColor(26, 90, 133);
      doc.text(8, 7, 'Open Male:');
      doc.setTextColor(0, 0, 0);
      doc.setFontType('normal');
      this.renderCategory(doc, pdfreport.openMaleRecords.recordsList);

      // Page 3: Master Male
      doc.addPage();
      doc.setFontSize(11);
      doc.setFontType('bold');
      doc.setTextColor(26, 90, 133);
      doc.text(8, 7, 'Master Male:');
      doc.setTextColor(0, 0, 0);
      doc.setFontType('normal');
      this.renderCategory(doc, pdfreport.masterMaleRecords.recordsList);

      // Page 4: Open Female
      doc.addPage();
      doc.setFontSize(11);
      doc.setFontType('bold');
      doc.setTextColor(26, 90, 133);
      doc.text(8, 7, 'Open Female:');
      doc.setTextColor(0, 0, 0);
      doc.setFontType('normal');
      this.renderCategory(doc, pdfreport.openFemaleRecords.recordsList);

      // Page 5: Master Female
      doc.addPage();
      doc.setFontSize(11);
      doc.setFontType('bold');
      doc.setTextColor(26, 90, 133);
      doc.text(8, 7, 'Master Female:');
      doc.setTextColor(0, 0, 0);
      doc.setFontType('normal');
      this.renderCategory(doc, pdfreport.masterFemaleRecords.recordsList);

      doc.save('mcrrcRecords.pdf');
    } finally {
      this.generating = false;
    }
  }

  private renderCategory(doc: any, recordsList: any[]): void {
    let h = 12;

    recordsList.forEach((divRecords: any) => {
      const rt = divRecords.raceType;
      const results = divRecords.results;

      if (results.length === 0) {
        return;
      }

      doc.setFontSize(8);
      doc.setFontType('bold');
      doc.text(8, h, rt.name + ' (' + rt.surface + ')');
      doc.setFontType('normal');
      doc.setFontSize(5);
      h += 3;

      results.forEach((result: any, index: number) => {
        const members = result.members.map((m: any) => m.firstname + ' ' + m.lastname).join(' & ');
        const place = index + 1;
        const timeFormatted = this.timePipe.transform(result.time);
        const raceDate = new Date(result.race.racedate).toISOString().split('T')[0];

        doc.text(10, h, place + '. ' + timeFormatted + ' - ' + members + '; ' + result.race.racename + ' ' + raceDate);
        h += 2;
      });
    });
  }
}
