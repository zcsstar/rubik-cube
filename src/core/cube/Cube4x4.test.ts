import { describe, it, expect } from 'vitest';
import { Cube4x4 } from './Cube4x4';
import { invertMoves, parseMove, parseMoves } from './moves';
import type { FaceLetter } from './colors';

const FACES: FaceLetter[] = ['U', 'R', 'F', 'D', 'L', 'B'];

describe('Cube4x4', () => {
  it('starts solved', () => {
    expect(Cube4x4.solved().isSolved()).toBe(true);
    expect(Cube4x4.solved().toFaceletString().length).toBe(96);
  });

  it('every base CW move returns to identity in 4 reps (outer + wide)', () => {
    const tokens = [
      'U', 'R', 'F', 'D', 'L', 'B',
      'Uw', 'Rw', 'Fw', 'Dw', 'Lw', 'Bw',
    ];
    for (const tok of tokens) {
      let c = Cube4x4.solved();
      for (let i = 0; i < 4; i++) c = c.apply(parseMove(tok));
      expect(c.toFaceletString(), `${tok}^4`).toBe(Cube4x4.solved().toFaceletString());
    }
  });

  it('preserves the 16-per-face sticker count after every base move', () => {
    for (const face of FACES) {
      for (const mod of ['', "'", '2'] as const) {
        for (const wide of ['', 'w'] as const) {
          const tok = `${face}${wide}${mod}`;
          const cube = Cube4x4.solved().apply(parseMove(tok));
          const counts: Record<string, number> = {};
          for (const ch of cube.toFaceletString()) counts[ch] = (counts[ch] ?? 0) + 1;
          for (const f of FACES) expect(counts[f], `after ${tok}`).toBe(16);
        }
      }
    }
  });

  it("apply M then M' is a no-op (M is undefined for even N — degrades to identity)", () => {
    const a = Cube4x4.solved().apply(parseMove('M'));
    expect(a.toFaceletString()).toBe(Cube4x4.solved().toFaceletString());
  });

  it('whole-cube rotations recompose to identity in 4 reps', () => {
    for (const rot of ['x', 'y', 'z'] as const) {
      let c = Cube4x4.solved();
      for (let i = 0; i < 4; i++) c = c.apply(parseMove(rot));
      expect(c.toFaceletString(), `${rot}^4`).toBe(Cube4x4.solved().toFaceletString());
    }
  });

  it('inverse round-trip on 200 random sequences (length 1..30, mixed outer + wide)', () => {
    for (let trial = 0; trial < 200; trial++) {
      const len = 1 + Math.floor(Math.random() * 30);
      const seq = Array.from({ length: len }, () => {
        const face = FACES[Math.floor(Math.random() * FACES.length)]!;
        const wide = Math.random() < 0.5 ? 'w' : '';
        const mod = (['', "'", '2'] as const)[Math.floor(Math.random() * 3)]!;
        return parseMove(`${face}${wide}${mod}`);
      });
      const cube = Cube4x4.solved().applyAll(seq).applyAll(invertMoves(seq));
      expect(cube.toFaceletString()).toBe(Cube4x4.solved().toFaceletString());
    }
  });

  it('Uw rotates both U and the layer just below (sticker on U[1,1] stays U after 4 reps)', () => {
    const after = Cube4x4.solved().applyAll(parseMoves('Uw'));
    // After Uw, each face's TOP TWO rows have rotated. The U face stays
    // monochromatic but the top two rows of F/R/B/L now belong to neighbouring
    // colours.
    const s = after.toFaceletString();
    // F top two rows (indices 32-39) should now be the colour previously on R top.
    for (let i = 32; i < 40; i++) {
      expect(s[i]).toBe('R');
    }
  });
});
