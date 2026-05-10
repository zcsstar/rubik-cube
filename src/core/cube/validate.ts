import type { CubeSize } from './ICube';
import { stickersPerFace, totalStickers, URFDLB } from './ICube';
import type { FaceLetter } from './colors';
import { hasValidCenterArrangement } from './canonicalize';

export interface ValidationError {
  code:
    | 'wrong_length'
    | 'unknown_char'
    | 'bad_count'
    | 'bad_centers'
    | 'unsolvable_parity';
  /** Translation key, e.g. 'validate.wrongLength'. */
  key: string;
  /** Substitution params for placeholders in the translation. */
  params?: Record<string, string | number>;
  /** English fallback message; useful for tests / debug. */
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
      key: 'validate.wrongLength',
      params: { expected, got: facelets.length },
      message: `Expected ${expected} stickers, got ${facelets.length}.`,
    });
    return errors;
  }

  const counts: Record<string, number> = {};
  for (const ch of facelets) {
    if (!URFDLB.includes(ch as FaceLetter)) {
      errors.push({
        code: 'unknown_char',
        key: 'validate.unknownChar',
        params: { ch },
        message: `Unknown sticker color "${ch}".`,
      });
      return errors;
    }
    counts[ch] = (counts[ch] ?? 0) + 1;
  }
  const perFace = stickersPerFace(size);
  for (const f of URFDLB) {
    if (counts[f] !== perFace) {
      errors.push({
        code: 'bad_count',
        key: 'validate.badCount',
        params: { f, got: counts[f] ?? 0, expected: perFace },
        message: `Color "${f}" appears ${counts[f] ?? 0} times, expected ${perFace}.`,
      });
    }
  }

  // For 3x3, the user can hold the cube in any of 24 orientations — we just
  // need each face to have a unique centre colour AND the three pairs of
  // opposite-face centres to be the canonical opposite-colour pairs
  // ({U,D}, {F,B}, {L,R}). Any such input can be re-rotated into the canonical
  // URFDLB orientation by canonicalize3x3 before solving.
  if (size === 3 && !hasValidCenterArrangement(facelets)) {
    errors.push({
      code: 'bad_centers',
      key: 'validate.badCenters',
      message:
        'Centres must use 6 different colours, with opposite faces using the canonical opposite pairs (white↔yellow, green↔blue, orange↔red).',
    });
  }

  return errors;
}
