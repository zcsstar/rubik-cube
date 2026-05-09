import CubeJS from 'cubejs';
import type { ISolver } from './ISolver';
import type { ICube } from '../cube/ICube';
import { parseMoves } from '../cube/moves';

let initPromise: Promise<void> | null = null;

/**
 * 3x3 solver that wraps cubejs's Kociemba two-phase implementation.
 * Solutions are typically <= 22 moves. Init takes ~1 second on first use as
 * pruning tables are built; subsequent solves are 10-400ms.
 */
export class Solver3x3Kociemba implements ISolver {
  readonly size = 3 as const;

  init(): Promise<void> {
    if (!initPromise) {
      initPromise = new Promise<void>((resolve) => {
        // cubejs.initSolver is synchronous and CPU-bound. Defer with a microtask
        // so callers awaiting init() don't block the synchronous call site.
        queueMicrotask(() => {
          CubeJS.initSolver();
          resolve();
        });
      });
    }
    return initPromise;
  }

  async solve(cube: ICube): Promise<ReturnType<typeof parseMoves>> {
    if (cube.size !== 3) throw new Error(`Solver3x3Kociemba called with size ${cube.size}`);
    if (cube.isSolved()) return [];
    await this.init();
    const c = CubeJS.fromString(cube.toFaceletString());
    const algo = c.solve();
    if (!algo) return [];
    return parseMoves(algo);
  }
}
