#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
APP_VERSION="$(node -e "console.log(require(process.argv[1]).version)" "$SCRIPT_DIR/package.json")"
IMAGE_REPOSITORY="${IMAGE_REPOSITORY:-shuai0/jadeai}"
PLATFORMS="${PLATFORMS:-linux/amd64,linux/arm64}"
PUSH="${PUSH:-true}"
BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
VCS_REF="$(git -C "$SCRIPT_DIR" rev-parse --short=12 HEAD 2>/dev/null || echo unknown)"

if [[ ! "$APP_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
  echo "package.json version '$APP_VERSION' is not a valid semver string."
  exit 1
fi

if [ "$PUSH" != "true" ] && [[ "$PLATFORMS" == *,* ]]; then
  echo "Multi-platform builds require PUSH=true. Use PLATFORMS=linux/amd64 for a local --load build."
  exit 1
fi

if ! docker buildx version >/dev/null 2>&1; then
  echo "docker buildx is required for publishing images."
  exit 1
fi

if [ "${SKIP_RELEASE_CHECK:-false}" != "true" ]; then
  pnpm release:check
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

tags=(
  -t "${IMAGE_REPOSITORY}:v${APP_VERSION}"
  -t "${IMAGE_REPOSITORY}:${APP_VERSION}"
)
if [[ "$APP_VERSION" != *-* ]]; then
  tags+=(-t "${IMAGE_REPOSITORY}:latest")
fi

buildx_args=(
  --platform "$PLATFORMS"
  "${tags[@]}"
  --build-arg "APP_VERSION=$APP_VERSION"
  --build-arg "BUILD_DATE=$BUILD_DATE"
  --build-arg "VCS_REF=$VCS_REF"
)
needs_host_gateway=false
if [ -n "${DEBIAN_MIRROR:-}" ]; then
  buildx_args+=(--build-arg "DEBIAN_MIRROR=$DEBIAN_MIRROR")
fi
if [ -n "${DEBIAN_SECURITY_MIRROR:-}" ]; then
  buildx_args+=(--build-arg "DEBIAN_SECURITY_MIRROR=$DEBIAN_SECURITY_MIRROR")
fi
if [ -n "${INSTALL_CHROMIUM:-}" ]; then
  buildx_args+=(--build-arg "INSTALL_CHROMIUM=$INSTALL_CHROMIUM")
fi
if [ -n "${INSTALL_CJK_FONTS:-}" ]; then
  buildx_args+=(--build-arg "INSTALL_CJK_FONTS=$INSTALL_CJK_FONTS")
fi
if [ -n "${ALLOW_CHROMIUM_DOWNLOAD:-}" ]; then
  buildx_args+=(--build-arg "ALLOW_CHROMIUM_DOWNLOAD=$ALLOW_CHROMIUM_DOWNLOAD")
fi
effective_http_proxy="${HTTP_PROXY:-${http_proxy:-}}"
if [ -n "$effective_http_proxy" ]; then
  normalized_http_proxy="$(normalize_proxy_for_build "$effective_http_proxy")"
  buildx_args+=(--build-arg "HTTP_PROXY=$normalized_http_proxy")
  buildx_args+=(--build-arg "http_proxy=$normalized_http_proxy")
  if proxy_needs_host_gateway "$effective_http_proxy"; then
    needs_host_gateway=true
  fi
fi
effective_https_proxy="${HTTPS_PROXY:-${https_proxy:-}}"
if [ -n "$effective_https_proxy" ]; then
  normalized_https_proxy="$(normalize_proxy_for_build "$effective_https_proxy")"
  buildx_args+=(--build-arg "HTTPS_PROXY=$normalized_https_proxy")
  buildx_args+=(--build-arg "https_proxy=$normalized_https_proxy")
  if proxy_needs_host_gateway "$effective_https_proxy"; then
    needs_host_gateway=true
  fi
fi
effective_no_proxy="${NO_PROXY:-${no_proxy:-}}"
if [ -n "$effective_no_proxy" ]; then
  buildx_args+=(--build-arg "NO_PROXY=$effective_no_proxy")
  buildx_args+=(--build-arg "no_proxy=$effective_no_proxy")
fi
if [ "$needs_host_gateway" = "true" ]; then
  buildx_args+=(--add-host "host.docker.internal:host-gateway")
fi
if [ "$PUSH" = "true" ]; then
  buildx_args+=(--push)
else
  buildx_args+=(--load)
fi

docker buildx build "${buildx_args[@]}" "$SCRIPT_DIR"

echo "Published ${IMAGE_REPOSITORY}:v${APP_VERSION} and ${IMAGE_REPOSITORY}:${APP_VERSION}"
if [[ "$APP_VERSION" != *-* ]]; then
  echo "Published ${IMAGE_REPOSITORY}:latest"
fi
