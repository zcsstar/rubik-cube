import type { Tutorial } from './ITutorial';

/**
 * Beginner-method tutorial for a 3×3 (white-on-top, yellow-on-bottom convention).
 * Uses kid-friendly language and the classic 7-step Layer-by-Layer method.
 *
 * Algorithms here are the canonical beginner-method ones. Per-case setup
 * sequences are derived at runtime by inverting the solve algorithm — that
 * keeps content compact and ensures every demo round-trips back to solved.
 * Where two cases need DIFFERENT visual states but share an algorithm (e.g.,
 * "dot" applies F R U R' U' F' twice, "L-shape" once), the case carries an
 * explicit `setup` field.
 */
export const tutorial3x3Beginner: Tutorial = {
  id: '3x3-beginner',
  size: 3,
  title: 'How to solve a 3×3 — Beginner Method',
  blurb:
    'You will solve the cube one layer at a time. We start with the white side, work up to the middle, and finish with the yellow side. Each step has just a few patterns to learn.',
  steps: [
    {
      id: 'cross',
      number: 1,
      title: 'White cross',
      goal: 'Build a plus sign of white on the top, with side colours matching their centres.',
      intro:
        'Find the four white edge pieces and bring them around the white centre. Each white edge has a second colour — match it to the same-coloured centre on the side. There is no fixed algorithm here; you will rotate edges into place by hand. Once the cross looks like a plus, you are done.',
      tips: [
        'Hold the cube so the white centre is on top.',
        'You only need to think about one edge at a time.',
        'If a white edge is on the bottom, turn it under its target slot, then twice (F2 / R2 / B2 / L2) to bring it up.',
      ],
      cases: [
        {
          id: 'cross-bottom',
          name: 'White edge on the bottom',
          description: 'Turn the bottom layer to line up the edge under its matching side colour, then turn that side twice to lift it up.',
          algorithm: "D F2",
          recognition: 'White is on the bottom face.',
        },
        {
          id: 'cross-equator',
          name: 'White edge in the middle (white on side)',
          description: 'Pop the edge out to the bottom first using one quarter turn, then bring it up with a double turn.',
          algorithm: "F'",
          recognition: 'White is sticking out the side, between top and bottom.',
        },
        {
          id: 'cross-top-flipped',
          name: 'White edge on top but flipped',
          description: 'The edge is in its slot but the white sticker faces sideways. A short routine flips it without disturbing other cross edges.',
          algorithm: "F U' R U F2",
          recognition: 'A white edge is in the top layer, on a non-white face.',
        },
      ],
    },
    {
      id: 'corners',
      number: 2,
      title: 'White corners',
      goal: 'Slot the four white corners — the white face is now done.',
      intro:
        "Find a white corner on the bottom layer. Spin the bottom (D) until that corner sits directly under where it belongs (between its two side colours). Then repeat the trigger R U R' U' until the corner pops up the right way. Three repeats at most per corner.",
      tips: [
        "The trigger R U R' U' is also called the \"sexy move\".",
        'If a white corner is stuck on the top in the wrong place, do the trigger once to kick it down to the bottom first.',
      ],
      cases: [
        {
          id: 'corner-trigger',
          name: 'Apply the trigger',
          description: "With the corner under its slot, R U R' U' tucks it in. If it comes up wrong, do the trigger again — at most 3 tries.",
          algorithm: "R U R' U'",
          recognition: 'A white corner is on the bottom layer, under its target spot.',
        },
        {
          id: 'corner-stuck-top',
          name: 'White corner stuck on top',
          description: 'A white corner is sitting on top in the wrong place. One trigger kicks it to the bottom; then handle it like any bottom corner.',
          algorithm: "R U R' U'",
          recognition: 'A white sticker is on a top-layer corner but not on the white face.',
        },
        {
          id: 'corner-direct-right',
          name: 'White facing right (one shot)',
          description: "When the white sticker faces RIGHT and the corner is under its slot, R' D' R brings it up directly in one move group.",
          algorithm: "R' D' R",
          recognition: 'White sticker is on the right side of the bottom-front-right corner.',
        },
      ],
    },
    {
      id: 'middle',
      number: 3,
      title: 'Middle edges',
      goal: 'Place the four middle-layer edges.',
      intro:
        'Flip the cube so white is now on the bottom. Find an edge in the top (U) layer that has no yellow on it — that edge belongs in the middle. Match its front colour to the front centre, then send it left or right depending on the other colour.',
      tips: [
        'Right algorithm: send to the right slot.',
        'Left algorithm: send to the left slot.',
        'If a middle edge is already in place but flipped, kick it out with the right algorithm, then put it back the right way.',
      ],
      cases: [
        {
          id: 'middle-right',
          name: 'Send edge to the RIGHT',
          description: 'Front colour matches the front centre, and the top sticker matches the right centre. Use the right algorithm.',
          algorithm: "U R U' R' U' F' U F",
          recognition: 'Top sticker matches the RIGHT centre colour.',
        },
        {
          id: 'middle-left',
          name: 'Send edge to the LEFT',
          description: 'Front colour matches the front centre, and the top sticker matches the left centre. Use the left algorithm.',
          algorithm: "U' L' U L U F U' F'",
          recognition: 'Top sticker matches the LEFT centre colour.',
        },
        {
          id: 'middle-flipped',
          name: 'Edge stuck and flipped in middle',
          description: 'A non-yellow edge is in the middle but its colours are reversed. Run the right algorithm once to extract it; the case now becomes a top-layer "send right/left".',
          algorithm: "U R U' R' U' F' U F",
          recognition: 'Middle edge is in place but the two side colours are swapped.',
        },
      ],
    },
    {
      id: 'yellow-cross',
      number: 4,
      title: 'Yellow cross',
      goal: 'Make a yellow plus sign on top.',
      intro:
        "You may see one of three patterns: dot, L-shape, or line. Apply F R U R' U' F' once or twice depending on the case. From a dot, repeat until you see the cross.",
      tips: [
        'Hold the L-shape so the two yellow edges form the corner at top-left of your view.',
        'Hold the line horizontally before applying.',
        'Dot needs the algorithm twice; L and Line need it once.',
      ],
      cases: [
        {
          id: 'oll-l',
          name: 'L-shape (one application)',
          description: 'Two yellow edges form an L. Hold so the L points to top-left, then apply once.',
          algorithm: "F R U R' U' F'",
          recognition: 'Two yellow edges next to each other (90° apart).',
        },
        {
          id: 'oll-dot',
          name: 'Dot (apply twice)',
          description: 'Only the centre is yellow. Apply once to reach an L; apply again to reach the cross.',
          algorithm: "F R U R' U' F' F R U R' U' F'",
          setup: "F U R U' R' F' F U R U' R' F'",
          recognition: 'No yellow edges on top, only the centre.',
        },
      ],
    },
    {
      id: 'yellow-face',
      number: 5,
      title: 'Yellow face',
      goal: 'Make the entire top face yellow.',
      intro:
        "The cross is done; now twist the corners. Look at how many corners already show yellow on top — that tells you which case you have.",
      tips: [
        '0 yellow corners: hold so a yellow sticker faces you on the front-left.',
        '1 yellow corner: place that corner at the bottom-left of the top face.',
        '2 yellow corners: depends on whether they are diagonal or adjacent.',
      ],
      cases: [
        {
          id: 'sune',
          name: 'Sune (one yellow corner)',
          description: 'Hold the one already-yellow corner at the bottom-left of the top face. The classic 7-move algorithm rotates the other three.',
          algorithm: "R U R' U R U2 R'",
          recognition: 'Exactly one corner shows yellow on top.',
        },
        {
          id: 'anti-sune',
          name: 'Anti-Sune (mirror of Sune)',
          description: 'Same idea but the yellow corner is in the bottom-right. Use the mirrored algorithm.',
          algorithm: "R U2 R' U' R U' R'",
          recognition: 'One yellow corner with the yellow sticker pointing the OTHER way.',
        },
        {
          id: 'h-pattern',
          name: 'H-pattern (two opposite corners)',
          description: 'Two yellow corners sit diagonally across from each other. Apply this longer Sune-chain to fix all four at once.',
          algorithm: "R U R' U R U' R' U R U2 R'",
          recognition: 'Two yellow corners on opposite ends of the top face (diagonal).',
        },
        {
          id: 'pi-pattern',
          name: 'Pi-pattern (two adjacent at the back)',
          description: 'Two yellow corners are next to each other at the back. The Pi algorithm rotates the front two while leaving the back two correct.',
          algorithm: "R U2 R' U' R U R' U' R U' R'",
          recognition: 'Two yellow corners adjacent (a "headlight" pair) at the BACK.',
        },
      ],
    },
    {
      id: 'pll-corners',
      number: 6,
      title: 'Permute corners',
      goal: 'Swap top corners into their correct positions (colours may not all match yet).',
      intro:
        'Look for two corners next to each other that share the same side colour pair — those two corners are already in the right spot. Hold them at the back, and apply the corner-swap algorithm to fix the front two. If no pair matches, apply the algorithm once anyway and look again.',
      cases: [
        {
          id: 'a-perm-cw',
          name: 'A-perm (clockwise)',
          description: 'Cycles three corners clockwise around the top, leaving one fixed. Hold the fixed corner at back-right.',
          algorithm: "U R U' L' U R' U' L",
          recognition: 'One adjacent matching pair of side colours sits at the back-right.',
        },
        {
          id: 'a-perm-ccw',
          name: 'A-perm (counter-clockwise)',
          description: 'Mirror of A-perm. Cycles the other way. If A-cw made things worse, this one fixes it.',
          algorithm: "U' L' U R U' L U R'",
          recognition: 'One adjacent matching pair sits at the back-LEFT.',
        },
      ],
    },
    {
      id: 'pll-edges',
      number: 7,
      title: 'Permute edges',
      goal: 'Cycle the top edges into their final spots — your cube is now solved.',
      intro:
        'Look at the four side-colours on the top edges. One side will already match its centre — hold that side at the back. Apply the U-perm. If colours cycle the wrong way, use the mirror.',
      cases: [
        {
          id: 'u-perm-cw',
          name: 'U-perm (clockwise)',
          description: 'Cycles three edges clockwise around the top. Hold the matching side at the back.',
          algorithm: "F2 U L R' F2 L' R U F2",
          recognition: 'Edges need to cycle clockwise.',
        },
        {
          id: 'u-perm-ccw',
          name: 'U-perm (counter-clockwise)',
          description: 'Same shape but cycles the other way. If U-perm cw made it worse, this one fixes it.',
          algorithm: "F2 U' L R' F2 L' R U' F2",
          recognition: 'Edges need to cycle counter-clockwise.',
        },
      ],
    },
  ],
};
