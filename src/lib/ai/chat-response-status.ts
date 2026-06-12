import type { AIChatErrorKind, AIChatStatus, AIChatUIMessage, StoredOrderedPart } from '@/types/ai';

export const EMPTY_ASSISTANT_RESPONSE_ERROR_TEXT = 'AI returned an empty response. Please retry.';

type SerializedAssistantSummary = {
  content: string;
  orderedParts: StoredOrderedPart[];
  hasError: boolean;
  errorText?: string | null;
};

export function hasRenderableSerializedAssistantOutput(
  serialized: Pick<SerializedAssistantSummary, 'content' | 'orderedParts'>
) {
  if (serialized.content.trim().length > 0) return true;

  return serialized.orderedParts.some((part) => {
    if (part.type === 'tool') return true;
    if (part.type === 'text') return part.text.trim().length > 0;
    return false;
  });
}

export function hasRenderableUIAssistantMessage(message?: AIChatUIMessage) {
  if (!message || message.role !== 'assistant') return false;

  return message.parts.some((part) => {
    if (part.type === 'text') return part.text.trim().length > 0;
    return typeof part.type === 'string' && part.type.startsWith('tool-');
  });
}

export function hasRenderableAssistantReplySinceRequest(
  latestAssistantMessage: AIChatUIMessage | undefined,
  baselineAssistantId: string | undefined,
  baselineAssistantWasRenderable: boolean
) {
  if (!latestAssistantMessage) return false;

  const latestIsRenderable = hasRenderableUIAssistantMessage(latestAssistantMessage);
  if (!latestIsRenderable) return false;

  if (latestAssistantMessage.id !== baselineAssistantId) return true;

  return !baselineAssistantWasRenderable;
}

type ResolveAssistantTerminalOutcomeInput = {
  serialized: SerializedAssistantSummary;
  finishReason?: string;
  isAborted: boolean;
  classifiedErrorKind?: AIChatErrorKind;
};

type ResolveAssistantTerminalOutcomeResult = {
  status: AIChatStatus;
  errorKind?: AIChatErrorKind;
  errorText?: string;
};

export function resolveAssistantTerminalOutcome({
  serialized,
  finishReason,
  isAborted,
  classifiedErrorKind,
}: ResolveAssistantTerminalOutcomeInput): ResolveAssistantTerminalOutcomeResult {
  const hasRenderableOutput = hasRenderableSerializedAssistantOutput(serialized);
  const isEmptyTerminalResponse = !isAborted
    && !serialized.hasError
    && finishReason !== 'error'
    && !classifiedErrorKind
    && !hasRenderableOutput;

  const errorKind = classifiedErrorKind ?? (isEmptyTerminalResponse ? 'stream' : undefined);
  const errorText = serialized.errorText ?? (isEmptyTerminalResponse ? EMPTY_ASSISTANT_RESPONSE_ERROR_TEXT : undefined);
  const status: AIChatStatus = isAborted
    ? 'aborted'
    : serialized.hasError || finishReason === 'error' || Boolean(errorKind)
      ? 'error'
      : 'completed';

  return { status, errorKind, errorText };
}
