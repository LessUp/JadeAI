#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
APP_VERSION="$(node -e "console.log(require(process.argv[1]).version)" "$ROOT_DIR/package.json")"

IMAGE_NAME="${IMAGE_NAME:-jadeai-smoke:v${APP_VERSION}}"
CONTAINER_NAME="${CONTAINER_NAME:-jadeai-smoke-$$}"
VOLUME_NAME="${VOLUME_NAME:-jadeai-smoke-data-$$}"
HOST_PORT="${HOST_PORT:-3013}"
SKIP_BUILD="${SKIP_BUILD:-false}"
KEEP_CONTAINER="${KEEP_CONTAINER:-false}"
BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
VCS_REF="$(git -C "$ROOT_DIR" rev-parse --short=12 HEAD 2>/dev/null || echo unknown)"

command -v docker >/dev/null 2>&1 || {
  echo "Docker is required for docker:smoke." >&2
  exit 1
}

cleanup() {
  if [ "$KEEP_CONTAINER" = "true" ]; then
    echo "Keeping smoke container $CONTAINER_NAME and volume $VOLUME_NAME."
    return
  fi
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  docker volume rm "$VOLUME_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

build_args=(
  --build-arg "APP_VERSION=$APP_VERSION"
  --build-arg "BUILD_DATE=$BUILD_DATE"
  --build-arg "VCS_REF=$VCS_REF"
)
if [ -n "${DEBIAN_MIRROR:-}" ]; then
  build_args+=(--build-arg "DEBIAN_MIRROR=$DEBIAN_MIRROR")
fi
if [ -n "${DEBIAN_SECURITY_MIRROR:-}" ]; then
  build_args+=(--build-arg "DEBIAN_SECURITY_MIRROR=$DEBIAN_SECURITY_MIRROR")
fi

if [ "$SKIP_BUILD" != "true" ]; then
  docker build "${build_args[@]}" -t "$IMAGE_NAME" "$ROOT_DIR"
fi

ENV_FILE="$(mktemp)"
cat > "$ENV_FILE" <<'ENV'
AUTH_SECRET=docker-smoke-local-only-secret
DB_TYPE=sqlite
SQLITE_PATH=/app/data/jade.db
NEXT_TELEMETRY_DISABLED=1
ENV
trap 'rm -f "$ENV_FILE"; cleanup' EXIT

docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
docker volume rm "$VOLUME_NAME" >/dev/null 2>&1 || true
docker volume create "$VOLUME_NAME" >/dev/null

docker run -d \
  --init \
  --name "$CONTAINER_NAME" \
  --env-file "$ENV_FILE" \
  -p "${HOST_PORT}:3000" \
  -v "${VOLUME_NAME}:/app/data" \
  "$IMAGE_NAME" >/dev/null

ready=false
for _ in $(seq 1 60); do
  if docker exec "$CONTAINER_NAME" wget -qO- http://127.0.0.1:3000/ >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 2
done

if [ "$ready" != "true" ]; then
  docker logs "$CONTAINER_NAME" >&2 || true
  echo "Container did not become ready." >&2
  exit 1
fi

docker exec "$CONTAINER_NAME" test -x /usr/bin/chromium
docker exec "$CONTAINER_NAME" /usr/bin/chromium --version >/dev/null
docker exec "$CONTAINER_NAME" test -f /app/data/jade.db
docker exec "$CONTAINER_NAME" node -e "fetch('http://127.0.0.1:3000/api/ai/models').then((r) => { if (!r.ok) throw new Error('Unexpected status ' + r.status); return r.json(); }).then(() => console.log('API reachable'))"

echo "Docker smoke passed for $IMAGE_NAME on http://localhost:${HOST_PORT}"
