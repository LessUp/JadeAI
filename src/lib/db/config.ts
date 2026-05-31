export type DatabaseConfig =
  | { type: 'postgresql'; databaseUrl: string }
  | { type: 'sqlite'; sqlitePath: string };

type DatabaseEnv = Partial<Record<'DATABASE_URL' | 'DB_TYPE' | 'SQLITE_PATH' | 'VERCEL', string | undefined>>;

function resolveDbType(value: string | undefined): 'postgresql' | 'sqlite' {
  if (!value) return 'sqlite';
  if (value === 'postgresql' || value === 'sqlite') return value;
  throw new Error(`Unsupported DB_TYPE "${value}". Expected "sqlite" or "postgresql".`);
}

export function resolveDatabaseConfig(env: DatabaseEnv = process.env as DatabaseEnv): DatabaseConfig {
  const type = resolveDbType(env.DB_TYPE);

  if (type === 'postgresql') {
    const databaseUrl = env.DATABASE_URL?.trim();
    if (!databaseUrl) {
      throw new Error('DB_TYPE=postgresql requires DATABASE_URL.');
    }
    return { type, databaseUrl };
  }

  if (env.VERCEL) {
    throw new Error(
      'SQLite is not supported on Vercel (read-only filesystem). ' +
      'Please set DB_TYPE=postgresql and DATABASE_URL in your Vercel environment variables.',
    );
  }

  return { type, sqlitePath: env.SQLITE_PATH || './data/jade.db' };
}
