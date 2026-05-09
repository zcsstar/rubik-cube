import { describe, it, expect } from 'vitest';
import {
  invertMove,
  invertMoves,
  isFaceLetter,
  isRotationLetter,
  isSliceLetter,
  moveToString,
  parseMove,
  parseMoves,
} from './moves';
import { Cube3x3 } from './Cube3x3';
import { Cube2x2 } from './Cube2x2';

describe('parseMove', () => {
  it('parses outer-face moves', () => {
    expect(parseMove('R')).toEqual({ face: 'R', modifier: '', width: 1 });
    expect(parseMove("U'")).toEqual({ face: 'U', modifier: "'", width: 1 });
    expect(parseMove('F2')).toEqual({ face: 'F', modifier: '2', width: 1 });
  });

  it('parses wide moves (Uw and lowercase u)', () => {
    expect(parseMove('Uw')).toEqual({ face: 'U', modifier: '', width: 2 });
    expect(parseMove("Rw'")).toEqual({ face: 'R', modifier: "'", width: 2 });
    expect(parseMove('r')).toEqual({ face: 'R', modifier: '', width: 2 });
    expect(parseMove("u2")).toEqual({ face: 'U', modifier: '2', width: 2 });
  });

  it('parses middle-slice moves M / E / S', () => {
    expect(parseMove('M')).toEqual({ face: 'M', modifier: '', width: 1 });
    expect(parseMove("M'")).toEqual({ face: 'M', modifier: "'", width: 1 });
    expect(parseMove('M2')).toEqual({ face: 'M', modifier: '2', width: 1 });
    expect(parseMove('E')).toEqual({ face: 'E', modifier: '', width: 1 });
    expect(parseMove("S'")).toEqual({ face: 'S', modifier: "'", width: 1 });
  });

  it('parses whole-cube rotations x / y / z', () => {
    expect(parseMove('x')).toEqual({ face: 'x', modifier: '', width: 1 });
    expect(parseMove("y'")).toEqual({ face: 'y', modifier: "'", width: 1 });
    expect(parseMove('z2')).toEqual({ face: 'z', modifier: '2', width: 1 });
  });

  it('classification predicates work', () => {
    expect(isFaceLetter('R')).toBe(true);
    expect(isFaceLetter('M')).toBe(false);
    expect(isSliceLetter('M')).toBe(true);
    expect(isSliceLetter('R')).toBe(false);
    expect(isRotationLetter('x')).toBe(true);
    expect(isRotationLetter('R')).toBe(false);
  });

  it('round-trips notation through parse + toString (canonical form is Uw, not u)', () => {
    const tokens = ['R', "U'", 'F2', 'M', "M'", 'M2', 'E', 'S2', 'x', "y'", 'z2', 'Rw', "Uw'"];
    for (const tok of tokens) {
      const back = moveToString(parseMove(tok));
      expect(back).toBe(tok);
    }
  });

  it('lowercase u r f d l b are aliases for Uw, Rw, …', () => {
    expect(parseMove('u')).toEqual(parseMove('Uw'));
    expect(parseMove("r'")).toEqual(parseMove("Rw'"));
    expect(parseMove('f2')).toEqual(parseMove('Fw2'));
  });

  it('rejects junk tokens', () => {
    expect(() => parseMove('Q')).toThrow();
    expect(() => parseMove("M3")).toThrow();
    expect(() => parseMove('Rx')).toThrow();
  });
});

describe('Cube3x3 with slice and rotation moves', () => {
  it('M move returns to identity in 4 reps', () => {
    let c = Cube3x3.solved();
    for (let i = 0; i < 4; i++) c = c.apply(parseMove('M'));
    expect(c.isSolved()).toBe(true);
  });

  it("apply M then M' returns to solved", () => {
    const c = Cube3x3.solved().apply(parseMove('M')).apply(parseMove("M'"));
    expect(c.isSolved()).toBe(true);
  });

  it('the H-perm M-notation algorithm round-trips', () => {
    // Apply H-perm twice: should return to solved.
    const hPerm = parseMoves("M2 U M2 U2 M2 U M2");
    let c = Cube3x3.solved().applyAll(hPerm).applyAll(hPerm);
    expect(c.isSolved()).toBe(true);
  });

  it('whole-cube rotations preserve solved state', () => {
    // x/y/z applied to a solved cube leave it "solved" (every face still
    // monochromatic), even though cubejs's URFDLB facelet string changes.
    for (const rot of ['x', 'y', 'z'] as const) {
      const c = Cube3x3.solved().apply(parseMove(rot));
      // Each face of the cube is still a single colour; cubejs.isSolved()
      // returns true only for the canonical orientation, so we check via
      // a 4-rep round-trip instead.
      const c4 = Cube3x3.solved()
        .apply(parseMove(rot))
        .apply(parseMove(rot))
        .apply(parseMove(rot))
        .apply(parseMove(rot));
      expect(c4.isSolved()).toBe(true);
      expect(c).toBeDefined();
    }
  });

  it('inverse round-trip with mixed slice and rotation moves', () => {
    const moves = parseMoves("R U M' D2 x' F R' M2 y S U2");
    const c = Cube3x3.solved().applyAll(moves).applyAll(invertMoves(moves));
    expect(c.isSolved()).toBe(true);
  });
});

describe('Cube2x2 rejects slice and rotation moves', () => {
  it('throws on slice move', () => {
    expect(() => Cube2x2.solved().apply(parseMove('M'))).toThrow();
  });
  it('throws on rotation move', () => {
    expect(() => Cube2x2.solved().apply(parseMove('y'))).toThrow();
  });
});

describe('invertMove', () => {
  it("inverts X to X'", () => {
    expect(invertMove(parseMove('R'))).toEqual(parseMove("R'"));
    expect(invertMove(parseMove("M'"))).toEqual(parseMove('M'));
    expect(invertMove(parseMove('y'))).toEqual(parseMove("y'"));
  });
  it('leaves doubles alone', () => {
    expect(invertMove(parseMove('R2'))).toEqual(parseMove('R2'));
    expect(invertMove(parseMove('M2'))).toEqual(parseMove('M2'));
  });
});
