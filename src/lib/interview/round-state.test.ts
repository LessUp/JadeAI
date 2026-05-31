import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldAutoStartRound } from './round-state';

const base = {
  roundId: 'round-1',
  messageCount: 0,
  isLoading: false,
  isViewingHistory: false,
  isRoundDone: false,
  loadingRoundId: null,
  lastInitRoundId: null,
};

test('auto-starts an empty active round', () => {
  assert.equal(shouldAutoStartRound(base), true);
});

test('does not auto-start while round history is loading', () => {
  assert.equal(shouldAutoStartRound({ ...base, loadingRoundId: 'round-1' }), false);
});

test('does not auto-start completed history or rounds with messages', () => {
  assert.equal(shouldAutoStartRound({ ...base, isRoundDone: true }), false);
  assert.equal(shouldAutoStartRound({ ...base, isViewingHistory: true }), false);
  assert.equal(shouldAutoStartRound({ ...base, messageCount: 1 }), false);
});

test('does not auto-start the same round twice', () => {
  assert.equal(shouldAutoStartRound({ ...base, lastInitRoundId: 'round-1' }), false);
});
