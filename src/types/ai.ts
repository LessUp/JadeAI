import type { UIMessage } from 'ai';

export type AIChatStatus = 'submitted' | 'streaming' | 'completed' | 'error' | 'aborted';

export type AIChatErrorKind =
  | 'output_limit'
  | 'timeout_total'
  | 'timeout_chunk'
  | 'client_abort'
  | 'network'
  | 'provider'
  | 'tool'
  | 'stream'
  | 'unknown';

export type StoredToolState =
  | 'input-streaming'
  | 'input-available'
  | 'output-available'
  | 'output-error';

export type StoredOrderedPart =
  | { type: 'step-start' }
  | { type: 'text'; text: string }
  | {
    type: 'tool';
    toolName: string;
    state?: StoredToolState;
    args?: unknown;
    result?: unknown;
    errorText?: string;
  };

export interface AIChatMessageMetadata {
  orderedParts?: StoredOrderedPart[];
  status?: AIChatStatus;
  startedAt?: number;
  endedAt?: number;
  requestId?: string;
  finishReason?: string;
  errorText?: string;
  errorKind?: AIChatErrorKind;
  elapsedMs?: number;
  firstChunkAt?: number;
  lastChunkAt?: number;
  chunkCount?: number;
  outputLength?: number;
  retryable?: boolean;
  toolCalls?: AIToolCall[];
  toolResults?: Array<{ tool?: string; toolName?: string; result?: unknown }>;
}

export type AIChatUIMessage = UIMessage<AIChatMessageMetadata>;

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: AIChatMessageMetadata;
  createdAt: Date;
}

export interface AIToolCall {
  tool: string;
  args: Record<string, unknown>;
  applied: boolean;
}

export interface AIChatSession {
  id: string;
  resumeId: string;
  title: string;
  messages: AIChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}
