import type { ISolver } from './ISolver';
import type { ICube } from '../cube/ICube';
import type { Move, MoveModifier } from '../cube/moves';
import type { FaceLetter } from '../cube/colors';
import { Cube2x2 } from '../cube/Cube2x2';

/**
 * Optimal 2×2 solver: the fewest face turns (half-turn metric).
 *
 * A 2×2 has no centres, so the corner at DBL can stay where it is: its three
 * stickers give the solved colours of the D, B and L faces, and the colour
 * scheme gives the opposite three. Turning only U, R and F never moves that
 * corner, which leaves 7!·3^6 = 3,674,160 states — every one solvable in at
 * most 11 turns (God's number for the 2×2). IDA* over a corner-permutation
 * coordinate (5040) and a corner-twist coordinate (729), each with an exact
 * distance table as its heuristic, finds a shortest solution in milliseconds.
 *
 * Solutions use U, R and F only and leave the cube in whatever orientation
 * the DBL corner dictates; `Cube2x2.isSolved()` accepts any orientation.
 */
export class Solver2x2Optimal implements ISolver {
  readonly size = 2 as const;

  init(): Promise<void> {
    tables();
    return Promise.resolve();
  }

  async solve(cube: ICube): Promise<Move[]> {
    if (cube.size !== 2) throw new Error('Solver2x2Optimal called with a non-2x2 cube');
    if (cube.isSolved()) return [];
    const corners = cornersFromFacelets(cube.toFaceletString());
    if (!corners) {
      throw new Error('2x2 state is invalid: stickers do not form valid corners.');
    }
    return solveCorners(corners).map(toMove);
  }
}

// ---------------------------------------------------------------------------
// Corner model (Kociemba's conventions)

/**
 * Sticker indices of the eight corner positions, in Kociemba's order
 * URF, UFL, ULB, UBR, DFR, DLF, DBL, DRB. Each lists the U/D sticker first,
 * then the other two clockwise as seen from outside the corner. Sticker
 * layout as in Cube2x2: URFDLB, each face row-major.
 */
const CORNER_STICKERS: readonly (readonly [number, number, number])[] = [
  [3, 4, 9], // URF
  [2, 8, 17], // UFL
  [0, 16, 21], // ULB
  [1, 20, 5], // UBR
  [13, 11, 6], // DFR
  [12, 19, 10], // DLF
  [14, 23, 18], // DBL — never moves
  [15, 7, 22], // DRB
];

/** The faces each corner position touches, in the same sticker order. */
const CORNER_FACES: readonly (readonly [FaceLetter, FaceLetter, FaceLetter])[] = [
  ['U', 'R', 'F'],
  ['U', 'F', 'L'],
  ['U', 'L', 'B'],
  ['U', 'B', 'R'],
  ['D', 'F', 'R'],
  ['D', 'L', 'F'],
  ['D', 'B', 'L'],
  ['D', 'R', 'B'],
];

const OPPOSITE: Readonly<Record<string, FaceLetter>> = {
  U: 'D',
  D: 'U',
  R: 'L',
  L: 'R',
  F: 'B',
  B: 'F',
};

export interface Corners {
  /** cp[i] = the corner (by home position) now at position i. */
  cp: number[];
  /** co[i] = twist of the corner at position i: where its U/D sticker sits (0–2). */
  co: number[];
}

/**
 * Read the corners of a 24-sticker 2×2 state relative to its DBL corner.
 * Returns null when the stickers don't form eight valid, distinct corners
 * with a legal total twist (a mis-painted or physically impossible cube).
 */
export function cornersFromFacelets(facelets: string): Corners | null {
  if (facelets.length !== 24) return null;
  const d = facelets[14]!;
  const b = facelets[23]!;
  const l = facelets[18]!;
  const u = OPPOSITE[d];
  const f = OPPOSITE[b];
  const r = OPPOSITE[l];
  if (!u || !f || !r) return null;
  const home: Record<FaceLetter, string> = { U: u, R: r, F: f, D: d, L: l, B: b };
  if (new Set(Object.values(home)).size !== 6) return null;

  const cp: number[] = [];
  const co: number[] = [];
  for (const stickers of CORNER_STICKERS) {
    let ori = 0;
    while (ori < 3) {
      const c = facelets[stickers[ori]!];
      if (c === home.U || c === home.D) break;
      ori++;
    }
    if (ori === 3) return null;
    const c0 = facelets[stickers[ori]!];
    const c1 = facelets[stickers[(ori + 1) % 3]!];
    const c2 = facelets[stickers[(ori + 2) % 3]!];
    const piece = CORNER_FACES.findIndex(
      ([f0, f1, f2]) => home[f0] === c0 && home[f1] === c1 && home[f2] === c2,
    );
    if (piece < 0) return null;
    cp.push(piece);
    co.push(ori);
  }
  if (new Set(cp).size !== 8) return null;
  if (co.reduce((s, x) => s + x, 0) % 3 !== 0) return null;
  return { cp, co };
}

// ---------------------------------------------------------------------------
// Coordinates, move tables and distance tables

const FACES: readonly FaceLetter[] = ['U', 'R', 'F'];
const MODIFIERS: readonly MoveModifier[] = ['', '2', "'"];
const N_MOVES = 9; // 3 faces × 3 turns; index = face * 3 + turn
const N_CP = 5040; // 7! arrangements of the corners other than DBL
const N_CO = 729; // 3^6 twists (the 7th follows from the total)
/** Positions that move (all but DBL), in coordinate order. */
const FREE = [0, 1, 2, 3, 4, 5, 7] as const;
const FACTORIAL = [1, 1, 2, 6, 24, 120, 720];

function encodeCp(cp: readonly number[]): number {
  const a = FREE.map((p) => (cp[p] === 7 ? 6 : cp[p]!));
  let index = 0;
  for (let i = 0; i < 7; i++) {
    let smaller = 0;
    for (let j = i + 1; j < 7; j++) if (a[j]! < a[i]!) smaller++;
    index += smaller * FACTORIAL[6 - i]!;
  }
  return index;
}

function decodeCp(index: number): number[] {
  const pool = [0, 1, 2, 3, 4, 5, 6];
  const cp = new Array<number>(8).fill(6);
  for (let i = 0; i < 7; i++) {
    const f = FACTORIAL[6 - i]!;
    const k = Math.floor(index / f);
    index %= f;
    const v = pool.splice(k, 1)[0]!;
    cp[FREE[i]!] = v === 6 ? 7 : v;
  }
  cp[6] = 6;
  return cp;
}

function encodeCo(co: readonly number[]): number {
  let index = 0;
  for (let p = 5; p >= 0; p--) index = index * 3 + co[p]!;
  return index;
}

function decodeCo(index: number): number[] {
  const co = new Array<number>(8).fill(0);
  let sum = 0;
  for (let p = 0; p < 6; p++) {
    co[p] = index % 3;
    sum += co[p]!;
    index = Math.floor(index / 3);
  }
  co[7] = (3 - (sum % 3)) % 3;
  return co;
}

interface Tables {
  cpMove: Uint16Array;
  coMove: Uint16Array;
  cpDist: Int8Array;
  coDist: Int8Array;
}

let cached: Tables | null = null;

function tables(): Tables {
  if (cached) return cached;
  // Each move's own corner permutation and twist, read off a solved cube
  // turned once, so the tables follow Cube2x2's sticker model exactly.
  const moves: Corners[] = [];
  for (const face of FACES) {
    for (const modifier of MODIFIERS) {
      const turned = Cube2x2.solved().apply({ face, modifier, width: 1 });
      moves.push(cornersFromFacelets(turned.toFaceletString())!);
    }
  }

  const cpMove = new Uint16Array(N_CP * N_MOVES);
  for (let c = 0; c < N_CP; c++) {
    const cp = decodeCp(c);
    for (let m = 0; m < N_MOVES; m++) {
      const mv = moves[m]!.cp;
      cpMove[c * N_MOVES + m] = encodeCp(mv.map((from) => cp[from]!));
    }
  }
  const coMove = new Uint16Array(N_CO * N_MOVES);
  for (let o = 0; o < N_CO; o++) {
    const co = decodeCo(o);
    for (let m = 0; m < N_MOVES; m++) {
      const { cp: mcp, co: mco } = moves[m]!;
      coMove[o * N_MOVES + m] = encodeCo(mcp.map((from, i) => (co[from]! + mco[i]!) % 3));
    }
  }

  cached = {
    cpMove,
    coMove,
    cpDist: distances(cpMove, N_CP),
    coDist: distances(coMove, N_CO),
  };
  return cached;
}

/** Breadth-first distance from the solved coordinate (0) to every coordinate. */
function distances(move: Uint16Array, n: number): Int8Array {
  const dist = new Int8Array(n).fill(-1);
  dist[0] = 0;
  let frontier = [0];
  for (let depth = 0; frontier.length > 0; depth++) {
    const next: number[] = [];
    for (const x of frontier) {
      for (let m = 0; m < N_MOVES; m++) {
        const y = move[x * N_MOVES + m]!;
        if (dist[y] === -1) {
          dist[y] = depth + 1;
          next.push(y);
        }
      }
    }
    frontier = next;
  }
  return dist;
}

// ---------------------------------------------------------------------------
// Search

/** God's number for the 2×2 is 11 turns; the bound only guards against bugs. */
const MAX_DEPTH = 14;

export function solveCorners(corners: Corners): number[] {
  const { cpMove, coMove, cpDist, coDist } = tables();
  const path: number[] = [];

  const search = (cp: number, co: number, g: number, bound: number, lastFace: number): boolean => {
    const h = Math.max(cpDist[cp]!, coDist[co]!);
    if (h === 0) return true;
    if (g + h > bound) return false;
    for (let face = 0; face < 3; face++) {
      if (face === lastFace) continue;
      for (let turn = 0; turn < 3; turn++) {
        const m = face * 3 + turn;
        path.push(m);
        if (search(cpMove[cp * N_MOVES + m]!, coMove[co * N_MOVES + m]!, g + 1, bound, face)) {
          return true;
        }
        path.pop();
      }
    }
    return false;
  };

  const cp0 = encodeCp(corners.cp);
  const co0 = encodeCo(corners.co);
  for (let bound = Math.max(cpDist[cp0]!, coDist[co0]!); bound <= MAX_DEPTH; bound++) {
    if (search(cp0, co0, 0, bound, -1)) return path;
  }
  throw new Error('2x2 solver found no solution within 14 turns.');
}

function toMove(m: number): Move {
  return { face: FACES[Math.floor(m / 3)]!, modifier: MODIFIERS[m % 3]!, width: 1 };
}
