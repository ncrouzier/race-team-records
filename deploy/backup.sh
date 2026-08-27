#!/usr/bin/env bash
# Nightly Mongo dump. This replaces the scheduled backups Dokploy would have
# given you, and is the one piece of that functionality genuinely worth
# rebuilding by hand.
#
# Install on the droplet:
#   chmod +x /opt/mcrrc/backup.sh
#   crontab -e
#   17 3 * * * /opt/mcrrc/backup.sh >> /var/log/mcrrc-backup.log 2>&1

set -euo pipefail

STACK_DIR="${STACK_DIR:-/opt/mcrrc}"
BACKUP_DIR="${BACKUP_DIR:-/opt/mcrrc/backups}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"

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

echo "$(date -u +%FT%TZ) backup ok: $ARCHIVE ($((SIZE / 1024)) KiB)"

# These backups sit on the same droplet as the database, so they do not survive
# losing it. Either enable DigitalOcean's weekly droplet backups, or push this
# archive off-box:
#
#   s3cmd put "$ARCHIVE" s3://your-space/mcrrc/
