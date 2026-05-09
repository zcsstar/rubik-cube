import type { ISolver } from './ISolver';
import type { CubeSize } from '../cube/ICube';
import { Solver2x2BFS } from './Solver2x2BFS';
import { Solver3x3Kociemba } from './Solver3x3Kociemba';

const cache = new Map<CubeSize, ISolver>();

/**
 * Returns a singleton solver for the given cube size. Centralises the only
 * place in the codebase that names concrete solver classes — UI code depends
 * solely on ISolver.
 */
export function getSolver(size: CubeSize): ISolver {
  let solver = cache.get(size);
  if (solver) return solver;
  switch (size) {
    case 2:
      solver = new Solver2x2BFS();
      break;
    case 3:
      solver = new Solver3x3Kociemba();
      break;
    case 4:
      throw new Error('4x4 solver not yet implemented in this build.');
    default: {
      const _exhaustive: never = size;
      throw new Error(`Unsupported size: ${_exhaustive}`);
    }
  }
  cache.set(size, solver);
  return solver;
}
