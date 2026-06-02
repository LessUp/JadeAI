#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
APP_VERSION="$(node -e "console.log(require(process.argv[1]).version)" "$SCRIPT_DIR/package.json")"
VERSION_TAG="v${APP_VERSION}"
IMAGE_REPOSITORY="${IMAGE_REPOSITORY:-jadeai-local}"
IMAGE_TAG="${IMAGE_TAG:-$VERSION_TAG}"
IMAGE_NAME="${IMAGE_NAME:-${IMAGE_REPOSITORY}:${IMAGE_TAG}}"
LATEST_IMAGE="${IMAGE_REPOSITORY}:latest"
CONTAINER_NAME="${CONTAINER_NAME:-jadeai}"
HOST_PORT="${HOST_PORT:-3003}"
ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/.env.local}"
DATA_DIR="${DATA_DIR:-}"
VOLUME_NAME="${VOLUME_NAME:-jadeai-data}"
BUILD_ONLY="${BUILD_ONLY:-false}"
PULL="${PULL:-false}"
BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
VCS_REF="$(git -C "$SCRIPT_DIR" rev-parse --short=12 HEAD 2>/dev/null || echo unknown)"

if [ "$BUILD_ONLY" != "true" ] && [ ! -f "$ENV_FILE" ]; then
  echo "Missing env file: $ENV_FILE"
  echo "Create one first, for example: cp .env.example .env.local"
  exit 1
fi

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
if [ "$PULL" = "true" ]; then
  build_args=(--pull "${build_args[@]}")
fi

docker build "${build_args[@]}" -t "$IMAGE_NAME" -t "$LATEST_IMAGE" "$SCRIPT_DIR"

if [ "$BUILD_ONLY" = "true" ]; then
  echo "Built $IMAGE_NAME and $LATEST_IMAGE"
  exit 0
fi

docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true

volume_args=(-v "${VOLUME_NAME}:/app/data")
if [ -n "$DATA_DIR" ]; then
  mkdir -p "$DATA_DIR"
  volume_args=(-v "${DATA_DIR}:/app/data")
fi

docker run -d \
  --init \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  --env-file "$ENV_FILE" \
  -p "${HOST_PORT}:3000" \
  "${volume_args[@]}" \
  "$IMAGE_NAME"

echo "Started $CONTAINER_NAME from $IMAGE_NAME on http://localhost:${HOST_PORT}"
if [ -n "$DATA_DIR" ]; then
  echo "Using bind mount $DATA_DIR -> /app/data (ensure it is writable by container uid 1000 if you see SQLite permission errors)."
else
  echo "Using named Docker volume $VOLUME_NAME for persistent SQLite data."
fi
