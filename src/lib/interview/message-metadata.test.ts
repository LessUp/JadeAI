import assert from 'node:assert/strict';
import test from 'node:test';

import { mergeInterviewMessageMetadata } from './message-metadata';

test('merges partial interview message metadata without dropping existing flags', () => {
  assert.deepEqual(
    mergeInterviewMessageMetadata({ hinted: true, skipped: true }, { marked: true }),
    { hinted: true, skipped: true, marked: true },
  );
});

test('allows partial updates to unset a metadata flag', () => {
  assert.deepEqual(
    mergeInterviewMessageMetadata({ hinted: true, marked: true }, { marked: false }),
    { hinted: true, marked: false },
  );
});
