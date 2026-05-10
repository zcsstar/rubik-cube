import CubeJS from 'cubejs';
import type { FaceLetter } from './colors';
import { URFDLB } from './ICube';

/**
 * The 24 whole-cube orientations expressed as cubejs move strings. Each is a
 * combination of "bring face X to the top" and "rotate around U axis k times".
 * Empty string = identity. Tried in turn until centres line up canonically.
 */
const ROTATION_CANDIDATES: readonly string[] = (() => {
  // Move that brings each canonical face to the U position.
  const TO_U: readonly string[] = ['', "x'", 'x2', 'x', "z'", 'z'];
  const Y_ROT: readonly string[] = ['', 'y', 'y2', "y'"];
  const out: string[] = [];
  for (const a of TO_U) {
    for (const b of Y_ROT) {
      out.push([a, b].filter(Boolean).join(' '));
    }
  }
  return out;
})();

const CENTER_INDICES: readonly number[] = URFDLB.map((_, i) => i * 9 + 4);

function centersAreCanonical(s: string): boolean {
  for (let i = 0; i < URFDLB.length; i++) {
    if (s[CENTER_INDICES[i]!] !== URFDLB[i]) return false;
  }
  return true;
}

/**
 * Reads the 6 centre stickers of `facelets` and returns whether the 3 pairs of
 * opposite faces use the canonical opposite-colour pairs ({U,D}, {F,B}, {L,R}),
 * with each face letter appearing as a centre exactly once. A cube held in any
 * of the 24 valid orientations satisfies this; a physically-impossible centre
 * arrangement (e.g. two white centres) does not.
 */
export function hasValidCenterArrangement(facelets: string): boolean {
  const centers = CENTER_INDICES.map((i) => facelets[i] as FaceLetter);
  const seen = new Set(centers);
  if (seen.size !== 6) return false;
  // Opposite-face index pairs in URFDLB: (U,D)=(0,3), (R,L)=(1,4), (F,B)=(2,5).
  const userPairs: ReadonlyArray<readonly [FaceLetter, FaceLetter]> = [
    [centers[0]!, centers[3]!],
    [centers[1]!, centers[4]!],
    [centers[2]!, centers[5]!],
  ];
  const canonicalPairs: ReadonlyArray<ReadonlySet<FaceLetter>> = [
    new Set<FaceLetter>(['U', 'D']),
    new Set<FaceLetter>(['F', 'B']),
    new Set<FaceLetter>(['L', 'R']),
  ];
  return userPairs.every(([a, b]) =>
    canonicalPairs.some((cp) => cp.has(a) && cp.has(b) && a !== b),
  );
}

/**
 * Re-orient a 3x3 facelet string so that its centres match the canonical
 * URFDLB positions (U=white at top, R=red on right, etc.). The user can paint
 * a cube in any of the 24 valid orientations — this rotates that input into
 * the form the solver expects.
 *
 * Returns null if no whole-cube rotation produces canonical centres (i.e. the
 * input has a physically-impossible centre arrangement).
 */
export function canonicalize3x3(facelets: string): string | null {
  if (facelets.length !== 54) return null;
  if (!hasValidCenterArrangement(facelets)) return null;
  for (const moves of ROTATION_CANDIDATES) {
    const c = CubeJS.fromString(facelets);
    if (moves) c.move(moves);
    const out = c.asString();
    if (centersAreCanonical(out)) return out;
  }
  return null;
}
