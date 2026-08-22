import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import type { DatabaseAdapter, TransactionCallback } from '../adapter';
import { resolve } from 'path';

function isConcurrentSeedError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = 'code' in error ? error.code : undefined;
  return code === '23505';
}

export class PostgreSQLAdapter implements DatabaseAdapter {
  db;
  private client: ReturnType<typeof postgres>;

  constructor(connectionString: string) {
    this.client = postgres(connectionString);
    this.db = drizzle(this.client);
  }

  async initialize(): Promise<void> {
    // Auto-run migrations (PG-native migration files)
    try {
      await migrate(this.db, {
        migrationsFolder: resolve(process.cwd(), 'drizzle/pg-migrations'),
      });

      // Sanity check: if migration tracking says "done" but tables are missing
      // (e.g. after a manual DROP SCHEMA), reset tracking and re-run.
      // Destructive self-heal is opt-in via DB_ALLOW_SCHEMA_RESET=true.
      const check = await this.db.execute(
        sql`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') AS ok`
      );
      if (!(check as any)[0]?.ok) {
        if (process.env.DB_ALLOW_SCHEMA_RESET !== 'true') {
          throw new Error(
            '[DB] Migration tracking is stale (users table missing). Refusing to auto-DROP the drizzle schema. ' +
            'Set DB_ALLOW_SCHEMA_RESET=true to allow automatic schema reset, or repair migrations manually.'
          );
        }
        console.warn('[DB] Migration tracking is stale — resetting and re-running');
        await this.db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
        await migrate(this.db, {
          migrationsFolder: resolve(process.cwd(), 'drizzle/pg-migrations'),
        });
      }

      console.log('[DB] PostgreSQL migrations applied');
    } catch (e) {
      console.error('[DB] PostgreSQL migration failed:', e);
      throw e;
    }

    // Auto-seed if empty
    try {
      const result = await this.db.execute(sql`SELECT count(*)::int as count FROM users`);
      const count = Number((result as any)[0]?.count ?? 0);
      if (count === 0) {
        const { seedDemoUser } = await import('../seed-demo');
        await seedDemoUser(this.db);
        console.log('[DB] PostgreSQL auto-seed complete');
      }
    } catch (e) {
      if (isConcurrentSeedError(e)) {
        return;
      }
      console.error('[DB] PostgreSQL auto-seed failed:', e);
      throw e;
    }
  }

  async transaction<T>(callback: TransactionCallback<T>): Promise<T> {
    return this.db.transaction(async (tx) => callback(tx));
  }

  async close(): Promise<void> {
    await this.client.end();
  }
}
