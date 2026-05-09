import type { Move } from './moves';
import type { FaceLetter } from './colors';

export type CubeSize = 2 | 3 | 4;

/**
 * Read-only handle to a cube's facelet state.
 *
 * "Facelet string" convention: stickers in URFDLB order, each face row-major from
 * the perspective described in colors / docs. Each character is the FACE LETTER
 * (U/R/F/D/L/B) of the color currently at that sticker position on a solved cube.
 *   - 2x2: 24 chars (4 per face)
 *   - 3x3: 54 chars (9 per face)
 *   - 4x4: 96 chars (16 per face)
 */
export interface ICube {
  readonly size: CubeSize;

  /** Apply a single move and return a new immutable cube. */
  apply(move: Move): ICube;

  /** Apply a sequence of moves. */
  applyAll(moves: readonly Move[]): ICube;

  /** Whether the cube is in the solved state. */
  isSolved(): boolean;

  /**
   * Canonical facelet representation. The exact length depends on size.
   * Same string for two different ICube instances iff the visible state is identical.
   */
  toFaceletString(): string;

  /** Color letter at a given sticker index (0..stickerCount-1, in URFDLB order). */
  getFacelet(index: number): FaceLetter;

  /** Total sticker count = size*size*6. */
  readonly stickerCount: number;

  clone(): ICube;
}

export function stickersPerFace(size: CubeSize): number {
  return size * size;
}
export function totalStickers(size: CubeSize): number {
  return size * size * 6;
}

/** URFDLB face order, matching facelet-string layout. */
export const URFDLB: readonly FaceLetter[] = ['U', 'R', 'F', 'D', 'L', 'B'] as const;

export function faceOffset(size: CubeSize, face: FaceLetter): number {
  const idx = URFDLB.indexOf(face);
  if (idx < 0) throw new Error(`Bad face: ${face}`);
  return idx * stickersPerFace(size);
}
