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

normalize_proxy_for_build() {
  local value="$1"
  value="${value/#socks5:\/\//socks5h://}"
  value="${value//127.0.0.1/host.docker.internal}"
  value="${value//localhost/host.docker.internal}"
  printf '%s' "$value"
}

proxy_needs_host_gateway() {
  local value="$1"
  case "$value" in
    *127.0.0.1*|*localhost*) return 0 ;;
    *) return 1 ;;
  esac
}

build_args=(
  --build-arg "APP_VERSION=$APP_VERSION"
  --build-arg "BUILD_DATE=$BUILD_DATE"
  --build-arg "VCS_REF=$VCS_REF"
)
needs_host_gateway=false
if [ -n "${DEBIAN_MIRROR:-}" ]; then
  build_args+=(--build-arg "DEBIAN_MIRROR=$DEBIAN_MIRROR")
fi
if [ -n "${DEBIAN_SECURITY_MIRROR:-}" ]; then
  build_args+=(--build-arg "DEBIAN_SECURITY_MIRROR=$DEBIAN_SECURITY_MIRROR")
fi
if [ -n "${INSTALL_CHROMIUM:-}" ]; then
  build_args+=(--build-arg "INSTALL_CHROMIUM=$INSTALL_CHROMIUM")
fi
if [ -n "${INSTALL_CJK_FONTS:-}" ]; then
  build_args+=(--build-arg "INSTALL_CJK_FONTS=$INSTALL_CJK_FONTS")
fi
if [ -n "${ALLOW_CHROMIUM_DOWNLOAD:-}" ]; then
  build_args+=(--build-arg "ALLOW_CHROMIUM_DOWNLOAD=$ALLOW_CHROMIUM_DOWNLOAD")
fi
effective_http_proxy="${HTTP_PROXY:-${http_proxy:-}}"
if [ -n "$effective_http_proxy" ]; then
  normalized_http_proxy="$(normalize_proxy_for_build "$effective_http_proxy")"
  build_args+=(--build-arg "HTTP_PROXY=$normalized_http_proxy")
  build_args+=(--build-arg "http_proxy=$normalized_http_proxy")
  if proxy_needs_host_gateway "$effective_http_proxy"; then
    needs_host_gateway=true
  fi
fi
effective_https_proxy="${HTTPS_PROXY:-${https_proxy:-}}"
if [ -n "$effective_https_proxy" ]; then
  normalized_https_proxy="$(normalize_proxy_for_build "$effective_https_proxy")"
  build_args+=(--build-arg "HTTPS_PROXY=$normalized_https_proxy")
  build_args+=(--build-arg "https_proxy=$normalized_https_proxy")
  if proxy_needs_host_gateway "$effective_https_proxy"; then
    needs_host_gateway=true
  fi
fi
effective_no_proxy="${NO_PROXY:-${no_proxy:-}}"
if [ -n "$effective_no_proxy" ]; then
  build_args+=(--build-arg "NO_PROXY=$effective_no_proxy")
  build_args+=(--build-arg "no_proxy=$effective_no_proxy")
fi
if [ "$needs_host_gateway" = "true" ]; then
  build_args+=(--add-host "host.docker.internal:host-gateway")
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

if [ "${INSTALL_CHROMIUM:-true}" = "true" ]; then
  docker exec "$CONTAINER_NAME" test -x /usr/bin/chromium
  docker exec "$CONTAINER_NAME" /usr/bin/chromium --version >/dev/null
fi
docker exec "$CONTAINER_NAME" test -f /app/data/jade.db
docker exec "$CONTAINER_NAME" node -e "fetch('http://127.0.0.1:3000/api/ai/models').then((r) => { if (!r.ok) throw new Error('Unexpected status ' + r.status); return r.json(); }).then(() => console.log('API reachable'))"

echo "Docker smoke passed for $IMAGE_NAME on http://localhost:${HOST_PORT}"
