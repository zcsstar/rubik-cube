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
