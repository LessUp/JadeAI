import assert from 'node:assert/strict';
import test from 'node:test';

import {
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
