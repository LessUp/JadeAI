import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getUsableHeight,
  resolvePaginationTargetPlan,
  resolvePaginationStrategyConfig,
  type PaginationContext,
} from './pagination-strategy';

function createContext(
  overrides: Partial<PaginationContext['profile']> = {},
): PaginationContext {
  return {
    profile: {
      pageMode: 'standard',
      surfaceMode: 'light',
      columnMode: 'single',
      blankPagePrevention: 'light-shrink',
      fitOnePageMinScale: 55,
      blankPageMinScale: 85,
      breakRuleMode: 'allow-override',
      outerCloneMode: 'none',
      shrinkTarget: 'outer-padding',
      ...overrides,
    },
    needsPadding: true,
    sectionSpacing: 16,
    lineSpacing: 1.5,
    marginTop: 20,
    marginBottom: 20,
    childPaddingTop: 20,
  };
}

test('resolvePaginationStrategyConfig returns fit-one-page settings', () => {
  const config = resolvePaginationStrategyConfig('fit-one-page', createContext());

  assert.equal(config.styleId, '__fit-one-page');
  assert.equal(config.maxIterations, 20);
  assert.equal(config.scaleStepPct, 5);
  assert.equal(config.allowZoom, true);
  assert.equal(config.cleanupOnFailure, false);
});

test('resolvePaginationStrategyConfig returns aggressive blank-page settings', () => {
  const config = resolvePaginationStrategyConfig(
    'prevent-blank-page',
    createContext({ blankPagePrevention: 'aggressive-fit' }),
  );

  assert.equal(config.styleId, '__prevent-blank');
  assert.equal(config.maxIterations, 20);
  assert.equal(config.scaleStepPct, 1);
  assert.equal(config.overflowGuard, 1.2);
  assert.equal(config.cleanupOnFailure, true);
});

test('resolvePaginationStrategyConfig disables blank-page mode when prevention is off', () => {
  const config = resolvePaginationStrategyConfig(
    'prevent-blank-page',
    createContext({ blankPagePrevention: 'none' }),
  );

  assert.equal(config.disabledReason, 'disabled');
  assert.equal(config.maxIterations, 0);
});

test('getUsableHeight models standard PDF page margins even without CSS padding', () => {
  assert.equal(getUsableHeight(createContext({ pageMode: 'standard' })), 1083);
  assert.equal(
    getUsableHeight({
      ...createContext({ pageMode: 'standard' }),
      needsPadding: false,
    }),
    1083,
  );
  assert.equal(
    getUsableHeight({
      ...createContext({ pageMode: 'edge-to-edge' }),
      needsPadding: false,
    }),
    1123,
  );
});

test('resolvePaginationTargetPlan packs a small multi-page trailing fragment', () => {
  const context = createContext();
  const config = resolvePaginationStrategyConfig('prevent-blank-page', context);
  const plan = resolvePaginationTargetPlan('prevent-blank-page', 2080, 1000, context, config);

  assert.equal(plan.estimatedPageCount, 3);
  assert.equal(plan.targetPageCount, 2);
  assert.equal(plan.trailingFragmentHeight, 80);
  assert.equal(plan.trailingFragmentRatio, 0.08);
  assert.equal(plan.targetHeight, 1952);
  assert.equal(plan.skipReason, null);
});

test('resolvePaginationTargetPlan skips large trailing fragments as normal content', () => {
  const context = createContext();
  const config = resolvePaginationStrategyConfig('prevent-blank-page', context);
  const plan = resolvePaginationTargetPlan('prevent-blank-page', 2500, 1000, context, config);

  assert.equal(plan.estimatedPageCount, 3);
  assert.equal(plan.targetPageCount, 2);
  assert.equal(plan.trailingFragmentHeight, 500);
  assert.equal(plan.skipReason, 'no-blank-risk');
});

test('resolvePaginationTargetPlan lets aggressive profiles pack larger absolute fragments', () => {
  const lightContext = createContext();
  const lightConfig = resolvePaginationStrategyConfig('prevent-blank-page', lightContext);
  const lightPlan = resolvePaginationTargetPlan(
    'prevent-blank-page',
    2210,
    1000,
    lightContext,
    lightConfig,
  );

  const aggressiveContext = createContext({ blankPagePrevention: 'aggressive-fit' });
  const aggressiveConfig = resolvePaginationStrategyConfig(
    'prevent-blank-page',
    aggressiveContext,
  );
  const aggressivePlan = resolvePaginationTargetPlan(
    'prevent-blank-page',
    2210,
    1000,
    aggressiveContext,
    aggressiveConfig,
  );

  assert.equal(lightPlan.skipReason, 'no-blank-risk');
  assert.equal(aggressivePlan.skipReason, null);
});
