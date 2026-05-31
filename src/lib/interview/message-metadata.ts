import type { InterviewMessageMetadata } from '@/types/interview';

export function mergeInterviewMessageMetadata(
  current: InterviewMessageMetadata | null | undefined,
  updates: InterviewMessageMetadata,
): InterviewMessageMetadata {
  return {
    ...(current || {}),
    ...updates,
  };
}
