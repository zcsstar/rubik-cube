import type { CubeSize } from '@core/cube/ICube';
import { faceOffset } from '@core/cube/ICube';
import type { FaceLetter } from '@core/cube/colors';
import type { Move } from '@core/cube/moves';

/**
 * One sub-cube ("cubie") of an N×N×N cube. We render the cube as N³ cubies in a
 * grid; outward-facing faces carry coloured stickers. This representation is what
 * makes slice rotation animations straightforward — the slice is just "the
 * cubies whose axis-aligned coordinate matches the slice index", which we group
 * under an animated <group> while the rest stay still.
 *
 * (i, j, k) are integer coordinates in [0, N-1]:
 *   i runs along +X (left → right)
 *   j runs along +Y (down → up)
 *   k runs along +Z (back → front)
 */
export interface Cubie {
  i: number;
  j: number;
  k: number;
  /** World-space centre (size-1 cube spans [-0.5, 0.5]). */
  position: [number, number, number];
  /**
   * For each outward face direction, the colour letter on that sticker.
   * Inner faces (those pointing into the cube) are absent — they're black plastic.
   */
  stickers: Partial<Record<FaceLetter, FaceLetter>>;
}

/**
 * Map (cubie position, face) → flat facelet index in the URFDLB string.
 * Layout matches the cubejs / Kociemba convention; see colors.ts notes.
 */
export function faceletIndexFor(
  size: CubeSize,
  face: FaceLetter,
  i: number,
  j: number,
  k: number,
): number {
  const N = size;
  let row: number;
  let col: number;
  switch (face) {
    case 'U':
      row = k;
      col = i;
      break;
    case 'D':
      row = N - 1 - k;
      col = i;
      break;
    case 'F':
      row = N - 1 - j;
      col = i;
      break;
    case 'B':
      row = N - 1 - j;
      col = N - 1 - i;
      break;
    case 'R':
      row = N - 1 - j;
      col = N - 1 - k;
      break;
    case 'L':
      row = N - 1 - j;
      col = k;
      break;
  }
  return faceOffset(size, face) + row * N + col;
}

export function buildCubies(facelets: string, size: CubeSize): Cubie[] {
  const N = size;
  const cubies: Cubie[] = [];
  const cubieSize = 1 / N;
  // Centre offset to put cube centre at origin.
  const offset = (N - 1) / 2;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      for (let k = 0; k < N; k++) {
        // Skip cubies fully inside the cube — they're invisible.
        if (i > 0 && i < N - 1 && j > 0 && j < N - 1 && k > 0 && k < N - 1) continue;
        const stickers: Partial<Record<FaceLetter, FaceLetter>> = {};
        if (j === N - 1) stickers.U = facelets[faceletIndexFor(size, 'U', i, j, k)] as FaceLetter;
        if (j === 0) stickers.D = facelets[faceletIndexFor(size, 'D', i, j, k)] as FaceLetter;
        if (i === N - 1) stickers.R = facelets[faceletIndexFor(size, 'R', i, j, k)] as FaceLetter;
        if (i === 0) stickers.L = facelets[faceletIndexFor(size, 'L', i, j, k)] as FaceLetter;
        if (k === N - 1) stickers.F = facelets[faceletIndexFor(size, 'F', i, j, k)] as FaceLetter;
        if (k === 0) stickers.B = facelets[faceletIndexFor(size, 'B', i, j, k)] as FaceLetter;
        cubies.push({
          i,
          j,
          k,
          position: [
            (i - offset) * cubieSize,
            (j - offset) * cubieSize,
            (k - offset) * cubieSize,
          ],
          stickers,
        });
      }
    }
  }
  return cubies;
}

/**
 * True if the cubie is part of the slice rotated by `move`.
 *
 * For a face turn on face F (width 1), the slice is the outermost layer along F's normal.
 * For a wide turn (width 2), the slice is the outermost two layers.
 */
export function cubieInSlice(cubie: Cubie, move: Move, size: CubeSize): boolean {
  const N = size;
  const w = move.width;
  switch (move.face) {
    case 'U':
      return cubie.j >= N - w;
    case 'D':
      return cubie.j <= w - 1;
    case 'R':
      return cubie.i >= N - w;
    case 'L':
      return cubie.i <= w - 1;
    case 'F':
      return cubie.k >= N - w;
    case 'B':
      return cubie.k <= w - 1;
  }
}

/**
 * For a move, return the rotation axis as a (x, y, z) unit vector and the angle
 * (radians) to rotate from the "before" state to the "after" state. CW from
 * outside the face is the cubing convention.
 *
 * The sign convention is set so that animating a group's rotation from 0 to
 * `angle` about `axis` reproduces the move's effect on the slice.
 */
export function rotationForMove(move: Move): { axis: [number, number, number]; angle: number } {
  // Outward face normal × (–1 for CW from outside, +1 for CCW from outside).
  // Cubing uses right-hand rule about the INWARD normal for CW-from-outside.
  // Equivalently, a CW outer turn is a NEGATIVE rotation about the outward normal axis (right-hand).
  let axis: [number, number, number];
  switch (move.face) {
    case 'U':
      axis = [0, 1, 0];
      break;
    case 'D':
      axis = [0, -1, 0];
      break;
    case 'R':
      axis = [1, 0, 0];
      break;
    case 'L':
      axis = [-1, 0, 0];
      break;
    case 'F':
      axis = [0, 0, 1];
      break;
    case 'B':
      axis = [0, 0, -1];
      break;
  }
  // CW from outside = negative rotation about the outward normal (right-handed).
  const cwSign = -1;
  const magnitude =
    move.modifier === '2' ? Math.PI : move.modifier === "'" ? -Math.PI / 2 : Math.PI / 2;
  return { axis, angle: cwSign * magnitude };
}
