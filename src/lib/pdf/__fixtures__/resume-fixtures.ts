import type { Resume, ResumeSection, ThemeConfig, WorkExperienceContent } from '@/types/resume';
import { DEFAULT_THEME } from '@/lib/resume-theme/default-theme';

const NOW = new Date('2026-05-29T00:00:00.000Z');

function createTheme(overrides: Partial<ThemeConfig> = {}): ThemeConfig {
  return {
    ...DEFAULT_THEME,
    ...overrides,
    margin: {
      ...DEFAULT_THEME.margin,
      ...(overrides.margin || {}),
    },
  };
}

function createSection(
  resumeId: string,
  type: ResumeSection['type'],
  title: string,
  sortOrder: number,
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

function repeatParagraph(seed: string, count: number): string {
  return Array.from({ length: count }, (_, index) => {
    return `${seed} cycle ${index + 1} aligned resume export quality, content modeling, analytics handoff, and release governance across multilingual candidate workflows.`;
  }).join(' ');
}

function createWorkItems(count: number, highlightsPerItem: number, descriptionRepeat: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `work-${index + 1}`,
    company: `Northstar Systems ${index + 1}`,
    position: index === 0 ? 'Staff Resume Platform Engineer' : `Platform Engineer ${index + 1}`,
    location: 'Remote',
    startDate: `${2018 + index}.01`,
    endDate: index === 0 ? '' : `${2019 + index}.12`,
    current: index === 0,
    description: repeatParagraph(
      `Owned cross-surface export resilience for planning lane ${index + 1}.`,
      descriptionRepeat,
    ),
    technologies: ['TypeScript', 'Next.js', 'Puppeteer', 'MuPDF', 'Tailwind', 'Node.js'].slice(
      0,
      4 + (index % 2),
    ),
    highlights: Array.from({ length: highlightsPerItem }, (_, highlightIndex) =>
      `Delivered regression gate ${highlightIndex + 1} for workstream ${index + 1}, keeping preview and export output aligned under dense pagination.`,
    ),
  }));
}

function createEducationItems(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `education-${index + 1}`,
    institution: index === 0 ? 'Tsinghua University' : `Institute ${index + 1}`,
    degree: index === 0 ? 'M.S.' : 'B.S.',
    field: index === 0 ? 'Software Engineering' : 'Information Systems',
    startDate: `${2011 + index}.09`,
    endDate: `${2013 + index}.06`,
    gpa: index === 0 ? '3.9/4.0' : '',
    highlights: [
      'Focused on document rendering systems, search relevance, and internationalization.',
      'Built a layout evaluation toolkit for print-ready HTML pipelines.',
    ],
  }));
}

function createSkillCategories(categoryCount: number, skillsPerCategory: number) {
  return Array.from({ length: categoryCount }, (_, index) => ({
    id: `skill-category-${index + 1}`,
    name: ['Core Stack', 'Tooling', 'Testing', 'Leadership', 'Localization'][index] || `Skill Group ${index + 1}`,
    skills: Array.from({ length: skillsPerCategory }, (_, skillIndex) =>
      `${['TypeScript', 'React', 'Puppeteer', 'MuPDF', 'Tailwind', 'Node'][skillIndex % 6]} ${index + 1}-${skillIndex + 1}`,
    ),
  }));
}

function createProjectItems(count: number, finalAnchor: string) {
  return Array.from({ length: count }, (_, index) => ({
    id: `project-${index + 1}`,
    name: index === count - 1 ? finalAnchor : `Layout Ops Program ${index + 1}`,
    startDate: `202${index}.03`,
    endDate: `202${index}.11`,
    description: repeatParagraph(
      `Coordinated benchmark and export validation project ${index + 1}.`,
      2,
    ),
    technologies: ['Playwright', 'Puppeteer', 'Vitest', 'MuPDF'],
    highlights: [
      'Reduced preview/export drift by consolidating data selection and pagination assumptions.',
      'Captured cross-template page-count baselines for dark and split layouts.',
    ],
  }));
}

function createCertifications(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `certification-${index + 1}`,
    name: index === count - 1 ? 'Release Governance Certification' : `Certification ${index + 1}`,
    issuer: 'Open Skills Alliance',
    date: `202${index}.08`,
  }));
}

function createLanguages() {
  return [
    {
      id: 'language-en',
      language: 'English',
      proficiency: 'Professional',
      description: 'Comfortable leading cross-team technical reviews and writing detailed benchmark summaries.',
    },
    {
      id: 'language-zh',
      language: '中文',
      proficiency: 'Native',
      description: '负责多语言导出稳定性验证与排版策略设计。',
    },
  ];
}

function createResumeFixture({
  id,
  title,
  template,
  fullName,
  summaryParagraphs,
  workCount,
  workHighlights,
  workDescriptionRepeat,
  skillCategories,
  skillsPerCategory,
  projectCount,
  certificationCount,
  projectAnchor,
  theme,
}: {
  id: string;
  title: string;
  template: Resume['template'];
  fullName: string;
  summaryParagraphs: number;
  workCount: number;
  workHighlights: number;
  workDescriptionRepeat: number;
  skillCategories: number;
  skillsPerCategory: number;
  projectCount: number;
  certificationCount: number;
  projectAnchor: string;
  theme?: Partial<ThemeConfig>;
}): Resume {
  const sections: ResumeSection[] = [
    createSection(id, 'personal_info', 'Personal Info', 0, {
      fullName,
      jobTitle: 'Document Platform Lead',
      email: 'avery@example.com',
      phone: '+86 13800000000',
      location: 'Shanghai',
      website: 'avery.dev',
      yearsOfExperience: '9 years',
      educationLevel: 'Masters',
    }),
    createSection(id, 'summary', 'Summary', 1, {
      text: repeatParagraph(`${title} summary`, summaryParagraphs),
    }),
    createSection(id, 'work_experience', 'Experience', 2, {
      items: createWorkItems(workCount, workHighlights, workDescriptionRepeat),
    }),
    createSection(id, 'education', 'Education', 3, {
      items: createEducationItems(2),
    }),
    createSection(id, 'skills', 'Skills', 4, {
      categories: createSkillCategories(skillCategories, skillsPerCategory),
    }),
    createSection(id, 'projects', 'Projects', 5, {
      items: createProjectItems(projectCount, projectAnchor),
    }),
    createSection(id, 'certifications', 'Certifications', 6, {
      items: createCertifications(certificationCount),
    }),
    createSection(id, 'languages', 'Languages', 7, {
      items: createLanguages(),
    }),
  ];

  return {
    id,
    userId: 'fixture-user',
    title,
    template,
    themeConfig: createTheme(theme),
    isDefault: false,
    language: 'zh',
    sections,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function createSwissPageGapFixture(): Resume {
  const resume = createResumeFixture({
    id: 'fixture-swiss-gap',
    title: 'Swiss Page Gap Probe',
    template: 'swiss',
    fullName: 'Avery Swiss Probe',
    summaryParagraphs: 4,
    workCount: 3,
    workHighlights: 6,
    workDescriptionRepeat: 4,
    skillCategories: 2,
    skillsPerCategory: 4,
    projectCount: 2,
    certificationCount: 1,
    projectAnchor: 'Swiss Header Width Marker',
    theme: {
      lineSpacing: 1.5,
      sectionSpacing: 16,
      margin: { top: 20, right: 20, bottom: 20, left: 20 },
    },
  });

  const workSection = resume.sections.find((section) => section.type === 'work_experience');
  const projectSection = resume.sections.find((section) => section.type === 'projects');
  const summarySection = resume.sections.find((section) => section.type === 'summary');

  if (summarySection && 'text' in summarySection.content) {
    summarySection.content.text += ' 前置填充段落。'.repeat(20);
  }

  if (workSection && 'items' in workSection.content) {
    const workContent = workSection.content as WorkExperienceContent;
    const [firstItem, secondItem] = workContent.items;
    if (firstItem) {
      firstItem.position = '资深后端工程师';
      firstItem.description = repeatParagraph(
        'Led multimodal export orchestration for enterprise recruitment workflows.',
        2,
      );
      firstItem.highlights = firstItem.highlights.slice(0, 2);
    }
    if (secondItem) {
      secondItem.position = '全栈工程师';
      secondItem.company = '即构科技/实时音视频事业部公司';
      secondItem.startDate = '2021-03';
      secondItem.endDate = '2022-03';
      secondItem.description = Array.from({ length: 5 }, (_, index) =>
        `负责千万级并发信令系统与实时音视频质量诊断平台建设，复现分页边界空白场景 ${index + 1}。`,
      ).join(' ');
      secondItem.highlights = Array.from({ length: 9 }, (_, index) =>
        `分页边界复现锚点 ${index + 1}：保持条目头部、技术栈标签与长段落同时出现，观察是否被整块推到下一页。`,
      );
      secondItem.technologies = [
        'Golang',
        'ELK',
        'ZooKeeper',
        'Redis',
        'Grafana',
        'ClickHouse',
        'MySQL',
        'gRPC',
        'Go Micro',
      ];
    }
  }

  if (projectSection) {
    projectSection.title = '项目经历';
  }

  return resume;
}

function createGradientPageMarginFixture(): Resume {
  const resume = createResumeFixture({
    id: 'fixture-gradient-margin',
    title: 'Gradient Page Margin Probe',
    template: 'gradient',
    fullName: 'Avery Gradient Probe',
    summaryParagraphs: 2,
    workCount: 2,
    workHighlights: 3,
    workDescriptionRepeat: 2,
    skillCategories: 5,
    skillsPerCategory: 6,
    projectCount: 3,
    certificationCount: 1,
    projectAnchor: 'Gradient Page Safe Margin Marker',
    theme: {
      margin: { top: 20, right: 20, bottom: 20, left: 20 },
      sectionSpacing: 16,
      lineSpacing: 1.5,
    },
  });

  const skillsSection = resume.sections.find((section) => section.type === 'skills');
  const projectSection = resume.sections.find((section) => section.type === 'projects');

  if (skillsSection && 'categories' in skillsSection.content) {
    skillsSection.title = '专业技能';
    skillsSection.content.categories = [
      {
        id: 'gradient-skill-performance',
        name: '性能分析与工程效能',
        skills: ['Intel VTune / Linux perf', 'Valgrind / AddressSanitizer / UBSan', 'GDB 调试'],
      },
      {
        id: 'gradient-skill-tooling',
        name: '构建与交付',
        skills: ['CMake / Makefile', 'Git / GitHub Actions', 'Linux (RHEL/Ubuntu)'],
      },
      {
        id: 'gradient-skill-backend',
        name: '后端 & 数据中间件',
        skills: ['MySQL / Redis / ClickHouse', 'Elasticsearch / ELK', 'ZooKeeper / NSQ', 'Docker / Grafana'],
      },
      {
        id: 'gradient-skill-ai',
        name: 'AI 工程化 & 算法',
        skills: ['Prompt Engineering / RAG', 'LangChain / Dify / FastAPI', 'OpenCV / Caffe / TensorFlow'],
      },
    ];
  }

  if (projectSection) {
    projectSection.title = '项目经历';
  }

  return resume;
}

export const PDF_REGRESSION_FIXTURES = {
  'modern-long-content': createResumeFixture({
    id: 'fixture-modern',
    title: 'Modern Fit Marker',
    template: 'modern',
    fullName: 'Avery Modern Regression',
    summaryParagraphs: 1,
    workCount: 2,
    workHighlights: 2,
    workDescriptionRepeat: 1,
    skillCategories: 2,
    skillsPerCategory: 4,
    projectCount: 1,
    certificationCount: 1,
    projectAnchor: 'Modern Fit Marker Project',
    theme: {
      lineSpacing: 1.6,
      sectionSpacing: 20,
      margin: { top: 28, right: 20, bottom: 28, left: 20 },
    },
  }),
  'sidebar-long-content': createResumeFixture({
    id: 'fixture-sidebar',
    title: 'Sidebar Spill Guard',
    template: 'sidebar',
    fullName: 'Avery Sidebar Regression',
    summaryParagraphs: 3,
    workCount: 3,
    workHighlights: 4,
    workDescriptionRepeat: 2,
    skillCategories: 4,
    skillsPerCategory: 5,
    projectCount: 3,
    certificationCount: 4,
    projectAnchor: 'Edge Rollout Program Marker',
    theme: {
      lineSpacing: 1.5,
      sectionSpacing: 16,
      margin: { top: 18, right: 18, bottom: 18, left: 18 },
    },
  }),
  'two-column-balanced': createResumeFixture({
    id: 'fixture-two-column',
    title: 'Systems Narrative Anchor',
    template: 'two-column',
    fullName: 'Avery Two Column',
    summaryParagraphs: 2,
    workCount: 2,
    workHighlights: 3,
    workDescriptionRepeat: 2,
    skillCategories: 3,
    skillsPerCategory: 4,
    projectCount: 2,
    certificationCount: 2,
    projectAnchor: 'Systems Narrative Anchor',
  }),
  'compact-dense': createResumeFixture({
    id: 'fixture-compact',
    title: 'Compact Density Review',
    template: 'compact',
    fullName: 'Avery Compact Review',
    summaryParagraphs: 3,
    workCount: 3,
    workHighlights: 4,
    workDescriptionRepeat: 2,
    skillCategories: 4,
    skillsPerCategory: 6,
    projectCount: 2,
    certificationCount: 3,
    projectAnchor: 'Compact Density Review Marker',
    theme: {
      fontSize: 'small',
      lineSpacing: 1.45,
      margin: { top: 16, right: 16, bottom: 16, left: 16 },
      sectionSpacing: 14,
    },
  }),
  'neon-dark-background': createResumeFixture({
    id: 'fixture-neon',
    title: 'Neon Dark Mode Portfolio',
    template: 'neon',
    fullName: 'Avery Neon Portfolio',
    summaryParagraphs: 2,
    workCount: 2,
    workHighlights: 3,
    workDescriptionRepeat: 2,
    skillCategories: 3,
    skillsPerCategory: 4,
    projectCount: 2,
    certificationCount: 2,
    projectAnchor: 'Neon Dark Mode Portfolio',
    theme: {
      primaryColor: '#22d3ee',
      accentColor: '#a78bfa',
      lineSpacing: 1.55,
    },
  }),
  'swiss-page-gap': createSwissPageGapFixture(),
  'gradient-page-margin': createGradientPageMarginFixture(),
} as const satisfies Record<string, Resume>;

export type PdfRegressionFixtureName = keyof typeof PDF_REGRESSION_FIXTURES;

export function getPdfRegressionFixture(name: PdfRegressionFixtureName): Resume {
  return structuredClone(PDF_REGRESSION_FIXTURES[name]);
}

export function listPdfRegressionFixtureNames(): PdfRegressionFixtureName[] {
  return Object.keys(PDF_REGRESSION_FIXTURES) as PdfRegressionFixtureName[];
}
