# Camera capture UX

The canonical pattern for capturing a cube's sticker state via the device
camera. Every cube size that gets a camera flow should follow this — the
UX is designed for kids and beginners who don't read instructions, and
deviating "because this size is different" defeats the point.

The pattern is implemented in
[`CameraCaptureFree.tsx`](../src/ui/components/CameraCapture/CameraCaptureFree.tsx)
and consumed via the dispatcher
[`CameraCapture.tsx`](../src/ui/components/CameraCapture/CameraCapture.tsx).
`CameraCaptureGuided.tsx` is the older scripted-sequence flow; it's kept
around only for 4×4 until the 4×4 solver lands. New work should follow
this doc, not the guided flow.

## Core principles

1. **Free order.** The user shoots the 6 faces in any order. No "now show
   me the white face" sequence — kids hold the cube however they're holding
   it and shoot what's in front of the camera. Whatever a face's rotation
   was at capture time, the resolver figures it out at the end.
2. **Visual over verbal.** Diagrams, swatches, and live previews beat text.
   The cross-net (3×3) and capture strip (2×2) show progress at a glance
   without anyone reading a sentence.
3. **Explicit confirmation, never auto-advance.** Every capture has a
   "Use this face" tap. Auto-advancing rushes users who want to glance at
   the preview, and a single mis-timed tap doesn't compound into a stuck
   sequence. (The original 3×3 flow had a 1.8 s auto-advance — kids
   universally found it too fast, and we removed it.)
4. **Recoverable at every stage.** Per-face retake on the preview;
   per-face retake from the resolver-failure screen; manual-edit escape
   hatch into `ColorInputNet` for the irreducible-failure case. The user
   should never feel "stuck and have to start over."
5. **No reading required for the happy path.** All required UI text is
   visible, but the flow should be completable by tapping the obvious big
   button each step.

## Component anatomy

```
┌─────────────────────────────────────────────┐
│  title · progress counter · close (X)       │ <- compact top bar
├─────────────────────────────────────────────┤
│                                             │
│         live camera video                   │
│         with framing grid overlay           │ <- size×size grid lines
│                                             │
│         (or capture preview overlay,        │
│          or resolving spinner,              │
│          or error overlay)                  │
│                                             │
├─────────────────────────────────────────────┤
│  progress visual (cross-net or strip)       │ <- shown live + preview
│  action buttons                             │ <- size-aware
└─────────────────────────────────────────────┘
```

### Stages (`Stage` state machine)

| Stage         | Shown to user                                                        |
|---------------|----------------------------------------------------------------------|
| `init`        | Brief — before camera permission is resolved.                        |
| `denied`      | "Camera permission denied" + Cancel.                                 |
| `unsupported` | "Browser does not support camera" + Cancel.                          |
| `live`        | Video + framing grid + Capture button. Progress visual at bottom.    |
| `preview`     | Just-captured face shown as a correction grid. Retake / Confirm.     |
| `resolving`   | Spinner while the resolver enumerates rotations. Typically 50ms–3s.  |
| `error`       | Resolver failed. Tappable face list + manual-edit escape.            |

### Bottom action row (size-aware)

| State                             | Actions                                                                  |
|-----------------------------------|--------------------------------------------------------------------------|
| `live`, not all 6 captured        | **Capture** (primary) · flip-camera                                      |
| `live`, all 6 captured            | **Done** (emerald) — kicks off resolver                                  |
| `preview` (3×3 only)              | Retake · Wrong face? · **Use this face**                                 |
| `preview` (2×2 / centreless)      | Retake · **Use this face**  (no Wrong face? — no slot identity)          |
| `preview`, Wrong face? expanded   | 6 URFDLB swatch buttons + Cancel (3×3 only)                              |
| `error`                           | Tappable face list (retake one) + Edit manually                          |

## Size-specific differences

There are exactly **three** places where the flow branches on cube size.
Anything more than this is a smell and should probably be refactored back
to the shared path.

| Concern                       | 3×3 (centred sizes)                              | 2×2 (no centre)                                  |
|-------------------------------|--------------------------------------------------|--------------------------------------------------|
| Face identification           | Centre sticker classifier (W→U, G→F, …)          | Sequential — 1st capture goes to slot 0, etc.    |
| "Centre is {colour}" preview  | Yes, with swatch + coloured colour-name          | No — instead show "Face N of 6"                  |
| "Wrong face?" reassign picker | Yes — picks URFDLB slot, re-centres sticker      | N/A — no slot identity to reassign to            |
| Progress visual               | Cross-net at canonical slot positions            | Linear strip of 6 thumbnails in capture order    |
| Error-screen retake list      | 6 colour swatches keyed by face letter           | 6 thumbnails keyed by sequence number            |

A 4×4 with movable centres falls into the **2×2 category** (no centre
identity), not the 3×3 category. The 4×4 component will reuse the
centreless branches once the 4×4 solver ships.

## Resolver contract

The capture component is dumb; the resolver in [`core/cameraIntake/`](../src/core/cameraIntake/)
does the work. Each size has its own resolver:

- [`resolveOrientation3x3`](../src/core/cameraIntake/resolveOrientation.ts) —
  fixed-centre input, enumerates 4⁶ = 4096 per-face rotations, picks the
  unique solvable one.
- [`resolveOrientation2x2`](../src/core/cameraIntake/resolveOrientation.ts) —
  no centre input, enumerates 6! × 4⁶ ≈ 2.95M face-slot × rotation
  combinations, returns the first solvable one (2×2 has 24
  rotation-equivalent representations of the same physical cube; the
  solver handles all of them).

Both return:

```typescript
type ResolveResult =
  | { ok: true; facelets: string }
  | { ok: false; reason: 'no_valid_orientation' | 'ambiguous' };
```

The UI maps `no_valid_orientation` and `ambiguous` to slightly different
error copy but both lead to the same retake-or-manual-edit recovery.

## Implementation rules

- **Don't add a "Skip"/"Next" auto-advance.** It will be wrong for some
  users. Explicit confirmation is correct.
- **Don't put orientation hints in the camera UI.** The whole point of
  the resolver is that the user doesn't have to hold the cube any
  specific way. If something looks like it wants an orientation hint, the
  resolver isn't doing its job.
- **Don't conflate retake with re-shooting.** Retake = discard, return to
  live. Re-shooting the same logical face (3×3) = silently overwrites the
  previous capture in that slot; this is fine and expected.
- **Use `setTimeout(..., 0)` before calling the resolver** so the spinner
  actually paints. The resolver is synchronous and CPU-bound; without the
  defer the spinner state never reaches the DOM.
- **Lock body scroll on mount** (`document.body.style.overflow = 'hidden'`).
  Without it iOS lets scroll bleed through the fullscreen overlay.
- **Sticker correction grid taps cycle through URFDLB.** The 3×3 centre
  cell is non-tappable (centre identity is locked; "Wrong face?" is for
  changing it).

## Adding a new size to the free flow

To extend `CameraCaptureFree` to a new cube size:

1. Write `resolveOrientation{N}x{N}` in `core/cameraIntake/`. Match the
   `ResolveResult` shape. Add unit tests covering solved, scrambled
   (with face rotations / shuffled order), wrong-sticker, wrong-count
   inputs.
2. Pick the identification branch: does this size have *fixed* face
   centres? If yes, treat as a 3×3-style size. If no (movable centres
   or no centres at all), treat as a 2×2-style size.
3. Plumb the size through `CameraCaptureFree`'s `size: 2 | 3` prop type.
   Update the dispatcher (`CameraCapture.tsx`) to route the new size to
   `CameraCaptureFree`.
4. Add the size's framing-grid dimensions if the framing overlay needs
   them (currently `width: 'min(70vw, ...)'` works for both 2×2 and 3×3
   at typical phone sizes; larger cubes may need adjusting).

Avoid adding a new "guided" mode for a new size. The free flow is the
canonical UX; if a size doesn't fit, the *resolver* needs more work, not
the UI.
