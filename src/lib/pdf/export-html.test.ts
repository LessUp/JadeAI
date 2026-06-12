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
    expectedLength: 57273,
    expectedSha256: '29cbf101fafa0634071d7755aaada4574373095baf61077e01436f59565d0322',
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
    expectedLength: 64470,
    expectedSha256: '48673addd94baf7a94a0c900b9a9b0e817abe7dc5c95878936eaeb9a0c52cab9',
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
    expectedLength: 57331,
    expectedSha256: '50ae30d0d3e28cfadc46b3cb6accff9ebf957c92fa4090e8d65e1b79d9f83556',
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
    expectedLength: 62906,
    expectedSha256: 'f1647a608ad643d8fd23f3254e11155bd5ba3acd25476c970f3d3c3075d1c255',
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
    expectedLength: 62455,
    expectedSha256: '6f281cb4643f985213e79bcb3f311bac2178034417b9532d1d3e10ac619a25cd',
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
    expectedLength: 65651,
    expectedSha256: '84c97b0f9fa7d454942bdfe6b6d4ef5c0f14175e7d98f6ce008e03c2658b59dd',
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
  assert.match(html, /"Resource Han Rounded CN", "Noto Sans SC", "Microsoft YaHei", "PingFang SC", sans-serif/);
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
