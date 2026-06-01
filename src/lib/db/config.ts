export type DatabaseConfig =
  | { type: 'postgresql'; databaseUrl: string }
  | { type: 'sqlite'; sqlitePath: string };

type DatabaseType = DatabaseConfig['type'];
type DatabaseEnv = Partial<
  Record<'DATABASE_URL' | 'DB_TYPE' | 'NODE_ENV' | 'SQLITE_PATH' | 'VERCEL', string | undefined>
>;
type DatabaseConfigOptions = {
  warn?: (message: string) => void;
};

const DEFAULT_SQLITE_PATH = './data/jade.db';

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function resolveDbType(value: string | undefined): DatabaseType | undefined {
  const normalized = nonEmpty(value)?.toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'postgresql' || normalized === 'sqlite') return normalized;
  throw new Error(`Unsupported DB_TYPE "${value}". Expected "sqlite" or "postgresql".`);
}

function warn(options: DatabaseConfigOptions, message: string): void {
  (options.warn ?? console.warn)(message);
}

export function resolveDatabaseConfig(
  env: DatabaseEnv = process.env as DatabaseEnv,
  options: DatabaseConfigOptions = {},
): DatabaseConfig {
  const explicitType = resolveDbType(env.DB_TYPE);
  const databaseUrl = nonEmpty(env.DATABASE_URL);
  const sqlitePath = nonEmpty(env.SQLITE_PATH) || DEFAULT_SQLITE_PATH;
  const type = explicitType || (databaseUrl ? 'postgresql' : 'sqlite');

  if (type === 'postgresql') {
    if (!databaseUrl) {
      throw new Error('DB_TYPE=postgresql requires DATABASE_URL.');
    }
    if (!explicitType) {
      warn(
        options,
        '[DB] DB_TYPE is not set; using PostgreSQL because DATABASE_URL is present. ' +
          'Set DB_TYPE=postgresql to make this explicit.',
      );
    }
    return { type, databaseUrl };
  }

  if (env.VERCEL) {
    throw new Error(
      'SQLite is not supported on Vercel (read-only filesystem). ' +
      'Please set DB_TYPE=postgresql and DATABASE_URL in your Vercel environment variables.',
    );
  }

  if (databaseUrl) {
    warn(
      options,
      `[DB] DATABASE_URL is set but DB_TYPE=sqlite; ignoring DATABASE_URL and using SQLite at ${sqlitePath}.`,
    );
  } else if (!explicitType && env.NODE_ENV === 'production') {
    warn(
      options,
      `[DB] DB_TYPE is not set in production; using SQLite at ${sqlitePath} for backwards compatibility. ` +
        'Set DB_TYPE=sqlite to keep this explicit, or set DB_TYPE=postgresql with DATABASE_URL.',
    );
  }

  return { type, sqlitePath };
}
