import assert from 'node:assert/strict';
import test from 'node:test';
import { generateHtml } from '@/app/api/resume/[id]/export/builders';
import { getPdfRegressionFixture, PDF_REGRESSION_FIXTURE_NAMES, type PdfRegressionFixtureName } from '@/lib/pdf/__fixtures__/resume-fixtures';
import { generatePdf } from '@/lib/pdf/generate-pdf';

interface RenderedPdfArtifact {
  buffer: Buffer;
  pageCount: number;
  pageTexts: string[];
  text: string;
}

const artifactCache = new Map<string, Promise<RenderedPdfArtifact>>();

function cacheKey(name: PdfRegressionFixtureName, fitOnePage: boolean): string {
  return `${name}:${fitOnePage ? 'fit' : 'default'}`;
}

async function readPdfArtifact(buffer: Buffer): Promise<RenderedPdfArtifact> {
  const mupdf = await import('mupdf');
  const doc = mupdf.Document.openDocument(new Uint8Array(buffer), 'application/pdf');
  const pageTexts = Array.from({ length: doc.countPages() }, (_, index) =>
    doc.loadPage(index).toStructuredText('preserve-whitespace').asText().replace(/\s+/g, ' ').trim(),
  );

  return {
    buffer,
    pageCount: doc.countPages(),
    pageTexts,
    text: pageTexts.join('\n').trim(),
  };
}

async function renderFixture(name: PdfRegressionFixtureName, fitOnePage = false): Promise<RenderedPdfArtifact> {
  const key = cacheKey(name, fitOnePage);
  const cached = artifactCache.get(key);
  if (cached) return cached;

  const promise = (async () => {
    const fixture = getPdfRegressionFixture(name);
    const html = await generateHtml(fixture.resume, true);
    const buffer = await generatePdf(html, { fitOnePage });
    return readPdfArtifact(buffer);
  })();

  artifactCache.set(key, promise);
  return promise;
}

test('PDF regression fixtures generate PDFs with extractable anchor text', async (t) => {
  for (const fixtureName of PDF_REGRESSION_FIXTURE_NAMES) {
    await t.test(fixtureName, async () => {
      const fixture = getPdfRegressionFixture(fixtureName);
      const artifact = await renderFixture(fixtureName);

      assert.ok(artifact.buffer.length > 0, 'expected non-empty PDF buffer');
      assert.ok(artifact.pageCount >= 1, 'expected at least one PDF page');
      assert.match(artifact.text, new RegExp(fixture.anchorText));
    });
  }
});

test('fitOnePage keeps modern-long-content on a single page', async () => {
  const artifact = await renderFixture('modern-long-content', true);
  assert.equal(artifact.pageCount, 1, `expected 1 page, received ${artifact.pageCount}`);
});

test('sidebar-long-content avoids a nearly blank trailing page by default', async () => {
  const artifact = await renderFixture('sidebar-long-content');
  const trailingPageText = artifact.pageTexts.at(-1) ?? '';

  assert.ok(
    artifact.pageCount === 1 || trailingPageText.length >= 160,
    `expected either a single page or substantial trailing content, received ${artifact.pageCount} pages with trailing text length ${trailingPageText.length}`,
  );
});

test('neon-dark-background remains text-extractable in MuPDF', async () => {
  const artifact = await renderFixture('neon-dark-background');
  assert.match(artifact.text, /NEON_DARK_BACKGROUND_SIGNAL/);
});
