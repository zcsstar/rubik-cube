import type { CubeSize } from './ICube';
import { stickersPerFace, totalStickers, URFDLB } from './ICube';
import type { FaceLetter } from './colors';

export interface ValidationError {
  code:
    | 'wrong_length'
    | 'unknown_char'
    | 'bad_count'
    | 'bad_centers'
    | 'unsolvable_parity';
  message: string;
}

/**
 * Cheap structural checks on a facelet string. Catches user input mistakes BEFORE
 * the (more expensive) solver runs. Does NOT check full cube reachability — just
 * the parts that are easy and high-value.
 */
export function validateFacelets(size: CubeSize, facelets: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const expected = totalStickers(size);
  if (facelets.length !== expected) {
    errors.push({
      code: 'wrong_length',
      message: `Expected ${expected} stickers, got ${facelets.length}.`,
    });
    return errors;
  }

  const counts: Record<string, number> = {};
  for (const ch of facelets) {
    if (!URFDLB.includes(ch as FaceLetter)) {
      errors.push({ code: 'unknown_char', message: `Unknown sticker color "${ch}".` });
      return errors;
    }
    counts[ch] = (counts[ch] ?? 0) + 1;
  }
  const perFace = stickersPerFace(size);
  for (const f of URFDLB) {
    if (counts[f] !== perFace) {
      errors.push({
        code: 'bad_count',
        message: `Color "${f}" appears ${counts[f] ?? 0} times, expected ${perFace}.`,
      });
    }
  }

  // For 3x3 and 4x4, the center sticker(s) of each face must agree with the
  // face's identity (i.e., the U face center must be U, etc.). This catches the
  // most common input mistake — painting a face with the wrong colour pool.
  if (size === 3) {
    URFDLB.forEach((f, i) => {
      const center = facelets[i * 9 + 4];
      if (center !== f) {
        errors.push({
          code: 'bad_centers',
          message: `${f} face centre should be "${f}" but is "${center}". Centers determine face identity.`,
        });
      }
    });
  }

  return errors;
}
