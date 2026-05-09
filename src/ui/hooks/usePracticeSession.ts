import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CubeSize, ICube } from '@core/cube/ICube';
import type { Move } from '@core/cube/moves';
import { invertMove } from '@core/cube/moves';
import { Cube2x2 } from '@core/cube/Cube2x2';
import { Cube3x3 } from '@core/cube/Cube3x3';

interface AnimationState {
  move: Move;
  /** History length the session will land on when the animation completes. */
  targetHistoryLen: number;
}

export interface PracticeSession {
  /** Logical cube state — always equal to the result of applyAll(history). */
  cube: ICube;
  /**
   * What the viewer should render right now. While animating, this is the
   * pre-move state so the viewer can animate the slice forward to `cube`.
   * When idle, identical to `cube`.
   */
  displayCube: ICube;
  /** The starting cube state (scramble) — what `reset()` returns to. */
  initial: ICube;
  size: CubeSize;
  /** Moves the user has applied since the last reset. */
  history: readonly Move[];
  animating: AnimationState | null;
  /** True when the cube reaches `goalPredicate(cube)`. */
  reached: boolean;

  applyMove: (move: Move) => void;
  undo: () => void;
  reset: () => void;
  finishAnimation: () => void;
  setInitial: (cube: ICube) => void;
}

function newSolved(size: CubeSize): ICube {
  if (size === 2) return Cube2x2.solved();
  if (size === 3) return Cube3x3.solved();
  throw new Error(`Unsupported size: ${size}`);
}

/**
 * Free-form practice on top of an arbitrary starting cube state. The user
 * applies moves; the session animates each one and records history.
 *
 * Goal detection: `goalPredicate(cube)` is called on every state change. The
 * session exposes `reached` so the UI can celebrate / prompt next.
 */
export function usePracticeSession(
  size: CubeSize,
  initialCube: ICube,
  goalPredicate: (cube: ICube) => boolean,
): PracticeSession {
  const [initial, setInitialState] = useState<ICube>(initialCube);
  const [history, setHistory] = useState<readonly Move[]>([]);
  const [animating, setAnimating] = useState<AnimationState | null>(null);

  // When the parent supplies a new initial cube (e.g., tutorial case change),
  // reset cleanly. Compare via facelet string since ICube is structurally typed.
  useEffect(() => {
    if (initialCube.toFaceletString() !== initial.toFaceletString()) {
      setInitialState(initialCube);
      setHistory([]);
      setAnimating(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCube]);

  const cube = useMemo(() => initial.applyAll(history), [initial, history]);

  const reached = useMemo(() => goalPredicate(cube), [cube, goalPredicate]);

  const finishAnimation = useCallback(() => {
    setAnimating(null);
  }, []);

  const applyMove = useCallback(
    (move: Move) => {
      // Skip incoming moves while we're already mid-animation; the user can
      // queue many quickly but they'll feel jerky if interrupted. Force the
      // current animation to its end first.
      if (animating) {
        setAnimating(null);
      }
      setHistory((prev) => {
        const next = [...prev, move];
        setAnimating({ move, targetHistoryLen: next.length });
        return next;
      });
    },
    [animating],
  );

  const undo = useCallback(() => {
    setAnimating(null);
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.slice(0, -1);
      const undone = prev[prev.length - 1]!;
      setAnimating({ move: invertMove(undone), targetHistoryLen: next.length });
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setHistory([]);
    setAnimating(null);
  }, []);

  const setInitial = useCallback((c: ICube) => {
    setInitialState(c);
    setHistory([]);
    setAnimating(null);
  }, []);

  // Pre-move display state for the cube viewer's animation contract. Both
  // `applyMove` and `undo` write the post-state to `cube`, then animate the
  // recorded move forward; the viewer needs the from-state, which we get by
  // un-applying the recorded move.
  const displayCube = useMemo(
    () => (animating ? cube.apply(invertMove(animating.move)) : cube),
    [cube, animating],
  );

  return {
    cube,
    displayCube,
    initial,
    size,
    history,
    animating,
    reached,
    applyMove,
    undo,
    reset,
    finishAnimation,
    setInitial,
  };
}

// Re-export so consumers don't need to import newSolved if they need a fallback.
export { newSolved as practiceSolved };
