import type { LanguageItem, LanguagesContent } from '@/types/resume';

const DETAILED_LANGUAGE_TEMPLATES = new Set(['modern', 'sidebar']);

export function getLanguageDescriptionText(item: Pick<LanguageItem, 'description'>): string {
  return item.description?.trim() || '';
}

export function formatCompactLanguageProficiency(item: Pick<LanguageItem, 'proficiency' | 'description'>): string {
  const proficiency = item.proficiency?.trim() || '';
  const description = getLanguageDescriptionText(item);

  if (!description) return proficiency;
  if (!proficiency) return description;
  return `${proficiency} · ${description}`;
}

type ResumeLikeSection = {
  type: string;
  content: unknown;
};

type ResumeLike = {
  template: string;
  sections: ResumeLikeSection[];
};

export function normalizeLanguageDescriptionsForCompactTemplates<T extends ResumeLike>(resume: T): T {
  if (DETAILED_LANGUAGE_TEMPLATES.has(resume.template)) return resume;

  let changed = false;
  const sections = resume.sections.map((section) => {
    if (section.type !== 'languages') return section;

    const content = section.content as LanguagesContent;
    const items = content.items || [];
    let sectionChanged = false;

    const normalizedItems = items.map((item) => {
      const nextProficiency = formatCompactLanguageProficiency(item);
      if (nextProficiency === item.proficiency) return item;
      sectionChanged = true;
      return { ...item, proficiency: nextProficiency };
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
