import { esc, buildExportThemeCSS, type ResumeWithSections } from './utils';
import { EXPORT_TAILWIND_CSS } from '@/lib/pdf/export-tailwind-css';
import { getEmbeddedFontFacesCss } from '@/lib/font-stacks';
import { normalizeLanguageDescriptionsForCompactTemplates } from '@/lib/language-description';
import {
  getPdfBodyBackground,
  getPdfLayoutDataAttributes,
  getPdfLayoutProfile,
} from '@/lib/pdf/layout-profile';
import { mergeThemeConfig } from '@/lib/resume-theme/build-theme-css';
import { generateQrSvg } from '@/lib/qrcode';
import { buildClassicHtml } from './templates/classic';
import { buildModernHtml } from './templates/modern';
import { buildMinimalHtml } from './templates/minimal';
import { buildProfessionalHtml } from './templates/professional';
import { buildTwoColumnHtml } from './templates/two-column';
import { buildCreativeHtml } from './templates/creative';
import { buildAtsHtml } from './templates/ats';
import { buildAcademicHtml } from './templates/academic';
import { buildElegantHtml } from './templates/elegant';
import { buildExecutiveHtml } from './templates/executive';
import { buildDeveloperHtml } from './templates/developer';
import { buildDesignerHtml } from './templates/designer';
import { buildStartupHtml } from './templates/startup';
import { buildFormalHtml } from './templates/formal';
import { buildInfographicHtml } from './templates/infographic';
import { buildCompactHtml } from './templates/compact';
import { buildEuroHtml } from './templates/euro';
import { buildCleanHtml } from './templates/clean';
import { buildBoldHtml } from './templates/bold';
import { buildTimelineHtml } from './templates/timeline';
// Batch 1
import { buildNordicHtml } from './templates/nordic';
import { buildCorporateHtml } from './templates/corporate';
import { buildConsultantHtml } from './templates/consultant';
import { buildFinanceHtml } from './templates/finance';
import { buildMedicalHtml } from './templates/medical';
// Batch 2
import { buildGradientHtml } from './templates/gradient';
import { buildMetroHtml } from './templates/metro';
import { buildMaterialHtml } from './templates/material';
import { buildCoderHtml } from './templates/coder';
import { buildBlocksHtml } from './templates/blocks';
// Batch 3
import { buildMagazineHtml } from './templates/magazine';
import { buildArtisticHtml } from './templates/artistic';
import { buildRetroHtml } from './templates/retro';
import { buildNeonHtml } from './templates/neon';
import { buildWatercolorHtml } from './templates/watercolor';
// Batch 4
import { buildSwissHtml } from './templates/swiss';
import { buildJapaneseHtml } from './templates/japanese';
import { buildBerlinHtml } from './templates/berlin';
import { buildLuxeHtml } from './templates/luxe';
import { buildRoseHtml } from './templates/rose';
// Batch 5
import { buildArchitectHtml } from './templates/architect';
import { buildLegalHtml } from './templates/legal';
import { buildTeacherHtml } from './templates/teacher';
import { buildScientistHtml } from './templates/scientist';
import { buildEngineerHtml } from './templates/engineer';
// Batch 6
import { buildSidebarHtml } from './templates/sidebar';
import { buildCardHtml } from './templates/card';
import { buildZigzagHtml } from './templates/zigzag';
import { buildRibbonHtml } from './templates/ribbon';
import { buildMosaicHtml } from './templates/mosaic';

const TEMPLATE_BUILDERS: Record<string, (r: ResumeWithSections) => string> = {
  classic: buildClassicHtml,
  modern: buildModernHtml,
  minimal: buildMinimalHtml,
  professional: buildProfessionalHtml,
  'two-column': buildTwoColumnHtml,
  creative: buildCreativeHtml,
  ats: buildAtsHtml,
  academic: buildAcademicHtml,
  elegant: buildElegantHtml,
  executive: buildExecutiveHtml,
  developer: buildDeveloperHtml,
  designer: buildDesignerHtml,
  startup: buildStartupHtml,
  formal: buildFormalHtml,
  infographic: buildInfographicHtml,
  compact: buildCompactHtml,
  euro: buildEuroHtml,
  clean: buildCleanHtml,
  bold: buildBoldHtml,
  timeline: buildTimelineHtml,
  // Batch 1
  nordic: buildNordicHtml,
  corporate: buildCorporateHtml,
  consultant: buildConsultantHtml,
  finance: buildFinanceHtml,
  medical: buildMedicalHtml,
  // Batch 2
  gradient: buildGradientHtml,
  metro: buildMetroHtml,
  material: buildMaterialHtml,
  coder: buildCoderHtml,
  blocks: buildBlocksHtml,
  // Batch 3
  magazine: buildMagazineHtml,
  artistic: buildArtisticHtml,
  retro: buildRetroHtml,
  neon: buildNeonHtml,
  watercolor: buildWatercolorHtml,
  // Batch 4
  swiss: buildSwissHtml,
  japanese: buildJapaneseHtml,
  berlin: buildBerlinHtml,
  luxe: buildLuxeHtml,
  rose: buildRoseHtml,
  // Batch 5
  architect: buildArchitectHtml,
  legal: buildLegalHtml,
  teacher: buildTeacherHtml,
  scientist: buildScientistHtml,
  engineer: buildEngineerHtml,
  // Batch 6
  sidebar: buildSidebarHtml,
  card: buildCardHtml,
  zigzag: buildZigzagHtml,
  ribbon: buildRibbonHtml,
  mosaic: buildMosaicHtml,
};

function isValidQrUrl(str: string): boolean {
  if (!str?.trim()) return false;
  try {
    const raw = str.startsWith('http') ? str : `https://${str}`;
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const host = url.hostname;
    return host === 'localhost' || /\.\w{2,}$/.test(host) || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  } catch {
    return false;
  }
}

/** Pre-generate QR code SVGs and attach to qr_codes section content
 *  so sync template builders can render them inline. */
async function preGenerateQrSvgs(resume: ResumeWithSections): Promise<void> {
  const qrSection = resume.sections.find((s: any) => s.type === 'qr_codes');
  if (!qrSection || qrSection.visible === false) return;
  const items = ((qrSection.content as any).items || []).filter((q: any) => isValidQrUrl(q.url));
  if (items.length === 0) return;
  const svgs: Record<string, string> = {};
  for (const qr of items) {
    try { svgs[qr.id] = await generateQrSvg(qr.url, 80); } catch { /* skip */ }
  }
  (qrSection.content as any)._qrSvgs = svgs;
}

export async function generateHtml(
  resume: ResumeWithSections,
  forPdf = false,
  fontBaseUrl = ''
): Promise<string> {
  const safeResume = normalizeLanguageDescriptionsForCompactTemplates(resume);
  // Pre-generate QR SVGs so sync template builders can use them
  await preGenerateQrSvgs(safeResume);
  const builder = TEMPLATE_BUILDERS[safeResume.template] || buildClassicHtml;
  const bodyHtml = builder(safeResume);
  const theme = mergeThemeConfig((safeResume as any).themeConfig);
  const layoutProfile = getPdfLayoutProfile(safeResume.template);
  const themeCSS = buildExportThemeCSS(theme, safeResume.template);
  const embeddedFontsCss = getEmbeddedFontFacesCss(fontBaseUrl);
  const bodyBg = getPdfBodyBackground(layoutProfile);

  const pxToMm = (px: number) => Math.round((px / 3.78) * 10) / 10;
  const pageMarginTop = pxToMm(theme.margin.top);
  const pageMarginBottom = pxToMm(theme.margin.bottom);

  const pdfOverrides = forPdf
    ? `/* Page margins and fragmentation */
       @page { margin: ${layoutProfile.pageMode === 'edge-to-edge' ? '0' : `${pageMarginTop}mm 0 ${pageMarginBottom}mm 0`}; }
       html, body { background: ${bodyBg} !important; padding: 0 !important; margin: 0 !important; display: block !important; min-height: 100%; }
       .resume-export { width: 100%; }
       .resume-export > div { box-shadow: none !important; overflow: visible !important; ${layoutProfile.outerCloneMode === 'clone' ? '-webkit-box-decoration-break: clone; box-decoration-break: clone;' : layoutProfile.outerCloneMode === 'slice' ? '-webkit-box-decoration-break: slice; box-decoration-break: slice;' : 'padding-top: 0 !important; padding-bottom: 0 !important;'} ${layoutProfile.surfaceMode === 'sidebar-dark' ? 'min-height: auto !important; max-width: none !important; width: 100% !important; background: transparent !important;' : layoutProfile.pageMode === 'edge-to-edge' ? 'max-width: none !important; width: 100% !important;' : 'background: white !important;'} }
       /* Smart pagination: allow sections to break across pages, keep individual items together.
          overflow:visible is critical — Chrome treats overflow:hidden as monolithic (no page fragmentation). */
       [data-section] { break-inside: auto !important; overflow: visible !important; }
       [data-section] * { overflow: visible !important; }
       [data-section] [class*="space-y"] { break-inside: auto !important; }
       [data-section] [class*="space-y"] > div, .item { break-inside: avoid !important; }
       h2, h3 { break-after: avoid !important; }
       p { orphans: 3; widows: 3; }
       ${layoutProfile.surfaceMode === 'sidebar-dark' && layoutProfile.sidebar ? `/* Sidebar dark: body gradient = sidebar colour every page.
          Sidebar uses slice to avoid clone rendering artifacts at page breaks.
          Content uses clone to replicate padding at page breaks. */
       .resume-export > div > div:first-child {
         background: ${layoutProfile.sidebar.bg} !important;
         background-image: none !important;
         -webkit-box-decoration-break: slice !important;
         box-decoration-break: slice !important;
         padding-top: 5mm !important;
         padding-bottom: 5mm !important;
       }
       .resume-export > div > div:last-child {
         background-color: white !important;
         -webkit-box-decoration-break: clone;
         box-decoration-break: clone;
         padding-top: 5mm !important;
         padding-bottom: 5mm !important;
       }` : layoutProfile.surfaceMode === 'background' ? `/* Background templates: padding lives on child divs (e.g. p-8),
          clone so padding replicates at each page break. */
       .resume-export > div > div {
         -webkit-box-decoration-break: clone;
         box-decoration-break: clone;
       }` : ''}
       ${layoutProfile.surfaceMode === 'full-dark' ? `/* Full-dark: simulate @page margin via content padding */
       .resume-export > div > *:last-child {
         padding: 12mm 10mm !important;
         -webkit-box-decoration-break: clone;
         box-decoration-break: clone;
       }` : ''}`
    : '';

  return `<!DOCTYPE html>
<html lang="${esc(resume.language || 'en')}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(resume.title)}</title>
  <style>${EXPORT_TAILWIND_CSS}</style>
  <style>
    ${embeddedFontsCss}
    body { margin: 0; display: flex; justify-content: center; padding: 40px 20px; background: #f4f4f5; min-height: 100vh; }
    @media print { body { padding: 0 !important; background: white !important; } .resume-export > div { box-shadow: none !important; } }
    ${themeCSS}
    ${pdfOverrides}
    /* Tailwind v4 uses calc(infinity * 1px) for rounded-full which may fail
       in some Chromium PDF rendering — use safe 9999px fallback */
    .resume-export .rounded-full { border-radius: 9999px !important; }
    /* Avatar style overrides — export templates hardcode rounded-full + equal w/h.
       Override to match the preview's AvatarImage component for each style. */
    /* oneInch: portrait rectangle (5:7) with small radius */
    .resume-export[data-avatar-style="oneInch"] img[class*="object-cover"] {
      border-radius: 4px !important;
      aspect-ratio: 5 / 7 !important;
      height: auto !important;
      max-height: none !important;
    }
    .resume-export[data-avatar-style="oneInch"] div:has(> img[class*="object-cover"]) {
      border-radius: 4px !important;
      height: auto !important;
      overflow: hidden !important;
    }
    /* circle: equal w/h with full rounding — use 9999px as safe fallback
       for Tailwind v4's calc(infinity * 1px) which may fail in some Chromium builds */
    .resume-export[data-avatar-style="circle"] img[class*="object-cover"] {
      border-radius: 9999px !important;
      aspect-ratio: 1 / 1 !important;
    }
    .resume-export[data-avatar-style="circle"] div:has(> img[class*="object-cover"]) {
      border-radius: 9999px !important;
      overflow: hidden !important;
    }
  </style>
</head>
<body>
  <div class="resume-export" data-avatar-style="${esc((resume as any).themeConfig?.avatarStyle || 'oneInch')}" ${Object.entries(getPdfLayoutDataAttributes(layoutProfile)).map(([key, value]) => `${key}="${esc(value)}"`).join(' ')}>
    ${bodyHtml}
  </div>
</body>
</html>`;
}
