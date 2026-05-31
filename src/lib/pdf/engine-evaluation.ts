import { generatePdfHtml } from '@/app/api/resume/[id]/export/builders';

import {
  getPdfRegressionFixture,
  listPdfRegressionFixtureNames,
  type PdfRegressionFixtureName,
} from './__fixtures__/resume-fixtures';
import { generatePdf } from './generate-pdf';
import type { PaginationStrategyResult } from './pagination-strategy';

export interface PdfBenchmarkInput {
  fixtureName: PdfRegressionFixtureName;
  html: string;
}

export interface PdfEngineEvaluator {
  engine: string;
  availability: 'available' | 'optional' | 'external';
  notes: string;
  renderPdf?: (html: string) => Promise<PdfRenderArtifact>;
}

export interface PdfRenderArtifact {
  pdf: Buffer;
  paginationResult?: PaginationStrategyResult;
}

const BENCHMARK_FONT_BASE_URL = 'http://jadeai.test';

async function loadOptionalModule(specifier: string): Promise<any> {
  const dynamicImport = new Function(
    'modulePath',
    'return import(modulePath);',
  ) as (modulePath: string) => Promise<any>;
  return dynamicImport(specifier);
}

export async function preparePdfBenchmarkInputs(): Promise<PdfBenchmarkInput[]> {
  const fixtureNames = listPdfRegressionFixtureNames();
  const inputs: PdfBenchmarkInput[] = [];

  for (const fixtureName of fixtureNames) {
    const resume = getPdfRegressionFixture(fixtureName);
    inputs.push({
      fixtureName,
      html: await generatePdfHtml(resume as any, BENCHMARK_FONT_BASE_URL),
    });
  }

  return inputs;
}

async function renderWithPlaywright(html: string): Promise<PdfRenderArtifact> {
  const playwright = await loadOptionalModule('playwright');
  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
    await page.emulateMedia({ media: 'print' });
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    const pdf = await page.pdf({
      format: 'A4',
      preferCSSPageSize: true,
      scale: 1,
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    return { pdf: Buffer.from(pdf) };
  } finally {
    await browser.close();
  }
}

export async function getPdfEngineEvaluators(): Promise<PdfEngineEvaluator[]> {
  const evaluators: PdfEngineEvaluator[] = [
    {
      engine: 'puppeteer',
      availability: 'available',
      notes: 'Current production renderer; baseline for page count and render time.',
      renderPdf: async (html) => {
        let paginationResult: PaginationStrategyResult | undefined;
        const pdf = await generatePdf(html, {
          onPaginationResult: (result) => {
            paginationResult = result;
          },
        });

        return { pdf, paginationResult };
      },
    },
  ];

  try {
    await loadOptionalModule('playwright');
    evaluators.push({
      engine: 'playwright',
      availability: 'optional',
      notes: 'Browser-engine parity check when Playwright is installed locally.',
      renderPdf: renderWithPlaywright,
    });
  } catch {
    evaluators.push({
      engine: 'playwright',
      availability: 'optional',
      notes: 'Install playwright to benchmark API-equivalent Chromium rendering.',
    });
  }

  evaluators.push(
    {
      engine: 'vivliostyle',
      availability: 'external',
      notes: 'Planned paged-media spike target; no renderer wired yet.',
    },
    {
      engine: 'pagedjs',
      availability: 'external',
      notes: 'Planned authoring/preview experiment; benchmark integration pending.',
    },
    {
      engine: 'princexml',
      availability: 'external',
      notes: 'Commercial quality ceiling; benchmark once license/deployment path is accepted.',
    },
  );

  return evaluators;
}
