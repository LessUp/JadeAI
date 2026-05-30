import type { UIMessage } from 'ai';

interface DBMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, unknown> | null;
  createdAt: Date | number | null;
}

type OrderedPart =
  | { type: 'step-start' }
  | { type: 'text'; text: string }
  | { type: 'tool'; toolName: string; args: unknown; result: unknown };

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

function normalizeOrderedParts(orderedParts: OrderedPart[]): OrderedPart[] {
  if (orderedParts.length === 0 || orderedParts.some((part) => part.type === 'step-start')) {
    return orderedParts;
  }

  const normalized: OrderedPart[] = [];

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
  input,
  output,
}: {
  messageId: string;
  toolIndex: number;
  toolName: string;
  input: unknown;
  output: unknown;
}): UIMessage['parts'][number] {
  return {
    type: `tool-${toolName}`,
    toolCallId: `${messageId}-tool-${toolIndex}`,
    state: 'output-available',
    input,
    output,
  } as UIMessage['parts'][number];
}

function restoreOrderedParts(messageId: string, orderedParts: OrderedPart[]): UIMessage['parts'] {
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
        input: part.args,
        output: part.result ?? { success: true },
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

export function dbMessagesToUIMessages(dbMessages: DBMessage[]): UIMessage[] {
  return dbMessages.map((msg) => {
    const metadata = (msg.metadata || {}) as Record<string, unknown>;
    let parts: UIMessage['parts'] = [];

    if (msg.role === 'assistant' && metadata.orderedParts) {
      // New format: ordered parts preserving interleaving of text and tool calls
      const orderedParts = Array.isArray(metadata.orderedParts) ? metadata.orderedParts as OrderedPart[] : [];
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
      createdAt: msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt as number),
    };
  });
}
