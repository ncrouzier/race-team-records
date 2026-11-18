# Result Correction Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a logged-in, non-admin user linked to a member suggest corrections to their own result, and let admins review each request through the existing result and race edit modals.

**Architecture:** One shared module (`app/correctionRequests.js`, Node + browser like `app/resultStanding.js`) holds every rule: who may send, the editable fields, the old→new change list, and how a save closes a request. A Mongoose model and one routes file store and serve requests; the member form, the result page, the admin page and the two edit modals call those routes through one AngularJS service.

**Tech Stack:** Express + Mongoose 9, AngularJS 1.x with Bootstrap 3 classes, Jest (`tests/**/*.test.js`), Brevo mail transport (`transport.sendMail`).

**Spec:** `docs/superpowers/specs/2026-10-16-result-correction-requests-design.md`

## Global Constraints

- Admins never send requests: no button for them, and the server answers 403 to an admin account.
- Only one open request per result, whoever sent it.
- Editable result fields: time, category, result link, comments, the six `ranking` numbers, and for multisport results each leg's distance and time. Editable race fields: race name, date, location (country, state), distance (free text), surface (one of `['road', 'track', 'trail', 'ultra', 'other', 'multiple', 'pool', 'open water']`).
- Never editable: runners, custom options, age grade, record eligibility, achievements, multisport or not, the legs themselves (count, order, kind).
- Email goes to `process.env.MCRRC_FROM_EMAIL`, subject `Correction request: {runner(s)}, {race name} ({year})`, on create and on update; never on withdraw.
- Admin edit modals open with the **current** values; the request is shown above the form for reference only.
- Statuses: `open`, `handled`, `declined`, `withdrawn`. Done tab lists everything not `open`.
- Times are centiseconds. Race dates are compared as UTC `YYYY-MM-DD`.
- Highlight colour for changed fields: background `#fff8e1`, border `#f0ad4e` (the site's "yours" amber).
- The user commits their own work: at each **Commit** step, stage the files and stop; do not run `git commit` unless the user asks.

## Review Focus

1. **A field "changed" to the same value** (trailing spaces, `15:47` re-typed, same date) must not count as a change, and a request with no change and no note cannot be sent. → test in Task 1.
2. **A result with missing data** (no location, no state, variable race type with a `distanceName`, no ranking, no legs) must open the form and compute changes without errors. → test in Task 1.
3. **The second teammate on a relay** opening the form while a teammate's request is open sees "a correction is pending", not an error, and cannot send. → test in Task 1 (`requestRole`), Task 2 (409).
4. **An admin saving from a request another admin already closed** (or the member withdrew meanwhile): the edit is saved, the request is not reopened or double-closed, and the page reloads its list. → test in Task 1 (`afterSave` on a non-open request).
5. **A race date near midnight** (stored as UTC midnight) must not show as changed or shift by a day when the member leaves it alone. → test in Task 1.

---

### Task 1: Shared rules module

**Files:**
- Create: `app/correctionRequests.js`
- Modify: `scripts/build-js.mjs` (add `'app/correctionRequests.js'` to `libFiles`, after `'app/resultStanding.js'`)
- Test: `tests/correctionRequests.test.js`

**Interfaces:**
- Produces (UMD: `module.exports` in Node, `window.CorrectionRequests` in the browser):
  - `SURFACES: string[]` (the list in Global Constraints)
  - `formValues(result): Values`, the editable values of a result as one flat object. Keys: `time, category, resultlink, comments, overallrank, overalltotal, genderrank, gendertotal, agerank, agetotal, racename, racedate ('YYYY-MM-DD'), country, state, distance, surface, legs: [{ order, legName, legType, isTransition, distance, time }]`. `distance` = `race.racetype.isVariable && race.distanceName ? race.distanceName : race.racetype.name`; `surface` = `race.racetype.surface`; a leg's `distance` = its `distanceName` (empty for transitions). Missing values are `null`, never `undefined`.
  - `changesBetween(current: Values, suggested: Values): Change[]`, where `Change = { field, label, from, to, raceWide: boolean, legOrder?: number }`. Only real differences, after normalising (strings trimmed, empty → `null`, numbers compared as numbers). `field` is the `Values` key, or `leg.time` / `leg.distance` for legs. Labels: `Time, Category, Result link, Comments, Overall place, Overall out of, Gender place, Gender out of, Age group place, Age group out of, Race name, Date, Country, State, Distance, Surface`; leg labels `"{legName} time"` / `"{legName} distance"`. `raceWide` is true for the six race keys.
  - `describeChange(change): string`, e.g. `"Time: 15:57 → 15:47"`. Times formatted `H:MM:SS` or `M:SS` (centiseconds kept as `.cc` only when non-zero); empty shown as `—`.
  - `requestRole(user, result, openRequest): 'admin' | 'none' | 'can-send' | 'own-pending' | 'other-pending'`. `'none'` when not logged in, no `user.member`, or the member is not in `result.members`.
  - `editKinds(changes): { result: boolean, race: boolean }`
  - `keepOpenDefault(request): boolean`, true when `editKinds(request.changes)` has both kinds and `request.savedKinds` does not yet include both.
  - `afterSave(request, kind: 'result'|'race', keepOpen: boolean, adminUser, now: Date): Patch | null`. `null` when `request.status !== 'open'`. Otherwise `{ savedKinds }` (with `kind` added) when `keepOpen`, else `{ savedKinds, status: 'handled', closedAt: now, closedBy: { _id, username } }`.

- [ ] **Step 1: Write the failing tests** in `tests/correctionRequests.test.js`, built on one 5k result fixture (time `95700`, overall `3/412`, race `Country Road 5K`, `racedate: new Date('2026-09-20T00:00:00Z')`, location `USA/MD`, racetype `{ name: '5k', surface: 'road' }`) and one multisport fixture (legs Swim, T1, Bike, T2, Run). Cases:
  - `formValues` gives `racedate: '2026-09-20'`, `distance: '5k'`, `surface: 'road'`; for a variable race type with `distanceName: '5.2 miles'` gives `distance: '5.2 miles'`; a result with no location, no ranking and no legs gives `country: null`, `overallrank: null`, `legs: []` (Review Focus 2).
  - `changesBetween(v, v)` is `[]`; same values with `' Master '` and the date unchanged is `[]` (Review Focus 1, 5).
  - time `95700 → 94700` and overall `3 → 2` give exactly two changes with labels `Time`, `Overall place`, `raceWide: false`.
  - date `'2026-09-20' → '2026-09-27'` gives one change, `raceWide: true`.
  - bike leg time change gives `{ field: 'leg.time', label: 'Bike time', legOrder: 3 }`.
  - `describeChange` gives `'Time: 15:57 → 15:47'` and `'State: MD → —'`.
  - `requestRole`: admin → `'admin'`; user without member → `'none'`; runner, no open request → `'can-send'`; runner whose own request is open → `'own-pending'`; relay teammate while another member's request is open → `'other-pending'` (Review Focus 3); non-runner → `'none'`.
  - `keepOpenDefault` true for result+race changes with `savedKinds: ['result']`, false with `['result','race']`, false for result-only changes.
  - `afterSave(open, 'result', false, admin, now)` returns status `'handled'` with `closedBy.username`; with `keepOpen` true returns only `savedKinds: ['result']`; on a `'declined'` request returns `null` (Review Focus 4).

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest tests/correctionRequests.test.js`
Expected: FAIL, `Cannot find module '../app/correctionRequests'`

- [ ] **Step 3: Implement `app/correctionRequests.js`** with the UMD wrapper used by `app/resultStanding.js` and the functions in the Interfaces block. Normalise before comparing: `trim()`, `''` → `null`, numeric fields through `Number()`; legs matched by `order`.

- [ ] **Step 4: Run the tests to see them pass, then the whole suite**

Run: `npx jest`
Expected: all suites pass.

- [ ] **Step 5: Commit**: stage `app/correctionRequests.js tests/correctionRequests.test.js scripts/build-js.mjs`, message `Add correction request rules`.

---

### Task 2: Model, routes, email and badge count

**Files:**
- Create: `app/models/correctionrequest.js`
- Create: `app/correctionRoutes.js` (registered like `app/raceSeriesRoutes.js`)
- Modify: `server.js` (register the routes next to `require('./app/raceSeriesRoutes.js')(app)`; add the badge header in the admin header middleware)
- Modify: `app/routes.js` (result delete handler: close its open requests)

**Interfaces:**
- Consumes: Task 1's module (`formValues`, `changesBetween`, `requestRole`, `describeChange`, `afterSave`).
- Produces (all JSON):
  - Model `CorrectionRequest`: `{ result: ObjectId (indexed), race: { _id, racename, racedate }, sender: { user: { _id, username }, member: { _id, firstname, lastname } }, runners: [{ _id, firstname, lastname }], changes: [Change], note: String, status: { type: String, enum: ['open','handled','declined','withdrawn'], default: 'open', index: true }, savedKinds: [String], closedBy: { _id, username }, closedAt: Date, dismissReason: String, createdAt, updatedAt }`.
  - `GET /api/results/:resultId/correction` (logged in) → `{ role, request }`. `request` is the open request when `role === 'own-pending'`, otherwise `null`.
  - `POST /api/results/:resultId/correction` (logged in) body `{ values: Values, note }` → 201 the request (created) or 200 (own open request updated). 403 when role is `'admin'` or `'none'`; 409 `{ error: 'pending' }` when `'other-pending'`; 400 when no change and no note. The server computes `changes` itself from `formValues(result)` and `values`.
  - `DELETE /api/corrections/:id` (sender only, open only) → 200; status becomes `'withdrawn'`, `closedAt` set.
  - `GET /api/corrections?status=open|done` (admin) → requests, newest first; `done` = every status but `open`.
  - `POST /api/corrections/:id/saved` (admin) body `{ kind, keepOpen }` → 200 the request after `afterSave`; 409 when `afterSave` returns `null`.
  - `POST /api/corrections/:id/dismiss` (admin) body `{ reason }` → 200; status `'declined'`, `dismissReason`, `closedBy`, `closedAt`. 409 when not open.
  - Response header `X-Pending-Corrections-Count` (open count) for logged-in admins on `/api/` responses.

- [ ] **Step 1: Write the model, then the routes**, keeping handlers thin: every rule comes from Task 1. The email (create and update only) goes through `transport.sendMail` from `MCRRC_FROM_EMAIL` to `MCRRC_FROM_EMAIL`, with the subject from Global Constraints, one `describeChange` line per change (race-wide ones suffixed ` (race-wide)`), the note, and `{SITE_URL}/corrections`. A mail failure is logged, never fails the request.

- [ ] **Step 2: In the result delete handler** (`app.delete('/api/results/:result_id'` in `app/routes.js`), after the delete, set every open request for that result to `declined` with `dismissReason: 'Result deleted'`.

- [ ] **Step 3: Verify with a scratch script** against the dev server (`localhost:8090`). Create two temporary users in the dev database (role `user`, linked to two members of one relay result), log each in with `fetch('/api/login')`, and check:
  - member A `POST`s a time change → 201, and the change list has exactly one entry;
  - member B's `GET` returns `role: 'other-pending'` and its `POST` returns 409;
  - member A `POST`s again → 200 (update), still one open request;
  - an admin account's `POST` → 403;
  - logged out → 401;
  - an admin `GET /api/corrections?status=open` lists it, and the `X-Pending-Corrections-Count` header is `1`;
  - `saved` with `keepOpen: true` keeps it open, then without it closes it as `handled`; a second `saved` → 409.

  Delete the temporary users and requests afterwards.
Expected: every line as stated.

- [ ] **Step 4: Commit**: stage the four files, message `Add correction request storage and API`.

---

### Task 3: Member form and result page

**Files:**
- Create: `public/js/services/CorrectionService.js`
- Create: `public/js/controllers/CorrectionCtrl.js` (`CorrectionRequestModalController`; Task 4 adds the admin page controller here)
- Create: `public/views/modals/correctionRequestModal.html`
- Modify: `public/js/controllers/ResultDetailCtrl.js`, `public/views/resultDetail.html`, `public/less/mcrrc.less`

**Interfaces:**
- Consumes: Task 2's endpoints; `window.CorrectionRequests` (Task 1).
- Produces: `CorrectionService` on module `mcrrcApp`, each method returning a `$q` promise of the response data: `forResult(resultId)`, `send(resultId, values, note)`, `withdraw(id)`, `list(status)`, `markSaved(id, kind, keepOpen)`, `dismiss(id, reason)`; and `CorrectionService.openRequestModal(result, existingRequest) → promise` (resolves `'sent'`, `'withdrawn'` or rejects on cancel).

- [ ] **Step 1: Build the modal** to the agreed mockup (member form v2):
  - runners shown read-only;
  - **Your result:** time as hours / minutes / seconds / centiseconds inputs like `views/modals/resultModal.html`, category, result link, comments;
  - **Placement:** one box with rows Overall, Gender, Age group, each a place and an "out of";
  - **Legs:** only when `race.isMultisport`; one row per leg with distance (not for transitions) and time;
  - **The race** (labelled "shared by everyone who ran it"): name, date, country and state with the pickers from `views/modals/raceEditModal.html`, distance as free text, surface from `CorrectionRequests.SURFACES`;
  - **Anything else?** textarea.

  Changed fields get class `crq-changed` (amber, Global Constraints) and show "was {old}" under them, both driven by `changesBetween`. The submit button reads `Send suggestion ({n} change{s})` and is disabled when there are no changes and no note. With an `existingRequest`, the form starts from the request's suggested values and also shows **Withdraw**.

- [ ] **Step 2: On the result page**, `ResultDetailCtrl` calls `CorrectionService.forResult` once the user and result are known:
  - `'can-send'` shows a **Suggest a correction** button in the page header;
  - `'own-pending'` shows "Correction pending" with an **Update** link that reopens the modal;
  - `'other-pending'` shows "A teammate's correction is pending" (muted, no button);
  - `'admin'` and `'none'` show nothing.

  Reload the status after the modal closes.

- [ ] **Step 3: Build and check in headless Chrome** (scratch script, two temporary users as in Task 2):
  - the button appears for the runner and not for an admin;
  - changing the time highlights it and the button says `(1 change)`;
  - sending shows "Correction pending";
  - the teammate sees the pending note.

  Run: `npm run -s build:js:dev && npm run -s build:css`, then the scratch script.
Expected: each check as stated, no JavaScript errors.

- [ ] **Step 4: Commit**: stage the new and modified files, message `Add the member's correction form`.

---

### Task 4: Admin requests page, menu badge and edit modals

**Files:**
- Create: `public/views/corrections.html`
- Modify: `public/js/controllers/CorrectionCtrl.js` (add `CorrectionsController`)
- Modify: `public/js/routes/appRoutes.js` (state `/corrections`, url `/corrections?tab`)
- Modify: `views/index.ejs` (admin menu entry after Race Series, badge `pendingCorrectionsCount`)
- Modify: `public/js/app.js` (read `X-Pending-Corrections-Count` into `$rootScope.pendingCorrectionsCount`, next to `X-Pending-Series-Count`)
- Modify: `public/js/services/PageTitleService.js` (`'/corrections': 'Correction Requests'`)
- Modify: `public/js/services/ResultsService.js` (`retrieveResultForEdit(resultParam, options)`, `showEditRaceModal(raceInput, options)`; **every** `$uibModal.open` using `ResultModalInstanceController` or `RaceEditModalInstanceController` resolves `correctionRequest`: `options && options.request || null`)
- Modify: `public/js/controllers/ResultsCtrl.js` (inject `correctionRequest` into both modal controllers, expose it as `$scope.correctionRequest`)
- Create: `public/views/templates/correctionReference.html` (the amber box, `ng-include`d at the top of both modal bodies)
- Modify: `public/views/modals/resultModal.html`, `public/views/modals/raceEditModal.html`

**Interfaces:**
- Consumes: `CorrectionService.list/markSaved/dismiss` (Task 3), `CorrectionRequests.describeChange/editKinds/keepOpenDefault` (Task 1).
- Produces: nothing used by later tasks.

- [ ] **Step 1: Build the requests page** to the agreed mockup:
  - **Open** and **Done** tabs.
  - Each row shows the date, the sender, and the result (race name and date, linked to `/results/:id`).
  - One chip per change from `describeChange`; race-wide chips are labelled "race-wide".
  - The member's note.
  - **Edit result**, **Edit race** and **Dismiss** buttons. The primary style goes to the kind in `editKinds` (both kinds: Edit result).
  - Dismiss asks for an optional reason inside the page; no `confirm()`.
  - The Done tab adds the outcome (handled / declined / withdrawn), by whom, when, and the reason.
  - Admins only: once `$rootScope.authResolved`, anyone else is sent to `/` with `{ location: 'replace' }`, as `VolunteerJobsController` does.

- [ ] **Step 2: Wire the edit modals.**
  - Before opening, set `request.keepOpen = CorrectionRequests.keepOpenDefault(request)`, then open with `{ request }`.
  - The reference box shows the sender, the date, each change and the note, plus a **Keep this request open** checkbox bound to `correctionRequest.keepOpen`. The modal shares the page's object, so the page reads the checkbox after the modal closes.
  - A resolved modal (a value returned) → `markSaved(request._id, kind, request.keepOpen)`, then reload the list.
  - A dismissed modal, or `showEditRaceModal` resolving `null` → nothing.
  - A 409 from `markSaved` → reload the list without an error message (Review Focus 4).
  - The form values are never touched by the request.

- [ ] **Step 3: Check in headless Chrome** with a temporary admin and one open request:
  - the badge shows `1`;
  - Edit result opens the result modal with the amber box above the current values;
  - saving closes the request into Done as handled;
  - with a result + race request, the checkbox starts ticked and the first save keeps it open;
  - Dismiss with a reason lands in Done as declined;
  - opening the result modal from the race list (no request) still works.

  Run: `npm run -s build:js:dev`, then the scratch script.
Expected: each check as stated, no JavaScript errors.

- [ ] **Step 4: Run the whole suite and lint the changed files**

Run: `npx jest && npx eslint app/correctionRequests.js app/correctionRoutes.js public/js/services/CorrectionService.js public/js/controllers/CorrectionCtrl.js public/js/services/ResultsService.js public/js/controllers/ResultsCtrl.js`
Expected: all tests pass, no lint errors.

- [ ] **Step 5: Commit**: stage the files, message `Add the admin correction requests page`.
