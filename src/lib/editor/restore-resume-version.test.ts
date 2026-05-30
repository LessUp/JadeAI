import test from 'node:test';
import assert from 'node:assert/strict';
import type { ResumeDraftSnapshot } from '@/types/editor';
import type { Resume } from '@/types/resume';
import { DEFAULT_THEME } from '@/lib/resume-theme/build-theme-css';

function makeDraft(title: string): ResumeDraftSnapshot {
  return {
    title,
    template: 'default',
    themeConfig: {
      ...DEFAULT_THEME,
      margin: {
        ...DEFAULT_THEME.margin,
      },
    },
    language: 'en',
    sections: [],
  };
}

function makeResume(title: string): Resume {
  return {
    id: 'resume-1',
    userId: 'user-1',
    title,
    template: 'default',
    themeConfig: {
      ...DEFAULT_THEME,
      margin: {
        ...DEFAULT_THEME.margin,
      },
    },
    isDefault: false,
    language: 'en',
    sections: [],
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
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
    applyTargetDraft: async (draft: ResumeDraftSnapshot) => {
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

test('restoreResumeVersionById wires store callbacks into the restore transaction', async () => {
  const { restoreResumeVersionById } = await import('./resume-history-actions');
  const targetDraft = makeDraft('target');
  const applyCalls: Array<{
    draft: ResumeDraftSnapshot;
    options: unknown;
  }> = [];
  const saveCalls: Array<Record<string, unknown>> = [];
  const backupCalls: string[] = [];
  const resumeStoreState = {
    currentResume: makeResume('current'),
    save: async (options?: Record<string, unknown>) => {
      saveCalls.push(options ?? {});
    },
  };

  const result = await restoreResumeVersionById('version-1', {
    getResumeVersion: async (versionId: string) => ({
      id: versionId,
      resumeId: 'resume-1',
      snapshot: targetDraft,
      source: 'manual',
      createdAt: Date.now(),
    }),
    executeResumeRestore: async ({
      readCurrentDraft,
      targetDraft: resolvedTargetDraft,
      saveBackupVersion,
      applyTargetDraft,
      persistRestoredDraft,
    }) => {
      assert.deepEqual(await readCurrentDraft(), makeDraft('current'));
      assert.deepEqual(resolvedTargetDraft, targetDraft);

      await saveBackupVersion();
      await applyTargetDraft(targetDraft);
      await persistRestoredDraft();

      return { status: 'restored' };
    },
    saveCurrentResumeVersion: async (source) => {
      backupCalls.push(source);
      return null;
    },
    applyResumeDraftSnapshot: (draft, options) => {
      applyCalls.push({ draft, options });
      resumeStoreState.currentResume = makeResume(draft.title);
    },
    getResumeStoreState: () => resumeStoreState,
  });

  assert.deepEqual(backupCalls, ['restore']);
  assert.deepEqual(applyCalls, [
    {
      draft: targetDraft,
      options: {
        recordHistory: true,
        markDirty: true,
        clearPendingSave: true,
      },
    },
  ]);
  assert.deepEqual(saveCalls, [{ source: 'restore', forceVersion: true }]);
  assert.deepEqual(result, { status: 'restored' });
});

test('restoreResumeVersionById throws when the target version no longer exists', async () => {
  const { restoreResumeVersionById } = await import('./resume-history-actions');

  await assert.rejects(
    () =>
      restoreResumeVersionById('missing-version', {
        getResumeVersion: async () => null,
        executeResumeRestore: async () => {
          throw new Error('should not execute restore when version is missing');
        },
        saveCurrentResumeVersion: async () => null,
        applyResumeDraftSnapshot: () => {},
        getResumeStoreState: () => ({
          currentResume: makeResume('current'),
          save: async () => {},
        }),
      }),
    /version not found/i,
  );
});
