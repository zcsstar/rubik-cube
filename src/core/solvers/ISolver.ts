import type { ICube, CubeSize } from '../cube/ICube';
import type { Move } from '../cube/moves';

export interface ISolver {
  readonly size: CubeSize;
  /** Optional one-time setup (e.g., loading pruning tables). Idempotent. */
  init?(): Promise<void>;
  /** Returns a sequence of moves that solves the given cube state. */
  solve(cube: ICube): Promise<Move[]>;
}
