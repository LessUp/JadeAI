import { SQLiteAdapter } from './adapters/sqlite';
import { PostgreSQLAdapter } from './adapters/postgresql';
import type { DatabaseAdapter } from './adapter';
import { resolveDatabaseConfig } from './config';

let adapter: DatabaseAdapter;
const dbConfig = resolveDatabaseConfig();

if (dbConfig.type === 'postgresql') {
  adapter = new PostgreSQLAdapter(dbConfig.databaseUrl);
} else {
  adapter = new SQLiteAdapter(dbConfig.sqlitePath);
}

// Initialize (migrate + seed) — must complete before first query.
// Store the promise so consumers can await it if needed.
const _initPromise = adapter.initialize().catch((e) => {
  console.error('[DB] Initialize failed:', e);
  throw e;
});

/** Await this before any DB operation to ensure tables exist */
export const dbReady = _initPromise;

export const db = adapter.db;
export { adapter };
