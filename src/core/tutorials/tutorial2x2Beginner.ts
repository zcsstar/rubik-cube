import type { Tutorial } from './ITutorial';

/**
 * Beginner-method tutorial for a 2×2 (Pocket cube). Follows the simplified
 * Ortega method, taught in three steps:
 *   1. Solve any one face (typically white).
 *   2. Orient the opposite face (OLL).
 *   3. Permute both layers (PBL).
 */
export const tutorial2x2Beginner: Tutorial = {
  id: '2x2-beginner',
  size: 2,
  title: 'How to solve a 2×2 — Beginner Method',
  blurb:
    'A 2×2 has only corners — no centres, no edges. We solve one face first, then orient and place the corners on the opposite face. Three steps.',
  steps: [
    {
      id: 'first-face',
      number: 1,
      title: 'First face',
      goal: 'Make the entire white face show only white.',
      intro:
        "Pick any colour to start with — usually white. Solve the four white corners on the bottom (or top) layer by intuition: pick a white corner, put it under its target slot, and use the trigger R U R' U' until it pops up correctly. The other side colours do not need to match — only the white face matters here.",
      tips: [
        'There are no centres, so any orientation is OK.',
        "Use the trigger R U R' U' just like on a 3×3.",
      ],
      cases: [
        {
          id: 'corner-trigger',
          name: 'Place a corner with the trigger',
          description: "With a white corner under its slot, R U R' U' tucks it in. Repeat at most 3 times if it comes up wrong.",
          algorithm: "R U R' U'",
          recognition: 'White corner is on the bottom layer, under its target spot.',
        },
        {
          id: 'corner-direct',
          name: 'White facing right (direct slot)',
          description: "When the white sticker faces RIGHT under its target slot, R' D' R inserts it directly with no extra triggers.",
          algorithm: "R' D' R",
          recognition: 'A white sticker is on the right side of the bottom-front-right corner.',
        },
      ],
    },
    {
      id: 'oll',
      number: 2,
      title: 'Orient the top',
      goal: 'Get the entire top face to show one colour (yellow if you started with white).',
      intro:
        'Flip the cube so the unsolved face is on top. Look at the top: 0, 1, 2, or 3 corners may already be the right colour. Each pattern has its own short algorithm.',
      tips: [
        'Sune fixes any "1 corner already up" case.',
        'For tougher patterns, use the Pi or H algorithm — same building blocks as on a 3×3.',
      ],
      cases: [
        {
          id: 'sune',
          name: 'Sune (one yellow corner)',
          description: 'Hold the already-yellow corner at the bottom-left of the top face. Then apply the classic 7-move Sune.',
          algorithm: "R U R' U R U2 R'",
          recognition: 'Exactly ONE corner shows yellow on top.',
        },
        {
          id: 'anti-sune',
          name: 'Anti-Sune (mirror of Sune)',
          description: 'Mirror version when the yellow corner is on the OPPOSITE diagonal. Sune did not work; this one will.',
          algorithm: "R U2 R' U' R U' R'",
          recognition: 'One yellow corner up, but Sune put yellow on the wrong side.',
        },
        {
          id: 'h-pattern',
          name: 'H-pattern (two opposite corners)',
          description: 'Two yellow corners are diagonally opposite each other. This longer chain orients all four at once.',
          algorithm: "R U R' U R U' R' U R U2 R'",
          recognition: 'Two yellow corners on the diagonal of the top face.',
        },
        {
          id: 'pi-pattern',
          name: 'Pi-pattern (two adjacent corners back)',
          description: 'Two yellow corners are adjacent at the BACK of the top face. Apply the Pi algorithm.',
          algorithm: "R U2 R' U' R U R' U' R U' R'",
          recognition: 'Two yellow corners adjacent at the back ("headlights" pointing back).',
        },
      ],
    },
    {
      id: 'pbl',
      number: 3,
      title: 'Permute both layers',
      goal: 'Cycle corners on top and bottom into their final places.',
      intro:
        'Both layers are now oriented; corners just need to swap into the right spots. Look at the bottom — find a matching pair if there is one and hold it at the back. Then identify whether the top needs an adjacent or diagonal swap.',
      tips: [
        'If the bottom layer is already solved, only the top needs work.',
        'If both layers need the same swap, a single short routine fixes both.',
      ],
      cases: [
        {
          id: 'pbl-top-adj',
          name: 'Adjacent swap on top, bottom solved',
          description: 'Two adjacent top corners need to swap. Hold the matching pair at the back of the top layer.',
          algorithm: "R U' R F2 R' U R'",
          recognition: 'Bottom is one solid colour; top has a matched pair on one side and a swap on the opposite side.',
        },
        {
          id: 'pbl-top-diag',
          name: 'Diagonal swap on top, bottom solved',
          description: 'Two corners on the diagonal need to swap. Slightly longer algorithm.',
          algorithm: "F R' F' R U R U' R'",
          recognition: 'Bottom is solid; top has no matching pairs anywhere.',
        },
        {
          id: 'pbl-double-diag',
          name: 'Diagonal swap on both layers',
          description: 'Both layers need a diagonal swap. A short, very memorable algorithm fixes them simultaneously.',
          algorithm: "R2 F2 R2",
          recognition: 'Neither layer is solid — both need diagonal swaps.',
        },
      ],
    },
  ],
};
