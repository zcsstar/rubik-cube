import { describe, it, expect } from 'vitest';
import { Cube3x3 } from '../cube/Cube3x3';
import { parseMoves } from '../cube/moves';
import { BeginnerSolver3x3 } from './BeginnerSolver3x3';

function randomScramble(len: number): string {
  const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
  const out: string[] = [];
  let last = '';
  for (let i = 0; i < len; i++) {
    let f: string;
    do {
      f = FACES[Math.floor(Math.random() * FACES.length)]!;
    } while (f === last);
    last = f;
    const mod = (['', "'", '2'] as const)[Math.floor(Math.random() * 3)]!;
    out.push(`${f}${mod}`);
  }
  return out.join(' ');
}

describe('BeginnerSolver3x3', () => {
  const solver = new BeginnerSolver3x3();

  it('returns no moves for a solved cube', async () => {
    expect(await solver.solve(Cube3x3.solved())).toEqual([]);
  });

  it('solves 5 random scrambles end-to-end', async () => {
    for (let trial = 0; trial < 5; trial++) {
      const scramble = parseMoves(randomScramble(20));
      const cube = Cube3x3.solved().applyAll(scramble);
      const solution = await solver.solve(cube);
      const result = cube.applyAll(solution);
      expect(result.isSolved(), `Trial ${trial}: scramble=${scramble.length} sol=${solution.length}`).toBe(true);
    }
  }, 60_000);

  it('phase output is labelled and ordered', async () => {
    const cube = Cube3x3.solved().applyAll(parseMoves(randomScramble(15)));
    const phases = await solver.solveWithPhases(cube);
    const ids = phases.map((p) => p.id);
    expect(ids).toEqual(['cross', 'first-layer', 'middle', 'last-layer']);
    const flat = phases.flatMap((p) => p.moves);
    expect(cube.applyAll(flat).isSolved()).toBe(true);
  }, 60_000);
});
