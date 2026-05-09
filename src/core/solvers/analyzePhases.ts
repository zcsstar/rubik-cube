import type { ICube } from '../cube/ICube';
import type { Move } from '../cube/moves';

export interface SolutionPhase {
  /** Move index (0-based) where this phase BEGINS (inclusive). */
  start: number;
  /** Move index where this phase ENDS (inclusive). */
  end: number;
  /** Display name. */
  name: string;
  /** One-line plain-English description of what this phase achieves. */
  hint: string;
}

/**
 * Annotate a Kociemba solution with phase boundaries that match the algorithm's
 * actual structure: phase 1 uses any face turn to put the cube into the
 * Kociemba "G1" subgroup (edges oriented, corners oriented, E-slice edges in
 * E-slice); phase 2 finishes using only U, U', U2, D, D', D2 and the half-turns
 * R2, L2, F2, B2.
 *
 * That two-phase split IS the structure of the solution Kociemba just produced
 * — it's not a heuristic. We split by walking the solution from the end and
 * peeling off the longest suffix consisting only of G1 moves.
 *
 * Pure layer-by-layer (white cross → first layer → middle layer → yellow
 * cross → OLL → PLL) phases are NOT meaningful for a Kociemba solution,
 * because Kociemba reaches every milestone simultaneously on the last few
 * moves. A true LBL solver belongs in a separate `BeginnerSolver3x3` and is
 * deferred — see README.
 */
export function analyzeSolutionPhases(
  initial: ICube,
  solution: readonly Move[],
): SolutionPhase[] {
  if (initial.size !== 3) return [];
  if (solution.length === 0) return [];

  // Find the longest suffix where every move is in G1.
  let firstPhase2 = solution.length;
  for (let i = solution.length - 1; i >= 0; i--) {
    if (isG1Move(solution[i]!)) {
      firstPhase2 = i;
    } else {
      break;
    }
  }

  // Solution is purely in G1 from the start? Then it's "all phase 2".
  // Solution has no G1 suffix? Then it's "all phase 1".
  // Otherwise: split at firstPhase2.
  const hasPhase1 = firstPhase2 > 0;
  const hasPhase2 = firstPhase2 < solution.length;
  const phases: SolutionPhase[] = [];
  if (hasPhase1) {
    phases.push({
      start: 0,
      end: firstPhase2 - 1,
      name: 'Set-up',
      hint: 'Orient pieces and arrange the cube into a tidy intermediate state.',
    });
  }
  if (hasPhase2) {
    phases.push({
      start: firstPhase2,
      end: solution.length - 1,
      name: 'Finish',
      hint: 'Permute pieces using only top/bottom turns and 180° side flips.',
    });
  }
  return phases;
}

/**
 * G1 = the Kociemba phase-2 move group. A move is in G1 iff it never disturbs
 * the edge-orientation / E-slice invariants Kociemba's phase 1 establishes.
 * Concretely: U/D in any modifier; R/L/F/B only as 180° turns.
 */
export function isG1Move(move: Move): boolean {
  switch (move.face) {
    case 'U':
    case 'D':
      return true;
    case 'R':
    case 'L':
    case 'F':
    case 'B':
      return move.modifier === '2';
    // Slice (M/E/S) and whole-cube rotations (x/y/z) are NEVER part of the
    // G1 group — Kociemba's solver doesn't emit them, but defensive code path
    // for completeness.
    case 'M':
    case 'E':
    case 'S':
    case 'x':
    case 'y':
    case 'z':
      return false;
  }
}
