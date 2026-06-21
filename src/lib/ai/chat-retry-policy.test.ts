import assert from 'node:assert/strict';
import test from 'node:test';
import { isRetryableErrorKind } from './chat-retry-policy';

test('isRetryableErrorKind includes empty-response stream errors', () => {
  assert.equal(isRetryableErrorKind('stream'), true);
});

test('isRetryableErrorKind excludes non-retryable error kinds', () => {
  assert.equal(isRetryableErrorKind('tool'), false);
  assert.equal(isRetryableErrorKind('client_abort'), false);
  assert.equal(isRetryableErrorKind(undefined), false);
});
