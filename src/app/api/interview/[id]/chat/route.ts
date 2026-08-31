import { NextRequest } from 'next/server';
import { streamText, convertToModelMessages } from 'ai';
import { getModel, extractAIConfig, AIConfigError } from '@/lib/ai/provider';
import { resolveUser, getUserIdFromRequest } from '@/lib/auth/helpers';
import { interviewRepository } from '@/lib/db/repositories/interview.repository';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { buildInterviewSystemPrompt } from '@/lib/ai/interview-prompts';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { dbReady } from '@/lib/db';
import type { InterviewerConfig } from '@/types/interview';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbReady;
    const { id: sessionId } = await params;
    const fingerprint = getUserIdFromRequest(request);
    const user = await resolveUser(fingerprint);
    if (!user) return new Response('Unauthorized', { status: 401 });

  const rate = checkRateLimit(`interview-chat:${user.id}`, { limit: 20, windowMs: 60_000 });
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);

    const session = await interviewRepository.findSession(sessionId);
    if (!session || session.userId !== user.id) {
      return new Response('Not found', { status: 404 });
    }

    const { messages, roundId, model: modelId, locale = 'zh' } = await request.json();

    // roundId comes from the request body — verify it belongs to this session
    // before writing messages/status to it (same guard as /control).
    if (typeof roundId !== 'string' || !roundId) {
      return new Response('Round not found', { status: 404 });
    }
    const round = await interviewRepository.findRound(roundId);
    if (!round || round.sessionId !== sessionId) {
      return new Response('Round not found', { status: 404 });
    }

    let resumeContent: string | undefined;
    if (session.resumeId) {
      const resume = await resumeRepository.findByIdForUser(session.resumeId as string, user.id);
      if (resume) {
        resumeContent = JSON.stringify(resume.sections);
      }
    }

    const interviewerConfig = round.interviewerConfig as InterviewerConfig;

    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'user') {
        const textPart = lastMessage.parts?.find((p: { type: string }) => p.type === 'text');
        const content = textPart?.text || lastMessage.content || '';
        if (content) {
          await interviewRepository.addMessage({
            roundId,
            role: 'candidate',
            content,
          });
        }
      }
    }

    const aiConfig = extractAIConfig(request);
    const model = getModel(aiConfig, modelId);
    const modelMessages = await convertToModelMessages(messages);

    if (round.status === 'pending') {
      await interviewRepository.updateRoundStatus(roundId, 'in_progress');
      await interviewRepository.updateSessionStatus(sessionId, 'in_progress');
    }

    const systemPrompt = buildInterviewSystemPrompt({
      interviewer: interviewerConfig,
      jobDescription: session.jobDescription,
      resumeContent,
      maxQuestions: round.maxQuestions,
      locale,
    });

    const result = streamText({
      model,
      system: systemPrompt,
      messages: modelMessages,
      onFinish: async ({ text }) => {
        if (!text) return;

        await interviewRepository.addMessage({
          roundId,
          role: 'interviewer',
          content: text,
        });

        await interviewRepository.incrementQuestionCount(roundId);

        if (text.includes('[ROUND_COMPLETE]')) {
          await interviewRepository.setRoundSummary(roundId, {
            score: 0,
            feedback: text.replace('[ROUND_COMPLETE]', '').trim(),
          });

          const rounds = await interviewRepository.findRoundsBySessionId(sessionId);
          const currentIndex = rounds.findIndex((r: { id: string }) => r.id === roundId);
          const nextRound = rounds[currentIndex + 1];

          if (nextRound) {
            await interviewRepository.updateSessionRound(sessionId, currentIndex + 1);
          } else {
            await interviewRepository.updateSessionStatus(sessionId, 'completed');
          }
        }
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    if (error instanceof AIConfigError) {
      return new Response(JSON.stringify({ error: error.message }), { status: 401 });
    }
    console.error('POST /api/interview/[id]/chat error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
