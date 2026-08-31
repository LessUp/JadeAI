import assert from 'node:assert/strict';
import test from 'node:test';

import { isResumeSectionType, normalizeResumeSectionContent, safeNormalizeResumeSectionContent } from './schema';

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

test('safeNormalizeResumeSectionContent falls back to empty content on malformed input', () => {
  // Null/primitive content that used to corrupt resumes and crash exports.
  assert.deepEqual(safeNormalizeResumeSectionContent('work_experience', null), { items: [] });
  assert.deepEqual(safeNormalizeResumeSectionContent('summary', 'a string'), { text: '' });
  assert.deepEqual(safeNormalizeResumeSectionContent('skills', 42), { categories: [] });
});

test('safeNormalizeResumeSectionContent assigns stable ids to imported items', () => {
  const normalized = safeNormalizeResumeSectionContent('work_experience', {
    items: [
      { company: 'Acme', position: 'Engineer', startDate: '2020-01', endDate: null, current: true, description: 'x', highlights: [] },
    ],
  }) as { items: { id: string; company: string }[] };

  assert.equal(normalized.items.length, 1);
  assert.equal(typeof normalized.items[0].id, 'string');
  assert.ok(normalized.items[0].id.length > 0);
});
