import assert from 'node:assert/strict';
import test from 'node:test';

import { generateHtml } from '@/app/api/resume/[id]/export/builders';
import { generatePdf } from '@/lib/pdf/generate-pdf';
import type { PaginationStrategyResult } from '@/lib/pdf/pagination-strategy';

import {
  getPdfRegressionFixture,
  type PdfRegressionFixtureName,
} from './__fixtures__/resume-fixtures';

interface PdfArtifact {
  pageCount: number;
  pages: string[];
  text: string;
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
    const buffer = await generatePdf(html, options);
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
