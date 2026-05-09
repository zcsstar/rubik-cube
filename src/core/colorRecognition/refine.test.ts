import { describe, it, expect } from 'vitest';
import { refineWithKMeans, type Sample } from './refine';

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
