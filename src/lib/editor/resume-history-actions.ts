'use client';

import type { Resume } from '@/types/resume';
import type { ResumeDraftSnapshot, ResumeVersionRecord, ResumeVersionSource } from '@/types/editor';
import { useEditorStore } from '@/stores/editor-store';
import { useResumeStore } from '@/stores/resume-store';
import {
  areResumeDraftSnapshotsEqual,
  buildResumeFromDraft,
  cloneResumeDraftSnapshot,
  createResumeDraftSnapshot,
} from './resume-draft';
import {
  getResumeVersion,
  saveResumeVersion,
} from './resume-version-history';
import {
  executeResumeRestore,
  type ExecuteResumeRestoreArgs,
  type RestoreResumeVersionResult,
} from './restore-resume-version';

interface ApplyDraftOptions {
  recordHistory?: boolean;
  scheduleSave?: boolean;
  markDirty?: boolean;
  clearPendingSave?: boolean;
  source?: ResumeVersionSource;
}

function clearPendingSaveIfNeeded(enabled: boolean) {
  if (!enabled) return;

  const { _saveTimeout } = useResumeStore.getState();
  if (_saveTimeout) {
    clearTimeout(_saveTimeout);
    useResumeStore.setState({ _saveTimeout: null });
  }
}

export function getCurrentResumeDraftSnapshot(): ResumeDraftSnapshot | null {
  const currentResume = useResumeStore.getState().currentResume;
  return currentResume ? createResumeDraftSnapshot(currentResume) : null;
}

export async function saveCurrentResumeVersion(
  source: ResumeVersionSource
): Promise<ResumeVersionRecord | null> {
  const currentResume = useResumeStore.getState().currentResume;
  if (!currentResume) return null;

  return await saveResumeVersion({
    resumeId: currentResume.id,
    snapshot: createResumeDraftSnapshot(currentResume),
    source,
  });
}

export function applyResumeDraftSnapshot(
  draft: ResumeDraftSnapshot,
  options: ApplyDraftOptions = {}
) {
  const {
    recordHistory = false,
    scheduleSave = true,
    markDirty = true,
    clearPendingSave = false,
    source,
  } = options;

  const currentResume = useResumeStore.getState().currentResume;
  if (!currentResume) return;

  const currentDraft = createResumeDraftSnapshot(currentResume);
  if (areResumeDraftSnapshotsEqual(currentDraft, draft)) return;

  if (recordHistory) {
    useEditorStore.getState().pushSnapshot(currentDraft, source);
  }

  clearPendingSaveIfNeeded(clearPendingSave);

  const nextResume = buildResumeFromDraft(currentResume, draft);
  const clonedSections = structuredClone(nextResume.sections);

  useResumeStore.setState({
    currentResume: { ...nextResume, sections: clonedSections },
    sections: clonedSections,
    isDirty: markDirty,
  });

  if (scheduleSave) {
    useResumeStore.getState()._scheduleSave();
  }
}

export async function commitResumeChange(
  updater: (draft: ResumeDraftSnapshot) => ResumeDraftSnapshot,
  options: {
    saveNow?: boolean;
    source?: ResumeVersionSource;
  } = {}
) {
  const currentDraft = getCurrentResumeDraftSnapshot();
  if (!currentDraft) return;

  const nextDraft = updater(cloneResumeDraftSnapshot(currentDraft));
  if (areResumeDraftSnapshotsEqual(currentDraft, nextDraft)) return;

  applyResumeDraftSnapshot(nextDraft, {
    recordHistory: true,
    scheduleSave: !options.saveNow,
    markDirty: true,
    clearPendingSave: options.saveNow,
    source: options.source,
  });

  if (options.saveNow) {
    await useResumeStore.getState().save({
      source: options.source ?? 'manual',
      forceVersion: true,
    });
  }
}

export async function syncResumeFromServer(
  resume: Resume,
  options: {
    recordHistory?: boolean;
    saveVersion?: boolean;
    source?: ResumeVersionSource;
  } = {}
) {
  const currentResume = useResumeStore.getState().currentResume;
  const nextDraft = createResumeDraftSnapshot(resume);
  const currentDraft = currentResume ? createResumeDraftSnapshot(currentResume) : null;

  if (
    options.recordHistory &&
    currentDraft &&
    !areResumeDraftSnapshotsEqual(currentDraft, nextDraft)
  ) {
    useEditorStore
      .getState()
      .pushSnapshot(currentDraft, options.source);
  }

  useResumeStore.getState().setResume(resume);

  if (options.saveVersion) {
    await saveCurrentResumeVersion(options.source ?? 'checkpoint');
  }
}

type RestoreResumeVersionDependencies = {
  getResumeVersion: (versionId: string) => Promise<ResumeVersionRecord | null>;
  executeResumeRestore: (
    args: ExecuteResumeRestoreArgs
  ) => Promise<RestoreResumeVersionResult>;
  saveCurrentResumeVersion: typeof saveCurrentResumeVersion;
  applyResumeDraftSnapshot: typeof applyResumeDraftSnapshot;
  getResumeStoreState: () => Pick<ReturnType<typeof useResumeStore.getState>, 'currentResume' | 'save'>;
};

const defaultRestoreResumeVersionDependencies: RestoreResumeVersionDependencies = {
  getResumeVersion,
  executeResumeRestore,
  saveCurrentResumeVersion,
  applyResumeDraftSnapshot,
  getResumeStoreState: useResumeStore.getState,
};

export async function restoreResumeVersionById(
  versionId: string,
  dependencies: RestoreResumeVersionDependencies = defaultRestoreResumeVersionDependencies
) {
  const version = await dependencies.getResumeVersion(versionId);
  if (!version) {
    throw new Error(`Resume version not found: ${versionId}`);
  }

  return await restoreResumeVersionRecord(version, dependencies);
}

export async function restoreResumeVersionRecord(
  version: ResumeVersionRecord,
  dependencies: RestoreResumeVersionDependencies = defaultRestoreResumeVersionDependencies
) {
  return await dependencies.executeResumeRestore({
    readCurrentDraft: async () => {
      const currentResume = dependencies.getResumeStoreState().currentResume;
      return currentResume ? createResumeDraftSnapshot(currentResume) : null;
    },
    targetDraft: version.snapshot,
    saveBackupVersion: async () => {
      await dependencies.saveCurrentResumeVersion('restore');
    },
    applyTargetDraft: async (draft) => {
      dependencies.applyResumeDraftSnapshot(draft, {
        recordHistory: true,
        markDirty: true,
        clearPendingSave: true,
      });
    },
    persistRestoredDraft: async () => {
      await dependencies.getResumeStoreState().save({
        source: 'restore',
        forceVersion: true,
      });
    },
  });
}

export async function restoreResumeVersion(version: ResumeVersionRecord) {
  return await restoreResumeVersionRecord(version);
}
