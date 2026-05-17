import type { ISolver } from './ISolver';
import type { ICube } from '../cube/ICube';
import { Cube3x3 } from '../cube/Cube3x3';
import { Solver3x3Kociemba } from './Solver3x3Kociemba';
import type { Move } from '../cube/moves';
import type { FaceLetter } from '../cube/colors';
import { URFDLB } from '../cube/ICube';

/**
 * 2x2 solver via 3x3 embedding.
 *
 * The 2x2 is the corner-only sub-cube of a 3x3. We embed the 24-sticker 2x2 state
 * into a 54-sticker 3x3 state by:
 *   - placing each 2x2 corner sticker at the corresponding 3x3 corner position;
 *   - filling the 12 edge positions and 6 centres with the face's identity colour
 *     (i.e., a "solved" edge-and-centre layout).
 *
 * Cubejs's Kociemba two-phase solver then returns a sequence of 3x3 moves that
 * solves the 3x3 — and because the 3x3 face moves coincide with 2x2 face moves,
 * the same sequence solves the 2x2. Solutions are typically 12-18 moves; not
 * optimal for the 2x2 group but always correct and computed in <0.5s.
 *
 * Class name kept as `Solver2x2BFS` for backward compatibility; the strategy is
 * private and could be swapped for a real 2x2 IDA* later without changing callers.
 */
export class Solver2x2BFS implements ISolver {
  readonly size = 2 as const;
  private readonly inner = new Solver3x3Kociemba();

  init(): Promise<void> {
    return this.inner.init();
  }

  async solve(cube: ICube): Promise<Move[]> {
    if (cube.size !== 2) throw new Error('Solver2x2BFS called with non-2x2 cube');
    if (cube.isSolved()) return [];
    // The 3x3 embedding fixes edges to solved (even permutation parity). The
    // embedded 3x3 is therefore only solvable when the 2x2's corner permutation
    // is also even — otherwise Kociemba searches the full IDA* depth (~22)
    // without finding a solution, which on mobile feels like the solver
    // hanging. Half of valid 2x2 states have odd corner parity. To get a
    // solvable embedding either way, prepend a single face move (which flips
    // parity by 3 transpositions = odd) when we'd otherwise embed an
    // odd-parity state; the prepended move is added to the returned solution
    // so it still solves the caller's cube end-to-end.
    let workCube: ICube = cube;
    let prefix: Move[] = [];
    const parity = cornerParity2x2(cube.toFaceletString());
    if (parity < 0) {
      throw new Error('2x2 state is invalid: stickers do not form valid corners.');
    }
    if (parity === 1) {
      const u: Move = { face: 'U', modifier: '', width: 1 };
      workCube = workCube.apply(u);
      prefix = [u];
      if (workCube.isSolved()) return prefix;
    }
    const facelets3x3 = embed2x2In3x3(workCube.toFaceletString());
    const cube3x3 = Cube3x3.fromFacelets(facelets3x3);
    const inner = await this.inner.solve(cube3x3);
    return [...prefix, ...inner];
  }
}

/**
 * The 8 corner positions of a 2x2 in URFDLB sticker-index layout. Order
 * matches the canonical corner identity below (CANONICAL_CORNERS).
 */
const CORNER_POSITIONS_2X2: readonly (readonly [number, number, number])[] = [
  [0, 16, 21],  // UBL
  [1, 5, 20],   // UBR
  [2, 8, 17],   // UFL
  [3, 4, 9],    // UFR
  [10, 12, 19], // DFL
  [6, 11, 13],  // DFR
  [14, 18, 23], // DBL
  [7, 15, 22],  // DBR
];

/** Lookup table: sorted sticker colours of a corner → canonical corner index. */
const CANONICAL_CORNERS: Readonly<Record<string, number>> = {
  BLU: 0, BRU: 1, FLU: 2, FRU: 3, DFL: 4, DFR: 5, BDL: 6, BDR: 7,
};

/**
 * Parity (0=even, 1=odd) of the 2x2's corner permutation. Returns -1 if the
 * facelet string doesn't form 8 valid corners. We need parity to decide
 * whether to prepend a face move before solving (see solve() above).
 */
export function cornerParity2x2(facelets: string): number {
  const perm: number[] = [];
  for (const [a, b, c] of CORNER_POSITIONS_2X2) {
    const key = [facelets[a], facelets[b], facelets[c]].sort().join('');
    const id = CANONICAL_CORNERS[key];
    if (id === undefined) return -1;
    perm.push(id);
  }
  // Verify it's a permutation (no duplicate corners).
  if (new Set(perm).size !== 8) return -1;
  let parity = 0;
  const seen = new Array<boolean>(8).fill(false);
  for (let i = 0; i < 8; i++) {
    if (seen[i]) continue;
    let len = 0;
    let j = i;
    while (!seen[j]) {
      seen[j] = true;
      j = perm[j]!;
      len++;
    }
    if (len % 2 === 0) parity ^= 1; // even-length cycle = odd permutation
  }
  return parity;
}

/**
 * Map a 24-char 2x2 facelet string to a 54-char 3x3 facelet string.
 *
 * 2x2 row-major indices on each face: 0 1 / 2 3.
 * 3x3 row-major indices on each face: 0 1 2 / 3 4 5 / 6 7 8.
 * Corners coincide at 3x3 positions 0, 2, 6, 8 (the four corners).
 * Edges (1, 3, 5, 7) and centre (4) are filled with the face identity letter.
 */
export function embed2x2In3x3(facelets2x2: string): string {
  if (facelets2x2.length !== 24) {
    throw new Error(`Expected 24-char 2x2 facelet string, got ${facelets2x2.length}`);
  }
  const cornerMap = [0, 2, 6, 8] as const;
  const out = new Array<string>(54).fill('');
  for (let f = 0; f < 6; f++) {
    const faceLetter: FaceLetter = URFDLB[f]!;
    const off2 = f * 4;
    const off3 = f * 9;
    for (let i = 0; i < 9; i++) out[off3 + i] = faceLetter;
    for (let c = 0; c < 4; c++) {
      out[off3 + cornerMap[c]!] = facelets2x2[off2 + c]!;
    }
  }
  return out.join('');
}
