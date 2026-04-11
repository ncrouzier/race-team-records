import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MembersNamesPipe } from '../../pipes/members-names.pipe';
import { MembersNamesWithAgePipe } from '../../pipes/members-names-with-age.pipe';

@Component({
  selector: 'app-result-members-names',
  standalone: true,
  imports: [CommonModule],
  template: `
    <a class="hoverhand" [href]="memberLink" [title]="tooltip">{{displayName}}</a>
  `
})
export class ResultMembersNamesComponent implements OnChanges {
  @Input() result: any;
  @Input() race: any;
  @Input() full = false;

  displayName = '';
  tooltip = '';
  memberLink = '';

  private namesPipe = new MembersNamesPipe();
  private namesWithAgePipe = new MembersNamesWithAgePipe();

  ngOnChanges(): void {
    if (!this.result?.members?.length) return;
    this.memberLink = '/members/' + this.result.members[0].username + '/bio';
    this.displayName = this.full
      ? this.namesPipe.transform(this.result.members)
      : this.namesPipe.transform(this.result.members, true, 25);
    this.tooltip = this.namesWithAgePipe.transform(this.result, this.race);
  }
}
