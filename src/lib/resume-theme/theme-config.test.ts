import assert from 'node:assert/strict';
import test from 'node:test';

import { CHINESE_RESUME_FONT_STACK } from '@/lib/font-stacks';
import { buildThemeCss } from './build-theme-css';
import { DEFAULT_THEME } from './default-theme';
import { mergeThemeConfig, normalizeFontStack } from './theme-config';

test('normalizes theme colors, numbers, and font stacks', () => {
  const theme = mergeThemeConfig({
    primaryColor: '#ABC',
    accentColor: 'not-a-color',
    fontFamily: CHINESE_RESUME_FONT_STACK,
    fontSize: 'giant',
    lineSpacing: Number.POSITIVE_INFINITY,
    margin: { top: -10, right: 100, bottom: Number.NaN, left: 12 },
    sectionSpacing: 100,
  });

  assert.equal(theme.primaryColor, '#aabbcc');
  assert.equal(theme.accentColor, DEFAULT_THEME.accentColor);
  assert.equal(theme.fontFamily, CHINESE_RESUME_FONT_STACK);
  assert.equal(theme.fontSize, DEFAULT_THEME.fontSize);
  assert.equal(theme.lineSpacing, DEFAULT_THEME.lineSpacing);
  assert.deepEqual(theme.margin, { top: 0, right: 60, bottom: 20, left: 12 });
  assert.equal(theme.sectionSpacing, 64);
});

test('rejects font stacks that can break out of CSS declarations', () => {
  const fallback = normalizeFontStack(DEFAULT_THEME.fontFamily);

  assert.equal(normalizeFontStack('Inter; color:red'), fallback);
  assert.equal(normalizeFontStack('Inter, url(https://example.com/font.woff2)'), 'Inter');
  assert.equal(normalizeFontStack('Inter /* comment */'), fallback);
  assert.equal(normalizeFontStack('Inter } body { display:none'), fallback);
});

test('normalizes font stacks token-by-token and keeps valid families', () => {
  const fallback = normalizeFontStack(DEFAULT_THEME.fontFamily);

  assert.equal(
    normalizeFontStack('"Inter", "Noto Sans SC", sans-serif'),
    'Inter, "Noto Sans SC", sans-serif',
  );
  assert.equal(
    normalizeFontStack('sans-serif, "Noto Sans SC", "Inter", url(https://bad.font)'),
    'sans-serif, "Noto Sans SC", Inter',
  );
  assert.equal(normalizeFontStack('url(https://bad.font), ;;;'), fallback);
});

test('buildThemeCss only emits normalized theme values', () => {
  const css = buildThemeCss({
    selector: '.resume',
    template: 'classic',
    theme: {
      ...DEFAULT_THEME,
      primaryColor: '#bad-input',
      accentColor: '#DEF',
      fontFamily: 'Inter; color:red',
      lineSpacing: Number.NaN,
      margin: { top: -1, right: 999, bottom: 20, left: 20 },
      sectionSpacing: 999,
    },
  });

  assert.match(css, /color: #1a1a1a !important/);
  assert.match(css, /border-color: #ddeeff !important/);
  assert.doesNotMatch(css, /color:red/);
  assert.match(css, /font-family: Inter, "Noto Sans SC", sans-serif !important/);
  assert.match(css, /padding-top: 0px !important/);
  assert.match(css, /padding-right: 60px !important/);
  assert.match(css, /--base-section-spacing: 64px/);
});
