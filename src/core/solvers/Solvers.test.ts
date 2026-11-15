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

describe('Solver2x2Optimal', () => {
  it('solves a solved cube with empty move list', async () => {
    const solver = getSolver(2);
    const moves = await solver.solve(Cube2x2.solved());
    expect(moves).toEqual([]);
  });

  it("solves 200 random scrambles in at most 11 turns (God's number)", async () => {
    const solver = getSolver(2);
    for (let i = 0; i < 200; i++) {
      const scramble = parseMoves(randomScrambleString(FACES, 25));
      const scrambled = Cube2x2.solved().applyAll(scramble);
      const solution = await solver.solve(scrambled);
      expect(solution.length).toBeLessThanOrEqual(11);
      expect(scrambled.applyAll(solution).isSolved()).toBe(true);
    }
  }, 30_000);

  it('never needs more turns than a short scramble took', async () => {
    const solver = getSolver(2);
    for (let len = 1; len <= 5; len++) {
      for (let i = 0; i < 20; i++) {
        const scrambled = Cube2x2.solved().applyAll(parseMoves(randomScrambleString(FACES, len)));
        const solution = await solver.solve(scrambled);
        expect(solution.length).toBeLessThanOrEqual(len);
        expect(scrambled.applyAll(solution).isSolved()).toBe(true);
      }
    }
  });

  it('undoes a single turn of any face with a single turn', async () => {
    // D, L and B turns move the DBL corner the solver keeps still; the cube
    // is still one turn from solved (the opposite face, cube held rotated).
    const solver = getSolver(2);
    for (const face of FACES) {
      for (const modifier of ['', "'", '2'] as const) {
        const scrambled = Cube2x2.solved().apply({ face, modifier, width: 1 });
        const solution = await solver.solve(scrambled);
        expect(solution).toHaveLength(1);
        expect(scrambled.applyAll(solution).isSolved()).toBe(true);
      }
    }
  });

  it('solves the cube in any whole-cube orientation', async () => {
    const solver = getSolver(2);
    const scramble = parseMoves("R U2 F' R' U F2 R U'");
    // Cube2x2 has no rotation moves; on a 2×2, R L' is x, U D' is y and F B' is z.
    const rotations = ['', "R L'", "U D'", "F B'", "R' L", 'U2 D2', "F' B", "R L' U D'", "U D' F2 B2"];
    for (const rotation of rotations) {
      const start = rotation ? Cube2x2.solved().applyAll(parseMoves(rotation)) : Cube2x2.solved();
      const scrambled = start.applyAll(scramble);
      const solution = await solver.solve(scrambled);
      expect(solution.length).toBeLessThanOrEqual(scramble.length);
      expect(scrambled.applyAll(solution).isSolved()).toBe(true);
    }
  });

  it('rejects a cube with one corner twisted in place', async () => {
    const facelets = Cube2x2.solved().toFaceletString().split('');
    // Twist the URF corner (stickers U3, R4, F9) clockwise.
    [facelets[3], facelets[4], facelets[9]] = [facelets[9]!, facelets[3]!, facelets[4]!];
    const twisted = Cube2x2.fromFacelets(facelets.join(''));
    await expect(getSolver(2).solve(twisted)).rejects.toThrow(/invalid/);
  });
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
