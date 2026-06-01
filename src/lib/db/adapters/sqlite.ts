import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../schema';
import type { DatabaseAdapter, TransactionCallback } from '../adapter';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const directCode = 'code' in error ? error.code : undefined;
  if (typeof directCode === 'string') return directCode;
  const cause = 'cause' in error ? error.cause : undefined;
  if (typeof cause !== 'object' || cause === null) return undefined;
  const causeCode = 'code' in cause ? cause.code : undefined;
  return typeof causeCode === 'string' ? causeCode : undefined;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.cause instanceof Error) return error.cause.message;
    return error.message;
  }
  return String(error);
}

function isConcurrentMigrationError(error: unknown): boolean {
  return getErrorCode(error) === 'SQLITE_ERROR' && getErrorMessage(error).includes('already exists');
}

function isConcurrentSeedError(error: unknown): boolean {
  return getErrorCode(error) === 'SQLITE_CONSTRAINT_UNIQUE' && getErrorMessage(error).includes('users.fingerprint');
}

export class SQLiteAdapter implements DatabaseAdapter {
  db;
  private sqlite: Database.Database;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.sqlite = new Database(path);
    this.sqlite.pragma('busy_timeout = 5000');
    this.sqlite.pragma('journal_mode = WAL');
    this.sqlite.pragma('foreign_keys = ON');
    this.db = drizzle(this.sqlite, { schema });

    // Auto-run migrations (synchronous for SQLite)
    try {
      migrate(this.db, { migrationsFolder: resolve(process.cwd(), 'drizzle/migrations') });
    } catch (e) {
      if (isConcurrentMigrationError(e)) {
        return;
      }
      console.error('[DB] SQLite migration failed:', e);
      throw e;
    }
  }

  async initialize(): Promise<void> {
    try {
      const row = this.sqlite.prepare('SELECT count(*) as count FROM users').get() as any;
      if (row?.count === 0) {
        const { seedDemoUser } = await import('../seed-demo');
        await seedDemoUser(this.db);
        console.log('[DB] SQLite auto-seed complete');
      }
    } catch (e) {
      if (isConcurrentSeedError(e)) {
        return;
      }
      console.error('[DB] SQLite auto-seed failed:', e);
      throw e;
    }
  }

  async transaction<T>(callback: TransactionCallback<T>): Promise<T> {
    return this.db.transaction((tx) => {
      const result = callback(tx);

      if (result && typeof (result as Promise<T>).then === 'function') {
        throw new Error('SQLite transactions require synchronous callbacks');
      }

      return result as T;
    });
  }

  async close(): Promise<void> {
    this.sqlite.close();
  }
}
