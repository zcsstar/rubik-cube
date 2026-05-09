import { describe, it, expect } from 'vitest';
import { Cube2x2 } from './Cube2x2';
import { parseMove, parseMoves, invertMoves } from './moves';
import type { FaceLetter } from './colors';

const FACES: FaceLetter[] = ['U', 'R', 'F', 'D', 'L', 'B'];

describe('Cube2x2 base mechanics', () => {
  it('starts solved', () => {
    expect(Cube2x2.solved().isSolved()).toBe(true);
  });

  it('preserves the 4-per-face sticker count after every base move', () => {
    for (const face of FACES) {
      for (const mod of ['', "'", '2'] as const) {
        const cube = Cube2x2.solved().apply(parseMove(`${face}${mod}`));
        const s = cube.toFaceletString();
        const counts: Record<string, number> = {};
        for (const ch of s) counts[ch] = (counts[ch] ?? 0) + 1;
        for (const f of FACES) expect(counts[f]).toBe(4);
      }
    }
  });

  it('returns to solved after 4 repetitions of any CW move', () => {
    for (const face of FACES) {
      let c = Cube2x2.solved();
      for (let i = 0; i < 4; i++) c = c.apply(parseMove(face));
      expect(c.isSolved()).toBe(true);
      expect(c.toFaceletString()).toBe(Cube2x2.solved().toFaceletString());
    }
  });

  it("move + move' returns to solved", () => {
    for (const face of FACES) {
      const c = Cube2x2.solved().apply(parseMove(face)).apply(parseMove(`${face}'`));
      expect(c.isSolved()).toBe(true);
    }
  });

  it('move2 == move + move', () => {
    for (const face of FACES) {
      const a = Cube2x2.solved().apply(parseMove(`${face}2`));
      const b = Cube2x2.solved().apply(parseMove(face)).apply(parseMove(face));
      expect(a.toFaceletString()).toBe(b.toFaceletString());
    }
  });

  it('round-trips 1000 random sequences (length 1..20)', () => {
    for (let trial = 0; trial < 1000; trial++) {
      const len = 1 + Math.floor(Math.random() * 20);
      const seq = Array.from({ length: len }, () => {
        const face = FACES[Math.floor(Math.random() * FACES.length)]!;
        const mod = (['', "'", '2'] as const)[Math.floor(Math.random() * 3)]!;
        return parseMove(`${face}${mod}`);
      });
      const inv = invertMoves(seq);
      const c = Cube2x2.solved().applyAll(seq).applyAll(inv);
      expect(c.isSolved()).toBe(true);
    }
  });

  it('applies a known sequence and recognises non-solved state', () => {
    const c = Cube2x2.solved().applyAll(parseMoves("R U R' U'"));
    expect(c.isSolved()).toBe(false);
    // The classic "sexy move" applied 6 times returns to solved on a 3x3, but on 2x2 it
    // also returns to solved after 6 reps because corners cycle the same way.
    let c6 = Cube2x2.solved();
    for (let i = 0; i < 6; i++) c6 = c6.applyAll(parseMoves("R U R' U'"));
    expect(c6.isSolved()).toBe(true);
  });
});
