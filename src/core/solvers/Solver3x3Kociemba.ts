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

// Per-message timeouts. Init builds Kociemba's pruning tables and can take
// several seconds on first run on a slow mobile CPU; solve is normally
// <500 ms but Kociemba is not guaranteed to terminate on cubes that aren't
// reachable from solved (a mis-painted sticker is enough). Both cases used
// to deadlock the Solve button forever — bound them here so a stuck worker
// surfaces as a recoverable error and the next click re-spawns it.
const INIT_TIMEOUT_MS = 30_000;
const SOLVE_TIMEOUT_MS = 15_000;

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

/**
 * Tear down a stuck worker and reset module state so the next solve attempt
 * spawns a fresh one. Used by the RPC timeout path: if Kociemba's solver
 * spins on a bad state or WKWebView silently kills the worker under memory
 * pressure, this is what unblocks the UI.
 */
function resetWorker(reason: string): void {
  const dead = worker;
  worker = null;
  initPromise = null;
  const err = new Error(reason);
  for (const h of pending.values()) h.reject(err);
  pending.clear();
  if (dead) {
    try { dead.terminate(); } catch { /* ignore */ }
  }
}

/**
 * Distributive Omit — preserves union members instead of collapsing them.
 * Plain `Omit<RpcInit | RpcSolve, 'id'>` would erase `facelets` because Omit
 * Pick's the intersection of keys. The `T extends T` form is the standard
 * trick to make a conditional type distribute over a union.
 */
type DistributiveOmit<T, K extends keyof T> = T extends T ? Omit<T, K> : never;
type RpcRequestPayload = DistributiveOmit<RpcRequest, 'id'>;

function rpc(message: RpcRequestPayload, timeoutMs: number): Promise<RpcResponse> | null {
  const w = getWorker();
  if (!w) return null;
  const id = nextId++;
  const fullMessage = { id, ...message } as RpcRequest;
  return new Promise<RpcResponse>((resolve, reject) => {
    const timer = setTimeout(() => {
      // Worker hasn't replied in time. Could be dead (WKWebView OOM-kill) or
      // stuck in cube.solve() on an invalid state. Either way, terminate and
      // let the caller fall back to sync / surface an error.
      if (!pending.has(id)) return;
      resetWorker(`Solver ${message.type} timed out after ${timeoutMs} ms`);
    }, timeoutMs);
    pending.set(id, {
      resolve: (val) => { clearTimeout(timer); resolve(val); },
      reject: (err) => { clearTimeout(timer); reject(err); },
    });
    try {
      w.postMessage(fullMessage);
    } catch (err) {
      clearTimeout(timer);
      pending.delete(id);
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

// Tracks whether the *main thread's* cubejs has run `initSolver()`. The
// worker uses a separate module instance so it has its own equivalent flag
// inside solver3x3.worker.ts — flipping this one doesn't help the worker
// and vice versa.
let mainThreadInitialized = false;
let initPromise: Promise<void> | null = null;

function initOnMainThread(): void {
  if (mainThreadInitialized) return;
  CubeJS.initSolver();
  mainThreadInitialized = true;
}

async function initInWorker(): Promise<void> {
  const promise = rpc({ type: 'init' }, INIT_TIMEOUT_MS);
  if (!promise) {
    // Worker unavailable — fall back to synchronous main-thread init.
    initOnMainThread();
    return;
  }
  let result: RpcResponse;
  try {
    result = await promise;
  } catch {
    // Worker died, timed out, or postMessage threw. Fall back to sync so the
    // next solve still works instead of leaving init() permanently rejected.
    initOnMainThread();
    return;
  }
  if (!result.ok) {
    initOnMainThread();
  }
}

async function solveInWorkerOrSync(facelets: string): Promise<string | null> {
  const promise = rpc({ type: 'solve', facelets }, SOLVE_TIMEOUT_MS);
  if (!promise) {
    initOnMainThread();
    return CubeJS.fromString(facelets).solve();
  }
  let result: RpcResponse;
  try {
    result = await promise;
  } catch (err) {
    // Worker timed out / was killed. Surface the error to the caller so the
    // UI can show a recoverable message rather than spin on "Solving…".
    // Don't auto-retry on the main thread: a worker timeout often means the
    // input is unsolvable, and cubejs.solve() on main thread would freeze
    // the whole UI the same way.
    throw err instanceof Error ? err : new Error(String(err));
  }
  if (!result.ok) {
    // Worker reported a structured error (e.g. cubejs threw). Try sync once
    // as a best-effort fallback for transient worker hiccups.
    initOnMainThread();
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
