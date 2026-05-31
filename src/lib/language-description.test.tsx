import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Resume } from '@/types/resume';
import { ModernTemplate } from '@/components/preview/templates/modern';
import { SidebarTemplate } from '@/components/preview/templates/sidebar';
import { generateHtml } from '@/app/api/resume/[id]/export/builders';
import { buildModernHtml } from '@/app/api/resume/[id]/export/templates/modern';
import { buildSidebarHtml } from '@/app/api/resume/[id]/export/templates/sidebar';
import { generatePlainText } from '@/app/api/resume/[id]/export/plain-text';
import { generateDocxBuffer } from '@/app/api/resume/[id]/export/docx';
import { parsedResumeSchema } from '@/lib/ai/parse-schema';

function createResume(template: string): Resume {
  const now = new Date('2026-05-28T00:00:00.000Z');
  return {
    id: 'resume-1',
    userId: 'user-1',
    title: 'Test Resume',
    template,
    themeConfig: {
      primaryColor: '#111111',
      accentColor: '#ef4444',
      fontFamily: 'Inter',
      fontSize: 'medium',
      lineSpacing: 1.5,
      margin: { top: 20, right: 20, bottom: 20, left: 20 },
      sectionSpacing: 16,
      avatarStyle: 'oneInch',
    },
    isDefault: false,
    language: 'zh',
    sections: [
      {
        id: 'personal',
        resumeId: 'resume-1',
        type: 'personal_info',
        title: '个人信息',
        sortOrder: 0,
        visible: true,
        content: {
          fullName: '测试用户',
          jobTitle: '工程师',
          email: '',
          phone: '',
          location: '',
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'languages',
        resumeId: 'resume-1',
        type: 'languages',
        title: '语言能力',
        sortOrder: 1,
        visible: true,
        content: {
          items: [
            {
              id: 'lang-1',
              language: '英语',
              proficiency: '六级',
              description: '能熟练阅读英文技术文档与论文，具备基本的英文技术交流能力。',
            },
          ],
        },
        createdAt: now,
        updatedAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

test('modern preview renders language descriptions', () => {
  const html = renderToStaticMarkup(<ModernTemplate resume={createResume('modern')} />);
  assert.match(html, /能熟练阅读英文技术文档与论文/);
});

test('modern preview language descriptions are not hard-capped to 320px', () => {
  const html = renderToStaticMarkup(<ModernTemplate resume={createResume('modern')} />);
  assert.doesNotMatch(html, /max-w-\[320px\]/);
});

test('sidebar preview renders language descriptions', () => {
  const html = renderToStaticMarkup(<SidebarTemplate resume={createResume('sidebar')} />);
  assert.match(html, /能熟练阅读英文技术文档与论文/);
});

test('modern HTML export renders language descriptions', () => {
  const html = buildModernHtml(createResume('modern') as any);
  assert.match(html, /能熟练阅读英文技术文档与论文/);
});

test('modern HTML export language descriptions are not hard-capped to 320px', () => {
  const html = buildModernHtml(createResume('modern') as any);
  assert.doesNotMatch(html, /max-w-\[320px\]|max-width:320px/);
});

test('sidebar HTML export renders language descriptions', () => {
  const html = buildSidebarHtml(createResume('sidebar') as any);
  assert.match(html, /能熟练阅读英文技术文档与论文/);
});

test('generateHtml fills missing theme margin defaults for export CSS', async () => {
  const resume = createResume('classic');
  resume.themeConfig = {
    primaryColor: '#111111',
    accentColor: '#ef4444',
    fontFamily: 'Inter',
    fontSize: 'medium',
    lineSpacing: 1.5,
    margin: { top: 32 } as any,
    sectionSpacing: 16,
    avatarStyle: 'oneInch',
  };

  const html = await generateHtml(resume as any, true, 'http://jadeai.test');

  assert.match(html, /--base-margin-top: 32px;/);
  assert.match(html, /--base-margin-right: 20px;/);
  assert.match(html, /--base-margin-bottom: 20px;/);
  assert.match(html, /--base-margin-left: 20px;/);
});

test('plain-text export renders language descriptions', () => {
  const text = generatePlainText(createResume('modern') as any);
  assert.match(text, /能熟练阅读英文技术文档与论文/);
});

test('docx export renders language descriptions', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'jadeai-language-docx-'));
  try {
    const docxPath = join(tempDir, 'resume.docx');
    writeFileSync(docxPath, await generateDocxBuffer(createResume('modern') as any));
    const xml = execFileSync('unzip', ['-p', docxPath, 'word/document.xml'], { encoding: 'utf8' });
    assert.match(xml, /能熟练阅读英文技术文档与论文/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('parsed resume schema accepts language descriptions', () => {
  const parsed = parsedResumeSchema.parse({
    personalInfo: {
      fullName: '',
      jobTitle: '',
      age: '',
      gender: '',
      politicalStatus: '',
      ethnicity: '',
      hometown: '',
      maritalStatus: '',
      yearsOfExperience: '',
      educationLevel: '',
      email: '',
      phone: '',
      wechat: '',
      location: '',
      website: '',
      linkedin: '',
      github: '',
    },
    languages: [
      {
        language: '英语',
        proficiency: '六级',
        description: '能熟练阅读英文技术文档与论文，具备基本的英文技术交流能力。',
      },
    ],
  });

  assert.equal(parsed.languages?.[0]?.description, '能熟练阅读英文技术文档与论文，具备基本的英文技术交流能力。');
});
