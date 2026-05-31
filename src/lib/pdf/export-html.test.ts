import assert from 'node:assert/strict';
import test from 'node:test';

import { generatePdfHtml } from '@/app/api/resume/[id]/export/builders';
import { CHINESE_RESUME_FONT_STACK } from '@/lib/font-stacks';
import { getPdfRegressionFixture } from './__fixtures__/resume-fixtures';

const TEST_FONT_BASE_URL = 'http://jadeai.test';

test('PDF export HTML emits absolute font URLs when a font base URL is provided', async () => {
  const resume = getPdfRegressionFixture('modern-long-content');
  resume.themeConfig.fontFamily = CHINESE_RESUME_FONT_STACK;

  const html = await generatePdfHtml(resume as any, TEST_FONT_BASE_URL);

  assert.match(
    html,
    new RegExp(`${TEST_FONT_BASE_URL}/fonts/custom/resource-han-rounded-cn/ResourceHanRoundedCN-Regular\\.ttf`),
  );
  assert.match(html, /font-family: "Resource Han Rounded CN", "Noto Sans SC", "Microsoft YaHei", "PingFang SC", sans-serif !important/);
});
