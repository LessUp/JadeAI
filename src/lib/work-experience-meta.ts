import type { WorkExperienceContent } from '@/types/resume';

type WorkMetaLike = {
  team?: unknown;
  company?: unknown;
};

type ResumeLikeSection = {
  type: string;
  content: unknown;
};

type ResumeLike = {
  sections: ResumeLikeSection[];
};

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function formatWorkExperienceOrganization(item: WorkMetaLike): string {
  const team = clean(item.team);
  const company = clean(item.company);

  if (!team) return company;
  if (!company) return team;
  if (company === team || company.startsWith(`${team} |`) || company.startsWith(`${team}|`)) {
    return company;
  }

  return `${team} | ${company}`;
}

export function normalizeWorkExperienceMetadataForDisplay<T extends ResumeLike>(resume: T): T {
  let changed = false;

  const sections = resume.sections.map((section) => {
    if (section.type !== 'work_experience') return section;

    const content = section.content as WorkExperienceContent;
    // Guard against malformed stored content (null/primitive) that could
    // otherwise crash the preview render path.
    if (!content || typeof content !== 'object') return section;
    const items = content.items || [];
    let sectionChanged = false;

    const normalizedItems = items.map((item) => {
      const companyForDisplay = formatWorkExperienceOrganization(item);
      if (companyForDisplay === item.company) return item;
      sectionChanged = true;
      return { ...item, company: companyForDisplay };
    });

    if (!sectionChanged) return section;
    changed = true;
    return {
      ...section,
      content: {
        ...content,
        items: normalizedItems,
      },
    };
  });

  return changed ? { ...resume, sections } : resume;
}
