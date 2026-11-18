# Result correction requests: design

## Intent

Today a member who spots a mistake in one of their results (usually the time
or the placings, sometimes the race date or location) sends the admin a
message. The admin reads it, finds the result, checks it and edits it by hand.

This feature moves that onto the site. A logged-in user whose account is
linked to a member suggests corrections directly on their own result, in a
form that starts from the result's current values. The admin is notified,
sees exactly what changed (old → new), and fixes it with the existing edit
modals, with the request shown alongside for reference. Nothing on the site
changes until the admin saves an edit.

Success: the admin no longer has to work out from a free-form message what is
wrong and where; members can't change data themselves; and handling a request
is "open, look, type, save".

## Goals

- A member can suggest corrections to a result they are one of the runners of.
- The admin hears about each request (menu badge and email) and handles it from
  a list, through the existing result and race edit modals.
- Every request ends up either handled (an edit was saved) or declined
  (dismissed), with a history of who did what and when.

## Non-goals

- Members never edit data directly; there is no "auto-apply" of a suggestion.
- No email or notification to the member about the outcome. The admin tells
  them personally.
- No suggesting new results or results for other runners.

## Anti-goals (would make this a failure even if it works)

- Accidental changes: an admin saving the suggested values without meaning to.
- Conflicting requests on the same result piling up.
- A member being able to change who ran the result, or anything outside the
  fields listed below.

## Who can send a request

- A logged-in user whose account has a linked member (`user.member`), on a
  result whose `members` include that member. On a relay or team result, any
  team member listed can send one.
- **Not admins.** They edit results directly, so they never see the button and
  the server refuses a request from an admin account.
- **Only one open request per result** at a time (whoever sent it). While one is
  open:
  - the member who sent it, opening the form again, sees their pending request
    and can update it or withdraw it;
  - other team members on the same result see that a correction is pending and
    cannot send another (builder's call how this reads; it should not look
    like an error).
- The server enforces all of this; the client only hides the button.

## The member's side

### Where it starts

A **"Suggest a correction"** button on the individual result page
(`/results/:resultId`), shown only to a user allowed to send one for that
result (above), so never to admins. When a request is open for that result, the page shows a
"correction pending" note instead of, or next to, the button.

### The form (modal)

Opens filled with the result's **current** values. The member changes what is
wrong and leaves the rest.

- **Runner(s):** shown, not editable.
- **Your result**
  - Time
  - Category
  - Result link
  - Comments (the result's own comments field)
  - **Placement**, one grouped box with three rows, each a place and an
    "out of": Overall, Gender, Age group (the `ranking` fields).
- **Legs (multisport results only)**, between Placement and the race section:
  one row per leg, in order, with its kind (swim / bike / run / transition).
  Each leg's **distance and time** can be corrected. Legs cannot be added,
  removed or reordered, their kind cannot change, and the race cannot be
  switched to or from multisport. Transitions have a time only.
- **The race**, labelled as shared by everyone who ran it:
  - race name
  - date
  - location: the same country and state pickers as the race edit modal
  - **distance: free text**, so an odd distance or anything else can be
    described ("5.2 miles", "about 10k, course was short")
  - **surface: picked from the site's list of surfaces** (the race types'
    surfaces)

  Distance being free text means a suggested distance is information for the
  admin, who picks the race type in the race edit modal; it is never mapped
  to a race type automatically.
- **Anything else?**: a free-text note to the admin.
- **Not in the form:** age grade (the site recalculates it), record eligibility,
  custom options, achievements, the runners.

**Behaviour**
- A changed field is highlighted (amber, the colour the site uses for "yours")
  and shows its old value under it.
- The submit button says how many changes there are ("Send suggestion
  (2 changes)"). A request needs at least one changed field or a note.
- Time inputs take the same formats the admin's result modal accepts.

## The admin's side

### Notification

1. **Menu badge**: a "Correction requests" entry in the admin menu with the
   number of open requests, the same way the race series badge works (count
   sent in a response header to logged-in admins, `server.js`).
2. **Email** to `MCRRC_FROM_EMAIL` for each new request, and for an updated one,
   through the existing mail transport (Brevo API). Content:
   - subject: "Correction request: {runner(s)}, {race name} ({year})"
   - each change as "Field: old → new", race-wide ones marked as such
   - the member's note
   - a link to the requests page
   A withdrawn request sends nothing. *(Emailing on update too: my call.)*

### The requests page

Admin-only page, with **Open** and **Done** tabs. Each request shows:

- when it was sent, by whom, and which result (race name and date, linking to
  the result);
- each change as a chip, "Field old → new", with race-wide changes labelled
  "race-wide";
- the member's note;
- three actions: **Edit result**, **Edit race**, **Dismiss**. The action matching
  the kind of changes asked for is highlighted; both edit actions are always
  available.

The Done tab shows each request's outcome (handled or declined), who handled
it, when, and a dismissal reason if one was given.

### Editing from a request

"Edit result" and "Edit race" open the **existing** modals
(`views/modals/resultModal.html` via `ResultsService.retrieveResultForEdit`,
`views/modals/raceEditModal.html` via `ResultsService.showEditRaceModal`), with
two additions:

- the request shown in an amber box above the form, for reference: who, when,
  each change old → new, the note;
- a **"Keep this request open"** checkbox in that box.

The form keeps the result's **current** values; the admin types in what they
accept. Nothing is pre-filled from the suggestion (anti-goal: accidental
changes).

### How a request gets marked done

- **Saving** from a request's edit modal marks it **handled**, recording the
  admin and the date, unless "Keep this request open" is ticked.
- When a request has both result and race changes, the checkbox starts
  **ticked** until both kinds of edit have been saved from it, so the first
  save does not close it early. The admin can untick it.
- **Dismiss** marks it **declined**, with an optional short reason.
- If the result itself is deleted, its open requests are closed as declined
  (builder's call on the wording).

## Data

A new collection for requests. The builder designs the schema; it needs at
least:

- the result (id) and a snapshot of the race id, name and date at the time of
  the request, so the list still reads well if the race changes;
- who sent it (user and member);
- the suggested changes, each as field, old value, new value, and whether it is
  race-wide; legs changes identify the leg;
- the note;
- status (open, handled, declined, withdrawn), timestamps, who closed it,
  dismissal reason, and which kinds of edit (result, race) have been saved
  from it.

## Calls made while writing this up (not discussed; check them)

- A withdrawn request is kept, with status "withdrawn", and listed in the Done
  tab, rather than deleted.
- An updated request (the member changes their pending one) emails again.
- The requests page is for admins only, not captains, since only admins can
  edit results and races.

## Constraints

- AngularJS 1.x SPA with Bootstrap 3 classes; Express and Mongoose on the server
  (see `CLAUDE.md` and the project memory).
- Result times are stored in centiseconds.
- Admin data edits already make browsers re-check their cached data after a save
  (`DataCacheService`, any successful write to `/api`), so corrected results
  show up for everyone with no extra work.
- Requests must not be readable by other members: a member sees only their own;
  admins see all.

## Left to the builder

- The schema, endpoints and their names.
- Exact layout and wording, within the mockups agreed in brainstorming (the
  member form "v2" and the admin review screen).
- How the "correction pending" state reads on the result page and for other
  team members.
- Analytics events, following `AnalyticsService` conventions.
- Tests: the permission rules (who may send, one open request per result), the
  change list (only changed fields, old → new) and the done-marking rules are
  the parts worth unit tests.
