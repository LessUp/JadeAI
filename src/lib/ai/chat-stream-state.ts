import type { AIChatUIMessage } from '@/types/ai';

export function isCompletedToolPart(part: unknown): boolean {
  if (!part || typeof part !== 'object') return false;

  const candidate = part as { type?: unknown; state?: unknown };
  return typeof candidate.type === 'string'
    && candidate.type.startsWith('tool-')
    && candidate.state === 'output-available';
}

export function countCompletedToolParts(messages: AIChatUIMessage[]): number {
  return messages.reduce((count, message) => {
    if (message.role !== 'assistant' || !message.parts) return count;
    return count + message.parts.filter(isCompletedToolPart).length;
  }, 0);
}

export function getNextToolResultReloadState(
  previousCompletedToolCount: number,
  messages: AIChatUIMessage[],
): { shouldReload: boolean; completedToolCount: number } {
  const completedToolCount = countCompletedToolParts(messages);
  return {
    shouldReload: completedToolCount > previousCompletedToolCount,
    completedToolCount,
  };
}
