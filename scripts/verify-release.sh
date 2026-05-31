#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

pnpm type-check
pnpm build

SQLITE_SMOKE_DIR="$(mktemp -d)"
trap 'rm -rf "$SQLITE_SMOKE_DIR"' EXIT

SQLITE_PATH="$SQLITE_SMOKE_DIR/jade.db" node --import tsx - <<'NODE'
const sqliteModule = await import('./src/lib/db/adapters/sqlite.ts');
const { SQLiteAdapter } = sqliteModule.default ?? sqliteModule;
const adapter = new SQLiteAdapter(process.env.SQLITE_PATH);
await adapter.initialize();
await adapter.close();
NODE

if [ -n "${DATABASE_URL:-}" ]; then
  node --import tsx - <<'NODE'
const postgresModule = await import('./src/lib/db/adapters/postgresql.ts');
const { PostgreSQLAdapter } = postgresModule.default ?? postgresModule;
const adapter = new PostgreSQLAdapter(process.env.DATABASE_URL);
await adapter.initialize();
await adapter.close();
NODE
else
  echo "Skipping PostgreSQL migration smoke test because DATABASE_URL is not set."
fi
