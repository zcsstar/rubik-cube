import { describe, it, expect } from 'vitest';
import { Cube3x3 } from './Cube3x3';
import { parseMove, parseMoves, invertMoves } from './moves';
import type { FaceLetter } from './colors';

const FACES: FaceLetter[] = ['U', 'R', 'F', 'D', 'L', 'B'];

describe('Cube3x3', () => {
  it('starts solved', () => {
    expect(Cube3x3.solved().isSolved()).toBe(true);
  });

  it('returns to solved after 4 reps of any CW move', () => {
    for (const face of FACES) {
      let c = Cube3x3.solved();
      for (let i = 0; i < 4; i++) c = c.apply(parseMove(face));
      expect(c.isSolved()).toBe(true);
    }
  });

  it("apply(m).apply(m') === solved", () => {
    for (const face of FACES) {
      const c = Cube3x3.solved().apply(parseMove(face)).apply(parseMove(`${face}'`));
      expect(c.isSolved()).toBe(true);
    }
  });

  it('round-trips 200 random sequences', () => {
    for (let trial = 0; trial < 200; trial++) {
      const len = 1 + Math.floor(Math.random() * 30);
      const seq = Array.from({ length: len }, () => {
        const face = FACES[Math.floor(Math.random() * FACES.length)]!;
        const mod = (['', "'", '2'] as const)[Math.floor(Math.random() * 3)]!;
        return parseMove(`${face}${mod}`);
      });
      const inv = invertMoves(seq);
      const c = Cube3x3.solved().applyAll(seq).applyAll(inv);
      expect(c.isSolved()).toBe(true);
    }
  });

  it('produces a 54-char URFDLB facelet string', () => {
    const s = Cube3x3.solved().toFaceletString();
    expect(s.length).toBe(54);
    expect(s).toBe('U'.repeat(9) + 'R'.repeat(9) + 'F'.repeat(9) + 'D'.repeat(9) + 'L'.repeat(9) + 'B'.repeat(9));
  });

  it('applying "sexy move" 6 times returns to solved', () => {
    let c = Cube3x3.solved();
    for (let i = 0; i < 6; i++) c = c.applyAll(parseMoves("R U R' U'"));
    expect(c.isSolved()).toBe(true);
  });
});
