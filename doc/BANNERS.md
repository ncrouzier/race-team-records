# Homepage banners

The homepage shows one banner photo at a time behind the "Racing Team" title.
Making a banner has two halves:

- **The image** is made on your computer by a script, from a source photo, and
  deployed with the code.
- **Everything else** (tagged members, photo credit, pinned, disabled, title
  side) is set on the site, on the **Banners** admin page.

## Where things live

| Path | What it is |
|---|---|
| `public/images/banners/source/` | Original photos. Put new photos here. Not in the Docker image. |
| `public/images/banners/*.jpg` | The banner images the site shows. Generated; don't edit by hand. |
| `config/banners/slant-banners.config.json` | **Yours to edit.** Framing and fade for every banner, plus per-photo fixes. |
| `config/banners/slant-banners.detected.json` | Written by the script (faces it found). Don't edit. |

The two files in `config/banners/` are also read by the site, to give a new
banner its title side on the Banners page.

## Adding a photo

1. **Add the source photo** to `public/images/banners/source/`. A landscape
   photo works best: the banner is wide, so a portrait photo has to be
   framed tightly.
2. **Generate the banner:**
   ```bash
   npm run banners
   ```
   The script finds the runner's face, frames the runner on the left, and
   fades the photo to white along the title's slant. It frames each runner
   as wide as the photo allows, and prints one line per photo with the zoom
   and where the face ended up.
3. **Check it** on your local site: reload the homepage, or open the Banners
   page (see below) and click the photo's preview. If the framing is off,
   fix it in [the editor](#framing-a-banner-by-hand-the-editor).
4. **Commit and deploy** the source photo, the generated `.jpg`, and the two
   `config/banners/` files.
5. **Add it on the site:** open **Admin tools → Banners**. New images are listed
   at the top; click **Add them**. Then fill in the card (below).

Only photos with a single runner on the left get a banner automatically.
Group shots and photos where the runner is on the right are skipped (the
script says so); to make a banner from one, frame it in the editor.

## Framing a banner by hand: the editor

```bash
npm run banners:edit
```

This opens a page in your browser (http://localhost:8095) listing the source
photos. To add one, use **+ Add photo**, drop a file anywhere on the page,
or paste a picture (⌘V; it asks for a name): it's saved into `source/`, the
runner is found and its automatic banner made. Pick a photo, and it's shown behind the banner's window with the real
title badge and fade on top; the rest of the photo is dimmed around it.

- **Drag** the photo to move it, **scroll** or use the slider to zoom, and the
  **arrow keys** to nudge (Shift for bigger steps).
- The dashed line is where the banner ends on wide screens: below it only
  shows on narrower ones.
- The editor won't let you leave a gap: the photo always fills the banner's
  height and reaches the end of the fade.
- **Save banner** writes your framing into the config (as the photo's
  `crop`, replacing its other settings there, apart from a `note`) and
  regenerates the banner; the saved file is shown below for a
  final check. Running `npm run banners` later keeps it.
- **Use automatic framing** removes your crop and frames on the face again.
- **Rename** renames the source photo, and its settings and banner with it.
  If the banner was already on the site, the Banners page then lists it as a
  new image (add it, and delete the old entry, which has lost its file).
- **Delete photo** removes the source photo, its settings and its banner.
  If the banner was on the site, delete its entry on the Banners page too.

It also works for photos the script skips (group shots, runners on the
right): saving a crop makes a banner from them. If that photo already had a
banner on the site, set its **Title position** to **Right** on the Banners
page, since the new banner's fade is drawn for the title on the right.

Press Ctrl+C in the terminal to stop the editor. It only changes files in
your copy of the repo, so commit and deploy as usual.

## Fixing a banner's framing in the config file

The editor is easiest; the settings below are the alternative, and work
without it.

Edit `config/banners/slant-banners.config.json`, then run `npm run banners` again (or
`npm run banners -- jamesJ.jpg` for one photo) and reload the page. The file's
`_guide` section explains every setting.

Each run prints, for every photo, the zoom and where the face ended up:

```
  ✓ jamesJ.jpg           zoom 1.30, face 20% across, 12% down
```

To adjust one photo, add an entry under `images`, named after the source file.
All settings are optional:

```json
"images": {
  "jamesJ.jpg": { "zoom": 1.3, "moveRight": 5, "moveDown": -3 }
}
```

| You want to… | Setting |
|---|---|
| Get closer to the runner | `"zoom"`: 1 = as wide as the photo allows (the default), 1.3 = 30% closer. Below 1 isn't possible. |
| Move the runner right or left | `"moveRight"`: % of the banner's width; negative moves left |
| Move the runner down or up | `"moveDown"`: % of the banner's height; negative moves up |
| Cut something off the photo's edge | `"cropLeft"`, `"cropRight"`: % of the source photo's width to cut off |
| Frame a different person | `"face": { "x", "y", "width", "height" }`: the right face's box, in pixels of the source photo. `config/banners/slant-banners.detected.json` lists other faces it found (`otherFaces`). |
| Use a photo it skipped as a group or right-side runner | `"kind": "runner-left"` |
| No banner from this photo | `"skip": true` |
| Leave yourself a reminder | `"note": "…"` (ignored) |
| Exact framing (what the editor saves) | `"crop": { "x", "y", "width" }`: the area of the photo the banner shows, in source pixels. Wins over the settings above. |

A move the photo can't make, because its edge is in the way, is done as far as
possible, and the run says so (`! moveRight: …`). So does a misspelled setting.

The `framing` section sets the starting point for every photo: where the face
sits (`faceFromLeft`, `faceFromTop`, in % of the banner) and the smallest the
face may be (`faceSize`), which stops a big photo zooming out too far.

To run face detection again on every photo: `npm run banners -- --reanalyze`.
Your settings in the config file are never touched.

## On the Banners page

**Admin tools → Banners** lists every banner as a card. Click a preview to see
it on the homepage. Change what you need, then **Save** on the card (or
**Save all** at the top).

- **Members:** tag the people in the photo. On a tagged member's birthday,
  their banner is shown in preference to all others.
- **Title position:** which side the title sits on. Banners made by the script
  need **Right**: their fade is drawn for it.
- **Copyright:** the photographer's name, a link to the photo, and the
  credit's text colour (pick one that reads well on the photo's corner).
- **Pin:** pinned banners are shown in preference to unpinned ones.
- **Shown / Disabled:** a disabled banner is never shown, not even on a
  birthday. Use this to retire a banner but keep its details.
- **Delete (trash icon):** removes the entry and its details. The image file
  stays, so it comes back as a new image that can be added again. To remove a
  banner for good, also delete its image from `public/images/banners/` and
  deploy.

Members, credit, pinned and disabled are only ever set here. The scripts never
change them, so regenerating images is always safe.

## Commands

| Command | What it does |
|---|---|
| `npm run banners` | Analyse new photos and (re)generate banner images |
| `npm run banners -- name.jpg` | Just these photos |
| `npm run banners -- --reanalyze` | Detect faces again in every photo |
| `npm run banners:edit` | Open the visual editor |
| `npm run banners:seed` | Create database entries for new images from the command line (same as the page's **Add**). Uses `MONGO_DEV_URL`. |
