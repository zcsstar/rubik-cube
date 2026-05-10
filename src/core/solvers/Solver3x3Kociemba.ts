import CubeJS from 'cubejs';
import type { ISolver } from './ISolver';
import type { ICube } from '../cube/ICube';
import { parseMoves } from '../cube/moves';

/**
 * 3x3 solver that wraps cubejs's Kociemba two-phase implementation.
 *
 * Both `initSolver()` (builds large pruning tables) and `solve()` are
 * synchronous and CPU-bound — multi-second on mobile. We run them in a Web
 * Worker so the main thread stays responsive (page scrolls, Solve button
 * stays clickable). Falls back to running on the main thread when Worker
 * isn't available (tests under jsdom, exotic environments).
 *
 * Solutions are typically <= 22 moves. Init takes ~1s on desktop, 2-6s on
 * mobile, the first time only; subsequent solves are 50-400ms.
 */

interface RpcInit { id: number; type: 'init' }
interface RpcSolve { id: number; type: 'solve'; facelets: string }
type RpcRequest = RpcInit | RpcSolve;

interface RpcResponse {
  id: number;
  ok: boolean;
  algorithm?: string | null;
  error?: string;
}

interface PendingResolver {
  resolve: (value: RpcResponse) => void;
  reject: (reason: Error) => void;
}

let worker: Worker | null = null;
let workerUnavailable = false;
const pending = new Map<number, PendingResolver>();
let nextId = 0;

function getWorker(): Worker | null {
  if (worker) return worker;
  if (workerUnavailable) return null;
  if (typeof Worker === 'undefined') {
    workerUnavailable = true;
    return null;
  }
  try {
    const w = new Worker(new URL('./solver3x3.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<RpcResponse>) => {
      const handler = pending.get(e.data.id);
      if (!handler) return;
      pending.delete(e.data.id);
      handler.resolve(e.data);
    };
    w.onerror = (e) => {
      // Worker is dead — drain pending and disable for future calls so we
      // fall back to sync. Don't try to resurrect.
      const err = new Error(`Solver worker error: ${e.message ?? 'unknown'}`);
      for (const h of pending.values()) h.reject(err);
      pending.clear();
      worker = null;
      workerUnavailable = true;
    };
    worker = w;
    return w;
  } catch {
    workerUnavailable = true;
    return null;
  }
}

function rpc(message: Omit<RpcRequest, 'id'>): Promise<RpcResponse> | null {
  const w = getWorker();
  if (!w) return null;
  const id = nextId++;
  const fullMessage = { id, ...message } as RpcRequest;
  return new Promise<RpcResponse>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    try {
      w.postMessage(fullMessage);
    } catch (err) {
      pending.delete(id);
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

let initialized = false;
let initPromise: Promise<void> | null = null;

async function initInWorker(): Promise<void> {
  const promise = rpc({ type: 'init' });
  if (!promise) {
    // Worker unavailable — fall back to synchronous main-thread init.
    if (!initialized) {
      CubeJS.initSolver();
      initialized = true;
    }
    return;
  }
  const result = await promise;
  if (!result.ok) {
    // Worker reported error — try sync fallback so users still get a result.
    if (!initialized) {
      CubeJS.initSolver();
      initialized = true;
    }
    return;
  }
  initialized = true;
}

async function solveInWorkerOrSync(facelets: string): Promise<string | null> {
  const promise = rpc({ type: 'solve', facelets });
  if (!promise) {
    if (!initialized) {
      CubeJS.initSolver();
      initialized = true;
    }
    return CubeJS.fromString(facelets).solve();
  }
  const result = await promise;
  if (!result.ok) {
    // Solve failed in worker — best-effort sync fallback.
    if (!initialized) {
      CubeJS.initSolver();
      initialized = true;
    }
    return CubeJS.fromString(facelets).solve();
  }
  return result.algorithm ?? null;
}

export class Solver3x3Kociemba implements ISolver {
  readonly size = 3 as const;

  init(): Promise<void> {
    if (!initPromise) initPromise = initInWorker();
    return initPromise;
  }

  async solve(cube: ICube): Promise<ReturnType<typeof parseMoves>> {
    if (cube.size !== 3) throw new Error(`Solver3x3Kociemba called with size ${cube.size}`);
    if (cube.isSolved()) return [];
    await this.init();
    const algo = await solveInWorkerOrSync(cube.toFaceletString());
    if (!algo) return [];
    return parseMoves(algo);
  }
}
