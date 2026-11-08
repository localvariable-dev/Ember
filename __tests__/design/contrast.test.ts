/**
 * Design Tokens & WCAG Contrast Tests
 * Master Plan Part 1 §2.1 & Prompt 1.1 Acceptance Criteria
 * Verifies color contrast ratios mathematically according to WCAG 2.1.
 */

import { colors } from '../../src/design/tokens';

/**
 * Calculates WCAG 2.1 relative luminance for a given hex color string (#RRGGBB).
 */
function relativeLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const toLinear = (c: number): number =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  const rLin = toLinear(r);
  const gLin = toLinear(g);
  const bLin = toLinear(b);

  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Calculates WCAG 2.1 contrast ratio between two hex colors.
 */
function contrastRatio(hex1: string, hex2: string): number {
  const lum1 = relativeLuminance(hex1);
  const lum2 = relativeLuminance(hex2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('Design Tokens WCAG 2.1 Contrast Audits', () => {
  it('verifies primary text against OLED black background exceeds 15:1', () => {
    const ratio = contrastRatio(colors.text, colors.bg);
    // Target: >= 15:1 (Warm Alabaster #F4F4F6 on OLED Black #000000 achieves ~19.1:1)
    expect(ratio).toBeGreaterThanOrEqual(15.0);
  });

  it('verifies muted secondary text against OLED black background exceeds 6:1', () => {
    const ratio = contrastRatio(colors.textMuted, colors.bg);
    // Target: >= 6:1 (Muted Stone #8E8E99 on OLED Black #000000 achieves ~6.48:1)
    expect(ratio).toBeGreaterThanOrEqual(6.0);
  });

  it('verifies muted secondary text against surface (Deep Obsidian) exceeds 5.5:1', () => {
    const ratio = contrastRatio(colors.textMuted, colors.surface);
    // Target: >= 5.5:1 (Muted Stone #8E8E99 on Deep Obsidian #0B0B0E achieves ~6.07:1)
    expect(ratio).toBeGreaterThanOrEqual(5.5);
  });

  it('verifies onAccent text against Candlelight Amber accent exceeds 9:1', () => {
    const ratio = contrastRatio(colors.onAccent, colors.accent);
    // Target: >= 9:1 (Black #000000 on Candlelight Amber #F59E0B achieves ~9.8:1)
    expect(ratio).toBeGreaterThanOrEqual(9.0);
  });
});
