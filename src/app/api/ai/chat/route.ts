import { NextRequest } from 'next/server';
import { streamText, stepCountIs, consumeStream, type UIMessage } from 'ai';
import { getModel, extractAIConfig, AIConfigError } from '@/lib/ai/provider';
import { resolveCurrentUser } from '@/lib/auth/helpers';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { chatRepository } from '@/lib/db/repositories/chat.repository';
import { getSystemPrompt } from '@/lib/ai/prompts';
import { createExecutableTools } from '@/lib/ai/tools';
import { buildChatContextMessages } from '@/lib/ai/chat-context';
import {
  selectLatestResumeBaselineMessages,
  shouldRebaseChatContextToLatestResume,
} from '@/lib/ai/session-context-guard';
import type { AIChatErrorKind, AIChatMessageMetadata } from '@/types/ai';
import { serializeAssistantMessage } from '@/lib/ai/utils';
import { resolveAssistantTerminalOutcome } from '@/lib/ai/chat-response-status';

const DEFAULT_CHAT_STREAM_TIMEOUT_MS = 300_000;
const DEFAULT_CHAT_STREAM_CHUNK_TIMEOUT_MS = 90_000;
const DEFAULT_CHAT_MAX_OUTPUT_TOKENS = 8_192;

function readPositiveIntEnv(name: string, fallback?: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const CHAT_STREAM_TIMEOUT_MS = readPositiveIntEnv('AI_CHAT_STREAM_TIMEOUT_MS', DEFAULT_CHAT_STREAM_TIMEOUT_MS) ?? DEFAULT_CHAT_STREAM_TIMEOUT_MS;
const CHAT_STREAM_CHUNK_TIMEOUT_MS = readPositiveIntEnv('AI_CHAT_STREAM_CHUNK_TIMEOUT_MS', DEFAULT_CHAT_STREAM_CHUNK_TIMEOUT_MS) ?? DEFAULT_CHAT_STREAM_CHUNK_TIMEOUT_MS;
const CHAT_MAX_OUTPUT_TOKENS = readPositiveIntEnv('AI_CHAT_MAX_OUTPUT_TOKENS', DEFAULT_CHAT_MAX_OUTPUT_TOKENS);

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : 'An error occurred.';
}

function getErrorName(error: unknown) {
  return error instanceof Error ? error.name : undefined;
}

function getErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function getErrorStatus(error: unknown) {
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as { status?: unknown; statusCode?: unknown };
  const status = candidate.status ?? candidate.statusCode;
  return typeof status === 'number' ? status : undefined;
}

function getBaseURLHost(baseURL: string) {
  try {
    return new URL(baseURL).host;
  } catch {
    return 'invalid-url';
  }
}

function logChatStream(level: 'info' | 'warn' | 'error', event: string, fields: Record<string, unknown>) {
  const line = JSON.stringify({ event, ...fields });
  if (level === 'error') {
    console.error('[ai-chat]', line);
  } else if (level === 'warn') {
    console.warn('[ai-chat]', line);
  } else {
    console.log('[ai-chat]', line);
  }
}

interface StreamDiagnostics {
  requestId: string;
  startedAt: number;
  firstChunkAt?: number;
  lastChunkAt?: number;
  chunkCount: number;
  outputLength: number;
  partialText: string;
}

function createInitialDiagnostics(startedAt: number): StreamDiagnostics {
  return {
    requestId: crypto.randomUUID(),
    startedAt,
    chunkCount: 0,
    outputLength: 0,
    partialText: '',
  };
}

function markStreamChunk(diagnostics: StreamDiagnostics, chunk: { type: string; text?: string }) {
  const now = Date.now();
  diagnostics.firstChunkAt ??= now;
  diagnostics.lastChunkAt = now;
  diagnostics.chunkCount += 1;
  if (chunk.type === 'text-delta' && chunk.text) {
    diagnostics.partialText += chunk.text;
    diagnostics.outputLength += chunk.text.length;
  }
}

function classifyStreamError({
  error,
  finishReason,
  isAborted,
  requestAborted,
  diagnostics,
}: {
  error?: unknown;
  finishReason?: string;
  isAborted?: boolean;
  requestAborted?: boolean;
  diagnostics: StreamDiagnostics;
}): AIChatErrorKind | undefined {
  if (finishReason === 'length') return 'output_limit';
  if (requestAborted || (isAborted && requestAborted)) return 'client_abort';
  if (!error) return undefined;

  const elapsedMs = Date.now() - diagnostics.startedAt;
  const sinceLastChunkMs = Date.now() - (diagnostics.lastChunkAt ?? diagnostics.startedAt);
  const message = getErrorMessage(error);
  const name = getErrorName(error);
  const code = getErrorCode(error);
  const status = getErrorStatus(error);

  if (/timeout|timed out/i.test(message) || name === 'TimeoutError') {
    if (sinceLastChunkMs >= CHAT_STREAM_CHUNK_TIMEOUT_MS - 1_000) return 'timeout_chunk';
    if (elapsedMs >= CHAT_STREAM_TIMEOUT_MS - 1_000) return 'timeout_total';
    return 'timeout_chunk';
  }

  if (name === 'AbortError') {
    return requestAborted ? 'client_abort' : 'timeout_total';
  }

  if (
    code
    && /ETIMEDOUT|ECONNRESET|ECONNREFUSED|EPIPE|ENOTFOUND|EAI_AGAIN|UND_ERR/i.test(code)
  ) {
    return 'network';
  }

  if (/fetch failed|network|socket|connection|ECONNRESET|ETIMEDOUT|terminated/i.test(message)) {
    return 'network';
  }

  if (typeof status === 'number') return 'provider';
  if (/tool/i.test(message)) return 'tool';
  return 'stream';
}

function isRetryableErrorKind(errorKind?: AIChatErrorKind) {
  return errorKind === 'timeout_chunk' || errorKind === 'timeout_total' || errorKind === 'network' || errorKind === 'provider';
}

function createDiagnosticsMetadata(
  diagnostics: StreamDiagnostics,
  extra: Pick<AIChatMessageMetadata, 'status' | 'endedAt'> & Partial<Pick<AIChatMessageMetadata, 'finishReason' | 'errorText' | 'errorKind'>>
): AIChatMessageMetadata {
  const elapsedMs = (extra.endedAt ?? Date.now()) - diagnostics.startedAt;
  return {
    ...extra,
    startedAt: diagnostics.startedAt,
    requestId: diagnostics.requestId,
    elapsedMs,
    firstChunkAt: diagnostics.firstChunkAt,
    lastChunkAt: diagnostics.lastChunkAt,
    chunkCount: diagnostics.chunkCount,
    outputLength: diagnostics.outputLength,
    retryable: isRetryableErrorKind(extra.errorKind),
  };
}

function createAssistantMessageIdGenerator(assistantMessageId?: string) {
  let usedPrimaryId = false;
  return () => {
    if (assistantMessageId && !usedPrimaryId) {
      usedPrimaryId = true;
      return assistantMessageId;
    }
    return crypto.randomUUID();
  };
}

export async function POST(request: NextRequest) {
  let assistantMessageId: string | undefined;
  let startedAt: number | undefined;
  let persistedSessionId: string | undefined;
  let diagnostics: StreamDiagnostics | undefined;
  let finishPersisted = false;
  try {
    const currentUser = await resolveCurrentUser({ request });
    if (!currentUser) {
      return new Response('Unauthorized', { status: 401 });
    }
    const user = currentUser.user;

    const {
      messages,
      resumeId,
      model: modelId,
      sessionId,
    }: {
      messages: UIMessage[];
      resumeId?: string;
      model?: string;
      sessionId?: string;
    } = await request.json();
    persistedSessionId = sessionId;

    let resumeContext = '';
    let resolvedResumeId = resumeId;
    let resolvedResumeUpdatedAt: Date | string | number | null = null;
    let resolvedSessionUpdatedAt: Date | string | number | null = null;
    if (resumeId) {
      const resume = await resumeRepository.findByIdForUser(resumeId, user.id);
      if (!resume) {
        return new Response('Resume not found', { status: 404 });
      }
      resumeContext = JSON.stringify(resume.sections);
      resolvedResumeUpdatedAt = resume.updatedAt;
    }

    if (sessionId) {
      const session = await chatRepository.findSessionForUser(sessionId, user.id);
      if (!session) {
        return new Response('Session not found', { status: 404 });
      }
      if (resolvedResumeId && session.resumeId !== resolvedResumeId) {
        return new Response('Session does not belong to resume', { status: 400 });
      }
      resolvedResumeId = resolvedResumeId ?? session.resumeId;
      resolvedSessionUpdatedAt = session.updatedAt;
    }

    if (!resumeContext && resolvedResumeId) {
      const resume = await resumeRepository.findByIdForUser(resolvedResumeId, user.id);
      if (!resume) {
        return new Response('Resume not found', { status: 404 });
      }
      resumeContext = JSON.stringify(resume.sections);
      resolvedResumeUpdatedAt = resume.updatedAt;
    }

    const aiConfig = extractAIConfig(request);
    const model = getModel(aiConfig, modelId);
    const shouldRebaseContext = shouldRebaseChatContextToLatestResume(
      resolvedSessionUpdatedAt,
      resolvedResumeUpdatedAt
    );
    const contextSourceMessages = shouldRebaseContext
      ? selectLatestResumeBaselineMessages(messages)
      : messages;
    const truncatedMessages = await buildChatContextMessages(contextSourceMessages);

    // Save user message to DB before streaming
    if (sessionId && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'user') {
        const content = (lastMessage.parts || [])
          .filter((part): part is Extract<UIMessage['parts'][number], { type: 'text' }> => part.type === 'text')
          .map((part) => part.text)
          .join('');
        if (content) {
          // First user message in this session → set as session title
          const userMessages = messages.filter((m: { role: string }) => m.role === 'user');
          if (userMessages.length === 1) {
            const title = content.slice(0, 50);
            await chatRepository.updateSessionTitle(sessionId, title);
          }

          await chatRepository.addMessage({
            sessionId,
            role: 'user',
            content,
          });
        }
      }
    }

    if (sessionId) {
      assistantMessageId = crypto.randomUUID();
      startedAt = Date.now();
      diagnostics = createInitialDiagnostics(startedAt);
      await chatRepository.addMessage({
        id: assistantMessageId,
        sessionId,
        role: 'assistant',
        content: '',
        metadata: {
          status: 'submitted',
          startedAt,
          requestId: diagnostics.requestId,
          orderedParts: [],
        } satisfies AIChatMessageMetadata,
      });
    }
    if (!diagnostics) {
      startedAt = Date.now();
      diagnostics = createInitialDiagnostics(startedAt);
    }

    logChatStream('info', 'stream_start', {
      requestId: diagnostics.requestId,
      sessionId,
      assistantMessageId,
      provider: aiConfig.provider,
      model: modelId || aiConfig.model,
      baseURLHost: getBaseURLHost(aiConfig.baseURL),
      messageCount: messages.length,
      contextSourceMessageCount: contextSourceMessages.length,
      contextMessageCount: truncatedMessages.length,
      contextRebased: shouldRebaseContext,
      hasResumeContext: Boolean(resumeContext),
      timeoutMs: CHAT_STREAM_TIMEOUT_MS,
      chunkTimeoutMs: CHAT_STREAM_CHUNK_TIMEOUT_MS,
      maxOutputTokens: CHAT_MAX_OUTPUT_TOKENS,
    });

    const tools = resolvedResumeId
      ? createExecutableTools({
        resumeId: resolvedResumeId,
        aiConfig,
        userId: user.id,
        abortSignal: request.signal,
      })
      : undefined;

    const result = streamText({
      model,
      system: getSystemPrompt(resumeContext),
      messages: truncatedMessages,
      tools,
      stopWhen: tools ? stepCountIs(25) : undefined,
      abortSignal: request.signal,
      timeout: {
        totalMs: CHAT_STREAM_TIMEOUT_MS,
        chunkMs: CHAT_STREAM_CHUNK_TIMEOUT_MS,
      },
      maxOutputTokens: CHAT_MAX_OUTPUT_TOKENS,
      onChunk: ({ chunk }) => {
        markStreamChunk(diagnostics!, chunk);
      },
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      generateMessageId: createAssistantMessageIdGenerator(assistantMessageId),
      consumeSseStream: consumeStream,
      onFinish: async ({ responseMessage, isAborted, finishReason }) => {
        if (!assistantMessageId || !sessionId) return;

        const serialized = serializeAssistantMessage(responseMessage);
        if (serialized.content.length > diagnostics!.outputLength) {
          diagnostics!.outputLength = serialized.content.length;
        }
        const classifiedErrorKind = classifyStreamError({
          finishReason,
          isAborted,
          requestAborted: request.signal.aborted,
          diagnostics: diagnostics!,
        });
        const { status, errorKind, errorText } = resolveAssistantTerminalOutcome({
          serialized,
          finishReason,
          isAborted,
          classifiedErrorKind,
        });
        const endedAt = Date.now();

        await chatRepository.updateMessage(assistantMessageId, {
          content: serialized.content,
          metadata: {
            ...createDiagnosticsMetadata(diagnostics!, {
              status,
              endedAt,
              finishReason,
              errorKind,
              errorText,
            }),
            orderedParts: serialized.orderedParts,
          } satisfies AIChatMessageMetadata,
        });
        finishPersisted = true;
        logChatStream(status === 'completed' ? 'info' : 'warn', 'stream_finish', {
          requestId: diagnostics!.requestId,
          sessionId,
          assistantMessageId,
          status,
          finishReason,
          errorKind,
          elapsedMs: endedAt - diagnostics!.startedAt,
          outputLength: serialized.content.length,
          chunkCount: diagnostics!.chunkCount,
        });
      },
      onError: (error) => {
        const errorMessage = getErrorMessage(error);
        if (assistantMessageId && sessionId) {
          const endedAt = Date.now();
          const errorKind = classifyStreamError({
            error,
            requestAborted: request.signal.aborted,
            diagnostics: diagnostics!,
          });
          const partialText = diagnostics!.partialText;
          void chatRepository.updateMessage(assistantMessageId, {
            ...(partialText ? { content: partialText } : {}),
            metadata: {
              ...createDiagnosticsMetadata(diagnostics!, {
                status: request.signal.aborted ? 'aborted' : 'error',
                endedAt,
                errorKind,
                errorText: errorMessage,
              }),
              orderedParts: partialText ? [{ type: 'text', text: partialText }] : [],
            } satisfies AIChatMessageMetadata,
          });
          logChatStream('error', 'stream_error', {
            requestId: diagnostics!.requestId,
            sessionId,
            assistantMessageId,
            errorKind,
            errorName: getErrorName(error),
            errorCode: getErrorCode(error),
            errorStatus: getErrorStatus(error),
            elapsedMs: endedAt - diagnostics!.startedAt,
            outputLength: diagnostics!.outputLength,
            chunkCount: diagnostics!.chunkCount,
            finishPersisted,
          });
        }
        return errorMessage;
      },
    });
  } catch (error) {
    if (error instanceof AIConfigError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 401 });
    }
    if (assistantMessageId && persistedSessionId) {
      const endedAt = Date.now();
      const fallbackDiagnostics = diagnostics ?? createInitialDiagnostics(startedAt ?? endedAt);
      const errorKind = classifyStreamError({
        error,
        requestAborted: request.signal.aborted,
        diagnostics: fallbackDiagnostics,
      });
      await chatRepository.updateMessage(assistantMessageId, {
        metadata: {
          ...createDiagnosticsMetadata(fallbackDiagnostics, {
            status: request.signal.aborted ? 'aborted' : 'error',
            endedAt,
            errorKind,
            errorText: getErrorMessage(error),
          }),
          orderedParts: [],
        } satisfies AIChatMessageMetadata,
      });
    }
    console.error('POST /api/ai/chat error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
