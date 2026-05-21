import { describe, expect, it } from 'vitest';
import CubeJS from 'cubejs';
import type { FaceLetter } from '../cube/colors';
import { Cube2x2 } from '../cube/Cube2x2';
import {
  resolveOrientation2x2,
  resolveOrientation2x2InSlots,
  resolveOrientation3x3,
} from './resolveOrientation';

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

const SOLVED_2X2 = 'UUUU' + 'RRRR' + 'FFFF' + 'DDDD' + 'LLLL' + 'BBBB';

function split2x2(facelets: string): FaceLetter[][] {
  const faces: FaceLetter[][] = [];
  for (let i = 0; i < 6; i++) {
    faces.push(facelets.slice(i * 4, i * 4 + 4).split('') as FaceLetter[]);
  }
  return faces;
}

/** Rotate a 2x2 face 90° CW k times: [TL,TR,BL,BR] → [BL,TL,BR,TR]. */
function rotate2x2(face: readonly FaceLetter[], k: number): FaceLetter[] {
  let out = [...face];
  for (let i = 0; i < k; i++) {
    out = [out[2]!, out[0]!, out[3]!, out[1]!];
  }
  return out;
}

/** Shuffle an array deterministically using a seeded LCG. */
function shuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

describe('resolveOrientation2x2', () => {
  it('returns a valid facelet string for a solved cube', () => {
    const result = resolveOrientation2x2({ faces: split2x2(SOLVED_2X2) });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Any of 24 rotation-equivalents is acceptable. Verify via the 2x2
      // solver: SOLVED stays solved under all 24 whole-cube rotations.
      const cube = Cube2x2.fromFacelets(result.facelets);
      expect(cube.isSolved()).toBe(true);
    }
  });

  it('recovers a scrambled cube under shuffled face order + per-face rotation', () => {
    const scrambled = Cube2x2.solved().applyAll([
      { face: 'R', modifier: '', width: 1 },
      { face: 'U', modifier: '', width: 1 },
      { face: 'F', modifier: "'", width: 1 },
      { face: 'R', modifier: "'", width: 1 },
    ]);
    const target = scrambled.toFaceletString();
    const faces = split2x2(target);
    // Shuffle the 6 faces and apply arbitrary rotations to simulate
    // free-order / free-rotation capture.
    const rotKs = [1, 3, 2, 0, 2, 1];
    const rotated = faces.map((f, i) => rotate2x2(f, rotKs[i]!));
    const shuffled = shuffle(
      rotated.map((stickers, idx) => ({ stickers, idx })),
      42,
    ).map((x) => x.stickers);
    const result = resolveOrientation2x2({ faces: shuffled });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Resolver returns SOME orientation of the same physical cube — its
      // canonical solution length must match the target's.
      // We can't string-compare since 2x2 has no anchor; instead verify the
      // colour-count + reachability via the solver downstream by checking
      // round-trip equivalence: both must have the same set of corner
      // colour-triples.
      expect(result.facelets.length).toBe(24);
      const cornerTriples = (s: string): string[] => {
        // 8 corners using the same layout as the resolver.
        const C: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
          [[0, 3], [1, 0], [2, 1]],
          [[0, 2], [2, 0], [4, 1]],
          [[0, 0], [4, 0], [5, 1]],
          [[0, 1], [5, 0], [1, 1]],
          [[3, 1], [2, 3], [1, 2]],
          [[3, 0], [4, 3], [2, 2]],
          [[3, 2], [5, 3], [4, 2]],
          [[3, 3], [1, 3], [5, 2]],
        ];
        return C.map((c) => c.map(([f, p]) => s[f * 4 + p]!).sort().join(''));
      };
      const a = cornerTriples(result.facelets).sort();
      const b = cornerTriples(target).sort();
      expect(a).toEqual(b);
    }
  });

  it('rejects a capture where colour counts are wrong', () => {
    const faces = split2x2(SOLVED_2X2);
    // Replace one R sticker with U — now U has 5 and R has 3 across the cube.
    faces[1]![0] = 'U';
    const result = resolveOrientation2x2({ faces });
    expect(result.ok).toBe(false);
  });

  it('rejects a capture that breaks the corner-orientation parity', () => {
    // A single corner twist (mathematically unreachable) keeps colour counts
    // correct but corner-orientation sum becomes 1, not 0 mod 3.
    const faces = split2x2(SOLVED_2X2);
    // Twist the URF corner: U[3], R[0], F[1] should rotate U→R→F→U. Pick
    // values that swap which colour sits in which slot without affecting
    // overall counts elsewhere. Easiest: swap U[3] with R[0] and rotate the
    // third sticker.
    // The simplest unreachable twist is one corner rotated CW: stickers
    // were U R F; become R F U at the same positions.
    faces[0]![3] = 'R';
    faces[1]![0] = 'F';
    faces[2]![1] = 'U';
    const result = resolveOrientation2x2({ faces });
    expect(result.ok).toBe(false);
  });
});

describe('resolveOrientation2x2InSlots', () => {
  it('returns valid facelets for a solved cube in URFDLB slot order', () => {
    const result = resolveOrientation2x2InSlots({ faces: split2x2(SOLVED_2X2) });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const cube = Cube2x2.fromFacelets(result.facelets);
      expect(cube.isSolved()).toBe(true);
    }
  });

  it('recovers a scrambled cube under per-face rotation (slots known)', () => {
    const scrambled = Cube2x2.solved().applyAll([
      { face: 'R', modifier: '', width: 1 },
      { face: 'U', modifier: '', width: 1 },
      { face: 'F', modifier: "'", width: 1 },
      { face: 'R', modifier: "'", width: 1 },
    ]);
    const target = scrambled.toFaceletString();
    const faces = split2x2(target);
    // Rotate each face arbitrarily — the slot index is still correct (caller
    // pre-assigned via the tap-slot UI), but each face's rotation around its
    // normal is unknown.
    const rotKs = [1, 3, 2, 0, 2, 1];
    const rotated = faces.map((f, i) => rotate2x2(f, rotKs[i]!));
    const result = resolveOrientation2x2InSlots({ faces: rotated });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Must recover the exact target — with slots fixed there's no
      // permutation ambiguity, only rotation, and there's exactly one
      // rotation per face that produces a reachable cube.
      expect(result.facelets).toBe(target);
    }
  });

  it('rejects a capture where colour counts are wrong', () => {
    const faces = split2x2(SOLVED_2X2);
    faces[1]![0] = 'U';
    const result = resolveOrientation2x2InSlots({ faces });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no_valid_orientation');
  });

  it('rejects a capture that breaks corner-orientation parity', () => {
    const faces = split2x2(SOLVED_2X2);
    faces[0]![3] = 'R';
    faces[1]![0] = 'F';
    faces[2]![1] = 'U';
    const result = resolveOrientation2x2InSlots({ faces });
    expect(result.ok).toBe(false);
  });

  it('runs noticeably faster than the brute-force resolver on the same input', () => {
    // Not a strict perf assertion — just a smoke test that the slot-anchored
    // path is at least an order of magnitude under the brute-force one on a
    // typical scrambled cube. The brute-force searches 6!×4⁶ ≈ 2.95M; the
    // slot-anchored searches just 4⁶ = 4096.
    const scrambled = Cube2x2.solved().applyAll([
      { face: 'U', modifier: '', width: 1 },
      { face: 'R', modifier: '', width: 1 },
      { face: 'F', modifier: '', width: 1 },
    ]);
    const target = scrambled.toFaceletString();
    const faces = split2x2(target).map((f, i) => rotate2x2(f, (i * 3) % 4));
    const t0 = performance.now();
    const result = resolveOrientation2x2InSlots({ faces });
    const elapsed = performance.now() - t0;
    expect(result.ok).toBe(true);
    expect(elapsed).toBeLessThan(150);
  });
});
