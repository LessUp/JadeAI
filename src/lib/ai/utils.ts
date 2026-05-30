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

export function dbMessagesToUIMessages(dbMessages: DBMessage[]): UIMessage[] {
  return dbMessages.map((msg) => {
    const parts: UIMessage['parts'] = [];
    const metadata = (msg.metadata || {}) as Record<string, unknown>;

    if (msg.role === 'assistant' && metadata.orderedParts) {
      // New format: ordered parts preserving interleaving of text and tool calls
      const orderedParts = metadata.orderedParts as OrderedPart[];
      let toolIndex = 0;
      for (const op of orderedParts) {
        if (op.type === 'step-start') {
          parts.push({ type: 'step-start' });
        } else if (op.type === 'text') {
          parts.push({ type: 'text' as const, text: op.text });
        } else if (op.type === 'tool') {
          parts.push({
            type: `tool-${op.toolName}`,
            toolCallId: `${msg.id}-tool-${toolIndex++}`,
            state: 'output-available',
            input: op.args,
            output: op.result ?? { success: true },
          } as UIMessage['parts'][number]);
        }
      }
    } else if (msg.role === 'assistant' && metadata.toolCalls) {
      // Legacy format: tool calls separate from text (backward compat)
      const toolCalls = metadata.toolCalls as { toolName: string; args: Record<string, unknown> }[];
      const toolResults = (metadata.toolResults || []) as { toolName: string; result: unknown }[];

      for (let i = 0; i < toolCalls.length; i++) {
        const tc = toolCalls[i];
        const tr = toolResults[i];
        parts.push({
          type: `tool-${tc.toolName}`,
          toolCallId: `${msg.id}-tool-${i}`,
          state: 'output-available',
          input: tc.args,
          output: tr?.result ?? { success: true },
        } as UIMessage['parts'][number]);
      }

      if (msg.content) {
        parts.push({ type: 'text' as const, text: msg.content });
      }
    } else if (msg.content) {
      // Plain text message
      parts.push({ type: 'text' as const, text: msg.content });
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
