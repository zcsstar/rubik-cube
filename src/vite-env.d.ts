/// <reference types="vite/client" />

declare module 'cubejs' {
  export default class Cube {
    constructor(state?: string | unknown);
    static initSolver(): void;
    static random(): Cube;
    static fromString(s: string): Cube;
    move(moves: string): this;
    asString(): string;
    solve(maxDepth?: number): string;
    isSolved(): boolean;
  }
}
