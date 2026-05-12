import { useEffect, useMemo, useState } from 'react';
import { maybeShowPostSolveAd } from '@/ads/admob';
import { Shuffle, Sparkles, Brush, Camera, Loader2, RotateCcw } from 'lucide-react';
import type { CubeSize } from '@core/cube/ICube';
import { CubeViewer3D } from '@ui/components/CubeViewer3D/CubeViewer3D';
import { StepViewer } from '@ui/components/StepViewer/StepViewer';
import { MobileStepBar } from '@ui/components/StepViewer/MobileStepBar';
import { ColorInputNet } from '@ui/components/ColorInputNet/ColorInputNet';
import { CameraCapture } from '@ui/components/CameraCapture/CameraCapture';
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
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
          {t('solve.page4.title')}
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('solve.page4.description')}</p>
      </div>
    );
  }

  return <SolveBody size={size} />;
}

function SolveBody({ size }: { size: 2 | 3 }) {
  const { t } = useI18n();
  const session = useSolveSession(size);

  type Mode = 'idle' | 'paint' | 'camera';
  const [mode, setMode] = useState<Mode>('idle');
  /** Pre-fill for ColorInputNet after a camera capture: jumps straight to "review and correct". */
  const [paintInitial, setPaintInitial] = useState<string | null>(null);

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
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">{t(titleKey)}</h1>
        <p className="hidden text-sm text-slate-500 dark:text-slate-400 sm:block">{t(descKey)}</p>
      </header>

      <div className="grid gap-3 sm:gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-2 sm:gap-3">
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
                setMode((m) => (m === 'paint' ? 'idle' : 'paint'));
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
              disabled={session.status === 'solving' || !isScrambled}
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

        <section className="flex flex-col gap-4">
          {mode === 'camera' ? (
            <CameraCapture
              size={size}
              onComplete={(faceletStr) => {
                // Hand the camera result to ColorInputNet so the user can verify
                // and fix any sticker the classifier misread before solving.
                setPaintInitial(faceletStr);
                setMode('paint');
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
                // to canonical URFDLB before handing it to the solver.
                const canonical =
                  size === 3 ? (canonicalize3x3(faceletStr) ?? faceletStr) : faceletStr;
                const cube =
                  size === 2 ? Cube2x2.fromFacelets(canonical) : Cube3x3.fromFacelets(canonical);
                session.setInitial(cube);
                setPaintInitial(null);
                setMode('idle');
              }}
              onCancel={() => {
                setPaintInitial(null);
                setMode('idle');
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
                <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
                  <li dangerouslySetInnerHTML={{ __html: t('solve.step1') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('solve.step2') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('solve.step3') }} />
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
