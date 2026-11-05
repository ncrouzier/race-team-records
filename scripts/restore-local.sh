#!/usr/bin/env bash
# Load a Mongo archive (from deploy/backup.sh, e.g. one downloaded from Drive)
# into the local development database — the local version of deploy/restore.sh.
#
#   ./scripts/restore-local.sh --check ~/Downloads/mcrrcrecords-20260906T031700Z.archive.gz
#   ./scripts/restore-local.sh ~/Downloads/mcrrcrecords-20260906T031700Z.archive.gz
#   npm run db:restore -- ~/Downloads/mcrrcrecords-20260906T031700Z.archive.gz
#
# The database is MONGO_DEV_URL from .env (mongodb://127.0.0.1:27017/mcrrcrecords).
#
# --check restores into a throwaway database and prints the collection counts,
# touching nothing. Without it the script replaces the local database, after
# saving a safety dump in backups-local/ and asking for confirmation.
#
# Uploads (member photos and banners): backup.sh writes uploads-<stamp>.tar.gz
# (photos-<stamp>.tar.gz before banners moved there) next to each database
# archive. When that file sits beside the archive (download both from Drive),
# it replaces the local uploads/photos and uploads/banners too; or name it
# with --uploads=<file>. Without one, they stay as they are, and members or
# banners whose files are not here show initials or a broken image.
#
# Options: --check          verify only, never touch the local database
#          --yes            skip the confirmation prompt
#          --uploads=<file> the uploads archive, when not beside the database one
#                           (--photos=<file> still works)
#          --no-uploads     leave the local photos and banners alone (or --no-photos)
#
# Needs mongorestore, mongodump and mongosh (brew install mongodb-database-tools mongosh).

set -euo pipefail

SCRATCH_DB="${SCRATCH_DB:-restorecheck}"
ARCHIVE_DB="mcrrcrecords"   # the database name inside backup.sh's archives

CHECK_ONLY=""
ASSUME_YES=""
ARCHIVE=""
PHOTOS=""
NO_PHOTOS=""

for arg in "$@"; do
	case "$arg" in
		--check) CHECK_ONLY=1 ;;
		--yes|-y) ASSUME_YES=1 ;;
		--uploads=*) PHOTOS="${arg#--uploads=}" ;;
		--photos=*) PHOTOS="${arg#--photos=}" ;;
		--no-uploads|--no-photos) NO_PHOTOS=1 ;;
		-*) echo "Unknown option: $arg"; exit 1 ;;
		*) ARCHIVE="$arg" ;;
	esac
done

if [ -z "$ARCHIVE" ]; then
	sed -n '2,28p' "$0" | sed 's/^# \{0,1\}//'
	exit 1
fi

# Paths given relative to where the command was run, before moving to the repo
case "$ARCHIVE" in
	/*) ;;
	*) ARCHIVE="$PWD/$ARCHIVE" ;;
esac
case "$PHOTOS" in
	""|/*) ;;
	*) PHOTOS="$PWD/$PHOTOS" ;;
esac

# The uploads archive from the same backup run: same stamp, same folder
if [ -z "$PHOTOS" ] && [ -z "$NO_PHOTOS" ]; then
	STAMP_PART="$(basename "$ARCHIVE" | sed -nE 's/^mcrrcrecords-(.*)\.archive\.gz$/\1/p')"
	for prefix in uploads photos; do
		if [ -z "$PHOTOS" ] && [ -n "$STAMP_PART" ] && [ -f "$(dirname "$ARCHIVE")/$prefix-$STAMP_PART.tar.gz" ]; then
			PHOTOS="$(dirname "$ARCHIVE")/$prefix-$STAMP_PART.tar.gz"
		fi
	done
fi
[ -n "$NO_PHOTOS" ] && PHOTOS=""

cd "$(dirname "$0")/.."

for tool in mongorestore mongodump mongosh; do
	if ! command -v "$tool" >/dev/null 2>&1; then
		echo "$tool is not installed (brew install mongodb-database-tools mongosh)."
		exit 1
	fi
done

# The local database, from .env
DB_URL="${MONGO_DEV_URL:-}"
if [ -z "$DB_URL" ] && [ -f .env ]; then
	DB_URL="$(grep -E '^MONGO_DEV_URL=' .env | tail -1 | cut -d= -f2- | tr -d '"'"'")"
fi
if [ -z "$DB_URL" ]; then
	echo "MONGO_DEV_URL is not set (in .env or the environment)."
	exit 1
fi
# Split into the server and the database name: mongodb://host:port/dbname?options
DB_NAME="$(printf '%s' "$DB_URL" | sed -E 's#^mongodb(\+srv)?://[^/]+/?##; s#\?.*$##')"
SERVER_URL="$(printf '%s' "$DB_URL" | sed -E 's#^(mongodb(\+srv)?://[^/]+).*#\1#')"
DB_NAME="${DB_NAME:-mcrrcrecords}"

# Only ever a local server: this replaces data
case "$SERVER_URL" in
	*127.0.0.1*|*localhost*) ;;
	*)
		echo "MONGO_DEV_URL points at $SERVER_URL, not this machine. This script only restores locally."
		exit 1
		;;
esac

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

echo "Archive:  $ARCHIVE ($(( $(wc -c < "$ARCHIVE") / 1024 )) KiB)"
echo "Database: $DB_NAME on $SERVER_URL"

# ---- Photos archive: check it before anything is touched --------------------
PHOTO_DIR_LOCAL="uploads/photos"
PHOTO_COUNT=0
BANNER_COUNT=0
UPLOAD_PARTS=""
if [ -n "$PHOTOS" ]; then
	if [ ! -s "$PHOTOS" ]; then
		echo "FAILED: uploads archive $PHOTOS is missing or empty."
		exit 1
	fi
	if ! ENTRIES="$(tar -tzf "$PHOTOS" 2>/dev/null)"; then
		echo "FAILED: $PHOTOS is not a readable .tar.gz."
		exit 1
	fi
	# Only photos/<memberId>.jpg and banners/<name>.jpg: nothing that could
	# land outside the folders (../, absolute paths, links) or that the site
	# would not serve anyway
	BAD="$(printf '%s\n' "$ENTRIES" | grep -vE '^(\./)?(photos|banners)/?$|^(\./)?photos/[a-f0-9]{24}\.jpg$|^(\./)?banners/[A-Za-z0-9_-]{1,60}\.jpg$' || true)"
	if [ -n "$BAD" ]; then
		echo "FAILED: $PHOTOS holds unexpected entries, refusing to extract it:"
		printf '%s\n' "$BAD" | head -5 | sed 's/^/   /'
		exit 1
	fi
	PHOTO_COUNT="$(printf '%s\n' "$ENTRIES" | grep -cE '^(\./)?photos/.*\.jpg$' || true)"
	BANNER_COUNT="$(printf '%s\n' "$ENTRIES" | grep -cE '^(\./)?banners/.*\.jpg$' || true)"
	printf '%s\n' "$ENTRIES" | grep -qE '^(\./)?photos/' && UPLOAD_PARTS="$UPLOAD_PARTS photos"
	printf '%s\n' "$ENTRIES" | grep -qE '^(\./)?banners/' && UPLOAD_PARTS="$UPLOAD_PARTS banners"
	echo "Uploads:  $PHOTOS ($PHOTO_COUNT photos, $BANNER_COUNT banners)"
else
	echo "Uploads:  none given - uploads/photos and uploads/banners are left as they are"
fi

count_collections() {
	mongosh "$SERVER_URL/$1" --quiet --eval \
		'db.getCollectionNames().filter(c => !c.startsWith("system.")).sort().forEach(c => print("   " + c + " " + db[c].countDocuments()))'
}

# ---- Check mode: restore somewhere harmless and report ----------------------

if [ -n "$CHECK_ONLY" ]; then
	echo "Restoring into scratch database '$SCRATCH_DB' - $DB_NAME is untouched."
	mongorestore --uri="$SERVER_URL" --archive="$ARCHIVE" --gzip --drop --quiet \
		--nsFrom="${ARCHIVE_DB}.*" --nsTo="${SCRATCH_DB}.*"

	echo
	echo "Contents of the archive:"
	count_collections "$SCRATCH_DB"

	echo
	echo "Dropping scratch database."
	mongosh "$SERVER_URL/$SCRATCH_DB" --quiet --eval 'db.dropDatabase()' >/dev/null
	[ -n "$PHOTOS" ] && echo "Uploads archive ok: $PHOTO_COUNT photos, $BANNER_COUNT banners."
	exit 0
fi

# ---- Real restore -----------------------------------------------------------

echo
echo "Current local database:"
count_collections "$DB_NAME"

if [ -z "$ASSUME_YES" ]; then
	echo
	echo "This REPLACES the local $DB_NAME database with the archive above."
	[ -n "$PHOTOS" ] && echo "It also REPLACES the local uploads ($UPLOAD_PARTS ) with those in the uploads archive: $PHOTO_COUNT photos, $BANNER_COUNT banners."
	printf "Type 'restore' to continue: "
	read -r reply
	if [ "$reply" != "restore" ]; then
		echo "Aborted."
		exit 1
	fi
fi

mkdir -p backups-local
SAFETY="backups-local/${DB_NAME}-before-restore-$(date -u +%Y%m%dT%H%M%SZ).archive.gz"
echo
echo "Saving the current state first -> $SAFETY"
if ! mongodump --uri="$SERVER_URL" --db="$DB_NAME" --archive="$SAFETY" --gzip --quiet; then
	echo "FAILED: could not save the current state, so there would be no way back. Stopping."
	exit 1
fi

# --drop replaces each collection that appears in the archive. Collections
# that exist only locally are not in it and therefore survive. The archive's
# database name is mapped onto the local one, should they ever differ.
echo "Restoring ..."
if ! mongorestore --uri="$SERVER_URL" --archive="$ARCHIVE" --gzip --drop --quiet \
	--nsFrom="${ARCHIVE_DB}.*" --nsTo="${DB_NAME}.*"; then
	echo
	echo "FAILED: the restore errored. To go back:"
	echo "   ./scripts/restore-local.sh $SAFETY"
	exit 1
fi

echo
echo "Restored database:"
count_collections "$DB_NAME"

# ---- Photos -----------------------------------------------------------------
PHOTO_SAFETY=""
if [ -n "$PHOTOS" ] && [ -n "$UPLOAD_PARTS" ]; then
	# The local folders this replaces, saved first
	EXISTING=""
	for part in $UPLOAD_PARTS; do
		[ -d "uploads/$part" ] && [ -n "$(ls -A "uploads/$part" 2>/dev/null)" ] && EXISTING="$EXISTING $part"
	done
	if [ -n "$EXISTING" ]; then
		PHOTO_SAFETY="backups-local/uploads-before-restore-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
		# shellcheck disable=SC2086
		tar -czf "$PHOTO_SAFETY" -C uploads $EXISTING
		echo
		echo "Saved the current uploads ($EXISTING ) -> $PHOTO_SAFETY"
	fi
	# Extract beside the folders, then swap each: never a half-replaced folder
	mkdir -p uploads
	TMP_UPLOADS="$(mktemp -d uploads/.restore.XXXXXX)"
	tar -xzf "$PHOTOS" -C "$TMP_UPLOADS" --no-same-owner
	for part in $UPLOAD_PARTS; do
		rm -rf "uploads/$part"
		mv "$TMP_UPLOADS/$part" "uploads/$part"
	done
	rm -rf "$TMP_UPLOADS"
	echo "Restored $PHOTO_COUNT photos and $BANNER_COUNT banners into uploads/"
fi

# Members still on a photo link to another site: an archive from before the
# photos moved to the server
EXTERNAL="$(mongosh "$SERVER_URL/$DB_NAME" --quiet --eval \
	'print(db.members.countDocuments({ pictureLink: { $nin: ["", null], $not: /^\/uploads\/photos\// } }))' 2>/dev/null || echo "?")"
if [ "$EXTERNAL" != "0" ] && [ "$EXTERNAL" != "?" ]; then
	echo
	echo "$EXTERNAL member(s) still have a photo link to another site. To store them here:"
	echo "   npm run photos:import -- --dry-run     # check"
	echo "   npm run photos:import"
fi

echo
echo "Done. Restart the local server so it starts from the restored data."
echo "To undo: ./scripts/restore-local.sh --no-uploads $SAFETY"
[ -n "$PHOTO_SAFETY" ] && echo "   and for the uploads: rm -rf$(printf ' uploads/%s' $EXISTING) && tar -xzf $PHOTO_SAFETY -C uploads"
true
