import { describe, expect, it } from 'vitest';
import CubeJS from 'cubejs';
import type { FaceLetter } from '../cube/colors';
import { resolveOrientation3x3 } from './resolveOrientation';

const SOLVED =
  'UUUUUUUUU' + 'RRRRRRRRR' + 'FFFFFFFFF' + 'DDDDDDDDD' + 'LLLLLLLLL' + 'BBBBBBBBB';

function splitFacelets(facelets: string): FaceLetter[][] {
  const faces: FaceLetter[][] = [];
  for (let i = 0; i < 6; i++) {
    faces.push(facelets.slice(i * 9, i * 9 + 9).split('') as FaceLetter[]);
  }
  return faces;
}

/** Rotate a 3x3 face 90° clockwise k times (k in 0..3). */
function rotateFaceCW(face: readonly FaceLetter[], k: number): FaceLetter[] {
  let out = [...face];
  for (let i = 0; i < k; i++) {
    const next: FaceLetter[] = new Array(9);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        next[r * 3 + c] = out[(2 - c) * 3 + r]!;
      }
    }
    out = next;
  }
  return out;
}

describe('resolveOrientation3x3', () => {
  it('returns the solved state unchanged', () => {
    const result = resolveOrientation3x3({ faces: splitFacelets(SOLVED) });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.facelets).toBe(SOLVED);
  });

  it('recovers the original state when each face is rotated by some amount', () => {
    // Solved cube → randomly rotate each face by 0..3 quarter-turns around its
    // normal. resolveOrientation must put them all back to the canonical
    // rotation since centres don't move under face rotation.
    const faces = splitFacelets(SOLVED);
    const rotated = faces.map((f, i) => rotateFaceCW(f, (i + 2) % 4));
    const result = resolveOrientation3x3({ faces: rotated });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.facelets).toBe(SOLVED);
  });

  it('resolves a scrambled cube', () => {
    const c = CubeJS.fromString(SOLVED);
    c.move("R U R' U' F2 B' L U2 D'");
    const scrambled = c.asString();
    // Rotate each face by an arbitrary number of quarter-turns to simulate
    // free-rotation capture.
    const faces = splitFacelets(scrambled);
    const rotated = [
      rotateFaceCW(faces[0]!, 1),
      rotateFaceCW(faces[1]!, 3),
      rotateFaceCW(faces[2]!, 2),
      rotateFaceCW(faces[3]!, 0),
      rotateFaceCW(faces[4]!, 2),
      rotateFaceCW(faces[5]!, 1),
    ];
    const result = resolveOrientation3x3({ faces: rotated });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.facelets).toBe(scrambled);
  });

  it('reports no_valid_orientation when a sticker is wrong', () => {
    const faces = splitFacelets(SOLVED);
    // Flip a non-centre sticker on the U face to F — breaks every corner/edge
    // it touches, so no rotation can produce a valid cube.
    faces[0]![0] = 'F';
    const result = resolveOrientation3x3({ faces });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no_valid_orientation');
  });

  it('reports no_valid_orientation when a centre is wrong', () => {
    const faces = splitFacelets(SOLVED);
    // Force a non-canonical centre on slot 0 (U slot). Caller should have
    // already routed this face to a different slot; if they didn't, we reject.
    faces[0]![4] = 'F';
    const result = resolveOrientation3x3({ faces });
    expect(result.ok).toBe(false);
  });

  it('handles a random scramble end-to-end across many face-rotation combinations', () => {
    // Sweep multiple scrambles and per-face rotation patterns to confirm the
    // resolver consistently lands on the unique correct orientation.
    const scrambles = [
      'R U R\' U\'',
      "F R U' R' U' R U R' F'",
      "R U R' U R U2 R'",
      "U R U' L' U R' U' L",
    ];
    for (const algo of scrambles) {
      const c = CubeJS.fromString(SOLVED);
      c.move(algo);
      const target = c.asString();
      const baseFaces = splitFacelets(target);
      for (let rU = 0; rU < 4; rU += 2) {
        for (let rF = 0; rF < 4; rF += 2) {
          for (let rR = 0; rR < 4; rR += 2) {
            const rotated = baseFaces.map((f, i) => {
              const ks = [rU, rR, rF, 1, 3, 2];
              return rotateFaceCW(f, ks[i]!);
            });
            const result = resolveOrientation3x3({ faces: rotated });
            expect(result.ok, `scramble=${algo} rU=${rU} rR=${rR} rF=${rF}`).toBe(true);
            if (result.ok) expect(result.facelets).toBe(target);
          }
        }
      }
    }
  });
});
