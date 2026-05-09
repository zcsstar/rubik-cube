import type { CubeSize } from '../cube/ICube';

/**
 * One pattern-recognition case within a tutorial step.
 *
 * For most cases, the setup state is the inverse of `algorithm` applied to a
 * solved cube — that round-trips perfectly and keeps content compact. But some
 * cases share the same algorithm yet need DIFFERENT setup states (e.g., the
 * yellow-cross "dot" case applies F R U R' U' F' twice; "L-shape" applies it
 * once at one orientation; "line" applies it once at another). For those, set
 * `setup` explicitly — that is the move sequence applied to a solved cube to
 * produce the case state.
 */
export interface TutorialCase {
  id: string;
  name: string;
  /** Plain-English description, appears alongside the case thumbnail. */
  description: string;
  /** The beginner-method move sequence the user should apply to solve this case. */
  algorithm: string;
  /** Explicit setup sequence (applied to solved). Defaults to invert(algorithm). */
  setup?: string;
  /** Optional one-liner about how to spot this case on a real cube. */
  recognition?: string;
}

/**
 * One numbered step in a beginner-method tutorial (e.g., "Step 3: Middle layer").
 */
export interface TutorialStep {
  id: string;
  /** Short numeric/visual label, e.g. "1", "2"… */
  number: number;
  title: string;
  /** Goal of the step in one short sentence (kid-friendly). */
  goal: string;
  /** Markdown-ish text explaining the concept. Plain newlines OK. */
  intro: string;
  /** Cases the user will encounter in this step. */
  cases: TutorialCase[];
  /** Top tips, shown as bullet list. */
  tips?: string[];
}

export interface Tutorial {
  id: string;
  size: CubeSize;
  /** Page heading, e.g., "How to solve a 3×3 — Beginner Method". */
  title: string;
  /** One-paragraph intro shown above the first step. */
  blurb: string;
  steps: TutorialStep[];
}
