import { accessSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

import {
  A4_HEIGHT_PX,
  A4_WIDTH_PX,
  applyPaginationStrategy,
  type PaginationContext,
  type PaginationStrategyResult,
} from './pagination-strategy';

const SPARTICUZ_CHROMIUM_PACK_URL =
  'https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar';
const LOCAL_CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
] as const;
let hasWarnedAboutBundledChromiumFallback = false;

interface PdfOptions {
  fitOnePage?: boolean;
  paginationContext?: PaginationContext;
  onPaginationResult?: (result: PaginationStrategyResult) => void;
}

async function launchBundledChromium() {
  const chromium = await import('@sparticuz/chromium-min');
  return puppeteer.launch({
    args: chromium.default.args,
    executablePath: await chromium.default.executablePath(SPARTICUZ_CHROMIUM_PACK_URL),
    headless: true,
  });
}

export function resolveLocalChromeExecutable(
  hasAccess: (executablePath: string) => boolean = (executablePath) => {
    try {
      accessSync(executablePath);
      return true;
    } catch {
      return false;
    }
  },
): string | null {
  for (const executablePath of LOCAL_CHROME_CANDIDATES) {
    if (hasAccess(executablePath)) {
      return executablePath;
    }
  }

  return null;
}

function warnBundledChromiumFallback() {
  if (hasWarnedAboutBundledChromiumFallback) {
    return;
  }

  hasWarnedAboutBundledChromiumFallback = true;
  console.warn(
    'No local Chrome/Chromium found. Falling back to bundled Chromium; set CHROME_PATH to avoid the runtime download.',
  );
}

async function getBrowser() {
  if (process.env.CHROME_PATH) {
    return puppeteer.launch({
      executablePath: process.env.CHROME_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      headless: true,
    });
  }

  if (process.env.VERCEL) {
    return launchBundledChromium();
  }

  const executablePath = resolveLocalChromeExecutable();
  if (executablePath) {
    return puppeteer.launch({ executablePath, headless: true });
  }

  warnBundledChromiumFallback();
  return launchBundledChromium();
}

export async function generatePdf(html: string, options: PdfOptions = {}): Promise<Buffer> {
  const browser = await getBrowser();
  try {
    const page = await browser.newPage();

    await page.setViewport({ width: A4_WIDTH_PX, height: A4_HEIGHT_PX });
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );

    await applyPaginationStrategy(page, {
      mode: options.fitOnePage ? 'fit-one-page' : 'prevent-blank-page',
      context: options.paginationContext,
      onResult: options.onPaginationResult,
    });

    const pdf = await page.pdf({
      format: 'A4',
      scale: 1,
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
