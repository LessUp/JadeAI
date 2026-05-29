import { BACKGROUND_TEMPLATES, TWO_COLUMN_TEMPLATES } from '@/lib/constants';

export type PageMode = 'standard' | 'edge-to-edge';
export type SurfaceMode = 'light' | 'full-dark' | 'sidebar-dark' | 'background';
export type ColumnMode = 'single' | 'split';
export type OuterCloneMode = 'clone' | 'slice' | 'none';
export type BlankPagePrevention = 'none' | 'light-shrink' | 'aggressive-fit';
export type BreakRuleMode = 'allow-override' | 'preserve';
export type ShrinkTarget = 'outer-padding' | 'child-padding';

export interface PdfLayoutProfile {
  template: string;
  pageMode: PageMode;
  surfaceMode: SurfaceMode;
  columnMode: ColumnMode;
  outerCloneMode: OuterCloneMode;
  blankPagePrevention: BlankPagePrevention;
  breakRuleMode: BreakRuleMode;
  shrinkTarget: ShrinkTarget;
  fitOnePageMinScale: number;
  blankPageMinScale: number;
  background: string | null;
  sidebar: { bg: string; width: string } | null;
}

const FULL_DARK_TEMPLATE_BACKGROUNDS: Record<string, string> = {
  neon: '#111827',
};

const DEFAULT_PROFILE: Omit<PdfLayoutProfile, 'template'> = {
  pageMode: 'standard',
  surfaceMode: 'light',
  columnMode: 'single',
  outerCloneMode: 'none',
  blankPagePrevention: 'light-shrink',
  breakRuleMode: 'allow-override',
  shrinkTarget: 'outer-padding',
  fitOnePageMinScale: 80,
  blankPageMinScale: 95,
  background: null,
  sidebar: null,
};

const REPRESENTATIVE_PROFILE_OVERRIDES: Record<string, Partial<PdfLayoutProfile>> = {
  modern: {
    pageMode: 'edge-to-edge',
    surfaceMode: 'background',
    columnMode: 'single',
    outerCloneMode: 'clone',
    blankPagePrevention: 'light-shrink',
    shrinkTarget: 'child-padding',
    fitOnePageMinScale: 55,
    blankPageMinScale: 93,
  },
  sidebar: {
    pageMode: 'edge-to-edge',
    surfaceMode: 'sidebar-dark',
    columnMode: 'split',
    outerCloneMode: 'slice',
    blankPagePrevention: 'light-shrink',
    shrinkTarget: 'child-padding',
    sidebar: TWO_COLUMN_TEMPLATES.sidebar,
  },
  'two-column': {
    pageMode: 'edge-to-edge',
    surfaceMode: 'sidebar-dark',
    columnMode: 'split',
    outerCloneMode: 'slice',
    blankPagePrevention: 'light-shrink',
    shrinkTarget: 'child-padding',
    sidebar: TWO_COLUMN_TEMPLATES['two-column'],
  },
  compact: {
    pageMode: 'edge-to-edge',
    surfaceMode: 'background',
    columnMode: 'split',
    outerCloneMode: 'clone',
    blankPagePrevention: 'aggressive-fit',
    shrinkTarget: 'child-padding',
    fitOnePageMinScale: 78,
    blankPageMinScale: 92,
  },
  neon: {
    pageMode: 'edge-to-edge',
    surfaceMode: 'full-dark',
    columnMode: 'single',
    outerCloneMode: 'clone',
    blankPagePrevention: 'aggressive-fit',
    shrinkTarget: 'child-padding',
    fitOnePageMinScale: 76,
    blankPageMinScale: 92,
    background: FULL_DARK_TEMPLATE_BACKGROUNDS.neon,
  },
};

function buildFallbackProfile(template: string): PdfLayoutProfile {
  const fullDarkBackground = FULL_DARK_TEMPLATE_BACKGROUNDS[template];
  if (fullDarkBackground) {
    return {
      ...DEFAULT_PROFILE,
      template,
      pageMode: 'edge-to-edge',
      surfaceMode: 'full-dark',
      outerCloneMode: 'clone',
      shrinkTarget: 'child-padding',
      background: fullDarkBackground,
    };
  }

  const sidebar = TWO_COLUMN_TEMPLATES[template];
  if (sidebar) {
    return {
      ...DEFAULT_PROFILE,
      template,
      pageMode: 'edge-to-edge',
      surfaceMode: 'sidebar-dark',
      columnMode: 'split',
      outerCloneMode: 'slice',
      shrinkTarget: 'child-padding',
      sidebar,
    };
  }

  if (BACKGROUND_TEMPLATES.has(template)) {
    return {
      ...DEFAULT_PROFILE,
      template,
      pageMode: 'edge-to-edge',
      surfaceMode: 'background',
      outerCloneMode: 'clone',
      shrinkTarget: 'child-padding',
      columnMode: template === 'compact' ? 'split' : 'single',
    };
  }

  return {
    ...DEFAULT_PROFILE,
    template,
  };
}

export function getPdfLayoutProfile(template: string): PdfLayoutProfile {
  const base = buildFallbackProfile(template);
  const override = REPRESENTATIVE_PROFILE_OVERRIDES[template];

  if (!override) {
    return base;
  }

  return {
    ...base,
    ...override,
    template,
    background: override.background ?? base.background,
    sidebar: override.sidebar ?? base.sidebar,
  };
}

export function getPdfBodyBackground(profile: PdfLayoutProfile): string {
  if (profile.surfaceMode === 'full-dark') {
    return profile.background || 'white';
  }

  if (profile.surfaceMode === 'sidebar-dark' && profile.sidebar) {
    return `linear-gradient(90deg, ${profile.sidebar.bg} ${profile.sidebar.width}, white ${profile.sidebar.width})`;
  }

  return 'white';
}

export function getPdfLayoutDataAttributes(profile: PdfLayoutProfile): Record<string, string> {
  return {
    'data-page-mode': profile.pageMode,
    'data-surface-mode': profile.surfaceMode,
    'data-column-mode': profile.columnMode,
    'data-outer-clone-mode': profile.outerCloneMode,
    'data-blank-page-prevention': profile.blankPagePrevention,
    'data-break-rule-mode': profile.breakRuleMode,
    'data-shrink-target': profile.shrinkTarget,
    'data-fit-one-page-min-scale': String(profile.fitOnePageMinScale),
    'data-blank-page-min-scale': String(profile.blankPageMinScale),
  };
}
