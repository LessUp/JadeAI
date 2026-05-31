import assert from 'node:assert/strict';
import test from 'node:test';

import { generateHtml } from '@/app/api/resume/[id]/export/builders';
import { generatePdf } from '@/lib/pdf/generate-pdf';
import { PDF_SAFE_PAGE_MARGIN_PX } from '@/lib/pdf/page-margins';
import type { PaginationStrategyResult } from '@/lib/pdf/pagination-strategy';

import {
  getPdfRegressionFixture,
  type PdfRegressionFixtureName,
} from './__fixtures__/resume-fixtures';

interface PdfArtifact {
  pageCount: number;
  pages: string[];
  text: string;
  paginationResult?: PaginationStrategyResult;
}

const artifactCache = new Map<string, Promise<PdfArtifact>>();

async function renderPdfArtifact(
  fixtureName: PdfRegressionFixtureName,
  options: { fitOnePage?: boolean } = {},
): Promise<PdfArtifact> {
  const key = `${fixtureName}:${options.fitOnePage ? 'fit' : 'default'}`;
  const cached = artifactCache.get(key);
  if (cached) {
    return cached;
  }

  const pending = (async () => {
    const resume = getPdfRegressionFixture(fixtureName);
    const html = await generateHtml(resume as any, true);
    let paginationResult: PaginationStrategyResult | undefined;
    const buffer = await generatePdf(html, {
      ...options,
      onPaginationResult: (result) => {
        paginationResult = result;
      },
    });
    const mupdf = await import('mupdf');
    const document = mupdf.Document.openDocument(new Uint8Array(buffer), 'application/pdf');
    const pageCount = document.countPages();
    const pages: string[] = [];

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      const page = document.loadPage(pageIndex);
      pages.push(page.toStructuredText('preserve-whitespace').asText().trim());
    }

    return {
      pageCount,
      pages,
      text: pages.join('\n').trim(),
      paginationResult,
    };
  })();

  artifactCache.set(key, pending);
  return pending;
}

test('pdf regression suite', async (t) => {
  await t.test('fitOnePage compresses modern long content onto a single page', async () => {
    const defaultArtifact = await renderPdfArtifact('modern-long-content');
    const fitArtifact = await renderPdfArtifact('modern-long-content', { fitOnePage: true });

    assert.ok(
      defaultArtifact.pageCount > 1,
      `Expected modern-long-content baseline to overflow, got ${defaultArtifact.pageCount} page(s)`,
    );
    assert.equal(fitArtifact.pageCount, 1);
    assert.match(fitArtifact.text, /Modern Fit Marker Project/);
  });

  await t.test('fitOnePage emits pagination telemetry', async () => {
    const resume = getPdfRegressionFixture('modern-long-content');
    const html = await generateHtml(resume as any, true);
    let paginationResult: PaginationStrategyResult | undefined;

    await generatePdf(html, {
      fitOnePage: true,
      onPaginationResult: (result) => {
        paginationResult = result;
      },
    });

    assert.equal(paginationResult?.mode, 'fit-one-page');
    assert.equal(paginationResult?.success, true);
    assert.ok((paginationResult?.iterations ?? 0) > 0);
    assert.ok((paginationResult?.usableHeight ?? 0) > 0);
  });

  await t.test('sidebar layout avoids a near-blank trailing page', async () => {
    const artifact = await renderPdfArtifact('sidebar-long-content');
    assert.match(artifact.text, /Edge Rollout Program Marker/);

    if (artifact.pageCount > 1) {
      assert.match(
        artifact.pages.at(-1) || '',
        /Edge Rollout Program Marker/,
        'expected the trailing page to contain real content instead of clone/sidebar artifacts',
      );
    }
  });

  await t.test('swiss layout no longer defers the marker role to the next page', async () => {
    const artifact = await renderPdfArtifact('swiss-page-gap');
    assert.ok(artifact.pageCount >= 3);
    assert.match(
      artifact.pages[0] || '',
      /全栈工程师/,
      'expected the marker role to begin before the page break instead of leaving a large trailing gap',
    );
  });

  await t.test('swiss export widens section headers for page-top fragments', async () => {
    const resume = getPdfRegressionFixture('swiss-page-gap');
    const html = await generateHtml(resume as any, true);
    assert.match(html, /data-section-heading="wide"/);
    assert.match(html, /margin-left:-10px;margin-right:-10px;padding-left:10px;padding-right:10px/);
  });

  await t.test('gradient export reserves physical page safe margins', async () => {
    const resume = getPdfRegressionFixture('gradient-page-margin');
    const html = await generateHtml(resume as any, true);

    assert.match(html, /@page \{\s*size: A4;\s*margin: 10mm 0 10mm 0;/);
    assert.match(html, new RegExp(`--pdf-page-margin-top: ${PDF_SAFE_PAGE_MARGIN_PX}px;`));
    assert.match(html, new RegExp(`--pdf-page-margin-bottom: ${PDF_SAFE_PAGE_MARGIN_PX}px;`));
    assert.match(html, /span\[class\*="rounded-full"\] \{ break-inside: avoid !important; \}/);

    const artifact = await renderPdfArtifact('gradient-page-margin');
    assert.match(artifact.text, /后端 & 数据中间件/);
    assert.match(artifact.text, /Gradient Page Safe Margin Marker/);

    assert.ok(
      (artifact.paginationResult?.usableHeight ?? Number.POSITIVE_INFINITY) <=
        1123 - PDF_SAFE_PAGE_MARGIN_PX * 2,
    );
  });

  await t.test('two-column fixture keeps extractable semantic text', async () => {
    const artifact = await renderPdfArtifact('two-column-balanced');
    assert.ok(artifact.pageCount >= 1);
    assert.match(artifact.text, /Systems Narrative Anchor/);
  });

  await t.test('compact fixture renders dense content without dropping anchors', async () => {
    const artifact = await renderPdfArtifact('compact-dense');
    assert.ok(artifact.pageCount >= 1);
    assert.match(artifact.text, /Compact Density Review Marker/);
  });

  await t.test('neon dark fixture stays text-extractable', async () => {
    const artifact = await renderPdfArtifact('neon-dark-background');
    assert.ok(artifact.pageCount >= 1);
    assert.match(artifact.text, /Neon Dark Mode Portfolio/);
    assert.match(artifact.text, /多语言导出稳定性验证/);
  });
});
