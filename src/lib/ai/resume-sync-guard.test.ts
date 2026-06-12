import assert from 'node:assert/strict';
import test from 'node:test';

import { ensureResumeSyncedBeforeAI, type ResumeSyncSnapshot } from './resume-sync-guard';

test('returns immediately when no resume is loaded', async () => {
  let saveCallCount = 0;
  const snapshot: ResumeSyncSnapshot = {
    hasResume: false,
    isDirty: false,
    isSaving: false,
    save: async () => {
      saveCallCount += 1;
    },
  };

  await ensureResumeSyncedBeforeAI(() => snapshot, { timeoutMs: 50, pollIntervalMs: 1 });

  assert.equal(saveCallCount, 0);
});

test('triggers save when resume is dirty and not saving', async () => {
  let saveCallCount = 0;
  const snapshot: ResumeSyncSnapshot = {
    hasResume: true,
    isDirty: true,
    isSaving: false,
    save: async () => {
      saveCallCount += 1;
      snapshot.isSaving = true;
      await Promise.resolve();
      snapshot.isSaving = false;
      snapshot.isDirty = false;
    },
  };

  await ensureResumeSyncedBeforeAI(() => snapshot, { timeoutMs: 50, pollIntervalMs: 1 });

  assert.equal(saveCallCount, 1);
  assert.equal(snapshot.isDirty, false);
});

test('waits for ongoing save to finish', async () => {
  let saveCallCount = 0;
  const snapshot: ResumeSyncSnapshot = {
    hasResume: true,
    isDirty: true,
    isSaving: true,
    save: async () => {
      saveCallCount += 1;
    },
  };

  setTimeout(() => {
    snapshot.isSaving = false;
    snapshot.isDirty = false;
  }, 10);

  await ensureResumeSyncedBeforeAI(() => snapshot, { timeoutMs: 100, pollIntervalMs: 1 });

  assert.equal(saveCallCount, 0);
});

test('throws when syncing does not complete before timeout', async () => {
  const snapshot: ResumeSyncSnapshot = {
    hasResume: true,
    isDirty: true,
    isSaving: true,
    save: async () => {},
  };

  await assert.rejects(
    () => ensureResumeSyncedBeforeAI(() => snapshot, { timeoutMs: 5, pollIntervalMs: 1 }),
    /Timed out while syncing the latest resume before AI request/
  );
});
