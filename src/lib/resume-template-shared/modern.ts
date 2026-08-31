import type { PersonalInfoContent } from '@/types/resume';

import type { ResumeSectionLike, ResumeSectionsLike } from './base';
import { getResumePersonalInfo, getVisibleResumeSections } from './base';

export function getModernContactItems(personalInfo: PersonalInfoContent): string[] {
  return [
    personalInfo.age,
    personalInfo.politicalStatus,
    personalInfo.gender,
    personalInfo.ethnicity,
    personalInfo.hometown,
    personalInfo.maritalStatus,
    personalInfo.yearsOfExperience,
    personalInfo.educationLevel,
    personalInfo.email,
    personalInfo.phone,
    personalInfo.wechat,
    personalInfo.location,
    personalInfo.website,
    personalInfo.github,
    personalInfo.linkedin,
  ].filter(Boolean) as string[];
}

export function getModernTemplateModel<TSection extends ResumeSectionLike>(
  resume: ResumeSectionsLike<TSection>,
) {
  const personalInfo = getResumePersonalInfo(resume);
  const sections = getVisibleResumeSections(resume);

  return {
    personalInfo,
    sections,
    contacts: getModernContactItems(personalInfo),
  };
}
