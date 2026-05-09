import { useCallback, useMemo, useState } from 'react';
import type { ICube, CubeSize } from '@core/cube/ICube';
import type { Move } from '@core/cube/moves';
import { invertMove, movesToString } from '@core/cube/moves';
import { getSolver } from '@core/solvers/SolverFactory';
import { Cube2x2 } from '@core/cube/Cube2x2';
import { Cube3x3 } from '@core/cube/Cube3x3';

type SolveStatus = 'idle' | 'solving' | 'ready' | 'error';

interface AnimationState {
  /** The move being visually animated. */
  move: Move;
  /** Step the session will land on when animation completes. */
  targetStep: number;
}

export interface SolveSession {
  cube: ICube;
  initial: ICube;
  size: CubeSize;
  solution: readonly Move[];
  step: number;
  playing: boolean;
  status: SolveStatus;
  error: string | null;
  /** Non-null while a slice rotation is mid-animation. */
  animating: AnimationState | null;

  /**
   * Request a step change. Single-step deltas animate; jumps (reset, scrubbing
   * to a non-adjacent move) snap immediately.
   */
  requestStep: (step: number) => void;
  /** Skip current animation immediately to its target step. */
  finishAnimation: () => void;
  setPlaying: (playing: boolean) => void;
  scramble: () => void;
  solve: () => Promise<void>;
  resetToSolved: () => void;
  /** Replace the initial cube (e.g., from user-painted state). Resets solution. */
  setInitial: (cube: ICube) => void;
}

function newSolved(size: CubeSize): ICube {
  if (size === 2) return Cube2x2.solved();
  if (size === 3) return Cube3x3.solved();
  throw new Error(`Unsupported size for solved(): ${size}`);
}

function newRandom(size: CubeSize): ICube {
  if (size === 3) return Cube3x3.random();
  // For 2x2, scramble by applying ~15 random moves to a solved cube.
  let c: ICube = newSolved(size);
  const FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
  let lastFace: string | null = null;
  for (let i = 0; i < 15; i++) {
    let face: (typeof FACES)[number];
    do {
      face = FACES[Math.floor(Math.random() * FACES.length)]!;
    } while (face === lastFace);
    lastFace = face;
    const mod = (['', "'", '2'] as const)[Math.floor(Math.random() * 3)]!;
    c = c.apply({ face, modifier: mod, width: 1 });
  }
  return c;
}

export function useSolveSession(size: CubeSize): SolveSession {
  const [initial, setInitialState] = useState<ICube>(() => newSolved(size));
  const [solution, setSolution] = useState<readonly Move[]>([]);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState<SolveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [animating, setAnimating] = useState<AnimationState | null>(null);

  const cube = useMemo(() => {
    if (solution.length === 0) return initial;
    return initial.applyAll(solution.slice(0, step));
  }, [initial, solution, step]);

  const finishAnimation = useCallback(() => {
    setAnimating((cur) => {
      if (cur) setStep(cur.targetStep);
      return null;
    });
  }, []);

  const requestStep = useCallback(
    (newStep: number) => {
      const clamped = Math.max(0, Math.min(solution.length, newStep));
      if (clamped === step) return;
      // If an animation is already running, finish it instantly to avoid a
      // backlog of half-played slice rotations.
      if (animating) {
        setStep(animating.targetStep);
        setAnimating(null);
      }
      const baseStep = animating ? animating.targetStep : step;
      if (Math.abs(clamped - baseStep) !== 1) {
        // Multi-step jump: snap, no animation.
        setStep(clamped);
        return;
      }
      const move =
        clamped > baseStep
          ? solution[baseStep]!
          : invertMove(solution[clamped]!);
      setAnimating({ move, targetStep: clamped });
    },
    [step, solution, animating],
  );

  const scramble = useCallback(() => {
    setInitialState(newRandom(size));
    setSolution([]);
    setStep(0);
    setPlaying(false);
    setStatus('idle');
    setError(null);
    setAnimating(null);
  }, [size]);

  const solve = useCallback(async () => {
    setStatus('solving');
    setError(null);
    setPlaying(false);
    setAnimating(null);
    try {
      const solver = getSolver(size);
      const moves = await solver.solve(initial);
      setSolution(moves);
      setStep(0);
      setStatus('ready');
      // eslint-disable-next-line no-console
      console.debug('[solve]', size + 'x' + size, '→', movesToString(moves), `(${moves.length} moves)`);
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [initial, size]);

  const resetToSolved = useCallback(() => {
    setInitialState(newSolved(size));
    setSolution([]);
    setStep(0);
    setPlaying(false);
    setStatus('idle');
    setError(null);
    setAnimating(null);
  }, [size]);

  const setInitial = useCallback((c: ICube) => {
    setInitialState(c);
    setSolution([]);
    setStep(0);
    setPlaying(false);
    setStatus('idle');
    setError(null);
    setAnimating(null);
  }, []);

  return {
    cube,
    initial,
    size,
    solution,
    step,
    playing,
    status,
    error,
    animating,
    requestStep,
    finishAnimation,
    setPlaying,
    scramble,
    solve,
    resetToSolved,
    setInitial,
  };
}
