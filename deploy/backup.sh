#!/usr/bin/env bash
# Weekly Mongo dump. This replaces the scheduled backups Dokploy would have
# given you, and is the one piece of that functionality genuinely worth
# rebuilding by hand.
#
# Install on the droplet:
#   chmod +x /opt/mcrrc/backup.sh
#   crontab -e
#   17 3 * * 0 /opt/mcrrc/backup.sh >> /var/log/mcrrc-backup.log 2>&1
#
# That is 03:17 UTC each Sunday. The odd minute is deliberate: jobs on the hour
# contend with everything else scheduled on the hour.
#
# ---- Google Drive upload (one-time setup) -----------------------------------
# Uses rclone. The droplet has no browser, so the OAuth step happens on your
# laptop and only the resulting token is copied over.
#
#   On the droplet:
#     curl https://rclone.org/install.sh | sudo bash
#     rclone config
#       n) new remote -> name it: gdrive
#       storage: drive
#       client_id / client_secret: blank is fine for personal use
#       scope: 1 (full access)  — or 3 (drive.file) to limit rclone to files
#              it creates itself, which is the safer choice here
#       "Use web browser to automatically authenticate?" -> N
#     It prints a command to run. Run THAT on your laptop (which has rclone
#     and a browser), sign in as the account that should own the backups, and
#     paste the resulting token back into the droplet prompt.
#
#   Then create the destination folder in that account's Drive and set
#   GDRIVE_REMOTE / GDRIVE_FOLDER in .env.
#
# Note on service accounts: they do not work for this with a personal Gmail
# account. A service account has no Drive storage of its own, so uploads fail
# with a quota error even into a shared folder. Service accounts are only a
# real option with a Workspace Shared Drive.

set -euo pipefail

STACK_DIR="${STACK_DIR:-/opt/mcrrc}"
BACKUP_DIR="${BACKUP_DIR:-/opt/mcrrc/backups}"
# Retention is in days but backups run weekly, so this is really a count of
# copies: 35 days keeps five. The old 14-day default was written for a nightly
# schedule and would leave just two.
RETAIN_DAYS="${RETAIN_DAYS:-35}"

cd "$STACK_DIR"

# shellcheck disable=SC1091
set -a; . ./.env; set +a

mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE="$BACKUP_DIR/mcrrcrecords-$STAMP.archive.gz"

# --archive to stdout so nothing is written inside the container.
docker compose exec -T mongo mongodump \
	--uri="mongodb://${MONGO_USER}:${MONGO_PASSWORD}@localhost:27017/mcrrcrecords?authSource=admin" \
	--archive --gzip > "$ARCHIVE"

# A dump that silently produced nothing is worse than no dump, because it looks
# like success. Anything under 1KB is not a real database.
SIZE=$(wc -c < "$ARCHIVE")
if [ "$SIZE" -lt 1024 ]; then
	echo "FAILED: $ARCHIVE is only ${SIZE} bytes"
	rm -f "$ARCHIVE"
	exit 1
fi

find "$BACKUP_DIR" -name 'mcrrcrecords-*.archive.gz' -mtime "+$RETAIN_DAYS" -delete

echo "$(date -u +%FT%TZ) local backup ok: $ARCHIVE ($((SIZE / 1024)) KiB)"

# ---- Off-box copy to Google Drive -------------------------------------------
# A backup sitting on the same droplet as the database does not survive losing
# the droplet, which is most of what a backup is for.

GDRIVE_REMOTE="${GDRIVE_REMOTE:-}"
GDRIVE_FOLDER="${GDRIVE_FOLDER:-mcrrc-backups}"
GDRIVE_RETAIN_DAYS="${GDRIVE_RETAIN_DAYS:-90}"

if [ -z "$GDRIVE_REMOTE" ]; then
	echo "GDRIVE_REMOTE not set - local backup only, nothing copied off-box."
	exit 0
fi

if ! command -v rclone >/dev/null 2>&1; then
	echo "FAILED: GDRIVE_REMOTE is set but rclone is not installed."
	exit 1
fi

DEST="${GDRIVE_REMOTE}:${GDRIVE_FOLDER}/$(basename "$ARCHIVE")"

# Explicit if/then rather than relying on set -e, so a failed upload reports
# what happened instead of exiting silently mid-script.
if ! rclone copyto "$ARCHIVE" "$DEST" --transfers 1 --retries 3 2>&1; then
	echo "FAILED: could not upload to $DEST"
	exit 1
fi

# Confirm what landed rather than trusting the exit code. A truncated upload
# is the failure mode that stays invisible until you need the file.
REMOTE_SIZE=$(rclone size "$DEST" --json 2>/dev/null | sed -n 's/.*"bytes":\([0-9]*\).*/\1/p')
if [ "$REMOTE_SIZE" != "$SIZE" ]; then
	echo "FAILED: uploaded size ${REMOTE_SIZE:-unknown} does not match local $SIZE"
	exit 1
fi

# Prune old copies in Drive on their own schedule — kept longer than local,
# since that is the copy that survives losing the droplet.
rclone delete "${GDRIVE_REMOTE}:${GDRIVE_FOLDER}" \
	--min-age "${GDRIVE_RETAIN_DAYS}d" --include 'mcrrcrecords-*.archive.gz' || true

echo "$(date -u +%FT%TZ) uploaded to $DEST ($((SIZE / 1024)) KiB)"
