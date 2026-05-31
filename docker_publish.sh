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
if [ -n "${DEBIAN_MIRROR:-}" ]; then
  buildx_args+=(--build-arg "DEBIAN_MIRROR=$DEBIAN_MIRROR")
fi
if [ -n "${DEBIAN_SECURITY_MIRROR:-}" ]; then
  buildx_args+=(--build-arg "DEBIAN_SECURITY_MIRROR=$DEBIAN_SECURITY_MIRROR")
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
