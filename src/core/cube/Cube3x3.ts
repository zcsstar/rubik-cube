import CubeJS from 'cubejs';
import type { ICube } from './ICube';
import { totalStickers } from './ICube';
import type { Move } from './moves';
import { moveToString } from './moves';
import type { FaceLetter } from './colors';

/**
 * 3x3 cube. Internal state delegates to the `cubejs` package, which uses cubie-level
 * representation. Public surface is the URFDLB 54-char facelet string.
 *
 * Wrapping cubejs gives us a battle-tested move applier and a path to its Kociemba solver.
 * SOLID-wise: callers depend only on ICube; the cubejs dependency is private to this file
 * (and to Solver3x3Kociemba, which constructs its own cubejs from the facelet string).
 */
export class Cube3x3 implements ICube {
  readonly size = 3 as const;
  readonly stickerCount = totalStickers(3);

  /** Underlying cubejs instance. Treated as immutable: never mutated after construction. */
  private readonly cube: CubeJS;

  private constructor(cube: CubeJS) {
    this.cube = cube;
  }

  static solved(): Cube3x3 {
    return new Cube3x3(new CubeJS());
  }

  static fromFacelets(facelets: string): Cube3x3 {
    if (facelets.length !== 54) {
      throw new Error(`3x3 facelet string must be 54 chars, got ${facelets.length}`);
    }
    const c = CubeJS.fromString(facelets);
    return new Cube3x3(c);
  }

  /** Random scramble (uniform over reachable states). */
  static random(): Cube3x3 {
    return new Cube3x3(CubeJS.random());
  }

  apply(move: Move): Cube3x3 {
    if (move.width !== 1) {
      throw new Error(`3x3 does not support wide moves: ${moveToString(move)}`);
    }
    const next = new CubeJS(this.cube);
    next.move(moveToString(move));
    return new Cube3x3(next);
  }

  applyAll(moves: readonly Move[]): Cube3x3 {
    if (moves.length === 0) return this;
    const next = new CubeJS(this.cube);
    next.move(moves.map(moveToString).join(' '));
    return new Cube3x3(next);
  }

  isSolved(): boolean {
    return this.cube.isSolved();
  }

  toFaceletString(): string {
    return this.cube.asString();
  }

  getFacelet(index: number): FaceLetter {
    return this.cube.asString()[index] as FaceLetter;
  }

  clone(): Cube3x3 {
    return new Cube3x3(new CubeJS(this.cube));
  }
}
