# Site style guide

The look introduced on the member pages (October 2026) and rolled out to the
stats, results, records, tools, race, series and result pages, and the
admin pages (users, volunteer jobs, applications, hosted pages, banners,
result extractor, activity log). Use it for any
page you restyle or add so the site stays consistent.

All styles live in `public/less/mcrrc.less` (each page's block is at the end of
the file, labelled with a comment). The SPA is **Bootstrap 3** — never use
Bootstrap 5 classes. Rebuild with `npm run build:css` (and `npm run build:js`
when a `.js` file or directive template changed); `public/dist/css/*` and
`public/dist/js/app.min.js` are tracked, so commit them with the change.

## Colors

| Use | Value |
|---|---|
| Titles, active text, dark accents | `@brand-primary-dark` (#006687) |
| Accents, underlines, icons, selected buttons | `@brand-primary` (#008cba) |
| Light tint: table headers, tiles, hover rows | `@brand-primary-very-light` (#F7FBFC) |
| Body text | `#333` |
| Muted text (subtitles, dates, inactive tabs) | `#5b707a` / `#6b7f88` |
| Card / table frame | `#d5e1e6` |
| Row dividers | `#edf1f3` |
| Page background | the existing grey-blue jumbotron — leave it |

Keep existing data colors as they are (member 1 / member 2 colors on
head-to-head, podium gold/silver/bronze rows, the pace-adjustment heat grid,
win/loss row tints).

## Cards

Every section of a page is a **white card** on the grey background.

```less
background: #fff;
border-radius: 12px;
box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
padding: 20px 24px 22px;   // 16–24px depending on density
margin-bottom: 20px;
```

- Reusable class: `.member-card` (with `.member-card-header` for its title row).
- Restyling Bootstrap `.panel`s instead: drop the border and gradient heading,
  apply the card values above.
- **No coloured stripes** — no top border bar, no left accent bar (users
  rejected both).
- Cards that contain dropdowns must use `overflow: visible` so an open list
  hangs over the card instead of being clipped.

## Card titles

Dark-blue title over a 2px blue underline, spanning the card's content width.

```less
color: @brand-primary-dark;
font-weight: 600;          // 700 for page-level titles
font-size: 18–20px;        // 24px for a page title card
padding-bottom: 10px;
border-bottom: 2px solid @brand-primary;
```

- Icon before the title: `color: @brand-primary`.
- Controls (buttons, pickers, counts) sit on the right of the same row
  (`display: flex; justify-content: space-between`).
- A small count goes in a light pill: `.member-results-count`
  (e.g. "76 races", "6 awards").
- Page-level title cards (Participation / Team Members Stats, the tools):
  title `display: inline-block` so the underline fits the text, grey subtitle
  under it.

## Labels

Field labels and stat-tile captions: small, blue, all caps.

```less
font-size: 11px;
font-weight: 700;
letter-spacing: 0.08em;
text-transform: uppercase;
color: @brand-primary;
```

## Tabs / page switchers → menu items

Page-level navigation (member tabs, stats tabs, Race / Individual / Series
switch, By Age / By Year, Calculate / All standards) is a **menu**, not buttons:

- plain text (with icon), `font-weight: 600`, `color: #5b707a`;
- thin line under the whole row: `border-bottom: 1px solid fade(@brand-primary, 25%)`;
- current item: `color: @brand-primary-dark` + `border-bottom: 3px solid @brand-primary`;
- hover: dark text + `fade(@brand-primary, 35%)` underline;
- no backgrounds, no pills, no rounded corners.

In LESS use the shared mixins: `.site-menu-tabs-row()` on the row,
`.site-menu-tab()` on each item, `.site-menu-tab-on()` for the current one
(Applications, Race Series and Correction Requests use them).

## Buttons → square "Team Best Times" buttons

All buttons and toggle groups use the existing `.mcrrc-btn` look
(`.mcrrc-btn-look()` mixin):

- white, 1px `#c8dbe4` border, **4px radius** (not pills), light shadow,
  blue bold text;
- selected / on: `.is-on` (or `.active`) → filled `@brand-primary`, white text;
- toggle groups: separate buttons with a 4px gap, not a fused segmented bar;
- main action of a page (e.g. Submit Volunteer Job): `.member-primary-btn`
  (same shape, filled blue).

In markup prefer `class="mcrrc-btn" ng-class="{'is-on': …}"`. When a page
already uses Bootstrap `.btn` classes, apply the mixin in a scoped LESS rule
instead of rewriting the markup. Button text is normal case
("All members"), never all caps.

## Dropdown pickers (ui-select, select2 theme)

Keep the blue gradient; make it rounded and lifted: add `class="stats-year-select"`
to the `<ui-select>`.

- rounded 8px, soft blue shadow, bold left-aligned text;
- white chevron (the grey arrow box is made transparent);
- open list: rounded rows with a soft white highlight
  (`rgba(255,255,255,0.2)`) instead of a flat bright band;
- size with an extra class (`min-width`), not an inline `style`.

Plain `<select>` / inputs: `border-radius: 8px`.

## Tables and lists

Tables sit **inside** a card, framed:

```less
border: 1px solid #d5e1e6;
border-radius: 8px;
border-collapse: separate; border-spacing: 0;
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
```

- header row: `@brand-primary-very-light` band, labels in the small blue/dark
  all-caps style, `border-bottom: 2px solid @brand-primary`;
- rows: `border-top: 1px solid #edf1f3`, hover tint `@brand-primary-very-light`,
  text `#333`; no zebra stripes;
- reusable class: `.member-table`.
- Existing results lists (`.results-list` on the bio page, race results,
  records): **don't restyle the rows** — only frame the list and put it in a
  card. The owner asked for the result table itself to stay as it was.

## Status tags, icon buttons, filter rows

- **Status / role tags** (Published, Draft, admin, approved…): `.site-tag` plus
  `.site-tag-success` / `-warning` / `-danger` / `-info` / `-muted`. Flat,
  4px corners, no shadow, so they never read as buttons. A clickable one is a
  `<button class="site-tag site-tag-toggle">` (e.g. a user's enabled/disabled).
- **Row actions** (edit, delete, copy link): `class="mcrrc-btn site-icon-btn"`,
  add `is-danger` for delete (red icon, red fill on hover).
- **Filter row** above a table (labelled selects, search with a clear ×, count
  pill): `<div class="site-filters">` with `<label class="site-search">` for the
  search; set select widths in the page's own block.
- **Pages built on `.crf-chip`** (comp forms, applications, banners): apply the
  `.crf-chip-square()` mixin in the page block instead of restyling each chip.

## Stat tiles

Numbers like "76 total races": light-blue tile (`@brand-primary-very-light`,
1px `fade(@brand-primary, 15%)` border, 10px radius) or a white card,
number in `@brand-primary-dark` bold, caption in the small blue label style.

## Member page specifics

- Header: name (34px, 700, dark blue); attributes underneath as quiet text in
  a faint box — category and gender together ("Master Female"), age only for
  admin/captain ("· Age 47"); membership dates on their own grey line.
  No pills, no accent bar for the attributes.
- Admin edit/delete icons pinned top-left of the header; awards card
  top-right (icon tile + "ROY 2017" caption).
- Bio: photo left, "About {name}" card right; labels from the stored HTML
  (`<span class="bold">`) shown as small blue headings; long bios collapse with
  the `show-more` directive.
- Photo: 12px radius, 4px white frame, soft shadow.

## Responsive notes

- The SPA is desktop-locked (`.container { min-width: 992px }`); member pages
  lift it with `.container:has(member-header)`.
- `@screen-sm-min` is **2px** in this project's `variables.less`, so
  `@media (min-width: @screen-sm-min)` does nothing — use explicit widths or
  `@member-phone-max` (767px) for phone rules.

## Checklist for restyling a page

1. Add a page class to the root (`<div class="jumbotron my-page">`) and scope
   all new LESS under it so other pages are untouched.
2. Sections → cards; titles → underlined card titles.
3. Tabs → menu; buttons → `.mcrrc-btn`; pickers → `stats-year-select`.
4. Tables → framed inside the card (rows unchanged for results lists).
5. Check that open dropdowns are not clipped.
6. Rebuild CSS/JS and look at the page at 1280px (and 375px for member pages).
