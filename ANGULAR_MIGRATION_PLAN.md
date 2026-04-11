# Master Plan: AngularJS → Angular 19+ Migration

## Context
The MCRRC Race Team Records app runs AngularJS 1.5.11 with Bootstrap 3, serving ~43 routes, 27 controllers, 14 services, 30 directives, 36 filters, and 66 templates (~8,000 lines HTML). The frontend is not mobile-optimized. This plan migrates to Angular 19+ incrementally — one section at a time — while making each section mobile-friendly. The Express.js backend (70 API endpoints) stays unchanged.

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Hybrid strategy** | `@angular/upgrade/static` (ngUpgrade) | Official path; shared services work across both frameworks; single page/DOM |
| **CSS framework** | Bootstrap 5 (Bootswatch Yeti) + SCSS | Existing templates are Bootstrap-class-heavy; Yeti theme exists for BS5; drop jQuery |
| **HTTP client** | `@angular/common/http` (HttpClient) | Replaces Restangular; native Angular |
| **UI components** | `@ng-bootstrap/ng-bootstrap` | Replaces ui-bootstrap modals, tooltips, datepickers, dropdowns |
| **Select/dropdown** | `@ng-select/ng-select` | Replaces angular-ui-select |
| **State management** | RxJS BehaviorSubjects + Angular Signals | Maps naturally from factory closures; no NgRx needed at this scale |
| **Build system** | Angular CLI alongside existing `build-js.mjs` during hybrid; sole build after cleanup | Angular CLI manages Angular code; old concat script handles AngularJS during transition |
| **Routing (hybrid)** | Angular Router owns migrated routes; UI Router owns legacy routes; URL partitioning | Routes move from UI Router → Angular Router phase by phase |
| **EJS shell** | Keep during hybrid; rewrite to minimal shell in final cleanup | Navbar is server-rendered with role-based EJS conditionals |

## Library Replacement Map

| AngularJS | Angular Replacement |
|-----------|-------------------|
| angular 1.5.11 | @angular/core 19+ |
| angular-ui-router | @angular/router |
| restangular | HttpClient |
| angular-bootstrap (ui-bootstrap) | @ng-bootstrap/ng-bootstrap |
| angular-dialog-service | NgbModal (from ng-bootstrap) |
| angular-ui-select | @ng-select/ng-select |
| angular-loading-bar | HTTP interceptor + custom or ngx-loading-bar |
| angular-utils-pagination | ngx-pagination |
| angular-local-storage | Native localStorage API |
| angular-notify | ngx-toastr |
| angular-sanitize | DomSanitizer (built-in) |
| jquery | Remove entirely |
| lodash | lodash-es (tree-shakeable) or native ES |
| moment | date-fns |
| chart.js | ng2-charts (wraps Chart.js) |
| datamaps + D3 v3 | Keep encapsulated; future tech debt |
| leaflet | Direct import or @asymmetrik/ngx-leaflet |
| nouislider | ngx-slider or direct nouislider |
| tinymce | @tinymce/tinymce-angular |
| jspdf | jspdf (npm, latest) |
| Dexie | dexie (npm, direct import — already framework-agnostic) |
| bower | npm (all deps move to npm) |
| Bootstrap 3 LESS | Bootstrap 5 SCSS |
| Font Awesome 4 | Font Awesome 6 |

---

## Phase 0: Foundation
**Goal:** Set up Angular 19 alongside AngularJS. No visible change to users.

### Steps
1. **Init Angular CLI project** — `ng new` in project root, output to `src/`. Configure `angular.json` to build to `public/dist/ng/`
2. **Install npm equivalents** — `@angular/upgrade`, `@ng-bootstrap/ng-bootstrap`, `@ng-select/ng-select`, `ng2-charts`, `ngx-pagination`, `ngx-toastr`, `date-fns`, `lodash-es`
3. **Configure hybrid bootstrap** — In `src/main.ts`, use `UpgradeModule` to bootstrap AngularJS. Remove `ng-app` from `views/index.ejs`. Load both bundles
4. **Dual build pipeline** — Angular CLI builds `public/dist/ng/main.js`; existing `build-js.mjs` continues. Add `build:ng:dev`, `build:ng:prod`, `watch:ng` npm scripts. Update `dev` to run both watchers
5. **Angular Router** — Set up `RouterModule` with no routes initially, HTML5 mode matching existing `$locationProvider` config
6. **SCSS structure** — Convert `public/less/variables.less` → `src/styles/_variables.scss`. Install Bootstrap 5 Yeti via npm. Use `ViewEncapsulation.Emulated` to prevent BS5 leaking into AngularJS templates
7. **Shared infrastructure** — Create `src/app/core/` and `src/app/shared/` directories. Create `ApiService` base class wrapping HttpClient with `/api/` base URL
8. **Testing** — Configure Jest for Angular. Set up E2E smoke tests (home page, member list, results, login)
9. **Mobile viewport** — Add `<meta name="viewport" content="width=device-width, initial-scale=1">` to `views/index.ejs`

### Files to modify
- `views/index.ejs` — Remove `ng-app`, add Angular bundle `<script>`, add viewport meta
- `package.json` — Add Angular dependencies and build scripts
- New: `src/`, `angular.json`, `tsconfig.json`, `src/main.ts`, `src/app/app.module.ts`

### Deliverable
App looks and behaves identically. Angular bootstraps alongside AngularJS but contributes nothing visible. Both build pipelines work. E2E tests pass.

---

## Phase 1: Shared Services & Auth
**Goal:** Migrate core services to Angular. Convert Auth pages (4 routes).

### 1a: Migrate Core Services (in order)
Each service: write in `src/app/core/services/`, downgrade to AngularJS via `downgradeInjectable`, remove old AngularJS file.

1. **AuthService** → `AuthStateService` — BehaviorSubject holding user state
2. **NotificationService** → Replace angular-notify with ngx-toastr
3. **SystemService** → `SystemInfoService` — HTTP interceptor for cache headers
4. **MemoryCacheService** → Port to TypeScript service
5. **DexieService** → Import Dexie from npm, create typed tables
6. **UtilsService** → Port state/country data, age calc, age grade API call (HttpClient)
7. **TeamRequirementsConfig** → Direct import of `config/teamRequirements.js`

### 1b: Migrate Auth Section (4 routes + profile)
- `/login` → `LoginComponent`
- `/signup` → `SignupComponent`
- `/forgot-password` → `ForgotPasswordComponent`
- `/reset-password/:token` → `ResetPasswordComponent`
- `/profile` → `ProfileComponent`

**Mobile:** Full-width forms on XS, min 44px touch targets, responsive form layout (BS5 grid)

### Files
- New: `src/app/core/services/*.ts`, `src/app/features/auth/*/`
- Remove: `public/js/services/AuthService.js`, `NotificationService.js`, `SystemService.js`, `MemoryCacheService.js`, `DexieService.js`, `UtilsService.js`
- Remove: `public/js/controllers/LoginCtrl.js`, `SignUpCtrl.js`, `ForgotPasswordCtrl.js`, `ResetPasswordCtrl.js`, `ProfileCtrl.js`
- Modify: `public/js/app.js` — Register downgraded Angular services
- Modify: `public/js/routes/appRoutes.js` — Remove auth routes (Angular Router owns them now)

---

## Phase 2: Tools Section
**Goal:** Migrate 3 self-contained tool routes.

### Routes
- `/tools/agegrade` → `AgeGradeComponent`
- `/tools/paceAdjustment` → `TempAdjustmentComponent`
- `/tools/resultExtractor` → `ResultExtractorComponent`

### Key work
- Port nouislider integration to `ngx-slider` or direct nouislider
- Migrate first batch of shared pipes: `TimeStringPipe`, `AgeGradePipe`

**Mobile:** Age grade table with horizontal scroll + sticky first column. Touch-friendly sliders. Responsive temp/dew point matrix.

### Files
- New: `src/app/features/tools/*/`, `src/app/shared/pipes/time-string.pipe.ts`, `age-grade.pipe.ts`
- Remove: `public/js/controllers/ToolsCtrl.js`, `ResultExtractorCtrl.js`

---

## Phase 3: Content & Home Page
**Goal:** Migrate home page and content pages (5 routes).

### Routes
- `/` → `HomeComponent`
- `/about` → `AboutComponent`
- `/contact` → `ContactComponent`
- `/gallery` → `GalleryComponent`
- `/notacult` → `ParkrunStatsComponent`

### Key work
- `HomeComponent` is the most complex here — it uses `ResultsService` and `MembersService` (not yet migrated). **Use `@angular/upgrade/static` `upgradeInjectable`** to wrap the AngularJS services for Angular consumption during this phase
- Migrate `raceList` directive → `RaceListComponent` (reusable for Phase 6)
- Migrate `resultIcon` directive → `ResultIconComponent`

**Mobile:** Home dashboard stacks vertically on XS. Race list becomes card layout on mobile. Achievement pagination simplified.

### Files
- New: `src/app/features/home/`, `src/app/features/content/*/`, `src/app/shared/components/race-list/`, `result-icon/`
- Remove: `public/js/controllers/HomeCtrl.js`, `ContactCtrl.js`, `GalleryCtrl.js`, `ParkrunStatsCtrl.js`

---

## Phase 4: Stats Section
**Goal:** Migrate Stats (7 routes) including StatsService.

### Routes
- `/stats/team` → `TeamStatsComponent`
- `/stats/us-map` → `UsMapComponent`
- `/stats/world-map` → `WorldMapComponent`
- `/stats/participation` → `ParticipationComponent`
- `/stats/members` → `MembersStatsComponent`
- `/stats/progress-map` → `ProgressMapComponent`
- `/stats/awards` → `AwardsComponent`

### Key work
- **Migrate `StatsService`** — Heavy computation functions are pure TypeScript; multi-layer caching reimplemented with RxJS (`shareReplay`, custom caching operators)
- Migrate map directives (`usaMap`, `worldMap`) → Angular components encapsulating D3/datamaps in `AfterViewInit`
- Migrate `progressMap` → Angular component with Leaflet
- Migrate chart directives → Angular components using `ng2-charts`
- **Keep D3 v3 + datamaps encapsulated** (tech debt for later)

**Mobile:** Horizontal scrollable tab bar for stats nav. Responsive charts (`responsive: true`). Touch-zoom maps. Horizontal scroll containers for data tables on XS.

### Files
- New: `src/app/features/stats/*/`, `src/app/features/stats/services/stats.service.ts`
- Remove: `public/js/controllers/StatsCtrl.js`, `ProgressMapCtrl.js`, `public/js/services/StatsService.js`
- Remove: `public/js/directives/progressMapDirective.js`, chart directives from `chartDirectives.js`

---

## Phase 5: Members Section
**Goal:** Migrate Members (8 routes) including MembersService.

### Routes
- `/members` → `MemberListComponent`
- `/members/:member/bio` → `MemberDetailComponent` + `MemberBioTabComponent`
- `/members/:member/stats` → `MemberStatsComponent`
- `/members/:member/head-to-head` → `HeadToHeadComponent`
- `/members/:member/head-to-head/:member2` → `HeadToHeadComponent`
- `/members/:member/volunteer-jobs` → `MemberVolunteerJobsComponent`

### Key work
- **Migrate `MembersService`** — CRUD + memory caching + 3 modals → NgbModal
- **Decompose `MembersController` (581 lines)** — Split monolith into `MemberListComponent`, `MemberDetailComponent`, `MemberBioTabComponent`
- Migrate TinyMCE integration for bio editing → `@tinymce/tinymce-angular`
- Migrate member directives (`resultMembersNames`, `teamRequirements`) → Angular components
- Migrate remaining filters → Pipes

**Mobile:** Member list becomes searchable card grid (single column on XS). Member detail uses tabbed interface. Head-to-head stacks vertically on XS. ng-select for member search with mobile-friendly dropdown.

### Files
- New: `src/app/features/members/*/`, `src/app/features/members/services/members.service.ts`
- Remove: `public/js/controllers/MembersCtrl.js`, `MemberStatsCtrl.js`, `HeadToHeadController.js`, `MemberVolunteerJobsCtrl.js`
- Remove: `public/js/services/MembersService.js`

---

## Phase 6: Results Section
**Goal:** Migrate Results (3 routes) including ResultsService — the highest-risk migration.

### Routes
- `/results` → `ResultsListComponent` + `ResultsFilterComponent`
- `/races/:raceId` → `RaceDetailComponent`
- `/records` → `RecordsComponent`

### Key work
- **Migrate `ResultsService` (740 lines, most complex service):**
  - CRUD operations: Restangular → HttpClient
  - 3-tier caching (memory → IndexedDB → API) → RxJS operators
  - In-flight deduplication → `shareReplay(1)` with ref counting
  - 6 modal methods → NgbModal
- Migrate form validation directives (`onlyDigitsForMinSec`, etc.) → Angular custom validators
- Migrate remaining pace/ranking directives → Angular components
- Migrate all remaining filters → Pipes

**Mobile:** Results as expandable cards on XS. Slide-in filter drawer on mobile. Race detail modal → full-screen on XS. Records: horizontal scroll or card layout.

### Files
- New: `src/app/features/results/*/`, `src/app/features/results/services/results.service.ts`
- Remove: `public/js/controllers/ResultsCtrl.js`, `RecordsCtrl.js`
- Remove: `public/js/services/ResultsService.js`

---

## Phase 7: Admin Section
**Goal:** Migrate admin-only pages (7 routes). Last because admin-only = lowest risk.

### Routes
- `/bulk` → `BulkOperationsComponent`
- `/racetypes` → `RaceTypesComponent`
- `/users` → `UsersComponent`
- `/volunteer-jobs` → `VolunteerJobsComponent`
- `/activitylogs` → `ActivityLogsComponent`
- `/report` → `ReportComponent`
- `/pdf` → `PdfComponent`
- `/stats/requirements` → `RequirementsComponent`

### Key work
- Migrate `VolunteerJobsService`, `UsersService`, `ActivityLogService`, `RequirementsService`
- Migrate 6 admin modal templates → NgbModal components
- Port jspdf, TinyMCE (report), file upload (bulk operations)

**Mobile:** Lower priority but still responsive. Bulk operations as step wizard. Card-based user/job lists.

### Files
- Remove: All remaining `public/js/controllers/` and `public/js/services/` files
- Remove: All remaining `public/js/directives/` and `public/js/filters.js`

---

## Phase 8: Final Cleanup
**Goal:** Remove all AngularJS code. Angular-only app.

### Steps
1. **Remove AngularJS** — Delete `@angular/upgrade`, `public/js/`, `public/libs/`, `bower.json`, `build-js.mjs`, `build-css.mjs`
2. **Rewrite EJS shell** — Minimal shell with `<app-root>`. Server injects user data as `window.__USER__` JSON. Angular `NavbarComponent` renders role-based nav (replaces 4 duplicated EJS navbar variants)
3. **Consolidate build** — Angular CLI is sole build system. Update `dev`, `build`, `prod`, `heroku-postbuild` scripts
4. **Performance** — Lazy-load route groups (Admin, Stats, Tools). `OnPush` change detection. Tree-shake lodash. Replace remaining moment → date-fns. Optional PWA via `@angular/service-worker`
5. **Remove Bootstrap 3** — Delete LESS files. Audit all templates for BS3→BS5 class changes (`col-xs-*` → `col-*`, `pull-right` → `float-end`, etc.)
6. **Full mobile audit** — Test all pages on mobile. Ensure 44px touch targets. Test modals as full-screen drawers on XS
7. **Accessibility** — ARIA labels, keyboard navigation, Lighthouse audit (target >90)

---

## Angular Project Structure

```
src/
  app/
    core/
      services/         # ApiService, AuthStateService, SystemInfoService, etc.
      interceptors/     # SystemInfoInterceptor, LoadingBarInterceptor
      guards/           # AuthGuard, AdminGuard
    shared/
      pipes/            # All 36 filters become pipes
      components/       # RaceListComponent, ResultIconComponent, TeamRequirements, etc.
      directives/       # OnlyDigitsDirective, etc.
    features/
      auth/             # Login, Signup, ForgotPassword, ResetPassword, Profile
      home/             # HomeComponent
      members/          # MemberList, MemberDetail, MemberStats, HeadToHead, etc.
      results/          # ResultsList, RaceDetail, Records
      stats/            # TeamStats, UsMap, WorldMap, Participation, etc.
      tools/            # AgeGrade, TempAdjustment, ResultExtractor
      admin/            # BulkOps, Racetypes, Users, VolunteerJobs, ActivityLogs, etc.
      content/          # About, Contact, Gallery, ParkrunStats
    app.module.ts
    app-routing.module.ts
    app.component.ts
  styles/
    _variables.scss
    styles.scss
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| **ResultsService caching complexity** | Port caching logic in isolation with comprehensive unit tests before touching UI |
| **BS3 + BS5 CSS conflicts during hybrid** | `ViewEncapsulation.Emulated` scopes BS5 to Angular components |
| **EJS navbar during hybrid** | Keep navbar in AngularJS until Phase 8; Angular routes use `href` links |
| **Modal interop** | Migrate modals alongside their parent service — never split |
| **MainController on body tag** | Keep as AngularJS until Phase 8; depends on downgraded services, so it works |
| **Rollback** | Each phase is a feature branch. Keep old AngularJS files in `legacy/` until E2E tests pass for 1 week |

## Verification (per phase)
1. `npm run build` — Both Angular and AngularJS bundles build without errors
2. E2E smoke tests pass — Home, members, results, login
3. Manual test of migrated section on desktop + mobile
4. No console errors (no `$injector` errors, no missing provider errors)
5. GA4 tracking still fires on all routes
