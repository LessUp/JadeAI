import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveDatabaseConfig } from './config';

test('defaults to local SQLite when DB_TYPE is omitted', () => {
  assert.deepEqual(resolveDatabaseConfig({}), {
    type: 'sqlite',
    sqlitePath: './data/jade.db',
  });
});

test('rejects PostgreSQL without DATABASE_URL', () => {
  assert.throws(
    () => resolveDatabaseConfig({ DB_TYPE: 'postgresql' }),
    /DB_TYPE=postgresql requires DATABASE_URL/,
  );
});

test('rejects SQLite on Vercel', () => {
  assert.throws(
    () => resolveDatabaseConfig({ DB_TYPE: 'sqlite', VERCEL: '1' }),
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
