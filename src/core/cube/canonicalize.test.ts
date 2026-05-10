import { describe, expect, it } from 'vitest';
import CubeJS from 'cubejs';
import { canonicalize3x3, hasValidCenterArrangement } from './canonicalize';

const SOLVED = 'UUUUUUUUU' + 'RRRRRRRRR' + 'FFFFFFFFF' + 'DDDDDDDDD' + 'LLLLLLLLL' + 'BBBBBBBBB';

describe('canonicalize3x3', () => {
  it('leaves an already-canonical solved cube unchanged', () => {
    expect(canonicalize3x3(SOLVED)).toBe(SOLVED);
  });

  it('canonicalizes the screenshot example (x y2 reorientation)', () => {
    // Solved cube rotated by x' y2: blue on top, yellow at front, etc.
    const c = CubeJS.fromString(SOLVED);
    c.move("x' y2");
    const rotated = c.asString();
    expect(rotated).not.toBe(SOLVED);
    expect(canonicalize3x3(rotated)).toBe(SOLVED);
  });

  it('round-trips every one of the 24 valid orientations to the canonical state', () => {
    // Apply every combination of (face-to-top) × (rotate-around-up) to a solved
    // cube; canonicalize must always return us to the canonical solved string.
    const TO_U = ['', "x'", 'x2', 'x', "z'", 'z'];
    const Y_ROT = ['', 'y', 'y2', "y'"];
    for (const a of TO_U) {
      for (const b of Y_ROT) {
        const moves = [a, b].filter(Boolean).join(' ');
        const c = CubeJS.fromString(SOLVED);
        if (moves) c.move(moves);
        const rotated = c.asString();
        expect(canonicalize3x3(rotated), `failed for "${moves}"`).toBe(SOLVED);
      }
    }
  });

  it('preserves scramble identity: canonicalize(rotate(scramble)) === scramble', () => {
    // Take a scrambled cube, rotate it, and verify canonicalize undoes the
    // rotation — the underlying cubie state is invariant under whole-cube
    // rotation, so the canonical facelet string must match the original.
    const scrambled = CubeJS.random().asString();
    const c = CubeJS.fromString(scrambled);
    c.move('z y');
    const rotated = c.asString();
    expect(canonicalize3x3(rotated)).toBe(scrambled);
  });

  it('returns null when centres do not form a valid arrangement', () => {
    // Two whites at centres (replace R-centre with U-letter) — physically
    // impossible.
    const bad = SOLVED.substring(0, 13) + 'U' + SOLVED.substring(14);
    expect(canonicalize3x3(bad)).toBeNull();
  });
});

describe('hasValidCenterArrangement', () => {
  it('accepts the canonical solved cube', () => {
    expect(hasValidCenterArrangement(SOLVED)).toBe(true);
  });

  it('accepts any of the 24 valid orientations', () => {
    const TO_U = ['', "x'", 'x2', 'x', "z'", 'z'];
    const Y_ROT = ['', 'y', 'y2', "y'"];
    for (const a of TO_U) {
      for (const b of Y_ROT) {
        const moves = [a, b].filter(Boolean).join(' ');
        const c = CubeJS.fromString(SOLVED);
        if (moves) c.move(moves);
        expect(hasValidCenterArrangement(c.asString()), `for "${moves}"`).toBe(true);
      }
    }
  });

  it('rejects duplicate centres', () => {
    const bad = SOLVED.substring(0, 13) + 'U' + SOLVED.substring(14);
    expect(hasValidCenterArrangement(bad)).toBe(false);
  });

  it('rejects non-opposing pair (e.g. white opposite green)', () => {
    // Swap D-centre with F-centre so U(white) is opposite F(green).
    let s = SOLVED;
    s = s.substring(0, 22) + 'D' + s.substring(23); // F[4] = D
    s = s.substring(0, 31) + 'F' + s.substring(32); // D[4] = F
    expect(hasValidCenterArrangement(s)).toBe(false);
  });
});
