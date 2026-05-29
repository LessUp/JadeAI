import { performance } from 'node:perf_hooks';

import {
  getPdfEngineEvaluators,
  preparePdfBenchmarkInputs,
} from '@/lib/pdf/engine-evaluation';

interface BenchmarkRow {
  engine: string;
  fixture: string;
  status: string;
  pageCount?: number;
  textLength?: number;
  durationMs?: number;
  notes?: string;
}

async function inspectPdf(buffer: Buffer) {
  const mupdf = await import('mupdf');
  const document = mupdf.Document.openDocument(new Uint8Array(buffer), 'application/pdf');
  const pageCount = document.countPages();
  let textLength = 0;

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const page = document.loadPage(pageIndex);
    textLength += page.toStructuredText('preserve-whitespace').asText().trim().length;
  }

  return { pageCount, textLength };
}

async function main() {
  const inputs = await preparePdfBenchmarkInputs();
  const evaluators = await getPdfEngineEvaluators();
  const rows: BenchmarkRow[] = [];

  for (const evaluator of evaluators) {
    if (!evaluator.renderPdf) {
      rows.push({
        engine: evaluator.engine,
        fixture: '*',
        status: evaluator.availability,
        notes: evaluator.notes,
      });
      continue;
    }

    for (const input of inputs) {
      const start = performance.now();
      const buffer = await evaluator.renderPdf(input.html);
      const durationMs = Number((performance.now() - start).toFixed(1));
      const { pageCount, textLength } = await inspectPdf(buffer);

      rows.push({
        engine: evaluator.engine,
        fixture: input.fixtureName,
        status: 'ok',
        pageCount,
        textLength,
        durationMs,
      });
    }
  }

  console.table(rows);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
