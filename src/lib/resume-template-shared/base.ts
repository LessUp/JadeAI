import type {
  PersonalInfoContent,
  ResumeSection,
  SkillsContent,
  SummaryContent,
} from '@/types/resume';

export type ResumeSectionLike = Pick<ResumeSection, 'type' | 'title' | 'visible' | 'content'>;
export interface ResumeSectionsLike<TSection extends ResumeSectionLike = ResumeSectionLike> {
  sections: TSection[];
}

function isSectionEmpty(section: ResumeSectionLike): boolean {
  const content = section.content as any;
  // Malformed content (null, primitives) must never break template rendering —
  // treat it as empty so the section is filtered out.
  if (!content || typeof content !== 'object') return true;
  if (section.type === 'summary') {
    return !(content as SummaryContent).text;
  }
  if (section.type === 'skills') {
    const categories = (content as SkillsContent).categories;
    return !categories?.length || categories.every((category: any) => !category.skills?.length);
  }
  if ('items' in content) {
    return !content.items?.length;
  }
  return false;
}

export function getResumePersonalInfo<TSection extends ResumeSectionLike>(
  resume: ResumeSectionsLike<TSection>,
): PersonalInfoContent {
  const section = resume.sections.find((item) => item.type === 'personal_info');
  return (section?.content || {}) as PersonalInfoContent;
}

export function getVisibleResumeSections<TSection extends ResumeSectionLike>(
  resume: ResumeSectionsLike<TSection>,
): TSection[] {
  return resume.sections.filter(
    (section) => section.visible && section.type !== 'personal_info' && !isSectionEmpty(section),
  );
}
