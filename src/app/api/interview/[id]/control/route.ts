import { NextRequest, NextResponse } from 'next/server';
import { resolveUser, getUserIdFromRequest } from '@/lib/auth/helpers';
import { interviewRepository } from '@/lib/db/repositories/interview.repository';
import { buildHintPrompt, buildSkipPrompt } from '@/lib/ai/interview-prompts';
import { dbReady } from '@/lib/db';
type InterviewRoundRecord = Awaited<ReturnType<typeof interviewRepository.findRoundsBySessionId>>[number];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbReady;
  const { id: sessionId } = await params;
  const fingerprint = getUserIdFromRequest(request);
  const user = await resolveUser(fingerprint);
  if (!user) return new Response('Unauthorized', { status: 401 });

  const session = await interviewRepository.findSession(sessionId);
  if (!session || session.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { action, roundId, locale = 'zh' } = await request.json();

  // roundId comes from the request body — it must belong to this session,
  // otherwise any user could flip or inject messages into other users' rounds.
  const rounds = await interviewRepository.findRoundsBySessionId(sessionId);
  const roundIds = new Set(rounds.map((r: InterviewRoundRecord) => r.id));
  if (roundId && !roundIds.has(roundId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let systemMessage = '';
  switch (action) {
    case 'skip':
      systemMessage = buildSkipPrompt(locale);
      break;
    case 'hint':
      systemMessage = buildHintPrompt(locale);
      break;
    case 'end_round': {
      // Mark current round as completed
      if (roundId) {
        await interviewRepository.updateRoundStatus(roundId, 'completed');
      }
      // Advance to next round or complete session
      const currentIndex = rounds.findIndex((r: InterviewRoundRecord) => r.id === roundId);
      const nextRound = currentIndex >= 0 ? rounds[currentIndex + 1] : undefined;
      if (nextRound) {
        await interviewRepository.updateSessionRound(sessionId, currentIndex + 1);
      } else {
        await interviewRepository.updateSessionStatus(sessionId, 'completed');
      }
      return NextResponse.json({ success: true });
    }
    case 'pause':
      await interviewRepository.updateSessionStatus(sessionId, 'paused');
      return NextResponse.json({ success: true });
    case 'resume':
      await interviewRepository.updateSessionStatus(sessionId, 'in_progress');
      return NextResponse.json({ success: true });
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  if (systemMessage && roundId) {
    await interviewRepository.addMessage({
      roundId,
      role: 'system',
      content: systemMessage,
    });
  }

  return NextResponse.json({ success: true, systemMessage });
}
