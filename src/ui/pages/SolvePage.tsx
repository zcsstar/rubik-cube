import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { maybeShowPostSolveAd } from '@/ads/admob';
import { Shuffle, Sparkles, Brush, Camera, Loader2, RotateCcw } from 'lucide-react';
import type { CubeSize } from '@core/cube/ICube';
import { CubeViewer3D } from '@ui/components/CubeViewer3D/CubeViewer3D';
import { StepViewer } from '@ui/components/StepViewer/StepViewer';
import { MobileStepBar } from '@ui/components/StepViewer/MobileStepBar';
import { ColorInputNet } from '@ui/components/ColorInputNet/ColorInputNet';
import { CameraCapture } from '@ui/components/CameraCapture/CameraCapture';
import { SizeSelector } from '@ui/components/SizeSelector/SizeSelector';
import { useSolveSession } from '@ui/hooks/useSolveSession';
import { analyzeSolutionPhases } from '@core/solvers/analyzePhases';
import { Cube2x2 } from '@core/cube/Cube2x2';
import { Cube3x3 } from '@core/cube/Cube3x3';
import { canonicalize3x3 } from '@core/cube/canonicalize';
import { useI18n } from '@ui/i18n/I18nProvider';

interface SolvePageProps {
  size: CubeSize;
}

export function SolvePage({ size }: SolvePageProps) {
  const { t } = useI18n();

  if (size === 4) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-12 text-center">
        <SizeSelector section="solve" sizes={[2, 3, 4]} />
        <h1 className="mt-4 text-2xl font-semibold text-slate-900 dark:text-slate-50">
          {t('solve.page4.title')}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('solve.page4.description')}</p>
      </div>
    );
  }

  // Key on `size` so the body (and its useSolveSession state) is remounted
  // when the user switches between 2×2 and 3×3. Without this, React reconciles
  // the two route elements as the same component instance, and useState's
  // initializer (which seeds the initial cube based on `size`) never re-runs —
  // a 2×2 state ends up displayed on the 3×3 page and vice versa.
  return <SolveBody key={size} size={size} />;
}

function SolveBody({ size }: { size: 2 | 3 }) {
  const { t } = useI18n();
  const session = useSolveSession(size);

  type Mode = 'idle' | 'paint' | 'camera';
  const [mode, setMode] = useState<Mode>('idle');
  /** Pre-fill for ColorInputNet after a camera capture: jumps straight to "review and correct". */
  const [paintInitial, setPaintInitial] = useState<string | null>(null);

  // Refs + intent flags drive the auto-scroll affordances on mobile:
  //   1. Finishing camera capture → scroll down to the paint review so the
  //      user notices the "Use this state" button.
  //   2. Confirming the paint state → scroll back up to the cube + Solve
  //      button so the next action is obvious.
  // We only fire on intentional transitions (flag set in the handler) so
  // unrelated re-renders or initial mount don't yank the viewport.
  const cubeSectionRef = useRef<HTMLElement | null>(null);
  const reviewSectionRef = useRef<HTMLElement | null>(null);
  const scrollToReviewNext = useRef(false);
  const scrollToCubeNext = useRef(false);

  useEffect(() => {
    if (mode === 'paint' && scrollToReviewNext.current) {
      scrollToReviewNext.current = false;
      reviewSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (mode === 'idle' && scrollToCubeNext.current) {
      scrollToCubeNext.current = false;
      cubeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [mode]);

  const phases = useMemo(
    () => analyzeSolutionPhases(session.initial, session.solution),
    [session.initial, session.solution],
  );
  const phaseSpecs = phases.map((p) => ({ start: p.start, name: p.name, hint: p.hint }));

  const isScrambled = !session.cube.isSolved() || session.solution.length > 0;
  const hasSolution = session.solution.length > 0;
  const facelets = session.cube.toFaceletString();

  // Trigger a (capped) interstitial when the user finishes stepping through
  // a solution. Native-only; the helper itself enforces "first solve is
  // free" + a 5-minute cooldown so this fires sparingly.
  const solveComplete =
    session.solution.length > 0 && session.step === session.solution.length;
  useEffect(() => {
    if (solveComplete) void maybeShowPostSolveAd();
  }, [solveComplete]);

  const titleKey = size === 2 ? 'solve.page2.title' : 'solve.page3.title';
  const descKey = size === 2 ? 'solve.page2.description' : 'solve.page3.description';

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 pb-24 pt-4 sm:gap-6 sm:pb-6 sm:pt-6 lg:py-10">
      <header className="flex flex-col gap-2">
        <SizeSelector section="solve" sizes={[2, 3, 4]} />
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">{t(titleKey)}</h1>
        <p className="hidden text-sm text-slate-500 dark:text-slate-400 sm:block">{t(descKey)}</p>
      </header>

      <div className="grid gap-3 sm:gap-6 lg:grid-cols-2">
        <section ref={cubeSectionRef} className="flex flex-col gap-2 sm:gap-3">
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-0 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-950 sm:p-3">
            <CubeViewer3D
              facelets={facelets}
              size={size}
              animation={session.animating}
              onAnimationEnd={session.finishAnimation}
              // On phones, cap the cube to ~38vh so the cube + controls + the
              // start of the step viewer fit on one screen. Combined with the
              // tighter camera framing in CubeViewer3D, this leaves enough
              // visual size for the cube to read clearly. Desktop unchanged.
              className="mx-auto aspect-square w-full max-w-[38vh] lg:max-w-none"
            />
          </div>

          {size === 3 && (
            // Compact on mobile (just two pill buttons), labelled card on
            // desktop. Drops a ~50px band from the top of the phone layout.
            // Hidden entirely on mobile once a solution is active — flipping
            // flavour from there would require re-solving anyway, so it's
            // just visual noise above the move list.
            <div
              className={
                'flex-wrap items-center gap-2 text-xs sm:rounded-md sm:border sm:border-slate-200 sm:bg-slate-50 sm:px-3 sm:py-2 sm:dark:border-slate-800 sm:dark:bg-slate-950/60 ' +
                (hasSolution ? 'hidden sm:flex' : 'flex')
              }
            >
              <span className="hidden font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 sm:inline">
                {t('solve.flavour.label')}
              </span>
              <div className="flex rounded-md border border-slate-200 bg-white p-0.5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
                <button
                  type="button"
                  onClick={() => session.setFlavour('fast')}
                  className={
                    'rounded px-2 py-1 transition ' +
                    (session.flavour === 'fast'
                      ? 'bg-indigo-500 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')
                  }
                >
                  {t('solve.flavour.fast')}
                </button>
                <button
                  type="button"
                  onClick={() => session.setFlavour('beginner')}
                  className={
                    'rounded px-2 py-1 transition ' +
                    (session.flavour === 'beginner'
                      ? 'bg-indigo-500 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')
                  }
                >
                  {t('solve.flavour.beginner')}
                </button>
              </div>
            </div>
          )}

          {/* Secondary action buttons collapse to icon-only on mobile (text
              still in DOM for screen readers); Solve keeps its label as the
              primary action so it doesn't read as just an "indigo dot". */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={session.scramble}
              aria-label={t('solve.btn.scramble')}
              className="flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:px-3"
            >
              <Shuffle size={14} />
              <span className="sr-only sm:not-sr-only">{t('solve.btn.scramble')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPaintInitial(null);
                setMode((m) => {
                  if (m === 'paint') {
                    // Closing paint via the toolbar toggle → bring the cube
                    // back into view, same as Cancel / Use this state.
                    scrollToCubeNext.current = true;
                    return 'idle';
                  }
                  // Opening paint → scroll to the review section so the
                  // sticker grid + Use this state CTA are in view.
                  scrollToReviewNext.current = true;
                  return 'paint';
                });
              }}
              aria-label={t('solve.btn.paint')}
              className={
                'flex h-9 items-center justify-center gap-2 rounded-md border px-2.5 text-sm font-medium shadow-sm transition sm:px-3 ' +
                (mode === 'paint'
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950 dark:text-indigo-200'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800')
              }
            >
              <Brush size={14} />
              <span className="sr-only sm:not-sr-only">{t('solve.btn.paint')}</span>
            </button>
            <button
              type="button"
              onClick={() => setMode((m) => (m === 'camera' ? 'idle' : 'camera'))}
              aria-label={t('solve.btn.camera')}
              className={
                'flex h-9 items-center justify-center gap-2 rounded-md border px-2.5 text-sm font-medium shadow-sm transition sm:px-3 ' +
                (mode === 'camera'
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950 dark:text-indigo-200'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800')
              }
            >
              <Camera size={14} />
              <span className="sr-only sm:not-sr-only">{t('solve.btn.camera')}</span>
            </button>
            <button
              type="button"
              onClick={session.solve}
              disabled={session.status === 'solving' || !isScrambled || mode !== 'idle'}
              className="flex h-9 items-center gap-2 rounded-md bg-indigo-500 px-3 text-sm font-medium text-white shadow-sm enabled:hover:bg-indigo-600 disabled:opacity-50"
            >
              {session.status === 'solving' || session.solverInit === 'preparing' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              {session.status === 'solving'
                ? t('solve.btn.solving')
                : session.solverInit === 'preparing'
                  ? t('solve.btn.preparing')
                  : t('solve.btn.solve')}
            </button>
            <button
              type="button"
              onClick={session.resetToSolved}
              aria-label={t('solve.btn.reset')}
              className="ml-auto flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 sm:px-3"
            >
              <RotateCcw size={14} />
              <span className="sr-only sm:not-sr-only">{t('solve.btn.reset')}</span>
            </button>
          </div>

          {session.error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {session.error}
            </div>
          )}
        </section>

        <section ref={reviewSectionRef} className="flex flex-col gap-4">
          {mode === 'camera' ? (
            <CameraCapture
              size={size}
              onComplete={(faceletStr) => {
                // Hand the camera result to ColorInputNet so the user can verify
                // and fix any sticker the classifier misread before solving.
                setPaintInitial(faceletStr);
                setMode('paint');
                // Scroll the paint review into view — on mobile the
                // "Use this state" CTA otherwise sits below the fold.
                scrollToReviewNext.current = true;
              }}
              onCancel={() => setMode('idle')}
            />
          ) : mode === 'paint' ? (
            <ColorInputNet
              size={size}
              initial={paintInitial ?? session.initial.toFaceletString()}
              onSubmit={(faceletStr) => {
                // The user may have painted the cube in any of 24 valid
                // orientations (e.g. blue-on-top instead of white). Re-rotate
                // to canonical before handing it to the solver. The 2x2 path
                // doesn't need this — Solver2x2BFS handles arbitrary
                // orientations and parity directly.
                const canonical =
                  size === 3 ? (canonicalize3x3(faceletStr) ?? faceletStr) : faceletStr;
                const cube =
                  size === 2 ? Cube2x2.fromFacelets(canonical) : Cube3x3.fromFacelets(canonical);
                session.setInitial(cube);
                setPaintInitial(null);
                setMode('idle');
                // Bring the cube + Solve button back into view so the next
                // action ("Solve") is obvious.
                scrollToCubeNext.current = true;
              }}
              onCancel={() => {
                setPaintInitial(null);
                setMode('idle');
                // Cancel mirrors Use this state for scrolling — get the
                // cube back on screen so the next action is obvious.
                scrollToCubeNext.current = true;
              }}
            />
          ) : session.solution.length > 0 ? (
            <StepViewer
              moves={session.solution}
              currentStep={session.step}
              playing={session.playing}
              animating={!!session.animating}
              phases={phaseSpecs}
              onStepChange={session.requestStep}
              onPlayingChange={session.setPlaying}
            />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <h2 className="mb-2 text-sm font-semibold tracking-wide text-slate-700 dark:text-slate-200">
                  {t('solve.howItWorks')}
                </h2>
                <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-600 dark:text-slate-300">
                  <li>
                    {renderWithSlots(t('solve.step1'), {
                      scramble: (
                        <InlineBtn icon={<Shuffle size={12} />} label={t('solve.btn.scramble')} />
                      ),
                      paint: (
                        <InlineBtn icon={<Brush size={12} />} label={t('solve.btn.paint')} />
                      ),
                      camera: (
                        <InlineBtn icon={<Camera size={12} />} label={t('solve.btn.camera')} />
                      ),
                    })}
                  </li>
                  <li>
                    {renderWithSlots(t('solve.step2'), {
                      solve: (
                        <InlineBtn icon={<Sparkles size={12} />} label={t('solve.btn.solve')} />
                      ),
                    })}
                  </li>
                  <li>{t('solve.step3')}</li>
                </ol>
              </div>
              <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-900">
                {(session.status === 'solving' || session.solverInit === 'preparing') && (
                  <Loader2 size={14} className="animate-spin" />
                )}
                {session.status === 'solving'
                  ? t('solve.prompt.solving')
                  : session.solverInit === 'preparing'
                    ? t('solve.prompt.preparing')
                    : t('solve.prompt.initial')}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Mobile-only fixed-bottom step bar — keeps play/prev/next reachable
          without scrolling past the move-chip list. Only renders when a
          solution is active and the user is in the step-viewer mode (not
          painting or capturing). */}
      {hasSolution && mode === 'idle' && (
        <MobileStepBar
          totalSteps={session.solution.length}
          currentStep={session.step}
          playing={session.playing}
          onStepChange={session.requestStep}
          onPlayingChange={session.setPlaying}
        />
      )}
    </div>
  );
}

/**
 * Inline "button chip" used inside the How-it-works prose: icon + bold label
 * matching the actual toolbar button, so users can map the description to
 * the on-screen control at a glance.
 */
function InlineBtn({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 align-baseline text-[0.8em] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
      {icon}
      {label}
    </span>
  );
}

/**
 * Lightweight templating: replace `{name}` placeholders in `template` with
 * React nodes supplied via `slots`. Used so translated prose can keep its
 * grammar while embedding interactive-looking elements (icon + label chips).
 */
function renderWithSlots(template: string, slots: Record<string, ReactNode>): ReactNode {
  const parts = template.split(/(\{[^}]+\})/g);
  return parts.map((part, i) => {
    const m = /^\{([^}]+)\}$/.exec(part);
    if (m && slots[m[1]!] !== undefined) {
      return <Fragment key={i}>{slots[m[1]!]}</Fragment>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}
