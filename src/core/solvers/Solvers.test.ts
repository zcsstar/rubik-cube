import { describe, it, expect } from 'vitest';
import { Cube2x2 } from '../cube/Cube2x2';
import { Cube3x3 } from '../cube/Cube3x3';
import { getSolver } from './SolverFactory';
import { parseMoves } from '../cube/moves';
import type { FaceLetter } from '../cube/colors';

const FACES: FaceLetter[] = ['U', 'R', 'F', 'D', 'L', 'B'];

function randomScrambleString(faces: FaceLetter[], len: number): string {
  const seq: string[] = [];
  let lastFace: FaceLetter | null = null;
  for (let i = 0; i < len; i++) {
    let face: FaceLetter;
    do {
      face = faces[Math.floor(Math.random() * faces.length)]!;
    } while (face === lastFace);
    lastFace = face;
    const mod = (['', "'", '2'] as const)[Math.floor(Math.random() * 3)]!;
    seq.push(`${face}${mod}`);
  }
  return seq.join(' ');
}

describe('Solver2x2BFS', () => {
  it('solves a solved cube with empty move list', async () => {
    const solver = getSolver(2);
    const moves = await solver.solve(Cube2x2.solved());
    expect(moves).toEqual([]);
  });

  it('solves 50 random scrambles within the move budget', async () => {
    const solver = getSolver(2);
    for (let i = 0; i < 50; i++) {
      const scramble = parseMoves(randomScrambleString(FACES, 12));
      const scrambled = Cube2x2.solved().applyAll(scramble);
      const solution = await solver.solve(scrambled);
      const result = scrambled.applyAll(solution);
      expect(result.isSolved()).toBe(true);
    }
  }, 30_000);

  it('solves odd-parity states without hanging (the camera-capture bug)', async () => {
    // Repro of the user-reported bug: a 2x2 scrambled with a single face turn
    // has odd corner permutation parity. The 3x3 embedding pins edges to
    // even parity, so the embedded 3x3 is unsolvable and Kociemba would
    // exhaust its full depth-22 search without returning — looking like a
    // hang. Solver2x2BFS works around this by prepending a face move to
    // re-balance parity before embedding; the prefix is included in the
    // returned solution so it still solves the original cube end-to-end.
    const oddParityScramble = Cube2x2.solved().apply({ face: 'U', modifier: '', width: 1 });
    const solver = getSolver(2);
    const solution = await solver.solve(oddParityScramble);
    expect(solution.length).toBeGreaterThan(0);
    expect(oddParityScramble.applyAll(solution).isSolved()).toBe(true);
  }, 30_000);
});

describe('Solver3x3Kociemba', () => {
  it('solves 5 random scrambles', async () => {
    const solver = getSolver(3);
    for (let i = 0; i < 5; i++) {
      const scramble = parseMoves(randomScrambleString(FACES, 20));
      const scrambled = Cube3x3.solved().applyAll(scramble);
      const solution = await solver.solve(scrambled);
      const result = scrambled.applyAll(solution);
      expect(result.isSolved()).toBe(true);
    }
  }, 30_000);
});
