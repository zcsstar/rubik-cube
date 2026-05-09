import type { FaceLetter } from './colors';

export type MoveModifier = '' | "'" | '2';
export type MoveWidth = 1 | 2; // 1 = outer turn (R), 2 = wide turn (Rw / r)

export interface Move {
  /** Face being turned. */
  face: FaceLetter;
  /** Modifier: '' = clockwise, "'" = counter-clockwise, '2' = 180°. */
  modifier: MoveModifier;
  /** 1 for outer-slice turn, 2 for wide turn (e.g., Rw = r). Only relevant for 4x4+. */
  width: MoveWidth;
}

/**
 * Parse a move-notation string like "R U R' U2 Rw" into a list of moves.
 * Supports:
 *   - Outer turns: U R F D L B (with optional ' or 2 modifier)
 *   - Wide turns:  Uw Rw Fw Dw Lw Bw  OR lowercase u r f d l b (only for 4x4+)
 * Whitespace-separated. Throws on invalid tokens.
 */
export function parseMoves(notation: string): Move[] {
  const tokens = notation.trim().split(/\s+/).filter(Boolean);
  return tokens.map(parseMove);
}

const FACE_RE = /^([URFDLB])(w)?(['2])?$/;
const LOWER_FACE_RE = /^([urfdlb])(['2])?$/;

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
  throw new Error(`Invalid move: "${token}"`);
}

export function moveToString(move: Move): string {
  const wide = move.width === 2 ? 'w' : '';
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
