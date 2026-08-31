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

test('md inserts a line break after a line ending in inline markup', () => {
  // Regression: a line ending in </strong> used to swallow the next line's <br>.
  assert.equal(
    md('**Bold line**\nSecond line'),
    '<strong>Bold line</strong><br>Second line'
  );
});

test('md still skips the line break after a block-level tag', () => {
  assert.equal(md('first line\nsecond line'), 'first line<br>second line');
  assert.equal(md('text\n- item'), 'text<ul style="margin:2px 0;padding-left:1.5em;list-style-type:disc"><li>item</li></ul>');
});

test('isSectionEmpty treats null content as empty instead of crashing', () => {
  const now = new Date('2026-05-31T00:00:00.000Z');
  const section: ResumeSection = {
    id: 'work',
    resumeId: 'resume',
    type: 'work_experience',
    title: 'Work',
    sortOrder: 1,
    visible: true,
    content: null as unknown as ResumeSection['content'],
    createdAt: now,
    updatedAt: now,
  };

  assert.equal(isSectionEmpty(section), true);
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
