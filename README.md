# Cubist — Rubik's Cube Solver & Tutor

Phase 1 (this build) is a static, client-side web app that scrambles a 2×2 or 3×3
cube and produces a step-by-step solution. Phase 2 is the same app on free hosting.
Phase 3 wraps it in Capacitor for iOS/Android.

## Status

| Feature                                  | State           |
| ---------------------------------------- | --------------- |
| 3×3 solver (Kociemba)                    | ✅ ready        |
| 2×2 solver (3×3 corner-only embedding)   | ✅ ready        |
| 4×4 solver                               | ⏳ stub page; reduction-method solver pending |
| 3D cube viewer (rotatable)               | ✅ ready        |
| Animated slice rotation per move         | ✅ ready        |
| Visual `MoveCard` (face icon + arrow + plain-English) | ✅ ready |
| Color input — 2D unfolded net painter    | ✅ ready (with sticker-count + centre validation) |
| Phase analysis (Kociemba two-phase split: Set-up → Finish) | ✅ ready |
| Beginner-method tutorial pages (3×3 LBL, 2×2 Ortega) | ✅ ready at `/learn/3` and `/learn/2` |
| Multi-language UI (English + 简体中文)    | ✅ ready (locale switcher in navbar; tutorials translated) |
| Camera color recognition (HSV nearest-neighbour) | ✅ ready (six-face guided capture, hands result to ColorInputNet for review) |
| PWA install + offline support              | ✅ ready (installable on iOS / Android / desktop; works offline after first visit) |
| Practice mode (try a tutorial case yourself) | ✅ ready at `/practice/3` and `/practice/2` (cube starts in a case state, user inputs moves with the on-screen pad, app validates when solved) |
| True LBL solver (auto-solves a user's cube via beginner method) | ⏳ pending — pattern-recognition for ~20 cases across 7 stages; current `Solver3x3Kociemba` is faster, the tutorial pages teach the method |
| Camera color recognition                 | ⏳ deferred to Phase 2 |

## Run

```sh
npm install
npm run dev          # dev server at http://localhost:5173
npm test             # vitest
npm run build        # production static build to dist/
```

## Deploy (GitHub Pages)

Push to `main`. The `.github/workflows/deploy.yml` workflow builds the app and
publishes `dist/` to GitHub Pages. The site lives at
`https://<owner>.github.io/rubik-cube/`.

How the URL routing works:

* `vite.config.ts` sets `base: '/rubik-cube/'` only when `GITHUB_ACTIONS` is set,
  so dev still uses relative paths.
* `main.tsx` passes `import.meta.env.BASE_URL` as `BrowserRouter`'s `basename`,
  so React Router knows about the prefix.
* The workflow copies `dist/index.html` to `dist/404.html`. GitHub Pages serves
  `404.html` for any path it cannot find, which lets a hard-refresh on
  `/rubik-cube/learn/3` boot the SPA correctly — BrowserRouter then strips the
  basename and matches the in-app route.

One-time GitHub repo setup before the first deploy: open **Settings → Pages**
and set **Source = GitHub Actions**. Subsequent deploys are automatic.

## Architecture

Strict separation of pure logic (`src/core/`) from React UI (`src/ui/`). UI
depends only on `core/` interfaces — adding a new cube size or a new solver is
a new file, no UI edits.

```
src/
  core/                       # Pure TS, no React, no DOM
    cube/      ICube, Cube2x2, Cube3x3, moves, colors, validate
    solvers/   ISolver, SolverFactory, Solver3x3Kociemba, Solver2x2BFS
  ui/
    components/ CubeViewer3D, StepViewer, Logo
    hooks/      useSolveSession
    pages/      HomePage, SolvePage, NotFoundPage
```

### Solver strategy

* **3×3** — wraps `cubejs` (MIT) which implements Kociemba two-phase. Solutions
  ≤22 moves, ~10–400 ms after a one-time ~1 s pruning-table init.
* **2×2** — embeds the 24-sticker 2×2 state into a 54-sticker 3×3 state where
  edges and centres are already solved, then delegates to the 3×3 solver. Same
  moves apply to the 2×2 because face turns coincide. Solutions are typically
  12–18 moves; not optimal for 2×2, but always correct and free.
* **4×4** — `Solver4x4Reduction` is the planned drop-in: pair centres → pair
  edges → run 3×3 solver with parity fix-ups. Not yet implemented.

### Deferred (Phase 1B / Phase 2)

* Standalone tutorial pages — the solver page already shows live phase labels
  ("White cross", "Middle-layer edges", …) walking through any solution, so
  the immediate teaching need is met. Dedicated practice tutorials (try a
  scramble, attempt the cross, get feedback) are next.
* `Cube4x4` + `Solver4x4Reduction` — full 4×4 mechanics (96 stickers, wide
  moves) and the reduction solver.
* Pure layer-by-layer (LBL) `BeginnerSolver3x3` — currently we run Kociemba
  for the actual move sequence and *label* milestones after the fact. A true
  LBL solver would emit longer but pedagogically straighter solutions; out of
  scope this iteration.
* Camera-based colour recognition for ColorInputNet.

The architecture deliberately leaves these as drop-in additions: the
`ICube` / `ISolver` interfaces and the generic `StepViewer` + phase metadata
already support them.

## Roadmap (next & later)

Tracked here so we don't forget. Roughly in priority order.

* ~~**Slice-move support (M / E / S)** — extend the move parser and
  3×3 applier to accept middle-slice rotations.~~ ✅ shipped.
* ~~**Full PLL coverage** — expand step-7 tutorial to all 21 named PLL
  cases.~~ ✅ shipped (Ua, Ub, H, Z, Aa, Ab, E, T, F, Ja, Jb, Ra, Rb,
  Na, Nb, V, Y, Ga, Gb, Gc, Gd — every alg round-trip-tested).
* **True LBL `BeginnerSolver3x3`** — auto-solve a user's cube using the
  same step-by-step beginner method the tutorial teaches. The current
  solver is Kociemba (efficient but cryptic 22-move solutions); a true
  LBL solver would emit longer but pedagogically straighter
  instructions kids can follow alongside the tutorial.
* **Camera color recognition robustness** — current HSV nearest-neighbour
  classifier handles normal indoor lighting. A small TensorFlow.js model
  trained on a handful of cube photos would be sturdier under warm /
  fluorescent / very dim lighting.
* **`Cube4x4` + `Solver4x4Reduction`** — full 4×4 mechanics (96
  stickers, wide moves) plus the centres → edges → 3×3 reduction
  solver with parity fix-ups.
* ~~**Practice mode** — scramble the cube to a known mid-LBL state
  and let the user attempt that phase with feedback.~~ ✅ shipped
  at `/practice/N`. Built on top of the tutorial case data so we
  reuse the same setups + canonical algorithms.
* ~~**PWA install** — manifest + service-worker so users can install
  the site to their home screen and use it offline.~~ ✅ shipped.
* **Phase 3: Capacitor wrap** — package the existing static build for
  iOS / Android app-store distribution.

## Tests

```sh
npm test
```

Covers move-application round-trips for both cubes (3×3 via cubejs, 2×2 via
hand-derived permutation tables verified against (move)⁴ = identity), and
random-scramble solve round-trips for both solvers.

## License

Code is MIT. All runtime dependencies are MIT-licensed (`cubejs`, `three`,
`@react-three/fiber`, `@react-three/drei`, `lucide-react`, `react`,
`react-router`, `@tailwindcss/vite`).
