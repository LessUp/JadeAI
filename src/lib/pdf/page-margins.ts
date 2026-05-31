import type { ThemeConfig } from '@/types/resume';

import type { PdfLayoutProfile } from './layout-profile';

const PX_PER_MM = 3.78;

export const PDF_SAFE_PAGE_MARGIN_MM = 10;
export const PDF_SAFE_PAGE_MARGIN_PX = Math.round(PDF_SAFE_PAGE_MARGIN_MM * PX_PER_MM);
export const PDF_FRAGMENT_PADDING_FLOOR_MM = 5;
export const PDF_FRAGMENT_PADDING_FLOOR_PX = Math.round(PDF_FRAGMENT_PADDING_FLOOR_MM * PX_PER_MM);

export interface ResolvedPdfPageMargins {
  topPx: number;
  bottomPx: number;
  topMm: number;
  bottomMm: number;
  css: string;
  usesPhysicalMargins: boolean;
  fragmentPaddingFloorPx: number;
}

export function pxToPdfMm(px: number): number {
  return Math.round((px / PX_PER_MM) * 10) / 10;
}

export function usesPhysicalPdfPageMargins(profile: PdfLayoutProfile): boolean {
  return profile.surfaceMode === 'light' || profile.surfaceMode === 'background';
}

export function resolvePdfPageMargins(
  profile: PdfLayoutProfile,
  themeMargin: ThemeConfig['margin'],
): ResolvedPdfPageMargins {
  const usesPhysicalMargins = usesPhysicalPdfPageMargins(profile);

  if (!usesPhysicalMargins) {
    return {
      topPx: 0,
      bottomPx: 0,
      topMm: 0,
      bottomMm: 0,
      css: '0',
      usesPhysicalMargins,
      fragmentPaddingFloorPx: PDF_FRAGMENT_PADDING_FLOOR_PX,
    };
  }

  const topPx = Math.max(themeMargin.top, PDF_SAFE_PAGE_MARGIN_PX);
  const bottomPx = Math.max(themeMargin.bottom, PDF_SAFE_PAGE_MARGIN_PX);
  const topMm = Math.max(pxToPdfMm(themeMargin.top), PDF_SAFE_PAGE_MARGIN_MM);
  const bottomMm = Math.max(pxToPdfMm(themeMargin.bottom), PDF_SAFE_PAGE_MARGIN_MM);

  return {
    topPx,
    bottomPx,
    topMm,
    bottomMm,
    css: `${topMm}mm 0 ${bottomMm}mm 0`,
    usesPhysicalMargins,
    fragmentPaddingFloorPx: 8,
  };
}
