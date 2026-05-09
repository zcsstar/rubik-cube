import type { FaceLetter } from './colors';

export type MoveModifier = '' | "'" | '2';
export type MoveWidth = 1 | 2;

/** Middle-slice rotations. */
export type SliceLetter = 'M' | 'E' | 'S';
/** Whole-cube rotations. */
export type RotationLetter = 'x' | 'y' | 'z';
/** Anything that can appear as a single move's "face" position. */
export type MoveTarget = FaceLetter | SliceLetter | RotationLetter;

export const SLICE_LETTERS: readonly SliceLetter[] = ['M', 'E', 'S'] as const;
export const ROTATION_LETTERS: readonly RotationLetter[] = ['x', 'y', 'z'] as const;

export function isSliceLetter(t: MoveTarget): t is SliceLetter {
  return t === 'M' || t === 'E' || t === 'S';
}
export function isRotationLetter(t: MoveTarget): t is RotationLetter {
  return t === 'x' || t === 'y' || t === 'z';
}
export function isFaceLetter(t: MoveTarget): t is FaceLetter {
  return t === 'U' || t === 'R' || t === 'F' || t === 'D' || t === 'L' || t === 'B';
}

export interface Move {
  /** Outer face (URFDLB), middle slice (MES) or whole-cube rotation (xyz). */
  face: MoveTarget;
  /** Modifier: '' = clockwise, "'" = counter-clockwise, '2' = 180°. */
  modifier: MoveModifier;
  /** 1 for outer-slice/MES/xyz, 2 for wide turn (Uw / u). Slices and rotations are always 1. */
  width: MoveWidth;
}

const FACE_RE = /^([URFDLB])(w)?(['2])?$/;
const LOWER_FACE_RE = /^([urfdlb])(['2])?$/;
const SLICE_RE = /^([MES])(['2])?$/;
const ROTATION_RE = /^([xyz])(['2])?$/;

/**
 * Parse a single move token. Supports:
 *   - Outer turns:   U R F D L B (with optional ' or 2)
 *   - Wide turns:    Uw, Rw, … OR lowercase u r f d l b (4×4+; 3×3 ignores the wide flag)
 *   - Slice turns:   M E S (with optional ' or 2)
 *   - Rotations:     x y z (with optional ' or 2)
 */
export function parseMove(token: string): Move {
  let m = FACE_RE.exec(token);
  if (m) {
    return {
      face: m[1] as FaceLetter,
      width: m[2] === 'w' ? 2 : 1,
      modifier: (m[3] ?? '') as MoveModifier,
    };
  }
  m = LOWER_FACE_RE.exec(token);
  if (m) {
    return {
      face: m[1]!.toUpperCase() as FaceLetter,
      width: 2,
      modifier: (m[2] ?? '') as MoveModifier,
    };
  }
  m = SLICE_RE.exec(token);
  if (m) {
    return {
      face: m[1] as SliceLetter,
      width: 1,
      modifier: (m[2] ?? '') as MoveModifier,
    };
  }
  m = ROTATION_RE.exec(token);
  if (m) {
    return {
      face: m[1] as RotationLetter,
      width: 1,
      modifier: (m[2] ?? '') as MoveModifier,
    };
  }
  throw new Error(`Invalid move: "${token}"`);
}

export function parseMoves(notation: string): Move[] {
  const tokens = notation.trim().split(/\s+/).filter(Boolean);
  return tokens.map(parseMove);
}

export function moveToString(move: Move): string {
  const wide = move.width === 2 && isFaceLetter(move.face) ? 'w' : '';
  return `${move.face}${wide}${move.modifier}`;
}

export function movesToString(moves: readonly Move[]): string {
  return moves.map(moveToString).join(' ');
}

export function invertMove(move: Move): Move {
  if (move.modifier === '2') return move;
  return { ...move, modifier: move.modifier === "'" ? '' : "'" };
}

export function invertMoves(moves: readonly Move[]): Move[] {
  return [...moves].reverse().map(invertMove);
}
