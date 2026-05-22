import { describe, it, expect } from 'vitest';
import type { FaceLetter } from '../cube/colors';
import { refineWithKMeans, refineWithKMeansConstrained, type Sample } from './refine';

describe('refineWithKMeans', () => {
  it('classifies clean WCA-coloured samples back to their faces', () => {
    const samples: Sample[] = [
      { faceIndex: 0, patchIndex: 0, rgb: { r: 255, g: 255, b: 255 } }, // U
      { faceIndex: 1, patchIndex: 0, rgb: { r: 238, g: 0, b: 0 } }, // R
      { faceIndex: 2, patchIndex: 0, rgb: { r: 0, g: 176, b: 75 } }, // F
      { faceIndex: 3, patchIndex: 0, rgb: { r: 255, g: 213, b: 0 } }, // D
      { faceIndex: 4, patchIndex: 0, rgb: { r: 255, g: 111, b: 0 } }, // L
      { faceIndex: 5, patchIndex: 0, rgb: { r: 26, g: 102, b: 255 } }, // B
    ];
    const labels = refineWithKMeans(samples);
    expect(labels.get('0,0')).toBe('U');
    expect(labels.get('1,0')).toBe('R');
    expect(labels.get('2,0')).toBe('F');
    expect(labels.get('3,0')).toBe('D');
    expect(labels.get('4,0')).toBe('L');
    expect(labels.get('5,0')).toBe('B');
  });

  it('handles a noisy "warm light" scenario where every sample is shifted toward yellow', () => {
    // Apply a uniform yellowish shift (more red+green, less blue) to every sample.
    const shift = (rgb: { r: number; g: number; b: number }) => ({
      r: Math.min(255, rgb.r + 18),
      g: Math.min(255, rgb.g + 12),
      b: Math.max(0, rgb.b - 18),
    });
    const samples: Sample[] = [
      { faceIndex: 0, patchIndex: 0, rgb: shift({ r: 245, g: 240, b: 220 }) }, // off-white
      { faceIndex: 1, patchIndex: 0, rgb: shift({ r: 220, g: 30, b: 25 }) }, // dim red
      { faceIndex: 2, patchIndex: 0, rgb: shift({ r: 40, g: 160, b: 90 }) }, // dim green
      { faceIndex: 3, patchIndex: 0, rgb: shift({ r: 240, g: 200, b: 30 }) }, // yellow
      { faceIndex: 4, patchIndex: 0, rgb: shift({ r: 235, g: 100, b: 30 }) }, // orange
      { faceIndex: 5, patchIndex: 0, rgb: shift({ r: 60, g: 110, b: 220 }) }, // dim blue
    ];
    const labels = refineWithKMeans(samples);
    // K-means should still recover the right face for each because the shifts
    // are consistent and the centroids migrate together.
    expect(labels.get('0,0')).toBe('U');
    expect(labels.get('1,0')).toBe('R');
    expect(labels.get('2,0')).toBe('F');
    expect(labels.get('3,0')).toBe('D');
    expect(labels.get('4,0')).toBe('L');
    expect(labels.get('5,0')).toBe('B');
  });

  it('many same-colour samples stay together (no cluster collapse)', () => {
    // Five samples of pure red; one of each other colour.
    const samples: Sample[] = [];
    for (let i = 0; i < 5; i++) {
      samples.push({ faceIndex: 1, patchIndex: i, rgb: { r: 230 + i, g: 5, b: 5 } });
    }
    samples.push({ faceIndex: 0, patchIndex: 0, rgb: { r: 250, g: 250, b: 250 } });
    samples.push({ faceIndex: 2, patchIndex: 0, rgb: { r: 0, g: 175, b: 70 } });
    samples.push({ faceIndex: 3, patchIndex: 0, rgb: { r: 255, g: 210, b: 0 } });
    samples.push({ faceIndex: 4, patchIndex: 0, rgb: { r: 255, g: 110, b: 0 } });
    samples.push({ faceIndex: 5, patchIndex: 0, rgb: { r: 25, g: 100, b: 255 } });
    const labels = refineWithKMeans(samples);
    for (let i = 0; i < 5; i++) expect(labels.get(`1,${i}`)).toBe('R');
    expect(labels.get('0,0')).toBe('U');
    expect(labels.get('2,0')).toBe('F');
    expect(labels.get('3,0')).toBe('D');
    expect(labels.get('4,0')).toBe('L');
    expect(labels.get('5,0')).toBe('B');
  });
});

describe('refineWithKMeansConstrained', () => {
  const EVEN_2X2: Record<FaceLetter, number> = { U: 4, R: 4, F: 4, D: 4, L: 4, B: 4 };

  it('produces exactly N stickers per colour on clean 2×2 captures', () => {
    const ref: Record<FaceLetter, { r: number; g: number; b: number }> = {
      U: { r: 255, g: 255, b: 255 },
      R: { r: 238, g: 0, b: 0 },
      F: { r: 0, g: 176, b: 75 },
      D: { r: 255, g: 213, b: 0 },
      L: { r: 255, g: 111, b: 0 },
      B: { r: 26, g: 102, b: 255 },
    };
    const samples: Sample[] = [];
    let idx = 0;
    for (const face of ['U', 'R', 'F', 'D', 'L', 'B'] as const) {
      for (let p = 0; p < 4; p++) {
        samples.push({ faceIndex: idx, patchIndex: p, rgb: { ...ref[face] } });
      }
      idx++;
    }
    const labels = refineWithKMeansConstrained(samples, EVEN_2X2);
    const counts: Record<string, number> = {};
    for (const l of labels.values()) counts[l] = (counts[l] ?? 0) + 1;
    for (const f of Object.keys(EVEN_2X2)) expect(counts[f]).toBe(4);
  });

  it('fixes the R=3 / L=5 over-classification under warm-light shift', () => {
    // 4 reddish reds + 4 orangish oranges. We synthesize one red that the
    // unconstrained classifier would mistake for orange (much closer to the
    // orange centroid), plus filler samples for the other colours so totals
    // add up to 24. Constrained version must still hand back 4 R + 4 L.
    const samples: Sample[] = [];
    // 3 confident reds
    for (let p = 0; p < 3; p++) {
      samples.push({ faceIndex: 1, patchIndex: p, rgb: { r: 230, g: 10, b: 10 } });
    }
    // 1 borderline "warm" red that drifts orange-ward
    samples.push({ faceIndex: 1, patchIndex: 3, rgb: { r: 240, g: 95, b: 15 } });
    // 4 confident oranges, slightly varied
    for (let p = 0; p < 4; p++) {
      samples.push({ faceIndex: 4, patchIndex: p, rgb: { r: 250, g: 115 + p, b: 5 } });
    }
    // 4 of every remaining colour
    for (let p = 0; p < 4; p++) {
      samples.push({ faceIndex: 0, patchIndex: p, rgb: { r: 250, g: 250, b: 250 } });
      samples.push({ faceIndex: 2, patchIndex: p, rgb: { r: 0, g: 175, b: 70 } });
      samples.push({ faceIndex: 3, patchIndex: p, rgb: { r: 255, g: 210, b: 0 } });
      samples.push({ faceIndex: 5, patchIndex: p, rgb: { r: 25, g: 100, b: 255 } });
    }
    expect(samples.length).toBe(24);

    // Sanity: unconstrained classifier puts the warm-red sample into L,
    // producing R=3 / L=5 (the failure mode the user reported).
    const unconstrained = refineWithKMeans(samples);
    const countsU: Record<string, number> = {};
    for (const l of unconstrained.values()) countsU[l] = (countsU[l] ?? 0) + 1;
    expect(countsU['R']).toBeLessThan(4);
    expect(countsU['L']).toBeGreaterThan(4);

    // Constrained version must rebalance.
    const constrained = refineWithKMeansConstrained(samples, EVEN_2X2);
    const counts: Record<string, number> = {};
    for (const l of constrained.values()) counts[l] = (counts[l] ?? 0) + 1;
    expect(counts['R']).toBe(4);
    expect(counts['L']).toBe(4);
    // Verify the borderline patch went to R (the under-counted cluster it
    // belongs to by ground truth).
    expect(constrained.get('1,3')).toBe('R');
  });

  it('falls back to unconstrained when expected totals don’t match sample count', () => {
    const samples: Sample[] = [
      { faceIndex: 0, patchIndex: 0, rgb: { r: 255, g: 255, b: 255 } },
      { faceIndex: 1, patchIndex: 0, rgb: { r: 238, g: 0, b: 0 } },
    ];
    // Expected counts add to 24 but we only have 2 samples — fall back.
    const labels = refineWithKMeansConstrained(samples, EVEN_2X2);
    expect(labels.get('0,0')).toBe('U');
    expect(labels.get('1,0')).toBe('R');
  });
});
