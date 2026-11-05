#!/usr/bin/env bash
# Pull the published image and restart the site.
#
#   ./update.sh            # pull whatever IMAGE_TAG in .env already points at
#   ./update.sh v1.4.0     # switch to a specific release and pull that
#   ./update.sh latest     # follow the newest tagged release
#
# Waits for the container to report healthy and rolls back if it does not, so a
# bad release does not leave the site down while you work out what happened.

set -euo pipefail

STACK_DIR="${STACK_DIR:-/opt/mcrrc}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"

cd "$STACK_DIR"

if [ ! -f .env ]; then
	echo "No .env found in $STACK_DIR - is this the right directory?"
	exit 1
fi

read_tag() {
	grep -E '^IMAGE_TAG=' .env | tail -1 | cut -d= -f2- || true
}

# Rewritten line by line rather than with `sed -i`: that flag differs between
# GNU and BSD sed, and this way no tag value can be mistaken for part of the
# substitution syntax. Written back with `cat >` so .env keeps its own inode and
# 0600 permissions — it holds the session secret and the database password.
write_tag() {
	local tag="$1" tmp
	tmp="$(mktemp)"
	if grep -qE '^IMAGE_TAG=' .env; then
		while IFS= read -r line || [ -n "$line" ]; do
			case "$line" in
				IMAGE_TAG=*) printf 'IMAGE_TAG=%s\n' "$tag" ;;
				*) printf '%s\n' "$line" ;;
			esac
		done < .env > "$tmp"
	else
		cat .env > "$tmp"
		printf 'IMAGE_TAG=%s\n' "$tag" >> "$tmp"
	fi
	cat "$tmp" > .env
	rm -f "$tmp"
}

PREVIOUS_TAG="$(read_tag)"
PREVIOUS_TAG="${PREVIOUS_TAG:-latest}"
REQUESTED_TAG="${1:-$PREVIOUS_TAG}"

# The image the container is on right now. Compared after the restart so the
# script can tell "pulled a new build" from "already current", and used as the
# rollback target when the tag itself has not changed.
container_image() {
	local cid
	cid="$(docker compose ps -q app 2>/dev/null || true)"
	[ -n "$cid" ] && docker inspect --format '{{.Image}}' "$cid" 2>/dev/null || true
}

BEFORE_IMAGE="$(container_image)"

if [ "$REQUESTED_TAG" != "$PREVIOUS_TAG" ]; then
	echo "IMAGE_TAG: $PREVIOUS_TAG -> $REQUESTED_TAG"
	write_tag "$REQUESTED_TAG"
fi

echo "Pulling $REQUESTED_TAG ..."
if ! docker compose pull app; then
	echo "FAILED: could not pull the image."
	# Undo the tag change so .env still describes what is actually running.
	[ "$REQUESTED_TAG" != "$PREVIOUS_TAG" ] && write_tag "$PREVIOUS_TAG"
	exit 1
fi

# The upload folders (member photos, banners), bind-mounted into the app
# (docker-compose.yml). Created here rather than left to Docker, which would
# make them owned by root and unwritable by the container's `node` user
# (uid 1000).
for part in photos banners; do
	UPLOAD_DIR_HOST="$STACK_DIR/uploads/$part"
	mkdir -p "$UPLOAD_DIR_HOST"
	if [ "$(stat -c %u "$UPLOAD_DIR_HOST" 2>/dev/null || echo 1000)" != "1000" ]; then
		echo "Giving $UPLOAD_DIR_HOST to uid 1000 (the app container's user) ..."
		chown -R 1000:1000 "$UPLOAD_DIR_HOST"
	fi
done

echo "Restarting ..."
docker compose up -d app

# ---- Wait for health --------------------------------------------------------
# The image declares a HEALTHCHECK against /api/health, which reports 503 while
# Mongo is unreachable — so "healthy" here means the app is actually serving,
# not merely that the process started.
CID="$(docker compose ps -q app)"
DEADLINE=$((SECONDS + HEALTH_TIMEOUT))
HEALTHY=""

while [ "$SECONDS" -lt "$DEADLINE" ]; do
	STATUS="$(docker inspect \
		--format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
		"$CID" 2>/dev/null || echo gone)"
	case "$STATUS" in
		healthy)
			HEALTHY=1
			break
			;;
		unhealthy | exited | dead | gone)
			break
			;;
	esac
	sleep 3
done

if [ -z "$HEALTHY" ]; then
	echo
	echo "FAILED: app did not become healthy within ${HEALTH_TIMEOUT}s (last status: ${STATUS:-unknown})"
	echo "--- last 40 log lines ---"
	docker compose logs --tail 40 app || true
	echo

	if [ "$REQUESTED_TAG" != "$PREVIOUS_TAG" ]; then
		echo "Rolling back to $PREVIOUS_TAG ..."
		write_tag "$PREVIOUS_TAG"
		docker compose up -d app
		echo "Rolled back. The site should be back on $PREVIOUS_TAG."
	else
		# Same tag means there is no earlier tag to name. The previous image is
		# still on disk, so it can be pinned by digest if needed.
		echo "No tag change to undo. To go back to the image that was running:"
		echo "  docker tag ${BEFORE_IMAGE:-<previous-image-id>} rollback:previous"
		echo "  # then set IMAGE_TAG to a known-good release and re-run this script"
	fi
	exit 1
fi

AFTER_IMAGE="$(container_image)"
if [ -n "$BEFORE_IMAGE" ] && [ "$BEFORE_IMAGE" = "$AFTER_IMAGE" ]; then
	echo "Already on the current image for '$REQUESTED_TAG' - nothing changed."
else
	echo "Updated to '$REQUESTED_TAG'."
fi

# Only dangling layers, so this never removes an image still referenced by a tag
# you might want to roll back to.
docker image prune -f >/dev/null 2>&1 || true

docker compose ps app
