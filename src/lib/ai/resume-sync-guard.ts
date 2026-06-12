import { useResumeStore } from '@/stores/resume-store';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_POLL_INTERVAL_MS = 50;

export interface ResumeSyncSnapshot {
  hasResume: boolean;
  isDirty: boolean;
  isSaving: boolean;
  save: () => Promise<void>;
}

interface EnsureResumeSyncedOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function hasTimedOut(startedAt: number, timeoutMs: number) {
  return Date.now() - startedAt >= timeoutMs;
}

export async function ensureResumeSyncedBeforeAI(
  getSnapshot: () => ResumeSyncSnapshot,
  options: EnsureResumeSyncedOptions = {}
) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const startedAt = Date.now();

  while (true) {
    const snapshot = getSnapshot();

    if (!snapshot.hasResume) {
      return;
    }

    if (!snapshot.isSaving && !snapshot.isDirty) {
      return;
    }

    if (!snapshot.isSaving && snapshot.isDirty) {
      await snapshot.save();
      continue;
    }

    if (hasTimedOut(startedAt, timeoutMs)) {
      throw new Error('Timed out while syncing the latest resume before AI request.');
    }

    await sleep(pollIntervalMs);
  }
}

export async function ensureResumeStoreSyncedBeforeAI(options?: EnsureResumeSyncedOptions) {
  await ensureResumeSyncedBeforeAI(() => {
    const state = useResumeStore.getState();
    return {
      hasResume: Boolean(state.currentResume),
      isDirty: state.isDirty,
      isSaving: state.isSaving,
      save: () => state.save({ source: 'manual' }),
    } satisfies ResumeSyncSnapshot;
  }, options);
}
