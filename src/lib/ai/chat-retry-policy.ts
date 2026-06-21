import type { AIChatErrorKind } from '@/types/ai';

export function isRetryableErrorKind(errorKind?: AIChatErrorKind) {
  return errorKind === 'timeout_chunk'
    || errorKind === 'timeout_total'
    || errorKind === 'network'
    || errorKind === 'provider'
    || errorKind === 'stream';
}
