import { resolveFontStack } from '@/lib/font-stacks';
import type { ThemeConfig } from '@/types/resume';
import { DEFAULT_THEME } from './default-theme';

const FONT_SIZES = new Set(['small', 'medium', 'large']);
const GENERIC_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'system-ui',
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
  'emoji',
  'fangsong',
  'cursive',
  'math',
]);

const FORBIDDEN_FONT_STACK_PATTERN = /[;{}]|\/\*|\*\/|url\s*\(|@import|[\r\n\\'"]/i;

type MarginSide = keyof ThemeConfig['margin'];
export type ThemeConfigInput = Partial<Omit<ThemeConfig, 'margin'>> & {
  margin?: Partial<ThemeConfig['margin']>;
};

function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;

  const trimmed = value.trim();
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(trimmed);
  if (!match) return fallback;

  const hex = match[1];
  if (hex.length === 3) {
    return `#${hex.split('').map((char) => `${char}${char}`).join('')}`.toLowerCase();
  }

  return `#${hex}`.toLowerCase();
}

function normalizeNumber(value: unknown, fallback: number, min: number, max: number): number {
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(max, Math.max(min, numberValue));
}

function splitFontStack(fontStack: string): string[] {
  return fontStack
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeFontFamilyPart(value: string): string | null {
  const family = value.replace(/^['"]|['"]$/g, '').trim();
  if (!family || FORBIDDEN_FONT_STACK_PATTERN.test(family)) return null;
  if (!/^[\p{L}\p{N}\s._-]+$/u.test(family)) return null;

  const lower = family.toLowerCase();
  if (GENERIC_FAMILIES.has(lower)) return lower;
  if (/^[A-Za-z0-9_-]+$/.test(family)) return family;
  return `"${family}"`;
}

export function normalizeFontStack(value: unknown): string {
  const fallback = resolveFontStack(DEFAULT_THEME.fontFamily);
  if (typeof value !== 'string') return fallback;

  const resolved = resolveFontStack(value);
  const parts = splitFontStack(resolved).map(normalizeFontFamilyPart);
  if (parts.length === 0 || parts.some((part) => part === null)) return fallback;

  return parts.join(', ');
}

export function normalizeThemeConfig(theme?: ThemeConfigInput | null): ThemeConfig {
  const source = theme || {};
  const marginSource: Partial<ThemeConfig['margin']> = source.margin || {};

  const margin = (['top', 'right', 'bottom', 'left'] as MarginSide[]).reduce<ThemeConfig['margin']>(
    (acc, side) => ({
      ...acc,
      [side]: normalizeNumber(marginSource[side], DEFAULT_THEME.margin[side], 0, 60),
    }),
    { ...DEFAULT_THEME.margin },
  );

  return {
    primaryColor: normalizeHexColor(source.primaryColor, DEFAULT_THEME.primaryColor),
    accentColor: normalizeHexColor(source.accentColor, DEFAULT_THEME.accentColor),
    fontFamily: normalizeFontStack(source.fontFamily),
    fontSize: typeof source.fontSize === 'string' && FONT_SIZES.has(source.fontSize)
      ? source.fontSize
      : DEFAULT_THEME.fontSize,
    lineSpacing: normalizeNumber(source.lineSpacing, DEFAULT_THEME.lineSpacing, 1, 2.5),
    margin,
    sectionSpacing: normalizeNumber(source.sectionSpacing, DEFAULT_THEME.sectionSpacing, 4, 64),
    avatarStyle: source.avatarStyle === 'circle' || source.avatarStyle === 'oneInch'
      ? source.avatarStyle
      : DEFAULT_THEME.avatarStyle,
  };
}

export function mergeThemeConfig(theme?: ThemeConfigInput | null): ThemeConfig {
  return normalizeThemeConfig({
    ...DEFAULT_THEME,
    ...theme,
    margin: {
      ...DEFAULT_THEME.margin,
      ...(theme?.margin || {}),
    },
  });
}
