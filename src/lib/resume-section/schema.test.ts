import assert from 'node:assert/strict';
import test from 'node:test';

import { isResumeSectionType, normalizeResumeSectionContent } from './schema';

test('recognizes supported resume section types', () => {
  assert.equal(isResumeSectionType('work_experience'), true);
  assert.equal(isResumeSectionType('qr_codes'), true);
  assert.equal(isResumeSectionType('unknown_section'), false);
});

test('normalizes supported section content and rejects invalid payloads', () => {
  assert.deepEqual(
    normalizeResumeSectionContent('summary', { text: 'hello' }),
    { text: 'hello' },
  );

  assert.throws(
    () => normalizeResumeSectionContent('summary', { items: [] }),
  );
});

test('passes through unsupported section types without throwing', () => {
  const raw = { custom: true, payload: [1, 2, 3] };
  assert.equal(normalizeResumeSectionContent('unknown_section', raw), raw);
});
