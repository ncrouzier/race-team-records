import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { SignupComponent } from './features/auth/signup/signup.component';
import { ForgotPasswordComponent } from './features/auth/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './features/auth/reset-password/reset-password.component';
import { ProfileComponent } from './features/auth/profile/profile.component';
import { AgeGradeComponent } from './features/tools/age-grade/age-grade.component';
import { TempAdjustmentComponent } from './features/tools/temp-adjustment/temp-adjustment.component';
import { ResultExtractorComponent } from './features/tools/result-extractor/result-extractor.component';
import { HomeComponent } from './features/home/home.component';
import { AboutComponent } from './features/content/about/about.component';
import { ContactComponent } from './features/content/contact/contact.component';
import { GalleryComponent } from './features/content/gallery/gallery.component';
import { ParkrunStatsComponent } from './features/content/parkrun-stats/parkrun-stats.component';
import { AuthGuard } from './core/guards/auth.guard';
import { TeamStatsComponent } from './features/stats/team-stats/team-stats.component';
import { UsMapStatsComponent } from './features/stats/us-map-stats/us-map-stats.component';
import { WorldMapStatsComponent } from './features/stats/world-map-stats/world-map-stats.component';
import { ProgressMapStatsComponent } from './features/stats/progress-map-stats/progress-map-stats.component';
import { AwardsComponent } from './features/stats/awards/awards.component';
import { ParticipationStatsComponent } from './features/stats/participation-stats/participation-stats.component';
import { MembersStatsComponent } from './features/stats/members-stats/members-stats.component';
import { RequirementsComponent } from './features/stats/requirements/requirements.component';
import { MemberListComponent } from './features/members/member-list/member-list.component';
import { MemberDetailComponent } from './features/members/member-detail/member-detail.component';
import { MemberStatsComponent } from './features/members/member-stats/member-stats.component';
import { MemberHeadToHeadComponent } from './features/members/member-head-to-head/member-head-to-head.component';
import { MemberH2hCompareComponent } from './features/members/member-h2h-compare/member-h2h-compare.component';
import { MemberVolunteerJobsComponent } from './features/members/member-volunteer-jobs/member-volunteer-jobs.component';
import { ResultsComponent } from './features/results/results.component';
import { RecordsComponent } from './features/results/records.component';
import { RaceTypesComponent } from './features/admin/race-types/race-types.component';
import { UsersComponent } from './features/admin/users/users.component';
import { ActivityLogsComponent } from './features/admin/activity-logs/activity-logs.component';
import { VolunteerJobsComponent } from './features/admin/volunteer-jobs/volunteer-jobs.component';
import { BulkOperationsComponent } from './features/admin/bulk-operations/bulk-operations.component';
import { ReportComponent } from './features/admin/report/report.component';
import { PdfComponent } from './features/admin/pdf/pdf.component';

export const routes: Routes = [
  // Home
  { path: '', component: HomeComponent, pathMatch: 'full' },
  // Auth routes
  { path: 'login', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password/:token', component: ResetPasswordComponent },
  { path: 'profile', component: ProfileComponent },
  // Tool routes
  { path: 'tools', redirectTo: 'tools/agegrade', pathMatch: 'full' },
  { path: 'tools/agegrade', component: AgeGradeComponent },
  { path: 'tools/paceAdjustment', component: TempAdjustmentComponent },
  { path: 'tools/result-extractor', component: ResultExtractorComponent, canActivate: [AuthGuard] },
  { path: 'moist', redirectTo: 'tools/paceAdjustment', pathMatch: 'full' },
  // Content routes
  { path: 'about', component: AboutComponent },
  { path: 'contact', component: ContactComponent },
  { path: 'gallery', component: GalleryComponent },
  { path: 'notacult', component: ParkrunStatsComponent },
  // Stats routes
  { path: 'stats', redirectTo: 'stats/team', pathMatch: 'full' },
  { path: 'stats/team', component: TeamStatsComponent },
  { path: 'stats/us-map', component: UsMapStatsComponent },
  { path: 'stats/world-map', component: WorldMapStatsComponent },
  { path: 'stats/progress-map', component: ProgressMapStatsComponent },
  { path: 'stats/awards', component: AwardsComponent },
  { path: 'stats/participation', component: ParticipationStatsComponent, canActivate: [AuthGuard] },
  { path: 'stats/members', component: MembersStatsComponent, canActivate: [AuthGuard] },
  { path: 'stats/requirements', component: RequirementsComponent },
  // Members routes
  { path: 'members', component: MemberListComponent },
  { path: 'members/:member', redirectTo: 'members/:member/bio', pathMatch: 'full' },
  { path: 'members/:member/bio', component: MemberDetailComponent },
  { path: 'members/:member/stats', component: MemberStatsComponent },
  { path: 'members/:member/head-to-head', component: MemberHeadToHeadComponent },
  { path: 'members/:member/head-to-head/:member2', component: MemberH2hCompareComponent },
  { path: 'members/:member/volunteer-jobs', component: MemberVolunteerJobsComponent },
  // Results routes
  { path: 'results', component: ResultsComponent },
  { path: 'races/:raceId', component: ResultsComponent },
  { path: 'records', component: RecordsComponent },
  // Admin routes
  { path: 'racetypes', component: RaceTypesComponent, canActivate: [AuthGuard] },
  { path: 'users', component: UsersComponent, canActivate: [AuthGuard] },
  { path: 'activitylogs', component: ActivityLogsComponent, canActivate: [AuthGuard] },
  { path: 'volunteer-jobs', component: VolunteerJobsComponent, canActivate: [AuthGuard] },
  { path: 'bulk', component: BulkOperationsComponent, canActivate: [AuthGuard] },
  { path: 'report', component: ReportComponent, canActivate: [AuthGuard] },
  { path: 'mcrrcreport', component: ReportComponent, canActivate: [AuthGuard] },
  { path: 'pdf', component: PdfComponent, canActivate: [AuthGuard] }
];

