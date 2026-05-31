import type { UIMessage } from 'ai';
import type { AIChatMessageMetadata, AIChatUIMessage, StoredOrderedPart, StoredToolState } from '@/types/ai';

interface DBMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: AIChatMessageMetadata | null;
  createdAt: Date | number | null;
}

type LegacyToolCall = {
  tool?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  applied?: boolean;
};

type LegacyToolResult = {
  tool?: string;
  toolName?: string;
  result?: unknown;
};

function normalizeOrderedParts(orderedParts: StoredOrderedPart[]): StoredOrderedPart[] {
  if (orderedParts.length === 0 || orderedParts.some((part) => part.type === 'step-start')) {
    return orderedParts;
  }

  const normalized: StoredOrderedPart[] = [];

  for (let index = 0; index < orderedParts.length; index += 1) {
    const part = orderedParts[index];
    const previous = orderedParts[index - 1];

    if (
      index === 0
      || (part.type === 'tool' && previous?.type === 'tool')
      || (part.type === 'text' && previous?.type === 'tool')
    ) {
      normalized.push({ type: 'step-start' });
    }

    normalized.push(part);
  }

  return normalized;
}

function createToolPart({
  messageId,
  toolIndex,
  toolName,
  state,
  input,
  output,
  errorText,
}: {
  messageId: string;
  toolIndex: number;
  toolName: string;
  state: StoredToolState;
  input: unknown;
  output?: unknown;
  errorText?: string;
}): UIMessage['parts'][number] {
  const basePart = {
    type: `tool-${toolName}`,
    toolCallId: `${messageId}-tool-${toolIndex}`,
    state,
    input,
  };

  if (state === 'output-error') {
    return {
      ...basePart,
      errorText: errorText || 'Tool call failed',
    } as UIMessage['parts'][number];
  }

  if (state === 'output-available') {
    return {
      ...basePart,
      output,
    } as UIMessage['parts'][number];
  }

  return basePart as UIMessage['parts'][number];
}

function restoreOrderedParts(messageId: string, orderedParts: StoredOrderedPart[]): UIMessage['parts'] {
  const parts: UIMessage['parts'] = [];
  let toolIndex = 0;

  for (const part of normalizeOrderedParts(orderedParts)) {
    if (part.type === 'step-start') {
      parts.push({ type: 'step-start' });
      continue;
    }

    if (part.type === 'text') {
      parts.push({ type: 'text', text: part.text });
      continue;
    }

    parts.push(
      createToolPart({
        messageId,
        toolIndex: toolIndex++,
        toolName: part.toolName,
        state: part.state ?? (part.errorText ? 'output-error' : 'output-available'),
        input: part.args ?? {},
        output: part.result,
        errorText: part.errorText,
      })
    );
  }

  return parts;
}

function restoreLegacyToolCalls(
  messageId: string,
  content: string,
  toolCalls: LegacyToolCall[],
  toolResults: LegacyToolResult[]
): UIMessage['parts'] {
  const parts: UIMessage['parts'] = [];
  let toolIndex = 0;

  if (toolCalls.length > 0) {
    parts.push({ type: 'step-start' });
  }

  for (let index = 0; index < toolCalls.length; index += 1) {
    const toolCall = toolCalls[index];
    const toolName = toolCall.tool ?? toolCall.toolName;

    if (!toolName) {
      continue;
    }

    parts.push(
      createToolPart({
        messageId,
        toolIndex: toolIndex++,
        toolName,
        state: 'output-available',
        input: toolCall.args ?? {},
        output: toolResults[index]?.result ?? { applied: toolCall.applied ?? null },
      })
    );
  }

  if (content) {
    if (toolIndex > 0) {
      parts.push({ type: 'step-start' });
    }
    parts.push({ type: 'text', text: content });
  }

  return parts;
}

export function dbMessagesToUIMessages(dbMessages: DBMessage[]): AIChatUIMessage[] {
  return dbMessages.map((msg) => {
    const metadata = (msg.metadata || {}) as AIChatMessageMetadata;
    let parts: UIMessage['parts'] = [];

    if (msg.role === 'assistant' && metadata.orderedParts) {
      // New format: ordered parts preserving interleaving of text and tool calls
      const orderedParts = Array.isArray(metadata.orderedParts) ? metadata.orderedParts as StoredOrderedPart[] : [];
      parts = restoreOrderedParts(msg.id, orderedParts);
    } else if (msg.role === 'assistant' && metadata.toolCalls) {
      // Legacy format: tool calls separate from text (backward compat)
      const toolCalls = Array.isArray(metadata.toolCalls) ? metadata.toolCalls as LegacyToolCall[] : [];
      const toolResults = Array.isArray(metadata.toolResults) ? metadata.toolResults as LegacyToolResult[] : [];
      parts = restoreLegacyToolCalls(msg.id, msg.content, toolCalls, toolResults);
    } else if (msg.content) {
      // Plain text message
      parts = [{ type: 'text', text: msg.content }];
    }

    return {
      id: msg.id,
      role: msg.role,
      content: msg.content,
      parts,
      metadata,
      createdAt: msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt as number),
    } as AIChatUIMessage;
  });
}

function isToolPart(part: UIMessage['parts'][number]): part is UIMessage['parts'][number] & {
  type: `tool-${string}`;
  state?: StoredToolState;
  input?: unknown;
  output?: unknown;
  errorText?: string;
} {
  return typeof part.type === 'string' && part.type.startsWith('tool-');
}

export function serializeAssistantMessage(message: UIMessage): {
  content: string;
  orderedParts: StoredOrderedPart[];
  hasError: boolean;
  errorText?: string;
} {
  const orderedParts: StoredOrderedPart[] = [];
  let content = '';
  let hasError = false;
  let errorText: string | undefined;

  for (const part of message.parts || []) {
    if (part.type === 'step-start') {
      orderedParts.push({ type: 'step-start' });
      continue;
    }

    if (part.type === 'text') {
      content += part.text;
      orderedParts.push({ type: 'text', text: part.text });
      continue;
    }

    if (!isToolPart(part)) {
      continue;
    }

    const state = part.state ?? 'output-available';
    if (state === 'output-error') {
      hasError = true;
      errorText ??= part.errorText;
    }

    orderedParts.push({
      type: 'tool',
      toolName: part.type.slice('tool-'.length),
      state,
      args: part.input,
      result: part.output,
      errorText: part.errorText,
    });
  }

  return { content, orderedParts, hasError, errorText };
}
