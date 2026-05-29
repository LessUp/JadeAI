import type { ResumeSectionLike, ResumeSectionsLike } from './base';
import { getResumePersonalInfo, getVisibleResumeSections } from './base';

export const SIDEBAR_TYPES = new Set(['skills', 'languages', 'certifications', 'custom']);

export function getSidebarTemplateModel<TSection extends ResumeSectionLike>(
  resume: ResumeSectionsLike<TSection>,
) {
  const personalInfo = getResumePersonalInfo(resume);
  const sections = getVisibleResumeSections(resume);

  return {
    personalInfo,
    sidebarSections: sections.filter((section) => SIDEBAR_TYPES.has(section.type)),
    mainSections: sections.filter((section) => !SIDEBAR_TYPES.has(section.type)),
  };
}
