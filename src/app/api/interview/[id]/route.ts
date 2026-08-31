import { NextRequest, NextResponse } from 'next/server';
import { resolveUser, getUserIdFromRequest } from '@/lib/auth/helpers';
import { interviewRepository } from '@/lib/db/repositories/interview.repository';
import { dbReady } from '@/lib/db';
import type { InterviewSessionStatus } from '@/types/interview';
type InterviewRoundRecord = Awaited<ReturnType<typeof interviewRepository.findRoundsBySessionId>>[number];

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbReady;
  const { id } = await params;
  const fingerprint = getUserIdFromRequest(request);
  const user = await resolveUser(fingerprint);
  if (!user) return new Response('Unauthorized', { status: 401 });

  const session = await interviewRepository.findSession(id);
  if (!session || session.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const rounds = await interviewRepository.findRoundsBySessionId(id);
  const report = await interviewRepository.findReportBySessionId(id);

  // Include messages for each round (needed for resume/history)
  const roundsWithMessages = await Promise.all(
    rounds.map(async (round: InterviewRoundRecord) => {
      const messages = await interviewRepository.findMessagesByRoundId(round.id);
      return { ...round, messages };
    })
  );

  return NextResponse.json({ session, rounds: roundsWithMessages, report });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbReady;
  const { id } = await params;
  const fingerprint = getUserIdFromRequest(request);
  const user = await resolveUser(fingerprint);
  if (!user) return new Response('Unauthorized', { status: 401 });

  const session = await interviewRepository.findSession(id);
  if (!session || session.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { status } = await request.json();
  // Status must be one of the valid session states — validating here stops
  // arbitrary strings from being stored (SQLite doesn't enforce the enum).
  const VALID_STATUSES: InterviewSessionStatus[] = ['preparing', 'in_progress', 'paused', 'completed'];
  if (status !== undefined) {
    if (typeof status !== 'string' || !VALID_STATUSES.includes(status as InterviewSessionStatus)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    await interviewRepository.updateSessionStatus(id, status as InterviewSessionStatus);
  }

  const updated = await interviewRepository.findSession(id);
  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbReady;
  const { id } = await params;
  const fingerprint = getUserIdFromRequest(request);
  const user = await resolveUser(fingerprint);
  if (!user) return new Response('Unauthorized', { status: 401 });

  const session = await interviewRepository.findSession(id);
  if (!session || session.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await interviewRepository.deleteSession(id);
  return new Response(null, { status: 204 });
}
