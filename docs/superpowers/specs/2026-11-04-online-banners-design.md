# Online banners — design

**Status:** approved · 2026-11-04

## Why

Making a homepage banner today means: put the photo in the repo, run
`npm run banners` / `npm run banners:edit` on a laptop, commit the photo, the
generated JPEG and two JSON files, and deploy. Only someone with the repo and
a dev setup can do it.

The goal: an **admin uploads a photo on the site, frames it with the same
editor as offline, and saves**. The banner goes live without a commit or a
deploy. Banner files live on the server, like member photos
(`app/memberPhotos.js`), not in the repo or the Docker image.

## Goals

- Admins create a banner from the **Banners** admin page: upload → automatic
  framing (face detection) → adjust in the editor → save.
- The in-site editor does what `scripts/banner-editor.html` does today: drag
  the photo behind the real title badge and fade, zoom (slider, scroll),
  arrow-key nudges, the wide-screen line, narrow/wide preview, "show title",
  undo, "use automatic framing".
- Banner files live in a host folder, `/opt/mcrrc/uploads/banners`
  (bind-mounted, outside any Docker volume), backed up with the member photos.
- The 39 existing banners move over without anyone redoing them.
- Afterwards, the offline tools are retired: the site is the only place
  banners are made.

## Non-goals

- **Re-framing an existing banner.** The source photo is **not kept** once
  the banner is saved (decided). Changing a banner's framing means uploading
  the photo again ("Replace photo", which keeps its tags and credit).
- Non-slant banners (title on the left or centred over a group shot). Every
  current banner is a slant banner (all 39 are `runner-left`); the online
  flow makes slant banners only. The `titlePosition` field stays as it is.
- Editing the global framing/fade settings online. They become constants in
  the code (their current values), changed by a commit if ever needed.
- Member uploads. Banners are admin-only.

## Anti-goals (would make this a failure even if it works)

- A banner that is half-written, or a homepage showing a broken image while
  one is being saved.
- Source photos piling up on the server (abandoned drafts).
- Any upload path weaker than the member photo one (type sniffing, size
  limits, re-encoding, file names checked by the server).
- Rendering that stalls the 2 GB droplet: renders run one at a time.

## Decisions

### Storage

```
/opt/mcrrc/uploads/            (host; ./uploads locally, gitignored)
  photos/<memberId>.jpg        member photos (existing)
  banners/<name>.jpg           finished banners, 2200x572, what the site shows
  banners/.drafts/<id>.jpg     source photos while a banner is being made
```

- Mounted at `/app/uploads/banners`, env `BANNER_DIR` (default
  `./uploads/banners`). `deploy/update.sh` creates it owned by uid 1000, like
  `photos/`.
- `<name>`: **set by the admin** in the editor, prefilled with the uploaded
  file's name (without its extension). Whatever is typed is cleaned to
  `[A-Za-z0-9_-]` (other characters become `-`, 1–60 characters) before it
  becomes a file name — the existing names (`aaronA`, `adrianS_sweat`) fit
  that as they are. **A name must not be in use already**: not by
  another Banner entry and not by any file in the banners folder, compared
  ignoring case (macOS disks are case-insensitive). The editor checks it as
  the admin types (`GET /api/admin/banners/name-available?name=`) and shows
  whether it is free; the save checks again and creates the file with an
  exclusive create, so two admins saving the same name at once cannot both
  win. A taken name is refused with a message, never silently changed. The raw upload name is never used as a path.
- Renaming later (my call): the Banners page lets an admin rename a banner;
  the file is renamed with it and the link changes (`?v=` keeps caches
  honest). "Replace photo" keeps the current name, still editable.
- Served by a dedicated route `GET /uploads/banners/:file`, only
  `^[A-Za-z0-9_-]{1,60}\.jpg$`, no listing, `nosniff`, long cache with `?v=<hash>`
  (stored on the Banner entry as `version`). Drafts are **not** served there;
  the editor loads them from an admin-only route.

### Source photos and drafts

- Upload (admin only): JPEG/PNG/WebP, decoded to prove it, at least 400 px
  on each side (today's rule), at most 20 MB, re-encoded as JPEG at most
  3000 px wide with metadata removed. Stored as a draft:
  `.drafts/<random id>.jpg`.
- Face detection runs on upload (the existing `updateDetected` logic): the
  editor opens on the automatic framing.
- **Save** renders the banner, writes it atomically, creates (or updates,
  for "Replace photo") the Banner entry, **then deletes the draft**.
- **Cancel** deletes the draft. Drafts older than 24 h are deleted at
  startup and hourly, so an abandoned editor leaves nothing behind.

### Settings

- `slant-banners.config.json`'s global `framing`, `fade` and `quality` become
  constants in the server module (same values).
- Per-photo settings (`crop`, `zoom`, `moveRight`, `face`, …) exist only
  while editing: the editor's crop is what the render uses. Nothing per-photo
  is stored, since the photo itself isn't kept.
- `slant-banners.detected.json` goes away: a draft's detection result is
  saved next to it as `.drafts/<id>.json` (size, face, other faces, kind)
  and deleted with it.

### Server code

- `app/bannerRender.js`: CommonJS port of `scripts/lib/slant-banners-core.mjs`
  (placement, clamp, fade overlay, render, face detection).
- The face detector is shared with profile thumbnails: move
  `initFaceDetector` out of `app/profileThumbnails.js` into
  `app/faceDetector.js` (tfjs-core + wasm). The full `@tensorflow/tfjs`
  devDependency is no longer needed for banners.
- Renders and detections go through a one-at-a-time queue.
- Admin routes (all `isAdminLoggedIn`, rate limited per user):
  - `POST /api/admin/banner-drafts` — upload, returns `{ draftId, width,
    height, detected, autoCrop, limits, layout }` (`layout`: the banner's
    output size and wide-screen share, what the editor's `OUT` holds today)
  - `GET /api/admin/banner-drafts/:id.jpg` — the draft photo, for the editor
  - `POST /api/admin/banner-drafts/:id/preview` — render with a crop, returns
    the JPEG (the "Saved banner" preview becomes a live preview)
  - `POST /api/admin/banner-drafts/:id/save` — `{ crop, name, bannerId? }`:
    check the name, render, store, create/update the Banner entry, delete
    the draft
  - `PUT /api/admin/banners/:id` gains `name`: renames the banner and its file
  - `DELETE /api/admin/banner-drafts/:id` — cancel
- `GET /api/banners` and the admin list give `url:
  '/uploads/banners/<filename>?v=<version>'` instead of `/images/banners/…`;
  the homepage and Banners page use that `url` rather than building paths.
- `DELETE /api/admin/banners/:id` also deletes the file. "Disable" stays the
  way to hide a banner without losing it.

### The editor in the site

- A large modal on the Banners page ("New banner", and "Replace photo" on
  each banner). It ports `scripts/banner-editor.html`'s stage logic into an
  AngularJS directive `<banner-editor>`, talking to the routes above. The
  title badge overlay uses the site's own header markup and fonts.
- After saving, the new banner appears in the list, ready for its tags,
  credit and pinning (unchanged UI).
- The "In public/images/banners but not on the site yet" section and the
  "register" route go: files can only arrive through the editor.

### Migration (the 39 existing banners)

- **Release 1** ships the new system with the current banner JPEGs still in
  the image. At startup, if `uploads/banners` has no banners yet, it copies
  `public/images/banners/*.jpg` into it and sets each Banner entry's
  `version` (idempotent: it does nothing once the folder has banners). No
  manual step, locally or in production.
- **Release 2** (after checking production): delete from the repo
  `public/images/banners/` (incl. `source/`), `config/banners/`,
  `scripts/banner-editor.mjs|html`, `scripts/slant-banners.mjs`,
  `scripts/lib/slant-banners-core.mjs`, `scripts/seed-banners.js` (if
  unused) and the `banners*` npm scripts; rewrite `doc/BANNERS.md` for the
  online flow; drop the startup copy.

### Backups and local restore

- `backup.sh` makes one archive, `uploads-<stamp>.tar.gz`, holding
  `photos/` and `banners/` (drafts excluded), uploaded to Drive with the
  last 4 kept (`PHOTOS_GDRIVE_KEEP`, renamed `UPLOADS_GDRIVE_KEEP`).
  Pruning also removes older `photos-*` archives.
- `restore-local.sh` accepts `uploads-<stamp>.tar.gz` (and the older
  `photos-<stamp>.tar.gz`), validating entries as `photos/<id>.jpg` or
  `banners/<name>.jpg`.

## Left to the builder

- How the editor directive is split (one directive vs. stage + controls).
- Exact queue implementation, rate-limit numbers (around the photo ones).
- Whether the live preview re-renders on every change (debounced) or on a
  "Preview" click.
- Test layout: unit tests for the ported pure functions (placement, clamp,
  crop limits), render output size, upload validation, draft cleanup and
  the idempotent startup copy.

## Calls I made (please check)

1. ~~Slug name from the uploaded file~~ → decided: the admin names it,
   prefilled with the file's name. Renaming later on the Banners page is my
   addition.
2. "Replace photo" on an existing banner, keeping its tags/credit/pin.
3. Deleting a banner deletes its file (disable is the soft option).
4. Two releases for the migration, with an automatic startup copy, rather
   than a manual script.
5. Global framing/fade become code constants; no online settings page.
6. One `uploads-<stamp>` archive replacing `photos-<stamp>`.
