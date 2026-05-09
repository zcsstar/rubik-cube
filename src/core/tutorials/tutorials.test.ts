import { describe, it, expect } from 'vitest';
import { Cube2x2 } from '../cube/Cube2x2';
import { Cube3x3 } from '../cube/Cube3x3';
import { invertMoves, parseMoves, movesToString } from '../cube/moves';
import { tutorial3x3Beginner } from './tutorial3x3Beginner';
import { tutorial2x2Beginner } from './tutorial2x2Beginner';
import type { Tutorial } from './ITutorial';

/**
 * Tutorial round-trip: for every case, applying setup → algorithm should
 * land on a solved cube (or solved face for 2×2 step 1, where only the
 * starting face needs to be solid). Catches typos in author-supplied
 * setups or algorithms.
 */
function roundTripCheck(tutorial: Tutorial) {
  for (const step of tutorial.steps) {
    for (const c of step.cases) {
      const algorithm = parseMoves(c.algorithm);
      const setup = c.setup ? parseMoves(c.setup) : invertMoves(algorithm);
      const solved = tutorial.size === 2 ? Cube2x2.solved() : Cube3x3.solved();
      const after = solved.applyAll(setup).applyAll(algorithm);
      expect(after.isSolved(), `${tutorial.id} / ${step.id} / ${c.id} setup+algorithm did not return to solved (alg: ${movesToString(algorithm)})`).toBe(true);
    }
  }
}

describe('3x3 beginner tutorial', () => {
  it('every case round-trips: solved → setup → algorithm → solved', () => {
    roundTripCheck(tutorial3x3Beginner);
  });
});

describe('2x2 beginner tutorial', () => {
  it('every case round-trips', () => {
    roundTripCheck(tutorial2x2Beginner);
  });
});
