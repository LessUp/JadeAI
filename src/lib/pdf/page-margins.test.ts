import assert from 'node:assert/strict';
import test from 'node:test';

import { getPdfLayoutProfile } from './layout-profile';
import {
  PDF_FRAGMENT_PADDING_FLOOR_PX,
  PDF_SAFE_PAGE_MARGIN_MM,
  PDF_SAFE_PAGE_MARGIN_PX,
  resolvePdfPageMargins,
  usesPhysicalPdfPageMargins,
} from './page-margins';

const defaultMargin = { top: 20, right: 20, bottom: 20, left: 20 };

test('background templates use physical safe page margins', () => {
  const profile = getPdfLayoutProfile('gradient');
  const margins = resolvePdfPageMargins(profile, defaultMargin);

  assert.equal(usesPhysicalPdfPageMargins(profile), true);
  assert.equal(margins.usesPhysicalMargins, true);
  assert.equal(margins.topPx, PDF_SAFE_PAGE_MARGIN_PX);
  assert.equal(margins.bottomPx, PDF_SAFE_PAGE_MARGIN_PX);
  assert.equal(margins.topMm, PDF_SAFE_PAGE_MARGIN_MM);
  assert.equal(margins.bottomMm, PDF_SAFE_PAGE_MARGIN_MM);
  assert.equal(margins.css, '10mm 0 10mm 0');
});

test('standard templates keep larger user margins while enforcing the safe minimum', () => {
  const margins = resolvePdfPageMargins(getPdfLayoutProfile('classic'), {
    top: 48,
    right: 20,
    bottom: 44,
    left: 20,
  });

  assert.equal(margins.topPx, 48);
  assert.equal(margins.bottomPx, 44);
  assert.equal(margins.css, '12.7mm 0 11.6mm 0');
});

test('sidebar and full-dark templates keep physical page margins at zero', () => {
  const sidebarMargins = resolvePdfPageMargins(getPdfLayoutProfile('sidebar'), defaultMargin);
  const neonMargins = resolvePdfPageMargins(getPdfLayoutProfile('neon'), defaultMargin);

  assert.equal(sidebarMargins.usesPhysicalMargins, false);
  assert.equal(sidebarMargins.css, '0');
  assert.equal(sidebarMargins.fragmentPaddingFloorPx, PDF_FRAGMENT_PADDING_FLOOR_PX);

  assert.equal(neonMargins.usesPhysicalMargins, false);
  assert.equal(neonMargins.css, '0');
  assert.equal(neonMargins.fragmentPaddingFloorPx, PDF_FRAGMENT_PADDING_FLOOR_PX);
});
