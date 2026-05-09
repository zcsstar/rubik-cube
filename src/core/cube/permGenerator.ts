import type { CubeSize } from './ICube';
import { faceOffset, URFDLB } from './ICube';
import type { FaceLetter } from './colors';
import type { Move, MoveTarget } from './moves';
import { isFaceLetter, isSliceLetter } from './moves';

/**
 * Programmatic permutation table generator for any N×N×N cube.
 *
 * Given a move (face / wide / slice / rotation), returns a permutation array
 * `perm` such that applying the move to a facelet string `s` is just
 * `out[perm[i]] = s[i]`.
 *
 * Strategy: for each sticker, compute the 3D position of the sub-cubie it sits
 * on plus the outward face normal of the sticker. Apply the move's rotation
 * (90° / 180° about an axis-aligned axis) to BOTH the cubie position AND the
 * normal. Map the rotated (position, normal) back to a sticker index. The
 * cube-centre coordinate `(N-1)/2` may be a half-integer (e.g., 1.5 for 4×4)
 * but every 90° rotation still maps integer cubie positions to integer cubie
 * positions, so the round trip is exact.
 */

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Cubie integer position from a sticker's (face, row, col). */
function cubieFromSticker(size: CubeSize, face: FaceLetter, row: number, col: number): Vec3 {
  const N = size;
  switch (face) {
    case 'U':
      return { x: col, y: N - 1, z: row };
    case 'D':
      return { x: col, y: 0, z: N - 1 - row };
    case 'F':
      return { x: col, y: N - 1 - row, z: N - 1 };
    case 'B':
      return { x: N - 1 - col, y: N - 1 - row, z: 0 };
    case 'R':
      return { x: N - 1, y: N - 1 - row, z: N - 1 - col };
    case 'L':
      return { x: 0, y: N - 1 - row, z: col };
  }
}

/** Outward normal vector for a face. */
function normalOf(face: FaceLetter): Vec3 {
  switch (face) {
    case 'U':
      return { x: 0, y: 1, z: 0 };
    case 'D':
      return { x: 0, y: -1, z: 0 };
    case 'R':
      return { x: 1, y: 0, z: 0 };
    case 'L':
      return { x: -1, y: 0, z: 0 };
    case 'F':
      return { x: 0, y: 0, z: 1 };
    case 'B':
      return { x: 0, y: 0, z: -1 };
  }
}

function faceFromNormal(n: Vec3): FaceLetter {
  if (n.y > 0.5) return 'U';
  if (n.y < -0.5) return 'D';
  if (n.x > 0.5) return 'R';
  if (n.x < -0.5) return 'L';
  if (n.z > 0.5) return 'F';
  return 'B';
}

/** Inverse of cubieFromSticker for a given face: given cubie position, return (row, col). */
function rowColOnFace(size: CubeSize, face: FaceLetter, p: Vec3): { row: number; col: number } {
  const N = size;
  switch (face) {
    case 'U':
      return { row: p.z, col: p.x };
    case 'D':
      return { row: N - 1 - p.z, col: p.x };
    case 'F':
      return { row: N - 1 - p.y, col: p.x };
    case 'B':
      return { row: N - 1 - p.y, col: N - 1 - p.x };
    case 'R':
      return { row: N - 1 - p.y, col: N - 1 - p.z };
    case 'L':
      return { row: N - 1 - p.y, col: p.z };
  }
}

/** Rotate a vector by a quarter-turn about an axis-aligned axis. */
function rotateAroundAxis(v: Vec3, axis: 'x' | 'y' | 'z', sign: 1 | -1): Vec3 {
  // sign = +1 means right-handed +90°; sign = -1 means -90°.
  switch (axis) {
    case 'x':
      // R_x(+90): (y, z) → (-z, y); R_x(-90): (y, z) → (z, -y)
      return sign === 1
        ? { x: v.x, y: -v.z, z: v.y }
        : { x: v.x, y: v.z, z: -v.y };
    case 'y':
      // R_y(+90): (x, z) → (z, -x); R_y(-90): (x, z) → (-z, x)
      return sign === 1
        ? { x: v.z, y: v.y, z: -v.x }
        : { x: -v.z, y: v.y, z: v.x };
    case 'z':
      // R_z(+90): (x, y) → (-y, x); R_z(-90): (x, y) → (y, -x)
      return sign === 1
        ? { x: -v.y, y: v.x, z: v.z }
        : { x: v.y, y: -v.x, z: v.z };
  }
}

/** Map a move target to a (rotation axis, CW/CCW sign) pair, in cubing convention. */
function rotationForTarget(target: MoveTarget): { axis: 'x' | 'y' | 'z'; sign: 1 | -1 } {
  // CW from outside the named face = negative right-handed rotation about
  // the outward normal axis.
  switch (target) {
    case 'U':
    case 'y':
      return { axis: 'y', sign: -1 };
    case 'D':
      return { axis: 'y', sign: 1 };
    case 'R':
    case 'x':
      return { axis: 'x', sign: -1 };
    case 'L':
      return { axis: 'x', sign: 1 };
    case 'F':
    case 'z':
      return { axis: 'z', sign: -1 };
    case 'B':
      return { axis: 'z', sign: 1 };
    case 'M':
      return { axis: 'x', sign: 1 }; // follows L
    case 'E':
      return { axis: 'y', sign: 1 }; // follows D
    case 'S':
      return { axis: 'z', sign: -1 }; // follows F
  }
}

/** Decide whether a cubie is in the slice rotated by `move` for an N-cube. */
function cubieInSlice(p: Vec3, move: Move, size: CubeSize): boolean {
  const N = size;
  const w = move.width;
  switch (move.face) {
    case 'U':
      return p.y >= N - w;
    case 'D':
      return p.y <= w - 1;
    case 'R':
      return p.x >= N - w;
    case 'L':
      return p.x <= w - 1;
    case 'F':
      return p.z >= N - w;
    case 'B':
      return p.z <= w - 1;
    case 'M':
      // Single central x-layer. Defined for odd N only; for even N the slice
      // is conventionally absent — degrade gracefully by selecting nothing.
      return N % 2 === 1 && p.x === Math.floor(N / 2);
    case 'E':
      return N % 2 === 1 && p.y === Math.floor(N / 2);
    case 'S':
      return N % 2 === 1 && p.z === Math.floor(N / 2);
    case 'x':
    case 'y':
    case 'z':
      return true; // whole-cube rotation
  }
}

/** Rotate (position, normal) about the cube centre by sign * 90°. */
function rotateOnce(
  pos: Vec3,
  normal: Vec3,
  axis: 'x' | 'y' | 'z',
  sign: 1 | -1,
  size: CubeSize,
): { pos: Vec3; normal: Vec3 } {
  const c = (size - 1) / 2;
  const centred: Vec3 = { x: pos.x - c, y: pos.y - c, z: pos.z - c };
  const rotated = rotateAroundAxis(centred, axis, sign);
  const out: Vec3 = { x: rotated.x + c, y: rotated.y + c, z: rotated.z + c };
  // Coerce floating-point fluff back to integers (multiplications can produce
  // -0 etc.). Cubie positions are always integers in [0, N-1].
  out.x = Math.round(out.x);
  out.y = Math.round(out.y);
  out.z = Math.round(out.z);
  return { pos: out, normal: rotateAroundAxis(normal, axis, sign) };
}

/**
 * Build the permutation array `perm` for a single move on an N-cube.
 *
 * Convention: applying the move to facelet string `s` produces `out` where
 * `out[perm[i]] = s[i]`, i.e., the sticker at position `i` ends up at
 * position `perm[i]`.
 */
export function generateMovePermutation(size: CubeSize, move: Move): number[] {
  const N = size;
  const total = 6 * N * N;
  const perm = new Array<number>(total);
  for (let i = 0; i < total; i++) perm[i] = i;

  const { axis, sign } = rotationForTarget(move.face);
  const repeats = move.modifier === '2' ? 2 : 1;
  const direction: 1 | -1 = move.modifier === "'" ? (sign === 1 ? -1 : 1) : sign;

  for (const face of URFDLB) {
    for (let row = 0; row < N; row++) {
      for (let col = 0; col < N; col++) {
        const oldIdx = faceOffset(size, face) + row * N + col;
        const pos0 = cubieFromSticker(size, face, row, col);
        const norm0 = normalOf(face);
        if (!cubieInSlice(pos0, move, size)) continue;
        let { pos, normal } = { pos: pos0, normal: norm0 };
        for (let r = 0; r < repeats; r++) {
          const next = rotateOnce(pos, normal, axis, direction, size);
          pos = next.pos;
          normal = next.normal;
        }
        const newFace = faceFromNormal(normal);
        const { row: newRow, col: newCol } = rowColOnFace(size, newFace, pos);
        const newIdx = faceOffset(size, newFace) + newRow * N + newCol;
        perm[oldIdx] = newIdx;
      }
    }
  }
  return perm;
}

/**
 * Apply a permutation to a facelet string: `out[perm[i]] = s[i]`.
 */
export function applyPermutation(s: string, perm: readonly number[]): string {
  const out = new Array<string>(s.length);
  for (let i = 0; i < s.length; i++) out[perm[i]!] = s[i]!;
  return out.join('');
}

/** Compose two permutations: `composed[i] = b[a[i]]` so that applying
 *  `composed` is equivalent to applying `a` then `b`. */
export function composePerm(a: readonly number[], b: readonly number[]): number[] {
  const out = new Array<number>(a.length);
  for (let i = 0; i < a.length; i++) out[i] = b[a[i]!]!;
  return out;
}

export function inversePermutation(perm: readonly number[]): number[] {
  const inv = new Array<number>(perm.length);
  for (let i = 0; i < perm.length; i++) inv[perm[i]!] = i;
  return inv;
}

void isFaceLetter;
void isSliceLetter;
