import type { ISolver } from './ISolver';
import type { CubeSize } from '../cube/ICube';
import { Solver2x2BFS } from './Solver2x2BFS';
import { Solver3x3Kociemba } from './Solver3x3Kociemba';
import { BeginnerSolver3x3 } from './BeginnerSolver3x3';

export type SolverFlavour = 'fast' | 'beginner';

interface CacheKey {
  size: CubeSize;
  flavour: SolverFlavour;
}
const cache = new Map<string, ISolver>();
function k({ size, flavour }: CacheKey) {
  return `${size}/${flavour}`;
}

/**
 * Returns a singleton solver for the given cube size + flavour. The factory
 * is the only place in the codebase that names concrete solver classes; UI
 * code depends solely on ISolver.
 *
 *   - flavour === 'fast' (default): the shortest-move solver for that size.
 *     For 3×3, this is Kociemba (≤22 moves). For 2×2, the embedded-3×3
 *     trick. For 4×4, not yet implemented.
 *   - flavour === 'beginner': for 3×3, returns the layer-by-layer
 *     pedagogical solver whose output is labelled by phase (cross / first
 *     layer / middle layer / last layer). For 2×2, falls back to 'fast'
 *     because there's no LBL distinction on a 2×2 (Ortega itself is the
 *     beginner method, and its three steps don't map onto Kociemba's
 *     output anyway).
 */
export function getSolver(size: CubeSize, flavour: SolverFlavour = 'fast'): ISolver {
  const key = k({ size, flavour });
  const cached = cache.get(key);
  if (cached) return cached;
  let solver: ISolver;
  switch (size) {
    case 2:
      solver = new Solver2x2BFS();
      break;
    case 3:
      solver = flavour === 'beginner' ? new BeginnerSolver3x3() : new Solver3x3Kociemba();
      break;
    case 4:
      throw new Error('4x4 solver not yet implemented in this build.');
    default: {
      const _exhaustive: never = size;
      throw new Error(`Unsupported size: ${_exhaustive}`);
    }
  }
  cache.set(key, solver);
  return solver;
}
