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
    const facelets3x3 = embed2x2In3x3(cube.toFaceletString());
    const cube3x3 = Cube3x3.fromFacelets(facelets3x3);
    return this.inner.solve(cube3x3);
  }
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
