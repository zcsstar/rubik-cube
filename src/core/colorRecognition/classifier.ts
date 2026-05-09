import type { FaceLetter } from '../cube/colors';

export interface HSV {
  /** Hue 0-360. Undefined when saturation is 0; we keep 0. */
  h: number;
  /** Saturation 0-100. */
  s: number;
  /** Value 0-100. */
  v: number;
}

/**
 * Reference HSV values for the six WCA sticker colours, computed from the
 * canonical hex constants. Used as nearest-neighbour anchors for camera
 * classification.
 */
export const WCA_HSV: Record<FaceLetter, HSV> = {
  U: { h: 0, s: 0, v: 100 }, // white
  D: { h: 50, s: 100, v: 100 }, // yellow #FFD500
  R: { h: 0, s: 100, v: 93 }, // red #EE0000
  L: { h: 26, s: 100, v: 100 }, // orange #FF6F00
  F: { h: 146, s: 100, v: 69 }, // green #00B04B
  B: { h: 219, s: 90, v: 100 }, // blue #1A66FF
};

export function rgbToHsv(r: number, g: number, b: number): HSV {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const v = max * 100;
  const s = max === 0 ? 0 : (delta / max) * 100;
  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
    else h = 60 * ((rn - gn) / delta + 4);
  }
  if (h < 0) h += 360;
  return { h, s, v };
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 360 - d);
}

/**
 * Classify a sampled pixel as one of the six WCA face colours.
 *
 * The algorithm:
 *   1. If saturation is very low and value is reasonably high → White.
 *      Catches the "almost-grey but bright" look that white actually has on
 *      camera; using just hue would mis-classify it as one of the colours.
 *   2. Otherwise, find the colour whose reference HSV is closest. Hue
 *      dominates (weighted 1.0); saturation and value are weighted lightly
 *      because they fluctuate the most with lighting.
 */
export function classifyColor(r: number, g: number, b: number): FaceLetter {
  const hsv = rgbToHsv(r, g, b);
  if (hsv.s < 22 && hsv.v > 50) return 'U';
  let bestFace: FaceLetter = 'D';
  let bestDist = Infinity;
  (Object.entries(WCA_HSV) as [FaceLetter, HSV][]).forEach(([face, ref]) => {
    if (face === 'U') return;
    const dh = hueDistance(hsv.h, ref.h);
    const ds = Math.abs(hsv.s - ref.s) * 0.25;
    const dv = Math.abs(hsv.v - ref.v) * 0.25;
    const dist = Math.sqrt(dh * dh + ds * ds + dv * dv);
    if (dist < bestDist) {
      bestDist = dist;
      bestFace = face;
    }
  });
  return bestFace;
}

/**
 * Sample the average colour inside a small window of an ImageData buffer.
 * Sampling a window (vs a single pixel) is much more robust to JPEG noise,
 * sticker glare, and the user's hand wobble.
 */
export function samplePatch(
  data: Uint8ClampedArray,
  width: number,
  cx: number,
  cy: number,
  radius: number,
): { r: number; g: number; b: number } {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const x0 = Math.max(0, Math.round(cx - radius));
  const y0 = Math.max(0, Math.round(cy - radius));
  const x1 = Math.round(cx + radius);
  const y1 = Math.round(cy + radius);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const idx = (y * width + x) * 4;
      r += data[idx]!;
      g += data[idx + 1]!;
      b += data[idx + 2]!;
      n++;
    }
  }
  if (n === 0) return { r: 0, g: 0, b: 0 };
  return { r: r / n, g: g / n, b: b / n };
}
