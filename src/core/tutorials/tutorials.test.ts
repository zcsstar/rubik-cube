import { describe, it, expect } from 'vitest';
import { Cube2x2 } from '../cube/Cube2x2';
import { Cube3x3 } from '../cube/Cube3x3';
import { invertMoves, parseMoves, movesToString } from '../cube/moves';
import { tutorial3x3Beginner } from './tutorial3x3Beginner';
import { tutorial2x2Beginner } from './tutorial2x2Beginner';
import { tutorial3x3Beginner_zh } from './tutorial3x3Beginner.zh';
import { tutorial2x2Beginner_zh } from './tutorial2x2Beginner.zh';
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

describe('3x3 beginner tutorial (en)', () => {
  it('every case round-trips: solved → setup → algorithm → solved', () => {
    roundTripCheck(tutorial3x3Beginner);
  });
});

describe('2x2 beginner tutorial (en)', () => {
  it('every case round-trips', () => {
    roundTripCheck(tutorial2x2Beginner);
  });
});

describe('3x3 beginner tutorial (zh)', () => {
  it('every case round-trips', () => {
    roundTripCheck(tutorial3x3Beginner_zh);
  });
  it('has the same step ids and case ids as the English version (locale-stable)', () => {
    expect(tutorial3x3Beginner_zh.steps.map((s) => s.id)).toEqual(
      tutorial3x3Beginner.steps.map((s) => s.id),
    );
    for (let i = 0; i < tutorial3x3Beginner.steps.length; i++) {
      expect(tutorial3x3Beginner_zh.steps[i]!.cases.map((c) => c.id)).toEqual(
        tutorial3x3Beginner.steps[i]!.cases.map((c) => c.id),
      );
    }
  });
});

describe('2x2 beginner tutorial (zh)', () => {
  it('every case round-trips', () => {
    roundTripCheck(tutorial2x2Beginner_zh);
  });
  it('matches the English structure', () => {
    expect(tutorial2x2Beginner_zh.steps.map((s) => s.id)).toEqual(
      tutorial2x2Beginner.steps.map((s) => s.id),
    );
  });
});
