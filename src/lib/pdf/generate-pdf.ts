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

type ChromiumEnv = Partial<Record<'ALLOW_CHROMIUM_DOWNLOAD' | 'CHROME_PATH' | 'VERCEL', string | undefined>>;

type BrowserLaunchPlan =
  | { kind: 'local'; executablePath: string; args?: string[] }
  | { kind: 'download' };

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
    'No local Chrome/Chromium found. Falling back to bundled Chromium because ALLOW_CHROMIUM_DOWNLOAD=true.',
  );
}

function defaultHasAccess(executablePath: string): boolean {
  try {
    accessSync(executablePath);
    return true;
  } catch {
    return false;
  }
}

export function resolveBrowserLaunchPlan(
  env: ChromiumEnv = process.env as ChromiumEnv,
  hasAccess: (executablePath: string) => boolean = defaultHasAccess,
): BrowserLaunchPlan {
  const chromePath = env.CHROME_PATH?.trim();
  if (chromePath) {
    if (!hasAccess(chromePath)) {
      throw new Error(`CHROME_PATH points to a missing or inaccessible executable: ${chromePath}`);
    }

    return {
      kind: 'local',
      executablePath: chromePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    };
  }

  const executablePath = resolveLocalChromeExecutable(hasAccess);
  if (executablePath) {
    return { kind: 'local', executablePath };
  }

  if (env.ALLOW_CHROMIUM_DOWNLOAD === 'true') {
    return { kind: 'download' };
  }

  const environment = env.VERCEL ? 'Vercel' : 'this environment';
  throw new Error(
    `No local Chrome/Chromium executable found for PDF export in ${environment}. ` +
    'Install Chromium and set CHROME_PATH, or explicitly set ALLOW_CHROMIUM_DOWNLOAD=true to permit the runtime download fallback.',
  );
}

async function getBrowser() {
  const launchPlan = resolveBrowserLaunchPlan();

  if (launchPlan.kind === 'local') {
    return puppeteer.launch({
      executablePath: launchPlan.executablePath,
      args: launchPlan.args,
      headless: true,
    });
  }

  warnBundledChromiumFallback();
  return launchBundledChromium();
}

/**
 * tsx/esbuild 的 keepNames 会把 page.evaluate 回调内的具名函数包成
 * `__name(fn, "fn")`。回调被序列化进浏览器后没有该辅助函数，会抛
 * ReferenceError，因此在新文档创建前先注入垫片。
 */
const KEEP_NAMES_SHIM = `window.__name = (f, n) => f;`;

function patchPageForEvaluate(page: import('puppeteer-core').Page) {
  return page.evaluateOnNewDocument(KEEP_NAMES_SHIM);
}

export async function generatePdf(html: string, options: PdfOptions = {}): Promise<Buffer> {
  const browser = await getBrowser();
  try {
    const page = await browser.newPage();
    await patchPageForEvaluate(page);

    await page.setViewport({ width: A4_WIDTH_PX, height: A4_HEIGHT_PX });
    await page.emulateMediaType('print');
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
      preferCSSPageSize: true,
      scale: 1,
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
