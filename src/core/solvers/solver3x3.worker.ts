/// <reference lib="webworker" />
import CubeJS from 'cubejs';

/**
 * Kociemba solver Web Worker. Runs `cubejs.initSolver()` (large pruning-table
 * build, multi-second on mobile) and individual solves off the main thread so
 * the UI stays scrollable and the Solve button stays responsive.
 *
 * Message protocol (all messages tagged with a numeric `id` for RPC pairing):
 *   in:  { id, type: 'init' }
 *   in:  { id, type: 'solve', facelets }
 *   out: { id, ok: true, algorithm? }       — success, algorithm only on solve
 *   out: { id, ok: false, error: string }   — failure
 */

type InMessage =
  | { id: number; type: 'init' }
  | { id: number; type: 'solve'; facelets: string };

let initialized = false;

function ensureInitialized(): void {
  if (initialized) return;
  CubeJS.initSolver();
  initialized = true;
}

self.onmessage = (e: MessageEvent<InMessage>) => {
  const msg = e.data;
  try {
    if (msg.type === 'init') {
      ensureInitialized();
      (self as DedicatedWorkerGlobalScope).postMessage({ id: msg.id, ok: true });
      return;
    }
    if (msg.type === 'solve') {
      ensureInitialized();
      const cube = CubeJS.fromString(msg.facelets);
      const algorithm: string | null = cube.solve();
      (self as DedicatedWorkerGlobalScope).postMessage({ id: msg.id, ok: true, algorithm });
      return;
    }
  } catch (err) {
    (self as DedicatedWorkerGlobalScope).postMessage({
      id: (msg as { id: number }).id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
