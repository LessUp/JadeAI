import type { Page } from 'puppeteer-core';

import type {
  BlankPagePrevention,
  BreakRuleMode,
  ColumnMode,
  OuterCloneMode,
  PageMode,
  ShrinkTarget,
  SurfaceMode,
} from './layout-profile';

export const A4_WIDTH_PX = 794;
export const A4_HEIGHT_PX = 1123;

const MAX_FIT_ITERATIONS = 20;

export type PaginationMode = 'fit-one-page' | 'prevent-blank-page';
export type PaginationResultReason =
  | 'already-fit'
  | 'fit'
  | 'no-blank-risk'
  | 'overflow-too-large'
  | 'disabled'
  | 'max-iterations';

interface ShrinkState {
  sectionSpacingDelta: number;
  lineSpacingDelta: number;
  marginDelta: number;
  scalePct: number;
}

interface RuntimeLayoutProfile {
  pageMode: PageMode;
  surfaceMode: SurfaceMode;
  columnMode: ColumnMode;
  outerCloneMode: OuterCloneMode;
  blankPagePrevention: BlankPagePrevention;
  breakRuleMode: BreakRuleMode;
  shrinkTarget: ShrinkTarget;
  fitOnePageMinScale: number;
  blankPageMinScale: number;
}

export interface PaginationContext {
  profile: RuntimeLayoutProfile;
  sectionSpacing: number;
  lineSpacing: number;
  marginTop: number;
  marginBottom: number;
  needsPadding: boolean;
  childPaddingTop: number;
}

export interface PaginationStrategyResult {
  mode: PaginationMode;
  success: boolean;
  skipped: boolean;
  reason: PaginationResultReason;
  initialHeight: number;
  finalHeight: number;
  usableHeight: number;
  iterations: number;
  stage: number;
  sectionSpacingDelta: number;
  lineSpacingDelta: number;
  marginDelta: number;
  scalePct: number;
  zoomApplied: boolean;
  styleId: string;
  cleanupApplied: boolean;
}

interface PaginationStrategyConfig {
  styleId: string;
  maxIterations: number;
  scaleStepPct: number;
  minScalePct: number;
  skipBreakRules: boolean;
  cleanupOnFailure: boolean;
  overflowGuard: number | null;
  allowZoom: boolean;
  disabledReason: PaginationResultReason | null;
}

export interface ApplyPaginationStrategyOptions {
  mode: PaginationMode;
  context?: PaginationContext;
  onResult?: (result: PaginationStrategyResult) => void;
}

function buildShrinkCSS(
  state: ShrinkState,
  context: PaginationContext,
  skipBreakRules: boolean,
): string {
  const sel = '.resume-export';
  const rules: string[] = [];

  if (!skipBreakRules) {
    rules.push(`
      ${sel} > div,
      ${sel} [data-section],
      ${sel} [data-section] *,
      ${sel} .item,
      ${sel} .rounded-lg,
      ${sel} .border-l-2,
      ${sel} ul, ${sel} ol {
        break-inside: auto !important;
        overflow: visible !important;
      }
      ${sel} h2, ${sel} h3 {
        break-after: auto !important;
      }
    `);
  }

  if (state.sectionSpacingDelta > 0) {
    rules.push(`
      ${sel} [data-section] {
        margin-bottom: calc(var(--base-section-spacing) - ${state.sectionSpacingDelta}px) !important;
        padding-bottom: calc(var(--base-section-spacing) - ${state.sectionSpacingDelta}px) !important;
      }
    `);
  }

  if (state.lineSpacingDelta > 0) {
    const delta = state.lineSpacingDelta.toFixed(2);
    rules.push(`
      ${sel} > div { line-height: calc(var(--base-line-spacing) - ${delta}) !important; }
      ${sel} p, ${sel} li, ${sel} span:not(.shrink-0), ${sel} td, ${sel} a {
        line-height: calc(var(--base-line-spacing) - ${delta}) !important;
      }
    `);
  }

  if (state.marginDelta > 0) {
    if (context.profile.shrinkTarget === 'child-padding') {
      const paddingTop = Math.max(8, context.childPaddingTop - state.marginDelta);
      rules.push(`
        ${sel} > div > div {
          padding-top: ${paddingTop}px !important;
          padding-bottom: ${paddingTop}px !important;
        }
      `);
    } else {
      rules.push(`
        ${sel} > div {
          padding-left: calc(var(--base-margin-left) - ${state.marginDelta}px) !important;
          padding-right: calc(var(--base-margin-right) - ${state.marginDelta}px) !important;
        }
      `);
    }
  }

  if (state.scalePct < 100) {
    const factor = (state.scalePct / 100).toFixed(3);
    rules.push(`
      ${sel} p, ${sel} li, ${sel} span:not(.shrink-0), ${sel} td, ${sel} a {
        font-size: calc(var(--base-body-size) * ${factor}) !important;
      }
      ${sel} h1 { font-size: calc(var(--base-h1-size) * ${factor}) !important; }
      ${sel} h2 { font-size: calc(var(--base-h2-size) * ${factor}) !important; }
      ${sel} h3 { font-size: calc(var(--base-h3-size) * ${factor}) !important; }
    `);
  }

  return rules.join('\n');
}

async function measureHeight(page: Page): Promise<number> {
  return page.evaluate(() => {
    const el = document.querySelector('.resume-export');
    if (!el) {
      return 0;
    }
    return el.scrollHeight;
  });
}

async function readPaginationContext(page: Page): Promise<PaginationContext> {
  return page.evaluate(() => {
    const root = document.querySelector('.resume-export') as HTMLElement | null;
    const container = document.querySelector('.resume-export > div') as HTMLElement | null;
    const computed = container ? getComputedStyle(container) : null;
    const needsPadding = computed?.getPropertyValue('--needs-padding')?.trim() === '1';
    const child = container?.querySelector(':scope > div') as HTMLElement | null;
    const childPaddingTop = child ? parseFloat(getComputedStyle(child).paddingTop) || 0 : 0;

    return {
      profile: {
        pageMode: (root?.dataset.pageMode || 'standard') as PageMode,
        surfaceMode: (root?.dataset.surfaceMode || 'light') as SurfaceMode,
        columnMode: (root?.dataset.columnMode || 'single') as ColumnMode,
        outerCloneMode: (root?.dataset.outerCloneMode || 'none') as OuterCloneMode,
        blankPagePrevention: (root?.dataset.blankPagePrevention || 'light-shrink') as BlankPagePrevention,
        breakRuleMode: (root?.dataset.breakRuleMode || 'allow-override') as BreakRuleMode,
        shrinkTarget: (root?.dataset.shrinkTarget ||
          (needsPadding ? 'outer-padding' : 'child-padding')) as ShrinkTarget,
        fitOnePageMinScale: Number(root?.dataset.fitOnePageMinScale || '80'),
        blankPageMinScale: Number(root?.dataset.blankPageMinScale || '95'),
      },
      sectionSpacing: computed ? parseFloat(computed.getPropertyValue('--base-section-spacing')) || 16 : 16,
      lineSpacing: computed ? parseFloat(computed.getPropertyValue('--base-line-spacing')) || 1.5 : 1.5,
      marginTop: computed ? parseFloat(computed.getPropertyValue('--base-margin-top')) || 20 : 20,
      marginBottom: computed ? parseFloat(computed.getPropertyValue('--base-margin-bottom')) || 20 : 20,
      needsPadding,
      childPaddingTop,
    };
  });
}

function getUsableHeight(context: PaginationContext): number {
  return context.needsPadding
    ? A4_HEIGHT_PX - context.marginTop - context.marginBottom
    : A4_HEIGHT_PX;
}

function getMaxMarginDelta(context: PaginationContext): number {
  if (context.profile.shrinkTarget === 'child-padding') {
    return Math.max(0, Math.round(context.childPaddingTop - 8));
  }

  return Math.max(0, context.marginTop - 8);
}

async function injectStyle(page: Page, id: string, css: string): Promise<void> {
  await page.evaluate(
    ({ styleId, cssText }) => {
      let styleEl = document.getElementById(styleId);
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = cssText;
    },
    { styleId: id, cssText: css },
  );
}

async function waitForReflow(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function applySinglePageCleanup(page: Page): Promise<void> {
  await injectStyle(
    page,
    '__no-clone',
    `
      .resume-export > div,
      .resume-export > div > div {
        -webkit-box-decoration-break: slice !important;
        box-decoration-break: slice !important;
      }
    `,
  );
}

async function applyFallbackZoom(
  page: Page,
  height: number,
  usableHeight: number,
  minScalePct: number,
): Promise<boolean> {
  const zoom = Math.max(minScalePct / 100, usableHeight / Math.max(height, 1));
  if (zoom >= 1) {
    return true;
  }

  await injectStyle(
    page,
    '__fit-one-page-zoom',
    `
      .resume-export > div {
        zoom: ${zoom.toFixed(3)};
      }
    `,
  );
  await waitForReflow(page);
  return (await measureHeight(page)) <= usableHeight;
}

export function resolvePaginationStrategyConfig(
  mode: PaginationMode,
  context: PaginationContext,
): PaginationStrategyConfig {
  if (mode === 'fit-one-page') {
    return {
      styleId: '__fit-one-page',
      maxIterations: MAX_FIT_ITERATIONS,
      scaleStepPct: 5,
      minScalePct: context.profile.fitOnePageMinScale,
      skipBreakRules: context.profile.breakRuleMode === 'preserve',
      cleanupOnFailure: false,
      overflowGuard: null,
      allowZoom: true,
      disabledReason: null,
    };
  }

  if (context.profile.blankPagePrevention === 'none') {
    return {
      styleId: '__prevent-blank',
      maxIterations: 0,
      scaleStepPct: 1,
      minScalePct: context.profile.blankPageMinScale,
      skipBreakRules: true,
      cleanupOnFailure: true,
      overflowGuard: null,
      allowZoom: false,
      disabledReason: 'disabled',
    };
  }

  return {
    styleId: '__prevent-blank',
    maxIterations:
      context.profile.blankPagePrevention === 'aggressive-fit' ? 20 : 12,
    scaleStepPct: 1,
    minScalePct: context.profile.blankPageMinScale,
    skipBreakRules: true,
    cleanupOnFailure: true,
    overflowGuard: context.profile.blankPagePrevention === 'aggressive-fit' ? 1.2 : 1.15,
    allowZoom: false,
    disabledReason: null,
  };
}

function buildResult(
  mode: PaginationMode,
  config: PaginationStrategyConfig,
  state: ShrinkState,
  initialHeight: number,
  finalHeight: number,
  usableHeight: number,
  iterations: number,
  stage: number,
  success: boolean,
  skipped: boolean,
  reason: PaginationResultReason,
  zoomApplied: boolean,
  cleanupApplied: boolean,
): PaginationStrategyResult {
  return {
    mode,
    success,
    skipped,
    reason,
    initialHeight,
    finalHeight,
    usableHeight,
    iterations,
    stage,
    sectionSpacingDelta: state.sectionSpacingDelta,
    lineSpacingDelta: state.lineSpacingDelta,
    marginDelta: state.marginDelta,
    scalePct: state.scalePct,
    zoomApplied,
    styleId: config.styleId,
    cleanupApplied,
  };
}

function emitResult(
  options: ApplyPaginationStrategyOptions,
  result: PaginationStrategyResult,
): PaginationStrategyResult {
  options.onResult?.(result);
  return result;
}

export async function applyPaginationStrategy(
  page: Page,
  options: ApplyPaginationStrategyOptions,
): Promise<PaginationStrategyResult> {
  await page.setViewport({ width: A4_WIDTH_PX, height: A4_HEIGHT_PX });

  const context = options.context ?? (await readPaginationContext(page));
  const config = resolvePaginationStrategyConfig(options.mode, context);
  const usableHeight = getUsableHeight(context);
  const initialHeight = await measureHeight(page);
  const state: ShrinkState = {
    sectionSpacingDelta: 0,
    lineSpacingDelta: 0,
    marginDelta: 0,
    scalePct: 100,
  };

  if (config.disabledReason) {
    return emitResult(
      options,
      buildResult(
        options.mode,
        config,
        state,
        initialHeight,
        initialHeight,
        usableHeight,
        0,
        0,
        false,
        true,
        config.disabledReason,
        false,
        false,
      ),
    );
  }

  if (options.mode === 'fit-one-page' && initialHeight <= usableHeight) {
    await applySinglePageCleanup(page);
    return emitResult(
      options,
      buildResult(
        options.mode,
        config,
        state,
        initialHeight,
        initialHeight,
        usableHeight,
        0,
        0,
        true,
        true,
        'already-fit',
        false,
        true,
      ),
    );
  }

  if (options.mode === 'prevent-blank-page') {
    if (initialHeight <= usableHeight) {
      return emitResult(
        options,
        buildResult(
          options.mode,
          config,
          state,
          initialHeight,
          initialHeight,
          usableHeight,
          0,
          0,
          false,
          true,
          'no-blank-risk',
          false,
          false,
        ),
      );
    }

    if (config.overflowGuard && initialHeight > usableHeight * config.overflowGuard) {
      return emitResult(
        options,
        buildResult(
          options.mode,
          config,
          state,
          initialHeight,
          initialHeight,
          usableHeight,
          0,
          0,
          false,
          true,
          'overflow-too-large',
          false,
          false,
        ),
      );
    }
  }

  const maxSectionDelta = Math.max(0, context.sectionSpacing - 4);
  const maxLineDelta = Math.max(0, context.lineSpacing - 1.15);
  const maxMarginDelta = getMaxMarginDelta(context);
  let stage = 1;
  let iterations = 0;

  for (let iteration = 1; iteration <= config.maxIterations; iteration += 1) {
    iterations = iteration;
    if (stage === 1) {
      state.sectionSpacingDelta = Math.min(state.sectionSpacingDelta + 4, maxSectionDelta);
      if (state.sectionSpacingDelta >= maxSectionDelta) {
        stage = 2;
      }
    } else if (stage === 2) {
      state.lineSpacingDelta = Math.min(
        +(state.lineSpacingDelta + 0.1).toFixed(2),
        +maxLineDelta.toFixed(2),
      );
      if (state.lineSpacingDelta >= +maxLineDelta.toFixed(2)) {
        stage = 3;
      }
    } else if (stage === 3) {
      state.marginDelta = Math.min(state.marginDelta + 4, maxMarginDelta);
      if (state.marginDelta >= maxMarginDelta) {
        stage = 4;
      }
    } else if (stage === 4) {
      state.scalePct = Math.max(state.scalePct - config.scaleStepPct, config.minScalePct);
      if (state.scalePct <= config.minScalePct) {
        stage = 5;
      }
    }

    await injectStyle(page, config.styleId, buildShrinkCSS(state, context, config.skipBreakRules));
    await waitForReflow(page);

    const height = await measureHeight(page);
    if (height <= usableHeight) {
      await applySinglePageCleanup(page);
      return emitResult(
        options,
        buildResult(
          options.mode,
          config,
          state,
          initialHeight,
          height,
          usableHeight,
          iterations,
          stage,
          true,
          false,
          'fit',
          false,
          true,
        ),
      );
    }

    if (stage === 5) {
      break;
    }
  }

  if (config.allowZoom) {
    const finalHeight = await measureHeight(page);
    const zoomSuccess = await applyFallbackZoom(
      page,
      finalHeight,
      usableHeight,
      config.minScalePct,
    );
    const zoomedHeight = await measureHeight(page);
    if (zoomSuccess) {
      await applySinglePageCleanup(page);
      return emitResult(
        options,
        buildResult(
          options.mode,
          config,
          state,
          initialHeight,
          zoomedHeight,
          usableHeight,
          iterations,
          stage,
          true,
          false,
          'fit',
          true,
          true,
        ),
      );
    }
  }

  if (config.cleanupOnFailure) {
    await page.evaluate((styleId) => {
      document.getElementById(styleId)?.remove();
    }, config.styleId);
  }

  const finalHeight = await measureHeight(page);
  return emitResult(
    options,
    buildResult(
      options.mode,
      config,
      state,
      initialHeight,
      finalHeight,
      usableHeight,
      iterations,
      stage,
      false,
      false,
      'max-iterations',
      false,
      config.cleanupOnFailure,
    ),
  );
}
