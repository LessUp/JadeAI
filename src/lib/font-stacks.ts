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

export const CODE_NEW_ROMAN_RESOURCE_HAN_STACK =
  '"CodeNewRoman Nerd Font Mono", "Resource Han Rounded CN", "Noto Sans SC", monospace, sans-serif';

export const DEFAULT_FONT_STACK = 'Inter';

export const FONT_STACK_OPTIONS = [
  { label: 'Inter', value: 'Inter' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Helvetica', value: 'Helvetica' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Palatino', value: 'Palatino' },
  { label: 'Verdana', value: 'Verdana' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Garamond', value: 'Garamond' },
  { label: 'Courier New', value: 'Courier New' },
  {
    label: 'CodeNewRoman + Resource Han Rounded CN',
    value: CODE_NEW_ROMAN_RESOURCE_HAN_STACK,
  },
] as const;

const LEGACY_FONT_STACKS: Record<string, string> = {
  Inter: 'Inter, "Noto Sans SC", sans-serif',
  Georgia: 'Georgia, "Noto Sans SC", serif',
  Helvetica: 'Helvetica, Arial, "Noto Sans SC", sans-serif',
  Arial: 'Arial, Helvetica, "Noto Sans SC", sans-serif',
  Palatino: 'Palatino, "Palatino Linotype", "Noto Sans SC", serif',
  Verdana: 'Verdana, Geneva, "Noto Sans SC", sans-serif',
  'Times New Roman': '"Times New Roman", Georgia, "Noto Sans SC", serif',
  Garamond: 'Garamond, Georgia, "Noto Sans SC", serif',
  'Courier New': '"Courier New", "Noto Sans SC", monospace',
};

function escapeFontUrl(value: string): string {
  return value.replace(/'/g, "\\'");
}

export function getEmbeddedFontFacesCss(fontBaseUrl = ''): string {
  const prefix = fontBaseUrl.replace(/\/$/, '');
  const asset = (path: string) => `${prefix}${path}`;

  return `
    @font-face {
      font-family: 'CodeNewRoman Nerd Font Mono';
      src: url('${escapeFontUrl(asset('/fonts/custom/code-new-roman/CodeNewRomanNerdFontMono-Regular.otf'))}') format('opentype');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'CodeNewRoman Nerd Font Mono';
      src: url('${escapeFontUrl(asset('/fonts/custom/code-new-roman/CodeNewRomanNerdFontMono-Bold.otf'))}') format('opentype');
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'CodeNewRoman Nerd Font Mono';
      src: url('${escapeFontUrl(asset('/fonts/custom/code-new-roman/CodeNewRomanNerdFontMono-Italic.otf'))}') format('opentype');
      font-weight: 400;
      font-style: italic;
      font-display: swap;
    }
    @font-face {
      font-family: 'Resource Han Rounded CN';
      src: url('${escapeFontUrl(asset('/fonts/custom/resource-han-rounded-cn/ResourceHanRoundedCN-Regular.ttf'))}') format('truetype');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Resource Han Rounded CN';
      src: url('${escapeFontUrl(asset('/fonts/custom/resource-han-rounded-cn/ResourceHanRoundedCN-Bold.ttf'))}') format('truetype');
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Noto Sans SC';
      src: url('${escapeFontUrl(asset('/fonts/NotoSansSC-Regular.otf'))}') format('opentype');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Noto Sans SC';
      src: url('${escapeFontUrl(asset('/fonts/NotoSansSC-Bold.otf'))}') format('opentype');
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }
  `;
}

export function resolveFontStack(fontFamily?: string): string {
  const value = fontFamily?.trim();
  if (!value) return LEGACY_FONT_STACKS[DEFAULT_FONT_STACK];
  return LEGACY_FONT_STACKS[value] || value;
}

export function splitFontFamilyStack(fontFamily?: string): string[] {
  const stack = resolveFontStack(fontFamily);
  return stack
    .split(',')
    .map((part) => part.trim())
    .map((part) => part.replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

export function resolveDocxFonts(fontFamily?: string): { west: string; east: string } {
  const families = splitFontFamilyStack(fontFamily).filter(
    (family) => !GENERIC_FAMILIES.has(family.toLowerCase())
  );

  const west = families[0] || 'Calibri';
  const east =
    families.find((family) =>
      /Han|Noto Sans SC|YaHei|HarmonyOS|GenSen|Source Han|Rounded CN/i.test(family)
    ) || 'Microsoft YaHei';

  return { west, east };
}
