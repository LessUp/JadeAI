import { NextRequest, NextResponse } from 'next/server';
import { resumeRepository } from '@/lib/db/repositories/resume.repository';
import { resolveCurrentUser } from '@/lib/auth/helpers';
import { DEFAULT_SECTIONS } from '@/lib/constants';
import { isResumeSectionType, safeNormalizeResumeSectionContent } from '@/lib/resume-section/schema';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await resolveCurrentUser({ request });
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resumes = await resumeRepository.findAllByUserId(currentUser.user.id);
    return NextResponse.json(resumes);
  } catch (error) {
    console.error('GET /api/resume error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await resolveCurrentUser({ request });
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, template, language, sections, themeConfig } = body;

    const resume = await resumeRepository.create({
      userId: currentUser.user.id,
      title: title || '未命名简历',
      template: template || 'classic',
      language: language || 'zh',
      ...(themeConfig ? { themeConfig } : {}),
    });

    if (resume) {
      if (Array.isArray(sections) && sections.length > 0) {
        // Import mode: use provided sections, ignore original ids.
        // Normalize each section's content so malformed imports (null content,
        // primitives, untyped JSON) can never crash rendering or export later.
        for (let i = 0; i < sections.length; i++) {
          const s = sections[i];
          const type = isResumeSectionType(s?.type) ? s.type : 'custom';
          await resumeRepository.createSection({
            resumeId: resume.id,
            type,
            // title is NOT NULL in the schema — default to a safe fallback.
            title: typeof s?.title === 'string' && s.title ? s.title : '未命名板块',
            sortOrder: i,
            visible: s?.visible !== false,
            content: safeNormalizeResumeSectionContent(type, s?.content),
          });
        }
      } else {
        // Default mode: create empty sections
        const lang = resume.language || 'zh';
        for (let i = 0; i < DEFAULT_SECTIONS.length; i++) {
          const s = DEFAULT_SECTIONS[i];
          const sectionTitle = lang === 'en' ? s.titleEn : s.titleZh;
          let content: unknown = {};

          if (s.type === 'personal_info') {
            content = { fullName: '', jobTitle: '', email: '', phone: '', location: '' };
          } else if (s.type === 'summary') {
            content = { text: '' };
          } else if (s.type === 'work_experience' || s.type === 'education' || s.type === 'projects' || s.type === 'certifications' || s.type === 'languages' || s.type === 'github' || s.type === 'custom') {
            content = { items: [] };
          } else if (s.type === 'skills') {
            content = { categories: [] };
          }

          await resumeRepository.createSection({
            resumeId: resume.id,
            type: s.type,
            title: sectionTitle,
            sortOrder: i,
            content,
          });
        }
      }

      const fullResume = await resumeRepository.findById(resume.id);
      return NextResponse.json(fullResume, { status: 201 });
    }

    return NextResponse.json({ error: 'Failed to create resume' }, { status: 500 });
  } catch (error) {
    console.error('POST /api/resume error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
