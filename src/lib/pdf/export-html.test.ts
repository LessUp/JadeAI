import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { generatePdfHtml } from '@/app/api/resume/[id]/export/builders';
import { type ResumeWithSections } from '@/app/api/resume/[id]/export/utils';
import { CHINESE_RESUME_FONT_STACK } from '@/lib/font-stacks';
import {
  getPdfRegressionFixture,
  type PdfRegressionFixtureName,
} from './__fixtures__/resume-fixtures';

const TEST_FONT_BASE_URL = 'http://jadeai.test';

interface HtmlRegressionCase {
  fixtureName: PdfRegressionFixtureName;
  expectedLength: number;
  expectedSha256: string;
  dataAttributes: Record<string, string>;
  anchors: string[];
  snippets: string[];
}

const REQUIRED_PDF_PAGINATION_SNIPPETS = [
  '@page {        size: A4;',
  '[data-section],\n       [data-pdf-entry],\n       [data-pdf-entry-header] { break-inside: auto !important; overflow: visible !important; }',
  '[data-section] [class*="space-y"] > div, .item { break-inside: avoid !important; }',
  '[data-section] [class*="space-y"] > [data-pdf-entry] { break-inside: auto !important; }',
  '.resume-export span[class*="rounded-full"] { break-inside: avoid !important; }',
  'p { orphans: 3; widows: 3; }',
];

const HTML_REGRESSION_CASES: HtmlRegressionCase[] = [
  {
    fixtureName: 'modern-long-content',
    expectedLength: 56568,
    expectedSha256: '671ed7d1b89c6a1951c99b754baef2244d6b2f63d82e3bee68ec33f37bb6ceea',
    dataAttributes: {
      'data-page-mode': 'edge-to-edge',
      'data-surface-mode': 'background',
      'data-column-mode': 'single',
      'data-outer-clone-mode': 'clone',
      'data-blank-page-prevention': 'light-shrink',
      'data-shrink-target': 'child-padding',
    },
    anchors: ['Modern Fit Marker Project'],
    snippets: [
      '--needs-padding: 0;',
      '--pdf-fragment-padding-floor: 8px;',
      '-webkit-box-decoration-break: clone;\n         box-decoration-break: clone;',
    ],
  },
  {
    fixtureName: 'sidebar-long-content',
    expectedLength: 63777,
    expectedSha256: 'e0992d518b57e1bc67ea5c2367db8c8eec5a1085981c0adccb184343717ea94f',
    dataAttributes: {
      'data-page-mode': 'edge-to-edge',
      'data-surface-mode': 'sidebar-dark',
      'data-column-mode': 'split',
      'data-outer-clone-mode': 'slice',
      'data-blank-page-prevention': 'light-shrink',
      'data-shrink-target': 'child-padding',
    },
    anchors: ['Edge Rollout Program Marker'],
    snippets: [
      'background: linear-gradient(90deg, #1e40af 35%, white 35%) !important;',
      '.resume-export > div > div:first-child',
      '-webkit-box-decoration-break: slice !important;',
    ],
  },
  {
    fixtureName: 'compact-dense',
    expectedLength: 56646,
    expectedSha256: '094be8a90bde40bb303746feb9cfe68fed03c37a9f9b0ef166bee8589835283d',
    dataAttributes: {
      'data-page-mode': 'edge-to-edge',
      'data-surface-mode': 'background',
      'data-column-mode': 'split',
      'data-outer-clone-mode': 'clone',
      'data-blank-page-prevention': 'aggressive-fit',
      'data-shrink-target': 'child-padding',
    },
    anchors: ['Compact Density Review Marker'],
    snippets: ['--needs-padding: 0;', 'data-blank-page-min-scale="92"'],
  },
  {
    fixtureName: 'neon-dark-background',
    expectedLength: 62249,
    expectedSha256: '17a5237e44e600fb19baef6d51fdd61315ed2c885e377b5e77d8be2f8acdfe9e',
    dataAttributes: {
      'data-page-mode': 'edge-to-edge',
      'data-surface-mode': 'full-dark',
      'data-column-mode': 'single',
      'data-outer-clone-mode': 'clone',
      'data-blank-page-prevention': 'aggressive-fit',
      'data-shrink-target': 'child-padding',
    },
    anchors: ['Neon Dark Mode Portfolio', '多语言导出稳定性验证'],
    snippets: [
      'html, body { background: #111827 !important;',
      '.resume-export > div > *:last-child',
      'padding: 12mm 10mm !important;',
    ],
  },
  {
    fixtureName: 'swiss-page-gap',
    expectedLength: 61762,
    expectedSha256: '2a577bc08a33464c9392b384d0274d41efb9013a421bee6f47c6a2559e3aca18',
    dataAttributes: {
      'data-page-mode': 'standard',
      'data-surface-mode': 'light',
      'data-column-mode': 'single',
      'data-outer-clone-mode': 'none',
      'data-blank-page-prevention': 'light-shrink',
      'data-shrink-target': 'outer-padding',
    },
    anchors: ['全栈工程师', '项目经历'],
    snippets: [
      'data-section-heading="wide"',
      'margin-left:-10px;margin-right:-10px;padding-left:10px;padding-right:10px',
    ],
  },
  {
    fixtureName: 'gradient-page-margin',
    expectedLength: 64958,
    expectedSha256: '6af66f72a0a44e8f7b6266a3272c5f0c273e594ec0c19f00713d6286ad97ecb0',
    dataAttributes: {
      'data-page-mode': 'edge-to-edge',
      'data-surface-mode': 'background',
      'data-column-mode': 'single',
      'data-outer-clone-mode': 'clone',
      'data-blank-page-prevention': 'light-shrink',
      'data-shrink-target': 'child-padding',
    },
    anchors: ['Gradient Page Safe Margin Marker', '后端 &amp; 数据中间件'],
    snippets: [
      'margin: 10mm 0 10mm 0;',
      '--pdf-page-margin-top: 38px;',
      '--pdf-page-margin-bottom: 38px;',
    ],
  },
];

function digestHtml(html: string): string {
  return createHash('sha256').update(html).digest('hex');
}

function assertHtmlIncludes(html: string, expected: string, message: string): void {
  assert.ok(html.includes(expected), `${message}\nMissing snippet: ${expected}`);
}

function asExportResume(resume: ReturnType<typeof getPdfRegressionFixture>): ResumeWithSections {
  return resume as unknown as ResumeWithSections;
}

test('PDF export HTML emits absolute font URLs when a font base URL is provided', async () => {
  const resume = getPdfRegressionFixture('modern-long-content');
  resume.themeConfig.fontFamily = CHINESE_RESUME_FONT_STACK;

  const html = await generatePdfHtml(asExportResume(resume), TEST_FONT_BASE_URL);

  assert.match(
    html,
    new RegExp(`${TEST_FONT_BASE_URL}/fonts/custom/resource-han-rounded-cn/ResourceHanRoundedCN-Regular\\.ttf`),
  );
  assert.match(html, /font-family: "Resource Han Rounded CN", "Noto Sans SC", "Microsoft YaHei", "PingFang SC", sans-serif !important/);
});

test('PDF export HTML is deterministic for representative long-content templates', async (t) => {
  for (const regressionCase of HTML_REGRESSION_CASES) {
    await t.test(regressionCase.fixtureName, async () => {
      const resume = getPdfRegressionFixture(regressionCase.fixtureName);
      const beforeExport = structuredClone(resume);
      const html = await generatePdfHtml(asExportResume(resume), TEST_FONT_BASE_URL);
      const secondHtml = await generatePdfHtml(
        asExportResume(getPdfRegressionFixture(regressionCase.fixtureName)),
        TEST_FONT_BASE_URL,
      );

      assert.deepEqual(resume, beforeExport, 'HTML export should not mutate fixture data');
      assert.equal(secondHtml, html, 'fresh fixture exports should be byte-for-byte stable');
      assert.equal(html.length, regressionCase.expectedLength);
      assert.equal(digestHtml(html), regressionCase.expectedSha256);

      for (const [attribute, value] of Object.entries(regressionCase.dataAttributes)) {
        assertHtmlIncludes(
          html,
          `${attribute}="${value}"`,
          `${regressionCase.fixtureName} should expose its PDF layout profile`,
        );
      }

      for (const anchor of regressionCase.anchors) {
        assertHtmlIncludes(html, anchor, `${regressionCase.fixtureName} should retain anchor content`);
      }

      for (const snippet of [...REQUIRED_PDF_PAGINATION_SNIPPETS, ...regressionCase.snippets]) {
        assertHtmlIncludes(
          html,
          snippet,
          `${regressionCase.fixtureName} should preserve export pagination CSS`,
        );
      }
    });
  }
});
