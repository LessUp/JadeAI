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

interface PaginationContext {
  profile: RuntimeLayoutProfile;
  sectionSpacing: number;
  lineSpacing: number;
  marginTop: number;
  marginBottom: number;
  needsPadding: boolean;
  childPaddingTop: number;
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
        shrinkTarget: (root?.dataset.shrinkTarget || (needsPadding ? 'outer-padding' : 'child-padding')) as ShrinkTarget,
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
): Promise<void> {
  const zoom = Math.max(minScalePct / 100, usableHeight / Math.max(height, 1));
  if (zoom >= 1) {
    return;
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
}

export async function fitContentToOnePage(page: Page): Promise<void> {
  await page.setViewport({ width: A4_WIDTH_PX, height: A4_HEIGHT_PX });

  const context = await readPaginationContext(page);
  const usableHeight = getUsableHeight(context);
  const initialHeight = await measureHeight(page);
  if (initialHeight <= usableHeight) {
    await applySinglePageCleanup(page);
    return;
  }

  const state: ShrinkState = {
    sectionSpacingDelta: 0,
    lineSpacingDelta: 0,
    marginDelta: 0,
    scalePct: 100,
  };

  const maxSectionDelta = Math.max(0, context.sectionSpacing - 4);
  const maxLineDelta = Math.max(0, context.lineSpacing - 1.15);
  const maxMarginDelta = getMaxMarginDelta(context);
  let stage = 1;

  for (let i = 0; i < MAX_FIT_ITERATIONS; i++) {
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
      state.scalePct = Math.max(state.scalePct - 5, context.profile.fitOnePageMinScale);
      if (state.scalePct <= context.profile.fitOnePageMinScale) {
        stage = 5;
      }
    }

    const css = buildShrinkCSS(
      state,
      context,
      context.profile.breakRuleMode === 'preserve',
    );
    await injectStyle(page, '__fit-one-page', css);
    await waitForReflow(page);

    if ((await measureHeight(page)) <= usableHeight) {
      await applySinglePageCleanup(page);
      return;
    }

    if (stage === 5) {
      break;
    }
  }

  const finalHeight = await measureHeight(page);
  if (finalHeight > usableHeight) {
    await applyFallbackZoom(
      page,
      finalHeight,
      usableHeight,
      context.profile.fitOnePageMinScale,
    );

    if ((await measureHeight(page)) <= usableHeight) {
      await applySinglePageCleanup(page);
    }
  }
}

export async function preventNearlyBlankPage(page: Page): Promise<void> {
  const context = await readPaginationContext(page);
  if (context.profile.blankPagePrevention === 'none') {
    return;
  }

  const targetHeight = getUsableHeight(context);
  const height = await measureHeight(page);
  const maxOverflow =
    context.profile.blankPagePrevention === 'aggressive-fit' ? 1.2 : 1.15;

  if (height <= targetHeight || height > targetHeight * maxOverflow) {
    return;
  }

  const state: ShrinkState = {
    sectionSpacingDelta: 0,
    lineSpacingDelta: 0,
    marginDelta: 0,
    scalePct: 100,
  };

  const maxSectionDelta = Math.max(0, context.sectionSpacing - 4);
  const maxLineDelta = Math.max(0, context.lineSpacing - 1.15);
  const maxMarginDelta = getMaxMarginDelta(context);
  const maxIterations =
    context.profile.blankPagePrevention === 'aggressive-fit' ? 20 : 12;

  let stage = 1;

  for (let i = 0; i < maxIterations; i++) {
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
      state.scalePct = Math.max(state.scalePct - 1, context.profile.blankPageMinScale);
      if (state.scalePct <= context.profile.blankPageMinScale) {
        break;
      }
    }

    await injectStyle(page, '__prevent-blank', buildShrinkCSS(state, context, true));
    await waitForReflow(page);

    if ((await measureHeight(page)) <= targetHeight) {
      await applySinglePageCleanup(page);
      return;
    }
  }

  await page.evaluate(() => {
    const style = document.getElementById('__prevent-blank');
    if (style) {
      style.remove();
    }
  });
}
