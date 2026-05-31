import assert from 'node:assert/strict';
import test from 'node:test';

import type { ResumeSection } from '@/types/resume';
import { isSectionEmpty, md } from './utils';

test('md renders summary text blocks as compact line breaks', () => {
  assert.equal(md('first block\n\nsecond block'), 'first block<br>second block');
});

test('md keeps single newlines compact inside a summary block', () => {
  assert.equal(md('first line\nsecond line'), 'first line<br>second line');
});

test('isSectionEmpty treats blank summary text blocks as empty', () => {
  const now = new Date('2026-05-31T00:00:00.000Z');
  const section: ResumeSection = {
    id: 'summary',
    resumeId: 'resume',
    type: 'summary',
    title: 'Summary',
    sortOrder: 1,
    visible: true,
    content: { text: '\n\n' },
    createdAt: now,
    updatedAt: now,
  };

  assert.equal(isSectionEmpty(section), true);
});
