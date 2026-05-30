import test from 'node:test';
import assert from 'node:assert/strict';
import type { ResumeDraftSnapshot } from '@/types/editor';

function makeDraft(title: string): ResumeDraftSnapshot {
  return {
    title,
    template: 'default',
    themeConfig: {},
    language: 'en',
    sections: [],
  };
}

test('restores a different snapshot and persists it after verification', async () => {
  const { executeResumeRestore } = await import('./restore-resume-version');
  const calls: string[] = [];
  let currentDraft = makeDraft('current');
  const targetDraft = makeDraft('target');

  const result = await executeResumeRestore({
    readCurrentDraft: async () => currentDraft,
    targetDraft,
    saveBackupVersion: async () => {
      calls.push('backup');
    },
    applyTargetDraft: async (draft) => {
      calls.push('apply');
      currentDraft = draft;
    },
    persistRestoredDraft: async () => {
      calls.push('persist');
    },
  });

  assert.deepEqual(calls, ['backup', 'apply', 'persist']);
  assert.equal(result.status, 'restored');
});

test('returns noop when restoring the already-current snapshot', async () => {
  const { executeResumeRestore } = await import('./restore-resume-version');
  const currentDraft = makeDraft('same');
  let persisted = false;

  const result = await executeResumeRestore({
    readCurrentDraft: async () => currentDraft,
    targetDraft: makeDraft('same'),
    saveBackupVersion: async () => {
      throw new Error('should not back up noop restore');
    },
    applyTargetDraft: async () => {
      throw new Error('should not apply noop restore');
    },
    persistRestoredDraft: async () => {
      persisted = true;
    },
  });

  assert.deepEqual(result, { status: 'noop', reason: 'already-current' });
  assert.equal(persisted, false);
});

test('throws when apply completes but current draft still does not match target', async () => {
  const { executeResumeRestore } = await import('./restore-resume-version');
  const currentDraft = makeDraft('before');
  await assert.rejects(
    () =>
      executeResumeRestore({
        readCurrentDraft: async () => currentDraft,
        targetDraft: makeDraft('after'),
        saveBackupVersion: async () => {},
        applyTargetDraft: async () => {},
        persistRestoredDraft: async () => {},
      }),
    /restore verification failed/i,
  );
});
