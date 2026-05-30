import type { Resume, ResumeSection, ThemeConfig } from '@/types/resume';

export const PDF_REGRESSION_FIXTURE_NAMES = [
  'modern-long-content',
  'sidebar-long-content',
  'two-column-balanced',
  'compact-dense',
  'neon-dark-background',
] as const;

export type PdfRegressionFixtureName = (typeof PDF_REGRESSION_FIXTURE_NAMES)[number];

interface PdfRegressionFixture {
  description: string;
  anchorText: string;
  resume: Resume;
}

const NOW = new Date('2026-05-28T00:00:00.000Z');

function buildTheme(overrides: Partial<ThemeConfig> = {}): ThemeConfig {
  return {
    primaryColor: '#111827',
    accentColor: '#2563eb',
    fontFamily: 'Inter',
    fontSize: 'medium',
    lineSpacing: 1.45,
    margin: { top: 20, right: 20, bottom: 20, left: 20 },
    sectionSpacing: 16,
    avatarStyle: 'oneInch',
    ...overrides,
  };
}

function section(
  resumeId: string,
  sortOrder: number,
  type: ResumeSection['type'],
  title: string,
  content: ResumeSection['content'],
): ResumeSection {
  return {
    id: `${resumeId}-${type}-${sortOrder}`,
    resumeId,
    type,
    title,
    sortOrder,
    visible: true,
    content,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function repeatSentence(sentence: string, count: number): string {
  return Array.from({ length: count }, () => sentence).join(' ');
}

function buildWorkItems(prefix: string, count: number, highlightCount: number, leadDescriptionRepeat = 2) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-work-${index + 1}`,
    company: `${prefix} Labs ${index + 1}`,
    position: index === 0 ? 'Senior Product Engineer' : `Platform Engineer ${index + 1}`,
    location: index % 2 === 0 ? 'Shanghai' : 'Shenzhen',
    startDate: `20${18 + index}-0${(index % 3) + 1}`,
    endDate: index === 0 ? null : `20${19 + index}-1${(index % 2) + 1}`,
    current: index === 0,
    description: repeatSentence(
      `${prefix} delivered hiring workflows, PDF export polish, and analytics instrumentation across multilingual resume flows with measurable reliability gains.`,
      index === 0 ? leadDescriptionRepeat : 1,
    ),
    technologies: ['TypeScript', 'React', 'Next.js', 'Puppeteer', 'SQLite'].slice(0, 3 + (index % 3)),
    highlights: Array.from({ length: highlightCount }, (_, highlightIndex) =>
      `${prefix} highlight ${index + 1}.${highlightIndex + 1} improved export fidelity, print pagination, and recruiter readability under dense content constraints.`,
    ),
  }));
}

function buildEducationItems(prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-education-${index + 1}`,
    institution: `${prefix} University ${index + 1}`,
    degree: index === 0 ? 'Master' : 'Bachelor',
    field: index === 0 ? 'Human Computer Interaction' : 'Computer Science',
    location: index === 0 ? 'Hangzhou' : 'Nanjing',
    startDate: `20${12 + index}-09`,
    endDate: `20${14 + index}-06`,
    gpa: index === 0 ? '3.9/4.0' : '3.7/4.0',
    highlights: [
      `${prefix} capstone focused on structured authoring systems for bilingual resumes.`,
      `${prefix} research explored layout compression techniques for print-first documents.`,
    ],
  }));
}

function buildSkillCategories(prefix: string, categoryCount: number, skillCount: number) {
  return Array.from({ length: categoryCount }, (_, index) => ({
    id: `${prefix}-skill-category-${index + 1}`,
    name: ['Frontend Systems', 'Content Modeling', 'Performance', 'Design Ops', 'AI Tooling'][index] || `Capability ${index + 1}`,
    skills: Array.from({ length: skillCount }, (_, skillIndex) => `${prefix} skill ${index + 1}.${skillIndex + 1}`),
  }));
}

function buildProjectItems(prefix: string, count: number, highlightCount: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-project-${index + 1}`,
    name: `${prefix} Project ${index + 1}`,
    url: `https://example.com/${prefix.toLowerCase()}-${index + 1}`,
    startDate: `202${index}-03`,
    endDate: `202${index}-11`,
    description: repeatSentence(
      `${prefix} project unified parsing, editing, and export experiences while preserving semantic text extraction in generated PDFs.`,
      1 + (index % 2),
    ),
    technologies: ['Next.js', 'Tailwind CSS', 'Puppeteer', 'MuPDF', 'Zod'].slice(0, 3 + index),
    highlights: Array.from({ length: highlightCount }, (_, highlightIndex) =>
      `${prefix} project ${index + 1}.${highlightIndex + 1} shipped measurable workflow improvements for recruiters and applicants across multiple templates.`,
    ),
  }));
}

function buildCertifications(prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-certification-${index + 1}`,
    name: `${prefix} Certification ${index + 1}`,
    issuer: ['ACM', 'Google', 'Linux Foundation', 'AWS'][index] || 'Open Source Guild',
    date: `202${index}-0${(index % 6) + 1}`,
  }));
}

function buildLanguages(prefix: string, count: number, withDescriptions: boolean) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-language-${index + 1}`,
    language: ['English', 'Chinese', 'Japanese', 'German', 'French'][index] || `Language ${index + 1}`,
    proficiency: ['Native', 'Professional', 'Working', 'Conversational', 'Reading'][index] || 'Working',
    description: withDescriptions
      ? `${prefix} language note ${index + 1} covers stakeholder workshops, technical writing, and nuanced interview calibration in multilingual settings.`
      : '',
  }));
}

function buildCustomItems(prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-custom-${index + 1}`,
    title: `${prefix} Leadership Track ${index + 1}`,
    subtitle: index % 2 === 0 ? 'Mentorship' : 'Community',
    date: `202${index}-Q${(index % 4) + 1}`,
    description: `${prefix} custom narrative ${index + 1} documents coaching, playbook writing, and hiring loop calibration around clear communication.`,
  }));
}

function buildResumeFixture(config: {
  key: string;
  template: Resume['template'];
  title: string;
  fullName: string;
  jobTitle: string;
  anchorText: string;
  description: string;
  summaryRepeat: number;
  workCount: number;
  workHighlights: number;
  educationCount: number;
  skillCategories: number;
  skillCount: number;
  projectCount: number;
  projectHighlights: number;
  certificationCount: number;
  languageCount: number;
  languageDescriptions: boolean;
  customCount: number;
  leadWorkDescriptionRepeat?: number;
  theme?: Partial<ThemeConfig>;
}): PdfRegressionFixture {
  const resumeId = `fixture-${config.key}`;
  const prefix = config.key.toUpperCase().replace(/-/g, '_');
  const summary = repeatSentence(
    `${config.anchorText} ${config.fullName} builds resume authoring systems that stay readable on screen, export cleanly to PDF, and remain searchable after archival.`,
    config.summaryRepeat,
  );

  const sections: ResumeSection[] = [
    section(resumeId, 0, 'personal_info', 'Personal Info', {
      fullName: config.fullName,
      jobTitle: config.jobTitle,
      email: `${config.key}@example.com`,
      phone: '+86 138-0000-0000',
      location: 'Shanghai, China',
      website: `https://${config.key}.example.com`,
      linkedin: `https://linkedin.com/in/${config.key}`,
      github: `https://github.com/${config.key}`,
      yearsOfExperience: '9+ years',
      educationLevel: 'Master',
    }),
    section(resumeId, 1, 'summary', 'Summary', {
      text: summary,
    }),
    section(resumeId, 2, 'work_experience', 'Work Experience', {
      items: buildWorkItems(prefix, config.workCount, config.workHighlights, config.leadWorkDescriptionRepeat),
    }),
    section(resumeId, 3, 'education', 'Education', {
      items: buildEducationItems(prefix, config.educationCount),
    }),
    section(resumeId, 4, 'skills', 'Skills', {
      categories: buildSkillCategories(prefix, config.skillCategories, config.skillCount),
    }),
    section(resumeId, 5, 'projects', 'Projects', {
      items: buildProjectItems(prefix, config.projectCount, config.projectHighlights),
    }),
    section(resumeId, 6, 'certifications', 'Certifications', {
      items: buildCertifications(prefix, config.certificationCount),
    }),
    section(resumeId, 7, 'languages', 'Languages', {
      items: buildLanguages(prefix, config.languageCount, config.languageDescriptions),
    }),
  ];

  if (config.customCount > 0) {
    sections.push(
      section(resumeId, 8, 'custom', 'Highlights', {
        items: buildCustomItems(prefix, config.customCount),
      }),
    );
  }

  return {
    description: config.description,
    anchorText: config.anchorText,
    resume: {
      id: resumeId,
      userId: 'pdf-regression-user',
      title: config.title,
      template: config.template,
      themeConfig: buildTheme(config.theme),
      isDefault: false,
      language: 'en',
      sections,
      createdAt: NOW,
      updatedAt: NOW,
    },
  };
}

export const PDF_REGRESSION_FIXTURES: Record<PdfRegressionFixtureName, PdfRegressionFixture> = {
  'modern-long-content': buildResumeFixture({
    key: 'modern-long-content',
    template: 'modern',
    title: 'Modern Long Content Fixture',
    fullName: 'Morgan Lin',
    jobTitle: 'Staff Resume Systems Engineer',
    anchorText: 'MODERN_LONG_CONTENT_SIGNAL',
    description: 'Single-column modern resume that sits near the one-page boundary.',
    summaryRepeat: 1,
    workCount: 1,
    workHighlights: 1,
    leadWorkDescriptionRepeat: 1,
    educationCount: 1,
    skillCategories: 3,
    skillCount: 3,
    projectCount: 1,
    projectHighlights: 1,
    certificationCount: 1,
    languageCount: 1,
    languageDescriptions: true,
    customCount: 0,
  }),
  'sidebar-long-content': buildResumeFixture({
    key: 'sidebar-long-content',
    template: 'sidebar',
    title: 'Sidebar Long Content Fixture',
    fullName: 'Sabrina Zhou',
    jobTitle: 'Design Systems Lead',
    anchorText: 'SIDEBAR_LONG_CONTENT_SIGNAL',
    description: 'Sidebar layout with enough content to expose nearly blank second-page regressions.',
    summaryRepeat: 2,
    workCount: 2,
    workHighlights: 3,
    educationCount: 1,
    skillCategories: 4,
    skillCount: 6,
    projectCount: 2,
    projectHighlights: 2,
    certificationCount: 3,
    languageCount: 4,
    languageDescriptions: true,
    customCount: 2,
    theme: {
      sectionSpacing: 14,
    },
  }),
  'two-column-balanced': buildResumeFixture({
    key: 'two-column-balanced',
    template: 'two-column',
    title: 'Two Column Balanced Fixture',
    fullName: 'Theo Park',
    jobTitle: 'Platform Product Engineer',
    anchorText: 'TWO_COLUMN_BALANCED_SIGNAL',
    description: 'Balanced two-column resume for parity across dark-sidebar templates.',
    summaryRepeat: 2,
    workCount: 2,
    workHighlights: 2,
    educationCount: 2,
    skillCategories: 3,
    skillCount: 4,
    projectCount: 1,
    projectHighlights: 2,
    certificationCount: 2,
    languageCount: 3,
    languageDescriptions: false,
    customCount: 1,
  }),
  'compact-dense': buildResumeFixture({
    key: 'compact-dense',
    template: 'compact',
    title: 'Compact Dense Fixture',
    fullName: 'Casey Wu',
    jobTitle: 'Senior Applied AI Engineer',
    anchorText: 'COMPACT_DENSE_SIGNAL',
    description: 'Dense compact layout close to a single-page limit.',
    summaryRepeat: 2,
    workCount: 3,
    workHighlights: 3,
    educationCount: 1,
    skillCategories: 4,
    skillCount: 6,
    projectCount: 2,
    projectHighlights: 2,
    certificationCount: 3,
    languageCount: 3,
    languageDescriptions: false,
    customCount: 1,
    theme: {
      fontSize: 'small',
      sectionSpacing: 12,
      margin: { top: 16, right: 16, bottom: 16, left: 16 },
    },
  }),
  'neon-dark-background': buildResumeFixture({
    key: 'neon-dark-background',
    template: 'neon',
    title: 'Neon Dark Background Fixture',
    fullName: 'Nova Reed',
    jobTitle: 'Creative Technologist',
    anchorText: 'NEON_DARK_BACKGROUND_SIGNAL',
    description: 'Dark full-background template used to validate text extraction parity.',
    summaryRepeat: 2,
    workCount: 2,
    workHighlights: 3,
    educationCount: 1,
    skillCategories: 3,
    skillCount: 5,
    projectCount: 2,
    projectHighlights: 2,
    certificationCount: 2,
    languageCount: 2,
    languageDescriptions: false,
    customCount: 1,
    theme: {
      accentColor: '#22d3ee',
    },
  }),
};

export function getPdfRegressionFixture(name: PdfRegressionFixtureName): PdfRegressionFixture {
  return structuredClone(PDF_REGRESSION_FIXTURES[name]);
}
