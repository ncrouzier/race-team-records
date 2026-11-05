# Homepage banners

The homepage shows one banner photo at a time behind the "Racing Team" title.
Banners are made and managed on the site, on the **Banners** admin page
(**Admin tools → Banners**): no commit or deploy is needed.

## Where things live

| Where | What |
|---|---|
| `uploads/banners/<name>.jpg` | The banner images. On the droplet `/opt/mcrrc/uploads/banners`, bind-mounted into the app (`BANNER_DIR`); locally `./uploads/banners`. Not in git or the Docker image. |
| `uploads/banners/.drafts/` | Photos being framed in the editor. Deleted when the banner is saved or the editor cancelled; anything left is removed after a day. |
| The `banners` collection | Each banner's members, credit, pin, shown/disabled, title side, and `version` (a hash of the file, in its link as `?v=`). |
| `app/bannerRender.js` | The framing, fade and render. The global framing and fade settings are constants there. |
| `app/bannerFiles.js`, `app/bannerRoutes.js` | Storage and the routes. |

The banners are backed up weekly with the member photos, in
`uploads-<stamp>.tar.gz` (`deploy/backup.sh`); `scripts/restore-local.sh`
restores them locally.

## Making a banner

1. On the Banners page, click **New banner**.
2. **Choose, drop or paste a photo.** JPEG, PNG or WebP, at least 400 px on
   each side, up to 20 MB (iPhone HEIC photos must be exported as JPEG
   first). Landscape photos with the runner on the left work best: the title
   covers the right of the banner.
3. The runner's face is found and the photo framed automatically. Adjust it:
   drag to move, scroll or the slider to zoom, arrow keys to nudge (Shift:
   further). The bright window is the banner, with the real title and fade
   over it; the dashed line is where it ends on wide screens. **Narrow
   screen / Wide screen** show both ends of the range. **Automatic framing**
   goes back to the automatic one. **Preview the banner** renders it exactly
   as it will be saved.
4. **Name it.** The name is prefilled from the photo's file name; letters,
   digits, `_` and `-` (other characters become `-`). It must not be used by
   another banner — checked as you type, ignoring case.
5. **Save banner.** It goes straight into the homepage rotation; then tag the
   members and add the photo credit on its card.

**The photo itself is not kept** once the banner is saved. To change a
banner's framing later, use **Replace photo** on its card and upload the photo
again: the banner keeps its members, credit and settings.

## On the Banners page

Each banner is a card. Click a preview to see it on the homepage. Change what
you need, then **Save** on the card (or **Save all** at the top).

- **Rename:** renames the banner and its file (the name must be free).
- **Replace photo:** a new photo or a new framing for the same banner.
- **Members:** tag the people in the photo. On a tagged member's birthday,
  their banner is shown in preference to all others.
- **Title position:** which side the title sits on. Banners made in the editor
  need **Right**: their fade is drawn for it.
- **Copyright:** the photographer's name, a link to the photo, and the
  credit's text colour (pick one that reads well on the photo's corner).
- **Pin:** pinned banners are shown in preference to unpinned ones.
- **Shown / Disabled:** a disabled banner is never shown, not even on a
  birthday. Use this to retire a banner but keep it.
- **Delete (trash icon):** deletes the banner and its image, for good.

## Moving from the offline tools

Banners used to be made on a laptop (`npm run banners`, `npm run
banners:edit`) from photos in `public/images/banners/source/`, and shipped in
the Docker image. On its first start, the new version copies the banners from
`public/images/banners/*.jpg` into the banners folder and gives every entry
its version; after that it never looks there again.

The offline tools still exist in this release but no longer affect the site.
Once production is confirmed on the new folder, the next release deletes
`public/images/banners/` (with `source/`), `config/banners/`, the scripts
(`slant-banners.mjs`, `banner-editor.*`, `lib/slant-banners-core.mjs`,
`seed-banners.js`, `app/bannerDefaults.js`) and the `banners*` npm scripts.
