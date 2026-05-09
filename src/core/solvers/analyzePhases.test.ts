import { describe, it, expect } from 'vitest';
import { Cube3x3 } from '../cube/Cube3x3';
import { parseMoves } from '../cube/moves';
import { getSolver } from './SolverFactory';
import { analyzeSolutionPhases, isG1Move } from './analyzePhases';

describe('analyzeSolutionPhases (Kociemba 2-phase split)', () => {
  it('returns no phases for an empty solution', () => {
    expect(analyzeSolutionPhases(Cube3x3.solved(), [])).toEqual([]);
  });

  it('phase 2 contains only G1 moves; phase 1 boundary is contiguous', async () => {
    const solver = getSolver(3);
    for (let trial = 0; trial < 5; trial++) {
      const cube = Cube3x3.random();
      const moves = await solver.solve(cube);
      const phases = analyzeSolutionPhases(cube, moves);
      // No gaps, no overlaps.
      let cursor = 0;
      for (const p of phases) {
        expect(p.start).toBe(cursor);
        expect(p.end).toBeGreaterThanOrEqual(p.start);
        cursor = p.end + 1;
      }
      expect(cursor).toBe(moves.length);
      // The Finish phase, if present, must contain only G1 moves.
      const finish = phases.find((p) => p.name === 'Finish');
      if (finish) {
        for (let i = finish.start; i <= finish.end; i++) {
          expect(isG1Move(moves[i]!)).toBe(true);
        }
      }
    }
  }, 30_000);

  it('a solution made entirely of G1 moves comes back as a single Finish phase', () => {
    const moves = parseMoves('U R2 D2 L2 U2');
    const cube = Cube3x3.solved().applyAll(moves); // not necessarily solvable in this exact length, but ICube doesn't care
    const phases = analyzeSolutionPhases(cube, moves);
    expect(phases).toHaveLength(1);
    expect(phases[0]!.name).toBe('Finish');
    expect(phases[0]!.start).toBe(0);
    expect(phases[0]!.end).toBe(moves.length - 1);
  });

  it('a sequence with no G1 suffix comes back as a single Set-up phase', () => {
    const moves = parseMoves("R U R'");
    const cube = Cube3x3.solved().applyAll(moves);
    const phases = analyzeSolutionPhases(cube, moves);
    expect(phases).toHaveLength(1);
    expect(phases[0]!.name).toBe('Set-up');
  });
});
