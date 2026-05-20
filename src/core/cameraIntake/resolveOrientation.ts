import CubeJS from 'cubejs';
import type { FaceLetter } from '../cube/colors';
import { URFDLB } from '../cube/ICube';

/**
 * Free-order / free-rotation camera intake → canonical facelet string.
 *
 * The camera flow lets the user shoot the 6 faces of a 3x3 in any order, held
 * in any rotation. We identify each face by its centre sticker's colour
 * (W→U, Y→D, G→F, B→B, R→R, O→L on a standard Western-scheme cube), so the
 * captured stickers can be slotted into URFDLB positions directly. What we
 * can't infer from the photo alone is each face's *rotation* around its
 * normal — there are 4 possibilities per face, giving 4⁶ = 4096 combinations.
 *
 * For each combination we build the 54-char facelet string and check piece
 * validity: every one of the 8 corner positions must hold exactly one of the
 * 8 canonical corner colour-triples, and every one of the 12 edge positions
 * must hold one of the 12 canonical edge colour-pairs, with no piece used
 * twice. A correctly-photographed cube produces exactly one passing
 * combination; misclassified stickers typically produce zero. Returning
 * `ambiguous` when more than one combination passes is theoretically possible
 * (symmetric/contrived patterns) but vanishingly rare on a real cube.
 *
 * Layout follows the cubejs / Kociemba convention (see
 * `node_modules/cubejs/lib/cube.js` for the canonical sticker→piece tables).
 */

export interface ResolveInput {
  /** Per-face stickers in URFDLB order. Each face has 9 stickers row-major
   *  in whatever rotation the camera saw — position 4 is the centre. */
  readonly faces: ReadonlyArray<readonly FaceLetter[]>;
}

export type ResolveResult =
  | { ok: true; facelets: string }
  | { ok: false; reason: 'no_valid_orientation' | 'ambiguous' };

// Face slot indices in URFDLB order.
const U = 0, R = 1, F = 2, D = 3, L = 4, B = 5;

/**
 * Corner positions (cubejs/Kociemba layout). Each inner array lists the 3
 * stickers that make up that physical corner, as `[faceIndex, indexInFace]`
 * pairs with indexInFace in 0..8 row-major.
 */
const CORNERS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [[U, 8], [R, 0], [F, 2]], // URF
  [[U, 6], [F, 0], [L, 2]], // UFL
  [[U, 0], [L, 0], [B, 2]], // ULB
  [[U, 2], [B, 0], [R, 2]], // UBR
  [[D, 2], [F, 8], [R, 6]], // DFR
  [[D, 0], [L, 8], [F, 6]], // DLF
  [[D, 6], [B, 8], [L, 6]], // DBL
  [[D, 8], [R, 8], [B, 6]], // DRB
];

/**
 * The 8 canonical corner colour-triples. Each is the sorted concatenation of
 * the 3 face-letters meeting at that corner. Order within a triple is
 * lexicographic so we can compare via string equality regardless of which
 * sticker the user happens to read first.
 */
const CORNER_KEYS: ReadonlySet<string> = new Set(
  [
    ['U', 'R', 'F'],
    ['U', 'F', 'L'],
    ['U', 'L', 'B'],
    ['U', 'B', 'R'],
    ['D', 'F', 'R'],
    ['D', 'L', 'F'],
    ['D', 'B', 'L'],
    ['D', 'R', 'B'],
  ].map(sortJoin),
);

const EDGES: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [[U, 5], [R, 1]], // UR
  [[U, 7], [F, 1]], // UF
  [[U, 3], [L, 1]], // UL
  [[U, 1], [B, 1]], // UB
  [[D, 5], [R, 7]], // DR
  [[D, 1], [F, 7]], // DF
  [[D, 3], [L, 7]], // DL
  [[D, 7], [B, 7]], // DB
  [[F, 5], [R, 3]], // FR
  [[F, 3], [L, 5]], // FL
  [[B, 5], [L, 3]], // BL
  [[B, 3], [R, 5]], // BR
];

const EDGE_KEYS: ReadonlySet<string> = new Set(
  [
    ['U', 'R'],
    ['U', 'F'],
    ['U', 'L'],
    ['U', 'B'],
    ['D', 'R'],
    ['D', 'F'],
    ['D', 'L'],
    ['D', 'B'],
    ['F', 'R'],
    ['F', 'L'],
    ['B', 'L'],
    ['B', 'R'],
  ].map(sortJoin),
);

function sortJoin(parts: readonly string[]): string {
  return [...parts].sort().join('');
}

/** 90° clockwise rotation of a 3x3 face (row-major). */
function rotate90CW(face: readonly FaceLetter[]): FaceLetter[] {
  // new[r][c] = old[2-c][r] for a 3x3.
  const out: FaceLetter[] = new Array(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out[r * 3 + c] = face[(2 - c) * 3 + r]!;
    }
  }
  return out;
}

function allRotations(face: readonly FaceLetter[]): FaceLetter[][] {
  const r0 = [...face];
  const r1 = rotate90CW(r0);
  const r2 = rotate90CW(r1);
  const r3 = rotate90CW(r2);
  return [r0, r1, r2, r3];
}

/**
 * Cheap first-pass: every corner position holds one of the 8 canonical
 * corner colour-triples, every edge position holds one of the 12 canonical
 * pairs, no piece used twice. Filters >99% of wrong-rotation candidates
 * before we pay for the cubejs parity check.
 */
function isPieceValid3x3(facelets: string): boolean {
  const seenCorners = new Set<string>();
  for (const corner of CORNERS) {
    const key = sortJoin(corner.map(([f, p]) => facelets[f * 9 + p]!));
    if (!CORNER_KEYS.has(key)) return false;
    if (seenCorners.has(key)) return false;
    seenCorners.add(key);
  }
  const seenEdges = new Set<string>();
  for (const edge of EDGES) {
    const key = sortJoin(edge.map(([f, p]) => facelets[f * 9 + p]!));
    if (!EDGE_KEYS.has(key)) return false;
    if (seenEdges.has(key)) return false;
    seenEdges.add(key);
  }
  return true;
}

interface CubeJSState {
  cp: number[];
  co: number[];
  ep: number[];
  eo: number[];
}

function permutationParity(perm: readonly number[]): number {
  let inv = 0;
  for (let i = 0; i < perm.length; i++) {
    for (let j = i + 1; j < perm.length; j++) {
      if (perm[i]! > perm[j]!) inv++;
    }
  }
  return inv % 2;
}

/**
 * Stricter check: the candidate must correspond to a physically reachable
 * cube state. Beyond piece identity we need (a) cp/ep are full permutations
 * — cubejs's fromString silently leaves slots at default 0 when it can't
 * match a piece; (b) corner-orientation sum ≡ 0 mod 3; (c) edge-orientation
 * sum ≡ 0 mod 2; (d) cp and ep have matching permutation parity. Without
 * these, certain commutator-style scrambles produce 2 or 3 piece-valid
 * candidates and we'd flag them as ambiguous.
 */
function isReachableState3x3(facelets: string): boolean {
  if (!isPieceValid3x3(facelets)) return false;
  const cube = CubeJS.fromString(facelets) as unknown as CubeJSState;
  if (new Set(cube.cp).size !== 8) return false;
  if (new Set(cube.ep).size !== 12) return false;
  let coSum = 0;
  for (const v of cube.co) coSum += v;
  if (coSum % 3 !== 0) return false;
  let eoSum = 0;
  for (const v of cube.eo) eoSum += v;
  if (eoSum % 2 !== 0) return false;
  if (permutationParity(cube.cp) !== permutationParity(cube.ep)) return false;
  return true;
}

function buildFacelets(faces: ReadonlyArray<readonly FaceLetter[]>): string {
  let out = '';
  for (let i = 0; i < 6; i++) out += faces[i]!.join('');
  return out;
}

/**
 * Resolve a 3x3 capture (free order, free rotation) into a canonical facelet
 * string. Pre-condition: `input.faces` is length 6 in URFDLB order — the
 * caller has already matched each captured face to its slot via the centre
 * colour.
 */
export function resolveOrientation3x3(input: ResolveInput): ResolveResult {
  if (input.faces.length !== 6) {
    return { ok: false, reason: 'no_valid_orientation' };
  }
  for (let i = 0; i < 6; i++) {
    if (input.faces[i]!.length !== 9) {
      return { ok: false, reason: 'no_valid_orientation' };
    }
    // Centre must match the slot (caller's responsibility, but check anyway).
    if (input.faces[i]![4] !== URFDLB[i]) {
      return { ok: false, reason: 'no_valid_orientation' };
    }
  }

  const rotsPerFace = input.faces.map(allRotations);
  // Use a Set to dedupe identical candidates — uniform faces (e.g. on a
  // solved cube) produce the same string under all 4 rotations, so 4⁶ raw
  // hits can collapse to a single unique facelet. We only care about whether
  // the set of *distinct* valid candidates is unique.
  const found = new Set<string>();

  for (let rU = 0; rU < 4; rU++) {
    for (let rR = 0; rR < 4; rR++) {
      for (let rF = 0; rF < 4; rF++) {
        for (let rD = 0; rD < 4; rD++) {
          for (let rL = 0; rL < 4; rL++) {
            for (let rB = 0; rB < 4; rB++) {
              const candidate = buildFacelets([
                rotsPerFace[0]![rU]!,
                rotsPerFace[1]![rR]!,
                rotsPerFace[2]![rF]!,
                rotsPerFace[3]![rD]!,
                rotsPerFace[4]![rL]!,
                rotsPerFace[5]![rB]!,
              ]);
              if (isReachableState3x3(candidate)) {
                found.add(candidate);
                if (found.size > 1) return { ok: false, reason: 'ambiguous' };
              }
            }
          }
        }
      }
    }
  }

  if (found.size === 0) return { ok: false, reason: 'no_valid_orientation' };
  const [only] = found;
  return { ok: true, facelets: only! };
}
