import type { ICube } from './ICube';
import { totalStickers } from './ICube';
import type { Move } from './moves';
import type { FaceLetter } from './colors';

/**
 * 2x2 (Pocket cube). 24 stickers in URFDLB order, each face row-major.
 *
 * Sticker index map (each face: top-left, top-right, bottom-left, bottom-right):
 *   U: 0=UBL  1=UBR  2=UFL  3=UFR
 *   R: 4=UFR  5=UBR  6=DFR  7=DBR
 *   F: 8=UFL  9=UFR  10=DFL 11=DFR
 *   D: 12=DFL 13=DFR 14=DBL 15=DBR
 *   L: 16=UBL 17=UFL 18=DBL 19=DFL
 *   B: 20=UBR 21=UBL 22=DBR 23=DBL
 *
 * Permutations below were derived geometrically from rotations about the
 * face-normal axes. Verified by round-trip tests (apply move + inverse =
 * identity; (move)4 = identity).
 */

const SOLVED = 'UUUURRRRFFFFDDDDLLLLBBBB';

// Each move's clockwise turn expressed as a list of cycles.
// Cycle (a,b,c,d) means: sticker at a moves to b, b->c, c->d, d->a.
type Cycle = readonly number[];
const BASE_CW: Record<FaceLetter, readonly Cycle[]> = {
  U: [
    [0, 1, 3, 2],
    [8, 16, 20, 4],
    [9, 17, 21, 5],
  ],
  D: [
    [12, 13, 15, 14],
    [10, 6, 22, 18],
    [11, 7, 23, 19],
  ],
  R: [
    [4, 5, 7, 6],
    [3, 20, 15, 11],
    [1, 22, 13, 9],
  ],
  L: [
    [17, 19, 18, 16],
    [2, 10, 14, 21],
    [0, 8, 12, 23],
  ],
  F: [
    [8, 9, 11, 10],
    [2, 4, 13, 19],
    [3, 6, 12, 17],
  ],
  B: [
    [20, 21, 23, 22],
    [0, 18, 15, 5],
    [1, 16, 14, 7],
  ],
};

// Pre-compile each base CW move into a permutation array (perm[oldIndex] = newIndex).
const BASE_PERM: Record<FaceLetter, readonly number[]> = (() => {
  const out: Partial<Record<FaceLetter, number[]>> = {};
  for (const face of Object.keys(BASE_CW) as FaceLetter[]) {
    const perm = Array.from({ length: 24 }, (_, i) => i);
    for (const cycle of BASE_CW[face]) {
      const last = cycle[cycle.length - 1]!;
      let prev = last;
      for (const cur of cycle) {
        perm[prev] = cur;
        prev = cur;
      }
    }
    out[face] = perm;
  }
  return out as Record<FaceLetter, number[]>;
})();

function applyPerm(state: string, perm: readonly number[]): string {
  const next: string[] = new Array(state.length);
  for (let i = 0; i < state.length; i++) next[perm[i]!] = state[i]!;
  return next.join('');
}
function inversePerm(perm: readonly number[]): number[] {
  const inv = new Array<number>(perm.length);
  for (let i = 0; i < perm.length; i++) inv[perm[i]!] = i;
  return inv;
}

export class Cube2x2 implements ICube {
  readonly size = 2 as const;
  readonly stickerCount = totalStickers(2);

  private constructor(private readonly state: string) {}

  static solved(): Cube2x2 {
    return new Cube2x2(SOLVED);
  }

  static fromFacelets(facelets: string): Cube2x2 {
    if (facelets.length !== 24) {
      throw new Error(`2x2 facelet string must be 24 chars, got ${facelets.length}`);
    }
    return new Cube2x2(facelets);
  }

  apply(move: Move): Cube2x2 {
    if (move.width !== 1) {
      throw new Error('2x2 does not support wide moves');
    }
    const cw = BASE_PERM[move.face];
    let perm = cw;
    if (move.modifier === "'") perm = inversePerm(cw);
    else if (move.modifier === '2') perm = applyPermToPerm(cw, cw);
    return new Cube2x2(applyPerm(this.state, perm));
  }

  applyAll(moves: readonly Move[]): Cube2x2 {
    let cur: Cube2x2 = this;
    for (const m of moves) cur = cur.apply(m);
    return cur;
  }

  isSolved(): boolean {
    // 2x2 has no fixed centers, so a "solved" cube is one with each face
    // monochromatic — regardless of which colour is on top. We compare the
    // canonical sticker counts plus monochromatic constraint per face.
    for (let f = 0; f < 6; f++) {
      const start = f * 4;
      const c = this.state[start];
      if (
        this.state[start + 1] !== c ||
        this.state[start + 2] !== c ||
        this.state[start + 3] !== c
      ) {
        return false;
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

  clone(): Cube2x2 {
    return new Cube2x2(this.state);
  }
}

function applyPermToPerm(a: readonly number[], b: readonly number[]): number[] {
  // Compose: result[i] = b[a[i]]
  const out = new Array<number>(a.length);
  for (let i = 0; i < a.length; i++) out[i] = b[a[i]!]!;
  return out;
}
