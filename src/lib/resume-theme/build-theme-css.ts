import { BACKGROUND_TEMPLATES } from '@/lib/constants';
import { resolveFontStack } from '@/lib/font-stacks';
import type { ThemeConfig } from '@/types/resume';

const FONT_SIZE_SCALE: Record<string, { body: string; h1: string; h2: string; h3: string }> = {
  small: { body: '12px', h1: '22px', h2: '15px', h3: '13px' },
  medium: { body: '14px', h1: '26px', h2: '17px', h3: '15px' },
  large: { body: '16px', h1: '30px', h2: '19px', h3: '17px' },
};

export const DEFAULT_THEME: ThemeConfig = {
  primaryColor: '#1a1a1a',
  accentColor: '#3b82f6',
  fontFamily: 'Inter',
  fontSize: 'medium',
  lineSpacing: 1.5,
  margin: { top: 20, right: 20, bottom: 20, left: 20 },
  sectionSpacing: 16,
  avatarStyle: 'oneInch',
};

interface BuildThemeCssOptions {
  selector: string;
  template: string;
  theme: ThemeConfig;
  includeNeedsPadding?: boolean;
}

function isDark(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b < 0.4;
}

export function mergeThemeConfig(theme?: Partial<ThemeConfig> | null): ThemeConfig {
  return {
    ...DEFAULT_THEME,
    ...theme,
    margin: {
      ...DEFAULT_THEME.margin,
      ...(theme?.margin || {}),
    },
  };
}

export function buildThemeCss({
  selector,
  template,
  theme,
  includeNeedsPadding = true,
}: BuildThemeCssOptions): string {
  const fs = FONT_SIZE_SCALE[theme.fontSize] || FONT_SIZE_SCALE.medium;
  const margin = theme.margin;
  const needsPadding = !BACKGROUND_TEMPLATES.has(template);
  const primaryIsDark = isDark(theme.primaryColor);
  const fontStack = resolveFontStack(theme.fontFamily);
  const needsPaddingCss = includeNeedsPadding ? `--needs-padding: ${needsPadding ? '1' : '0'};` : '';

  return `
    ${selector}, ${selector} * {
      font-family: ${fontStack} !important;
    }
    ${selector} > div {
      line-height: ${theme.lineSpacing} !important;
      ${needsPadding ? `padding-top: ${margin.top}px !important; padding-right: ${margin.right}px !important; padding-bottom: ${margin.bottom}px !important; padding-left: ${margin.left}px !important;` : ''}
      --base-body-size: ${fs.body};
      --base-h1-size: ${fs.h1};
      --base-h2-size: ${fs.h2};
      --base-h3-size: ${fs.h3};
      --base-line-spacing: ${theme.lineSpacing};
      --base-section-spacing: ${theme.sectionSpacing}px;
      --base-margin-top: ${margin.top}px;
      --base-margin-right: ${margin.right}px;
      --base-margin-bottom: ${margin.bottom}px;
      --base-margin-left: ${margin.left}px;
      ${needsPaddingCss}
    }
    ${selector} p, ${selector} li, ${selector} span, ${selector} td, ${selector} a, ${selector} div {
      font-size: ${fs.body} !important;
      line-height: ${theme.lineSpacing} !important;
    }
    ${selector} h1:not([style*="color"]) { color: ${theme.primaryColor} !important; font-size: ${fs.h1} !important; line-height: ${theme.lineSpacing} !important; }
    ${selector} h1[style*="color"] { font-size: ${fs.h1} !important; line-height: ${theme.lineSpacing} !important; }
    ${selector} h2:not([style*="color"]) { color: ${theme.primaryColor} !important; font-size: ${fs.h2} !important; line-height: ${theme.lineSpacing} !important; border-color: ${theme.accentColor} !important; }
    ${selector} h2[style*="color"] { font-size: ${fs.h2} !important; line-height: ${theme.lineSpacing} !important; border-color: ${theme.accentColor} !important; }
    ${selector} h3:not([style*="color"]) { color: ${theme.primaryColor} !important; font-size: ${fs.h3} !important; line-height: ${theme.lineSpacing} !important; }
    ${selector} h3[style*="color"] { font-size: ${fs.h3} !important; line-height: ${theme.lineSpacing} !important; }
    ${selector} [class*="border-b-2"], ${selector} [class*="border-b-"] { border-color: ${theme.accentColor} !important; }
    ${selector} [class*="bg-blue-"], ${selector} [class*="bg-indigo-"],
    ${selector} [class*="bg-slate-800"], ${selector} [class*="bg-zinc-800"],
    ${selector} [class*="bg-teal-"], ${selector} [class*="bg-emerald-"] {
      background-color: ${theme.accentColor} !important;
    }
    ${selector} [data-section] { ${needsPadding ? `margin-bottom: ${theme.sectionSpacing}px` : `padding-bottom: ${theme.sectionSpacing}px`} !important; }
    ${primaryIsDark ? `
    ${selector} [style*="background"][style*="#"] h1:not([style*="color"]),
    ${selector} [style*="background"][style*="#"] h2:not([style*="color"]),
    ${selector} [style*="background"][style*="#"] h3:not([style*="color"]),
    ${selector} [style*="background"][style*="rgb"] h1:not([style*="color"]),
    ${selector} [style*="background"][style*="rgb"] h2:not([style*="color"]),
    ${selector} [style*="background"][style*="rgb"] h3:not([style*="color"]),
    ${selector} [style*="background"][style*="linear-gradient"] h1:not([style*="color"]),
    ${selector} [style*="background"][style*="linear-gradient"] h2:not([style*="color"]),
    ${selector} [style*="background"][style*="linear-gradient"] h3:not([style*="color"]),
    ${selector} .bg-black h1:not([style*="color"]),
    ${selector} .bg-black h2:not([style*="color"]),
    ${selector} .bg-black h3:not([style*="color"]) {
      color: #ffffff !important;
    }` : ''}
  `;
}
