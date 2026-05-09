import type { ISolver } from './ISolver';
import type { ICube } from '../cube/ICube';
import { Cube3x3 } from '../cube/Cube3x3';
import type { Move } from '../cube/moves';
import { parseMoves, movesToString } from '../cube/moves';
import { Solver3x3Kociemba } from './Solver3x3Kociemba';

/**
 * Hybrid LBL-style solver for 3×3.
 *
 * The honest framing: a *fully* layer-by-layer solver — one that emits the
 * exact human-recognisable triggers a kid sees in the tutorial — needs a
 * pattern-recognition database for ~60 sub-cases plus a partial-state
 * solver, and is a substantial separate project. What this class delivers
 * is the pragmatic next-best-thing:
 *
 *   1. **Cross**: a real BFS that finds the shortest move sequence to put
 *      the white cross in place. State dedup is keyed on just the eight
 *      cross stickers, so the search space is small (~250 K states max).
 *   2. **Everything else**: defer to Kociemba for the move sequence, then
 *      partition that sequence post-hoc by walking through it move-by-move
 *      and tagging the slice between two consecutive milestones — first
 *      layer, F2L done, last layer, solved.
 *
 * Solutions are typically 30–35 moves total (vs Kociemba's 22). The
 * pedagogical win over plain Kociemba is the labelled phase boundaries:
 * the StepViewer can show "Step 1: White cross", "Step 2: First layer",
 * etc. as the user clicks through, matching what the tutorials teach.
 */

export interface SolvedPhase {
  id: 'cross' | 'first-layer' | 'middle' | 'last-layer';
  name: string;
  moves: Move[];
}

export class BeginnerSolver3x3 implements ISolver {
  readonly size = 3 as const;
  private readonly kociemba = new Solver3x3Kociemba();

  init(): Promise<void> {
    return this.kociemba.init();
  }

  async solve(cube: ICube): Promise<Move[]> {
    const phases = await this.solveWithPhases(cube);
    return phases.flatMap((p) => p.moves);
  }

  async solveWithPhases(cube: ICube): Promise<SolvedPhase[]> {
    if (cube.size !== 3) throw new Error('BeginnerSolver3x3 requires a 3x3 cube');
    if (cube.isSolved()) return [];

    let current = cube as Cube3x3;
    const phases: SolvedPhase[] = [];

    // Phase 1: cross via BFS.
    const crossMoves = solveCross(current);
    phases.push({ id: 'cross', name: 'White cross', moves: crossMoves });
    current = current.applyAll(crossMoves) as Cube3x3;

    // Phases 2–4: defer to Kociemba and partition the result by milestones.
    const restMoves = await this.kociemba.solve(current);
    const partitioned = partitionByMilestones(current, restMoves);
    phases.push(...partitioned);

    // Sanity check.
    const finalState = (cube as Cube3x3).applyAll(phases.flatMap((p) => p.moves)) as Cube3x3;
    if (!finalState.isSolved()) {
      throw new Error(
        `BeginnerSolver3x3 finished but cube is not solved. Phases: ${phases
          .map((p) => p.id + '=' + movesToString(p.moves))
          .join(' | ')}`,
      );
    }
    return phases;
  }
}

// ============================================================================
// Cross via BFS
// ============================================================================

const ALL_FACE_MOVES: Move[] = parseMoves("U U' U2 R R' R2 F F' F2 D D' D2 L L' L2 B B' B2");

function solveCross(cube: Cube3x3): Move[] {
  if (isCrossSolved(cube)) return [];
  return constrainedBFS(cube, isCrossSolved, crossHash, /*maxDepth=*/ 8);
}

function constrainedBFS(
  start: Cube3x3,
  goal: (c: Cube3x3) => boolean,
  hashFn: (c: Cube3x3) => string,
  maxDepth: number,
): Move[] {
  if (goal(start)) return [];
  type Entry = { cube: Cube3x3; parent: number; move: Move | null };
  const frontier: Entry[] = [{ cube: start, parent: -1, move: null }];
  const visited = new Set<string>([hashFn(start)]);
  let cursor = 0;
  let depth = 0;
  let nextLevelStart = 1;
  while (cursor < frontier.length) {
    if (cursor === nextLevelStart) {
      depth++;
      if (depth > maxDepth) break;
      nextLevelStart = frontier.length;
    }
    const entry = frontier[cursor]!;
    const lastFace = entry.move ? entry.move.face : null;
    for (const move of ALL_FACE_MOVES) {
      if (move.face === lastFace) continue;
      const next = entry.cube.apply(move);
      const h = hashFn(next);
      if (visited.has(h)) continue;
      if (goal(next)) return reconstruct(frontier, cursor, move);
      visited.add(h);
      frontier.push({ cube: next, parent: cursor, move });
    }
    cursor++;
  }
  throw new Error(`BFS exhausted at depth ${maxDepth} without finding goal`);
}

function reconstruct(
  frontier: Array<{ parent: number; move: Move | null }>,
  parentIdx: number,
  lastMove: Move,
): Move[] {
  const out: Move[] = [lastMove];
  let cur = parentIdx;
  while (cur >= 0) {
    const e = frontier[cur]!;
    if (e.move) out.push(e.move);
    cur = e.parent;
  }
  return out.reverse();
}

// ============================================================================
// Phase partition: walk Kociemba's moves and tag boundaries by milestone
// ============================================================================

/**
 * Walk the move sequence applied to `start` and return slices for the
 * first-layer, middle-layer, and last-layer phases. A move is tagged with
 * a phase based on which milestone the cube has just-or-not-yet reached
 * after that move.
 *
 * Milestones (assuming we enter with cross already solved):
 *   - first-layer reached when isFirstLayerSolved(state) becomes stable.
 *   - F2L reached when isF2LSolved(state) becomes stable.
 *   - last-layer = everything from F2L done to solved.
 *
 * If a milestone is never reached as a stable suffix (e.g., Kociemba breaks
 * the cross mid-solve and only fixes everything at the very end), the
 * corresponding phase ends up empty and the moves fall into the latest
 * non-empty phase. That's pedagogically less crisp but always correct.
 */
function partitionByMilestones(initial: Cube3x3, moves: readonly Move[]): SolvedPhase[] {
  if (moves.length === 0) {
    return [
      { id: 'first-layer', name: 'First layer', moves: [] },
      { id: 'middle', name: 'Middle layer', moves: [] },
      { id: 'last-layer', name: 'Last layer', moves: [] },
    ];
  }
  // Compute state after each move.
  const states: Cube3x3[] = [initial];
  for (const m of moves) states.push(states[states.length - 1]!.apply(m));

  // Find the LAST stable suffix indices for each milestone, similar to
  // `analyzeSolutionPhases`. firstLayerEnd / f2lEnd are inclusive move
  // indices where each milestone first becomes stable through end.
  const firstLayerStartFromEnd = lastStableTransition(states, isFirstLayerSolved);
  const f2lStartFromEnd = lastStableTransition(states, isF2LSolved);

  // Translate state indices into move-slice boundaries.
  // `firstLayerStartFromEnd` is the smallest state index s.t. isFirstLayerSolved
  // holds for all states[s..end]. Moves up to and including index s-1 belong
  // to the "first-layer" phase.
  const firstLayerMoves = moves.slice(0, Math.max(0, firstLayerStartFromEnd));
  const middleMoves = moves.slice(
    Math.max(0, firstLayerStartFromEnd),
    Math.max(firstLayerStartFromEnd, f2lStartFromEnd),
  );
  const lastLayerMoves = moves.slice(Math.max(firstLayerStartFromEnd, f2lStartFromEnd));

  return [
    { id: 'first-layer', name: 'First layer (white corners)', moves: [...firstLayerMoves] },
    { id: 'middle', name: 'Middle layer (F2L edges)', moves: [...middleMoves] },
    { id: 'last-layer', name: 'Last layer', moves: [...lastLayerMoves] },
  ];
}

/**
 * Return the smallest state index s.t. `predicate(states[s..end])` is true
 * for all subsequent states. If no such index exists (i.e., even the last
 * state fails), return states.length (no stable suffix). If the predicate
 * holds from index 0, return 0.
 */
function lastStableTransition(states: Cube3x3[], predicate: (c: Cube3x3) => boolean): number {
  for (let i = states.length - 1; i >= 0; i--) {
    if (!predicate(states[i]!)) return i + 1;
  }
  return 0;
}

// ============================================================================
// State predicates and hashes
// ============================================================================

const U_FACE = 0;
const R_FACE = 1;
const F_FACE = 2;
const L_FACE = 4;
const B_FACE = 5;
const FACE_LETTERS = ['U', 'R', 'F', 'D', 'L', 'B'] as const;

function st(facelets: string, face: number, row: number, col: number): string {
  return facelets[face * 9 + row * 3 + col]!;
}

function crossHash(c: Cube3x3): string {
  const s = c.toFaceletString();
  return s[1]! + s[3]! + s[5]! + s[7]! + s[19]! + s[10]! + s[46]! + s[37]!;
}

function isCrossSolved(c: Cube3x3): boolean {
  const s = c.toFaceletString();
  return (
    st(s, U_FACE, 0, 1) === 'U' &&
    st(s, U_FACE, 1, 0) === 'U' &&
    st(s, U_FACE, 1, 2) === 'U' &&
    st(s, U_FACE, 2, 1) === 'U' &&
    st(s, F_FACE, 0, 1) === 'F' &&
    st(s, R_FACE, 0, 1) === 'R' &&
    st(s, B_FACE, 0, 1) === 'B' &&
    st(s, L_FACE, 0, 1) === 'L'
  );
}

function isFirstLayerSolved(c: Cube3x3): boolean {
  if (!isCrossSolved(c)) return false;
  const s = c.toFaceletString();
  if (
    st(s, U_FACE, 0, 0) !== 'U' ||
    st(s, U_FACE, 0, 2) !== 'U' ||
    st(s, U_FACE, 2, 0) !== 'U' ||
    st(s, U_FACE, 2, 2) !== 'U'
  )
    return false;
  for (const face of [F_FACE, R_FACE, B_FACE, L_FACE]) {
    const letter = FACE_LETTERS[face]!;
    if (st(s, face, 0, 0) !== letter || st(s, face, 0, 2) !== letter) return false;
  }
  return true;
}

function isF2LSolved(c: Cube3x3): boolean {
  if (!isFirstLayerSolved(c)) return false;
  const s = c.toFaceletString();
  for (const face of [F_FACE, R_FACE, B_FACE, L_FACE]) {
    const letter = FACE_LETTERS[face]!;
    if (st(s, face, 1, 0) !== letter || st(s, face, 1, 2) !== letter) return false;
  }
  return true;
}
