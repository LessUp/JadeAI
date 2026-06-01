import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveDatabaseConfig } from './config';

function withWarnings() {
  const warnings: string[] = [];
  return {
    warnings,
    options: {
      warn(message: string) {
        warnings.push(message);
      },
    },
  };
}

test('defaults to local SQLite when DB_TYPE is omitted', () => {
  const { warnings, options } = withWarnings();

  assert.deepEqual(resolveDatabaseConfig({}, options), {
    type: 'sqlite',
    sqlitePath: './data/jade.db',
  });
  assert.deepEqual(warnings, []);
});

test('keeps SQLite in production without DATABASE_URL for existing installs and warns', () => {
  const { warnings, options } = withWarnings();

  assert.deepEqual(resolveDatabaseConfig({ NODE_ENV: 'production' }, options), {
    type: 'sqlite',
    sqlitePath: './data/jade.db',
  });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /using SQLite .* backwards compatibility/);
});

test('rejects PostgreSQL without DATABASE_URL', () => {
  assert.throws(
    () => resolveDatabaseConfig({ DB_TYPE: 'postgresql' }),
    /DB_TYPE=postgresql requires DATABASE_URL/,
  );
});

test('rejects SQLite on Vercel', () => {
  assert.throws(
    () => resolveDatabaseConfig({ DB_TYPE: 'sqlite', DATABASE_URL: 'postgres://db', VERCEL: '1' }),
    /SQLite is not supported on Vercel/,
  );
});

test('rejects unsupported database type', () => {
  assert.throws(
    () => resolveDatabaseConfig({ DB_TYPE: 'mysql' }),
    /Unsupported DB_TYPE "mysql"/,
  );
});

test('resolves PostgreSQL with a database URL', () => {
  assert.deepEqual(resolveDatabaseConfig({
    DB_TYPE: 'postgresql',
    DATABASE_URL: 'postgres://user:pass@example.test:5432/jade',
  }), {
    type: 'postgresql',
    databaseUrl: 'postgres://user:pass@example.test:5432/jade',
  });
});

test('infers PostgreSQL when DB_TYPE is omitted but DATABASE_URL is set', () => {
  const { warnings, options } = withWarnings();

  assert.deepEqual(resolveDatabaseConfig({
    DATABASE_URL: ' postgres://user:pass@example.test:5432/jade ',
  }, options), {
    type: 'postgresql',
    databaseUrl: 'postgres://user:pass@example.test:5432/jade',
  });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /using PostgreSQL because DATABASE_URL is present/);
});

test('honors explicit SQLite with DATABASE_URL and warns that URL is ignored', () => {
  const { warnings, options } = withWarnings();

  assert.deepEqual(resolveDatabaseConfig({
    DB_TYPE: 'sqlite',
    DATABASE_URL: 'postgres://user:pass@example.test:5432/jade',
    SQLITE_PATH: './data/existing.db',
  }, options), {
    type: 'sqlite',
    sqlitePath: './data/existing.db',
  });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /DATABASE_URL is set but DB_TYPE=sqlite/);
});
