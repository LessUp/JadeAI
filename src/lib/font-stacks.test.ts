import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CHINESE_RESUME_FONT_STACK,
  FONT_STACK_OPTIONS,
  resolveDocxFonts,
  resolveFontStack,
} from './font-stacks';

test('Chinese resume font stack is available for PDF and DOCX exports', () => {
  assert.ok(FONT_STACK_OPTIONS.some((option) => option.value === CHINESE_RESUME_FONT_STACK));
  assert.equal(resolveFontStack(CHINESE_RESUME_FONT_STACK), CHINESE_RESUME_FONT_STACK);
  assert.deepEqual(resolveDocxFonts(CHINESE_RESUME_FONT_STACK), {
    west: 'Resource Han Rounded CN',
    east: 'Resource Han Rounded CN',
  });
});

test('DOCX font resolution keeps Latin west font when stack mixes Chinese and generic families', () => {
  assert.deepEqual(resolveDocxFonts('sans-serif, "Noto Sans SC", Inter'), {
    west: 'Inter',
    east: 'Noto Sans SC',
  });
});

test('DOCX font resolution falls back to first non-generic family for both west/east when only one family is provided', () => {
  assert.deepEqual(resolveDocxFonts('"PingFang SC", sans-serif'), {
    west: 'PingFang SC',
    east: 'PingFang SC',
  });
});
