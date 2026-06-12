import type { UIMessage } from 'ai';

type DateLike = Date | string | number | null | undefined;
const REBASE_CONTEXT_ROUNDS = 3;
const MAX_REBASE_CONTEXT_MESSAGES = REBASE_CONTEXT_ROUNDS * 2;

function toEpochMs(value: DateLike): number | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  const epoch = date.getTime();
  if (Number.isNaN(epoch)) return null;
  return epoch;
}

export function shouldRebaseChatContextToLatestResume(
  sessionUpdatedAt: DateLike,
  resumeUpdatedAt: DateLike
) {
  const sessionEpoch = toEpochMs(sessionUpdatedAt);
  const resumeEpoch = toEpochMs(resumeUpdatedAt);

  if (sessionEpoch === null || resumeEpoch === null) {
    return false;
  }

  return resumeEpoch > sessionEpoch;
}

export function selectLatestResumeBaselineMessages(messages: UIMessage[]) {
  if (messages.length === 0) return [];

  return messages.slice(-MAX_REBASE_CONTEXT_MESSAGES);
}
