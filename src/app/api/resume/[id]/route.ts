import { NextRequest, NextResponse } from 'next/server';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { resolveCurrentUser } from '@/lib/auth/helpers';
import { safeNormalizeResumeSectionContent } from '@/lib/resume-section/schema';
import type { ResumeSection } from '@/types/resume';

type IncomingSection = Pick<ResumeSection, 'id' | 'type' | 'title' | 'sortOrder' | 'visible' | 'content'>;

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await resolveCurrentUser({ request });
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resume = await resumeRepository.findById(id);
    if (!resume) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (resume.userId !== currentUser.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(resume);
  } catch (error) {
    console.error('GET /api/resume/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await resolveCurrentUser({ request });
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resume = await resumeRepository.findById(id);
    if (!resume) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (resume.userId !== currentUser.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { title, template, themeConfig, language, sections } = body;
    const incomingSections = Array.isArray(sections) ? (sections as IncomingSection[]) : undefined;

    // Update resume metadata
    // Sync sections: create new, update existing, delete removed
    const updated = await resumeRepository.replaceDraftForUser({
      id,
      userId: currentUser.user.id,
      ...(title !== undefined ? { title } : {}),
      ...(template !== undefined ? { template } : {}),
      ...(themeConfig !== undefined ? { themeConfig } : {}),
      ...(language !== undefined ? { language } : {}),
      ...(incomingSections ? {
        sections: incomingSections.map((section, index) => ({
          id: section.id,
          type: section.type,
          title: section.title,
          sortOrder: Number.isFinite(section.sortOrder) ? section.sortOrder : index,
          visible: section.visible !== false,
          // Normalize content so null/primitive payloads can never corrupt the
          // stored resume and break rendering/export later.
          content: safeNormalizeResumeSectionContent(section.type, section.content),
        })),
      } : {}),
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('PUT /api/resume/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await resolveCurrentUser({ request });
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resume = await resumeRepository.findById(id);
    if (!resume) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (resume.userId !== currentUser.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await resumeRepository.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/resume/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
