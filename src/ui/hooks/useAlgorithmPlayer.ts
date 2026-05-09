import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CubeSize, ICube } from '@core/cube/ICube';
import type { Move } from '@core/cube/moves';
import { invertMove } from '@core/cube/moves';
import { Cube2x2 } from '@core/cube/Cube2x2';
import { Cube3x3 } from '@core/cube/Cube3x3';

interface AnimationState {
  move: Move;
  targetStep: number;
}

export interface AlgorithmPlayer {
  /** Cube at current visual step. */
  cube: ICube;
  /** Cube at start of algorithm (after setup, before solve). */
  initial: ICube;
  size: CubeSize;
  algorithm: readonly Move[];
  step: number;
  playing: boolean;
  animating: AnimationState | null;
  requestStep: (step: number) => void;
  finishAnimation: () => void;
  setPlaying: (playing: boolean) => void;
  /** Reset to step 0 (= initial state, just after setup). */
  reset: () => void;
}

function newSolved(size: CubeSize): ICube {
  if (size === 2) return Cube2x2.solved();
  if (size === 3) return Cube3x3.solved();
  throw new Error(`Unsupported size: ${size}`);
}

/**
 * Plays a fixed move sequence ("algorithm") on top of a setup state. Used by
 * tutorials where the moves are predetermined and the user just steps through.
 *
 * On every change of (setup, algorithm), the player resets to step 0 so that
 * switching tutorial cases drops you cleanly at the start of the new demo.
 */
export function useAlgorithmPlayer(
  size: CubeSize,
  setup: readonly Move[],
  algorithm: readonly Move[],
): AlgorithmPlayer {
  const initial = useMemo(() => newSolved(size).applyAll(setup), [size, setup]);

  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [animating, setAnimating] = useState<AnimationState | null>(null);

  // Reset on case change (initial reference / algorithm reference change).
  useEffect(() => {
    setStep(0);
    setPlaying(false);
    setAnimating(null);
  }, [initial, algorithm]);

  const cube = useMemo(() => initial.applyAll(algorithm.slice(0, step)), [initial, algorithm, step]);

  const finishAnimation = useCallback(() => {
    setAnimating((cur) => {
      if (cur) setStep(cur.targetStep);
      return null;
    });
  }, []);

  const requestStep = useCallback(
    (newStep: number) => {
      const clamped = Math.max(0, Math.min(algorithm.length, newStep));
      if (clamped === step) return;
      if (animating) {
        setStep(animating.targetStep);
        setAnimating(null);
      }
      const baseStep = animating ? animating.targetStep : step;
      if (Math.abs(clamped - baseStep) !== 1) {
        setStep(clamped);
        return;
      }
      const move = clamped > baseStep ? algorithm[baseStep]! : invertMove(algorithm[clamped]!);
      setAnimating({ move, targetStep: clamped });
    },
    [step, algorithm, animating],
  );

  const reset = useCallback(() => {
    setStep(0);
    setPlaying(false);
    setAnimating(null);
  }, []);

  return {
    cube,
    initial,
    size,
    algorithm,
    step,
    playing,
    animating,
    requestStep,
    finishAnimation,
    setPlaying,
    reset,
  };
}
