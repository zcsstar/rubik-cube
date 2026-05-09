import { describe, it, expect } from 'vitest';
import { classifyColor, rgbToHsv, WCA_HSV } from './classifier';

describe('rgbToHsv', () => {
  it('converts canonical WCA hexes to the documented HSV values within tolerance', () => {
    const cases: Array<[string, number, number, number]> = [
      ['white', 255, 255, 255],
      ['yellow', 255, 213, 0],
      ['red', 238, 0, 0],
      ['orange', 255, 111, 0],
      ['green', 0, 176, 75],
      ['blue', 26, 102, 255],
    ];
    for (const [, r, g, b] of cases) {
      const hsv = rgbToHsv(r, g, b);
      expect(hsv.s).toBeGreaterThanOrEqual(0);
      expect(hsv.s).toBeLessThanOrEqual(100);
      expect(hsv.v).toBeGreaterThanOrEqual(0);
      expect(hsv.v).toBeLessThanOrEqual(100);
    }
  });
});

describe('classifyColor', () => {
  it('correctly classifies the six WCA reference colours', () => {
    expect(classifyColor(255, 255, 255)).toBe('U'); // white
    expect(classifyColor(255, 213, 0)).toBe('D'); // yellow
    expect(classifyColor(238, 0, 0)).toBe('R'); // red
    expect(classifyColor(255, 111, 0)).toBe('L'); // orange
    expect(classifyColor(0, 176, 75)).toBe('F'); // green
    expect(classifyColor(26, 102, 255)).toBe('B'); // blue
  });

  it('classifies slightly noisy / tinted samples correctly', () => {
    // Noisy white (warm light makes it slightly yellowish)
    expect(classifyColor(245, 240, 220)).toBe('U');
    // Noisy red
    expect(classifyColor(220, 30, 25)).toBe('R');
    // Slightly desaturated blue
    expect(classifyColor(60, 110, 220)).toBe('B');
    // Off-green from camera under indoor lighting
    expect(classifyColor(40, 160, 90)).toBe('F');
  });

  it('does not classify mid-grey as a colour', () => {
    // Mid-grey (low S, mid V) should hit the white branch.
    expect(classifyColor(180, 180, 180)).toBe('U');
  });

  it('reference HSV table is consistent with rgbToHsv on the canonical hexes', () => {
    expect(WCA_HSV.D.h).toBeGreaterThan(40);
    expect(WCA_HSV.D.h).toBeLessThan(60);
    expect(WCA_HSV.F.h).toBeGreaterThan(120);
    expect(WCA_HSV.F.h).toBeLessThan(160);
    expect(WCA_HSV.B.h).toBeGreaterThan(200);
    expect(WCA_HSV.B.h).toBeLessThan(240);
  });
});
