import { NextRequest, NextResponse } from 'next/server';
import { resolveUser, getUserIdFromRequest } from '@/lib/auth/helpers';
import { interviewRepository } from '@/lib/db/repositories/interview.repository';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { dbReady } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  await dbReady;
  const fingerprint = getUserIdFromRequest(request);
  const user = await resolveUser(fingerprint);
  if (!user) return new Response('Unauthorized', { status: 401 });

  const sessions = await interviewRepository.findSessionsByUserId(user.id);
  return NextResponse.json(sessions);
}

export async function POST(request: NextRequest) {
  await dbReady;
  const fingerprint = getUserIdFromRequest(request);
  const user = await resolveUser(fingerprint);
  if (!user) return new Response('Unauthorized', { status: 401 });

  const body = await request.json();
  const { jobDescription, jobTitle, resumeId, interviewers } = body;

  if (!jobDescription || !jobTitle || !Array.isArray(interviewers) || interviewers.length === 0) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Validate each interviewer shape before creating anything — an invalid item
  // (e.g. missing `type`) would otherwise create an orphan session and 500.
  for (const interviewer of interviewers) {
    if (!interviewer || typeof interviewer !== 'object' || typeof interviewer.type !== 'string' || !interviewer.type) {
      return NextResponse.json({ error: 'Invalid interviewer config' }, { status: 400 });
    }
  }

  // Cap the number of rounds a single request can create (DB write DoS guard).
  if (interviewers.length > 20) {
    return NextResponse.json({ error: 'Too many interviewers' }, { status: 400 });
  }

  if (resumeId) {
    const resume = await resumeRepository.findByIdForUser(resumeId, user.id);
    if (!resume) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }
  }

  const session = await interviewRepository.createSession({
    userId: user.id,
    resumeId: resumeId || undefined,
    jobDescription,
    jobTitle,
    selectedInterviewers: interviewers,
  });

  try {
    for (let i = 0; i < interviewers.length; i++) {
      await interviewRepository.createRound({
        sessionId: session!.id,
        interviewerType: interviewers[i].type,
        interviewerConfig: interviewers[i],
        sortOrder: i,
      });
    }
  } catch (error) {
    // Roll back the partially-created session so we don't leave an orphan row.
    await interviewRepository.deleteSession(session!.id).catch(() => {});
    throw error;
  }

  const rounds = await interviewRepository.findRoundsBySessionId(session!.id);
  return NextResponse.json({ session, rounds }, { status: 201 });
}
