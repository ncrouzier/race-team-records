#!/usr/bin/env bash
# Restore a Mongo archive produced by backup.sh.
#
#   ./restore.sh --check backups/mcrrcrecords-20260906T031700Z.archive.gz
#   ./restore.sh --check 'https://drive.google.com/file/d/1tWwmT.../view?usp=drive_link'
#   ./restore.sh backups/mcrrcrecords-20260906T031700Z.archive.gz
#   ./restore.sh 'https://drive.google.com/file/d/1tWwmT.../view' --yes
#
# The source may be a local path, a Google Drive share link, or a bare Drive
# file ID. Drive downloads go through the rclone remote configured for
# backup.sh, so they work for private files in that account.
#
# --check restores into a throwaway database and prints the collection counts,
# touching nothing live. Run that first. Without it the script replaces the
# live database, after taking a safety dump and asking for confirmation.
#
# Options: --check  verify only, never touch live data
#          --yes    skip the confirmation prompt
#          --keep   keep a Drive download instead of deleting it afterwards

set -euo pipefail

STACK_DIR="${STACK_DIR:-/opt/mcrrc}"
SCRATCH_DB="${SCRATCH_DB:-restorecheck}"

CHECK_ONLY=""
ASSUME_YES=""
KEEP_DOWNLOAD=""
SOURCE=""

for arg in "$@"; do
	case "$arg" in
		--check) CHECK_ONLY=1 ;;
		--yes|-y) ASSUME_YES=1 ;;
		--keep) KEEP_DOWNLOAD=1 ;;
		-*) echo "Unknown option: $arg"; exit 1 ;;
		*) SOURCE="$arg" ;;
	esac
done

if [ -z "$SOURCE" ]; then
	sed -n '2,23p' "$0" | sed 's/^# \{0,1\}//'
	exit 1
fi

# A Drive download is a second copy of something that already exists in Drive,
# so it is removed once the run succeeds — but kept on failure, so a retry does
# not fetch it again. backup.sh prunes only mcrrcrecords-*.archive.gz, so
# without this these downloads would accumulate on the droplet indefinitely.
DOWNLOADED=""
cleanup_download() {
	local rc=$?
	if [ -n "$DOWNLOADED" ] && [ -f "$DOWNLOADED" ]; then
		if [ "$rc" -eq 0 ] && [ -z "$KEEP_DOWNLOAD" ]; then
			rm -f "$DOWNLOADED"
			echo "Removed the downloaded copy (it still exists in Drive). Use --keep to retain it."
		else
			echo "Downloaded copy kept at $DOWNLOADED"
		fi
	fi
}
trap cleanup_download EXIT

cd "$STACK_DIR"

if [ ! -f .env ]; then
	echo "No .env found in $STACK_DIR - is this the right directory?"
	exit 1
fi
# shellcheck disable=SC1091
set -a; . ./.env; set +a

MONGO_URI="mongodb://${MONGO_USER}:${MONGO_PASSWORD}@localhost:27017/?authSource=admin"

# ---- Resolve the source into a local file -----------------------------------

resolve_source() {
	# Already a local file? Use it as-is and never delete it.
	if [ -f "$SOURCE" ]; then
		ARCHIVE="$SOURCE"
		return
	fi

	# Accept a full share link, a uc?id= link, or a bare file ID.
	local id=""
	case "$SOURCE" in
		*drive.google.com*)
			id="$(printf '%s' "$SOURCE" | grep -oE '/file/d/[A-Za-z0-9_-]+' | head -1 | cut -d/ -f4)"
			if [ -z "$id" ]; then
				id="$(printf '%s' "$SOURCE" | grep -oE '[?&]id=[A-Za-z0-9_-]+' | head -1 | cut -d= -f2)"
			fi
			;;
		http*)
			echo "Only Google Drive links are supported. Download it yourself and pass the path."
			exit 1
			;;
		*)
			# Bare Drive IDs are long and have no slashes or dots.
			if printf '%s' "$SOURCE" | grep -qE '^[A-Za-z0-9_-]{20,}$'; then
				id="$SOURCE"
			fi
			;;
	esac

	if [ -z "$id" ]; then
		echo "Could not read '$SOURCE' as a local file, a Drive link, or a Drive file ID."
		exit 1
	fi

	if [ -z "${GDRIVE_REMOTE:-}" ]; then
		echo "GDRIVE_REMOTE is not set in .env, so there is no rclone remote to download through."
		exit 1
	fi
	if ! command -v rclone >/dev/null 2>&1; then
		echo "rclone is not installed, so a Drive link cannot be fetched."
		exit 1
	fi

	mkdir -p backups
	ARCHIVE="backups/restore-download-$(date -u +%Y%m%dT%H%M%SZ).archive.gz"
	DOWNLOADED="$ARCHIVE"

	echo "Downloading Drive file $id -> $ARCHIVE"
	# copyid fetches by file ID, so a share link works without knowing the path.
	# Note: if the rclone remote was authorised with the drive.file scope it can
	# only see files it created itself — a manually uploaded archive will 404.
	if ! rclone backend copyid "${GDRIVE_REMOTE}:" "$id" "$ARCHIVE"; then
		echo "FAILED: could not download $id from ${GDRIVE_REMOTE}:"
		exit 1
	fi
}

resolve_source

if [ ! -s "$ARCHIVE" ]; then
	echo "FAILED: $ARCHIVE is missing or empty."
	exit 1
fi

# mongodump --gzip writes a gzip stream; anything else here is the wrong file,
# and it is much better to find out now than half way through a --drop restore.
if [ "$(head -c 2 "$ARCHIVE" | od -An -tx1 | tr -d ' \n')" != "1f8b" ]; then
	echo "FAILED: $ARCHIVE is not gzip data. Wrong file, or a truncated download?"
	exit 1
fi

echo "Archive: $ARCHIVE ($(( $(wc -c < "$ARCHIVE") / 1024 )) KiB)"

count_collections() {
	docker compose exec -T mongo mongosh \
		"mongodb://${MONGO_USER}:${MONGO_PASSWORD}@localhost:27017/$1?authSource=admin" \
		--quiet --eval 'db.getCollectionNames().filter(c => !c.startsWith("system.")).forEach(c => print("   " + c + " " + db[c].countDocuments()))'
}

# ---- Check mode: restore somewhere harmless and report ----------------------

if [ -n "$CHECK_ONLY" ]; then
	echo "Restoring into scratch database '$SCRATCH_DB' - live data is untouched."
	docker compose exec -T mongo mongorestore \
		--uri="$MONGO_URI" --archive --gzip --drop \
		--nsFrom='mcrrcrecords.*' --nsTo="${SCRATCH_DB}.*" < "$ARCHIVE"

	echo
	echo "Contents of the archive:"
	count_collections "$SCRATCH_DB"

	echo
	echo "Dropping scratch database."
	docker compose exec -T mongo mongosh \
		"mongodb://${MONGO_USER}:${MONGO_PASSWORD}@localhost:27017/${SCRATCH_DB}?authSource=admin" \
		--quiet --eval 'db.dropDatabase()' >/dev/null
	exit 0
fi

# ---- Real restore -----------------------------------------------------------

echo
echo "Current live database:"
count_collections mcrrcrecords

if [ -z "$ASSUME_YES" ]; then
	echo
	echo "This REPLACES the live database with the archive above."
	printf "Type 'restore' to continue: "
	read -r reply
	if [ "$reply" != "restore" ]; then
		echo "Aborted."
		exit 1
	fi
fi

echo
echo "Taking a safety dump of the current state first ..."
if ! ./backup.sh; then
	echo "FAILED: could not back up the current state, so there would be no way back. Stopping."
	exit 1
fi

echo "Stopping the app so nothing writes mid-restore ..."
docker compose stop app

# --drop replaces each collection that appears in the archive. Collections
# created since the backup are not in it and therefore survive; this is a
# replace of what was backed up, not a wipe of the whole database.
echo "Restoring ..."
if ! docker compose exec -T mongo mongorestore \
	--uri="$MONGO_URI" --archive --gzip --drop < "$ARCHIVE"; then
	echo
	echo "FAILED: the restore errored. The app is still stopped, deliberately."
	echo "The safety dump from a moment ago is the newest file in backups/."
	exit 1
fi

echo
echo "Restored database:"
count_collections mcrrcrecords

echo
echo "Starting the app ..."
docker compose start app
echo "Done."
