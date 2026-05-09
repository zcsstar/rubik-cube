import type { ICube } from './ICube';
import { stickersPerFace, totalStickers, URFDLB } from './ICube';
import type { FaceLetter } from './colors';
import type { Move } from './moves';
import { applyPermutation, generateMovePermutation, inversePermutation } from './permGenerator';
import { moveToString } from './moves';

/**
 * 4×4 cube state model. 96 facelets in URFDLB order, each face row-major.
 *
 * Move semantics:
 *   - Outer turns U R F D L B (width 1) rotate just the outer slice.
 *   - Wide turns Uw / Rw / … / lowercase u r f d l b (width 2) rotate the
 *     OUTER + adjacent inner layer together. This is the standard 4×4
 *     convention.
 *   - Slice moves M / E / S are not conventionally defined on even-sized
 *     cubes and degrade to no-ops here.
 *   - Whole-cube rotations x / y / z work.
 *
 * Move permutations are generated programmatically at module load time from
 * cube geometry — see permGenerator.ts.
 */

const SOLVED_4X4 = URFDLB.map((f) => f.repeat(stickersPerFace(4))).join('');

const PERM_CACHE = new Map<string, number[]>();
function permFor(move: Move): number[] {
  const key = moveToString(move);
  let p = PERM_CACHE.get(key);
  if (p) return p;
  p = generateMovePermutation(4, move);
  PERM_CACHE.set(key, p);
  return p;
}

export class Cube4x4 implements ICube {
  readonly size = 4 as const;
  readonly stickerCount = totalStickers(4);

  private constructor(private readonly state: string) {}

  static solved(): Cube4x4 {
    return new Cube4x4(SOLVED_4X4);
  }

  static fromFacelets(facelets: string): Cube4x4 {
    if (facelets.length !== 96) {
      throw new Error(`4x4 facelet string must be 96 chars, got ${facelets.length}`);
    }
    return new Cube4x4(facelets);
  }

  apply(move: Move): Cube4x4 {
    const perm = permFor(move);
    return new Cube4x4(applyPermutation(this.state, perm));
  }

  applyAll(moves: readonly Move[]): Cube4x4 {
    if (moves.length === 0) return this;
    let s = this.state;
    for (const m of moves) {
      s = applyPermutation(s, permFor(m));
    }
    return new Cube4x4(s);
  }

  isSolved(): boolean {
    // Each face must be a single colour.
    for (let f = 0; f < 6; f++) {
      const start = f * 16;
      const c = this.state[start];
      for (let i = 1; i < 16; i++) {
        if (this.state[start + i] !== c) return false;
      }
    }
    return true;
  }

  toFaceletString(): string {
    return this.state;
  }

  getFacelet(index: number): FaceLetter {
    return this.state[index] as FaceLetter;
  }

  clone(): Cube4x4 {
    return new Cube4x4(this.state);
  }
}

void inversePermutation;
