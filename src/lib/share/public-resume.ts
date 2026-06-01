import type { ResumeSection, SectionContent, ThemeConfig } from '@/types/resume';

export interface PublicResumeSection {
  id: string;
  type: string;
  title: string;
  sortOrder: number;
  visible: boolean;
  content: SectionContent;
}

export interface PublicResume {
  id: string;
  title: string;
  template: string;
  themeConfig: ThemeConfig;
  language: string;
  sections: PublicResumeSection[];
}

type PublicResumeSource = Pick<PublicResume, 'id' | 'title' | 'template' | 'themeConfig' | 'language'> & {
  sections?: Array<Pick<ResumeSection, 'id' | 'type' | 'title' | 'sortOrder' | 'visible' | 'content'>>;
};

export function serializePublicResume(resume: PublicResumeSource): PublicResume {
  return {
    id: resume.id,
    title: resume.title,
    template: resume.template,
    themeConfig: resume.themeConfig,
    language: resume.language,
    sections: (resume.sections ?? []).map((section) => ({
      id: section.id,
      type: section.type,
      title: section.title,
      sortOrder: section.sortOrder,
      visible: section.visible,
      content: section.content,
    })),
  };
}
