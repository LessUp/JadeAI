import type { UIMessage } from 'ai';

export function isAssistantToolPart(part: NonNullable<UIMessage['parts']>[number]) {
  return typeof part.type === 'string' && part.type.startsWith('tool-');
}

export function stripAssistantToolPartsForRecovery(messages: UIMessage[]): UIMessage[] {
  return messages.map((message) => {
    if (message.role !== 'assistant') return message;
    const cleanedParts = (message.parts || []).filter((part) => part.type !== 'step-start' && !isAssistantToolPart(part));
    return { ...message, parts: cleanedParts };
  });
}
