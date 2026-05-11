#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
IMAGE_NAME="${IMAGE_NAME:-jadeai-local:node24}"
CONTAINER_NAME="${CONTAINER_NAME:-jadeai}"
HOST_PORT="${HOST_PORT:-3003}"
ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/.env.local}"
DATA_DIR="${DATA_DIR:-${SCRIPT_DIR}/jadeai-data}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing env file: $ENV_FILE"
  echo "Create one first, for example: cp .env.example .env.local"
  exit 1
fi

mkdir -p "$DATA_DIR"
docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
docker build --pull -t "$IMAGE_NAME" "$SCRIPT_DIR"
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  --env-file "$ENV_FILE" \
  -p "${HOST_PORT}:3000" \
  -v "${DATA_DIR}:/app/data" \
  "$IMAGE_NAME"
