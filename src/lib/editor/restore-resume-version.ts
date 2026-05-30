import {
  areResumeDraftSnapshotsEqual,
  type ResumeDraftSnapshot,
} from './resume-draft';

export type RestoreResumeVersionResult =
  | { status: 'noop'; reason: 'already-current' }
  | { status: 'restored' };

type ExecuteResumeRestoreArgs = {
  readCurrentDraft: () => Promise<ResumeDraftSnapshot | null>;
  targetDraft: ResumeDraftSnapshot;
  saveBackupVersion: () => Promise<void>;
  applyTargetDraft: (draft: ResumeDraftSnapshot) => Promise<void>;
  persistRestoredDraft: () => Promise<void>;
};

export async function executeResumeRestore({
  readCurrentDraft,
  targetDraft,
  saveBackupVersion,
  applyTargetDraft,
  persistRestoredDraft,
}: ExecuteResumeRestoreArgs): Promise<RestoreResumeVersionResult> {
  const currentDraft = await readCurrentDraft();
  if (!currentDraft) {
    throw new Error('No current resume available for restore');
  }

  if (areResumeDraftSnapshotsEqual(currentDraft, targetDraft)) {
    return { status: 'noop', reason: 'already-current' };
  }

  await saveBackupVersion();
  await applyTargetDraft(targetDraft);

  const appliedDraft = await readCurrentDraft();
  if (!appliedDraft || !areResumeDraftSnapshotsEqual(appliedDraft, targetDraft)) {
    throw new Error('Restore verification failed: applied draft does not match target snapshot');
  }

  await persistRestoredDraft();
  return { status: 'restored' };
}
