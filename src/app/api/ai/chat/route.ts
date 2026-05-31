import { NextRequest } from 'next/server';
import { streamText, stepCountIs, consumeStream, type UIMessage } from 'ai';
import { getModel, extractAIConfig, AIConfigError } from '@/lib/ai/provider';
import { resolveUser, getUserIdFromRequest } from '@/lib/auth/helpers';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { chatRepository } from '@/lib/db/repositories/chat.repository';
import { getSystemPrompt } from '@/lib/ai/prompts';
import { createExecutableTools } from '@/lib/ai/tools';
import { buildChatContextMessages } from '@/lib/ai/chat-context';
import type { AIChatMessageMetadata } from '@/types/ai';
import { serializeAssistantMessage } from '@/lib/ai/utils';

const CHAT_STREAM_TIMEOUT_MS = 120_000;

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : 'An error occurred.';
}

export async function POST(request: NextRequest) {
  let assistantMessageId: string | undefined;
  let startedAt: number | undefined;
  let persistedSessionId: string | undefined;
  try {
    const fingerprint = getUserIdFromRequest(request);
    const user = await resolveUser(fingerprint);
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

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
    if (resumeId) {
      const resume = await resumeRepository.findByIdForUser(resumeId, user.id);
      if (!resume) {
        return new Response('Resume not found', { status: 404 });
      }
      resumeContext = JSON.stringify(resume.sections);
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
    }

    if (!resumeContext && resolvedResumeId) {
      const resume = await resumeRepository.findByIdForUser(resolvedResumeId, user.id);
      if (!resume) {
        return new Response('Resume not found', { status: 404 });
      }
      resumeContext = JSON.stringify(resume.sections);
    }

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
      await chatRepository.addMessage({
        id: assistantMessageId,
        sessionId,
        role: 'assistant',
        content: '',
        metadata: {
          status: 'submitted',
          startedAt,
          orderedParts: [],
        } satisfies AIChatMessageMetadata,
      });
    }

    const aiConfig = extractAIConfig(request);
    const model = getModel(aiConfig, modelId);
    const truncatedMessages = await buildChatContextMessages(messages);

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
      timeout: CHAT_STREAM_TIMEOUT_MS,
    });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      generateMessageId: assistantMessageId ? () => assistantMessageId! : undefined,
      consumeSseStream: consumeStream,
      onFinish: async ({ responseMessage, isAborted, finishReason }) => {
        if (!assistantMessageId || !sessionId) return;

        const serialized = serializeAssistantMessage(responseMessage);
        const status = isAborted
          ? 'aborted'
          : serialized.hasError || finishReason === 'error'
            ? 'error'
            : 'completed';

        await chatRepository.updateMessage(assistantMessageId, {
          content: serialized.content,
          metadata: {
            orderedParts: serialized.orderedParts,
            status,
            startedAt,
            endedAt: Date.now(),
            finishReason,
            errorText: serialized.errorText,
          } satisfies AIChatMessageMetadata,
        });
      },
      onError: (error) => {
        const errorMessage = getErrorMessage(error);
        if (assistantMessageId && sessionId) {
          void chatRepository.updateMessage(assistantMessageId, {
            metadata: {
              status: 'error',
              startedAt,
              endedAt: Date.now(),
              orderedParts: [],
              errorText: errorMessage,
            } satisfies AIChatMessageMetadata,
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
      await chatRepository.updateMessage(assistantMessageId, {
        metadata: {
          status: 'error',
          startedAt,
          endedAt: Date.now(),
          orderedParts: [],
          errorText: getErrorMessage(error),
        } satisfies AIChatMessageMetadata,
      });
    }
    console.error('POST /api/ai/chat error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
