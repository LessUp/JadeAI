import { NextRequest } from 'next/server';
import { streamText, stepCountIs } from 'ai';
import { getModel, extractAIConfig, AIConfigError } from '@/lib/ai/provider';
import { resolveUser, getUserIdFromRequest } from '@/lib/auth/helpers';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { chatRepository } from '@/lib/db/repositories/chat.repository';
import { getSystemPrompt } from '@/lib/ai/prompts';
import { createExecutableTools } from '@/lib/ai/tools';
import { buildChatContextMessages } from '@/lib/ai/chat-context';
type ToolCallLike = { toolName: string; input: unknown };
type ToolResultLike = { output?: unknown };
type OrderedPart =
  | { type: 'step-start' }
  | { type: 'text'; text: string }
  | { type: 'tool'; toolName: string; args: unknown; result: unknown };

export async function POST(request: NextRequest) {
  try {
    const fingerprint = getUserIdFromRequest(request);
    const user = await resolveUser(fingerprint);
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { messages, resumeId, model: modelId, sessionId } = await request.json();

    let resumeContext = '';
    if (resumeId) {
      const resume = await resumeRepository.findById(resumeId);
      if (resume) {
        resumeContext = JSON.stringify(resume.sections);
      }
    }

    // Save user message to DB before streaming
    if (sessionId && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'user') {
        const textPart = lastMessage.parts?.find((p: { type: string }) => p.type === 'text');
        const content = textPart?.text || lastMessage.content || '';
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

    const aiConfig = extractAIConfig(request);
    const model = getModel(aiConfig, modelId);
    const truncatedMessages = await buildChatContextMessages(messages);

    const tools = resumeId ? createExecutableTools(resumeId, aiConfig) : undefined;

    const result = streamText({
      model,
      system: getSystemPrompt(resumeContext),
      messages: truncatedMessages,
      tools,
      stopWhen: tools ? stepCountIs(25) : undefined,
      onFinish: async ({ text, steps }) => {
        if (!sessionId) return;

        // Build ordered parts array preserving the interleaving of text and tool calls
        const orderedParts: OrderedPart[] = [];

        for (const step of steps) {
          const tcs = step.toolCalls ?? [];
          const trs = step.toolResults ?? [];

          if (!step.text && tcs.length === 0) {
            continue;
          }

          orderedParts.push({ type: 'step-start' });

          if (step.text) {
            orderedParts.push({ type: 'text', text: step.text });
          }

          for (let i = 0; i < tcs.length; i++) {
            const toolCall = tcs[i] as ToolCallLike | undefined;
            const toolResult = trs[i] as ToolResultLike | undefined;
            if (!toolCall) continue;
            orderedParts.push({
              type: 'tool',
              toolName: toolCall.toolName,
              args: toolCall.input,
              result: toolResult?.output,
            });
          }
        }

        const fullText = text || '';
        if (fullText || orderedParts.some((p) => p.type === 'tool')) {
          await chatRepository.addMessage({
            sessionId,
            role: 'assistant',
            content: fullText,
            metadata: orderedParts.length > 0 ? { orderedParts } : {},
          });
        }
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    if (error instanceof AIConfigError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 401 });
    }
    console.error('POST /api/ai/chat error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
