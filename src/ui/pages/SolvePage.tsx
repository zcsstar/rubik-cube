import { useMemo, useState } from 'react';
import { Shuffle, Sparkles, Brush, Camera, Loader2 } from 'lucide-react';
import type { CubeSize } from '@core/cube/ICube';
import { CubeViewer3D } from '@ui/components/CubeViewer3D/CubeViewer3D';
import { StepViewer } from '@ui/components/StepViewer/StepViewer';
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
  const facelets = session.cube.toFaceletString();

  const titleKey = size === 2 ? 'solve.page2.title' : 'solve.page3.title';
  const descKey = size === 2 ? 'solve.page2.description' : 'solve.page3.description';

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 lg:py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{t(titleKey)}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t(descKey)}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
            <CubeViewer3D
              facelets={facelets}
              size={size}
              animation={session.animating}
              onAnimationEnd={session.finishAnimation}
              className="aspect-square w-full"
            />
          </div>

          {size === 3 && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-950/60">
              <span className="font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t('solve.flavour.label')}
              </span>
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
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={session.scramble}
              className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Shuffle size={14} /> {t('solve.btn.scramble')}
            </button>
            <button
              type="button"
              onClick={() => {
                setPaintInitial(null);
                setMode((m) => (m === 'paint' ? 'idle' : 'paint'));
              }}
              className={
                'flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium shadow-sm transition ' +
                (mode === 'paint'
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950 dark:text-indigo-200'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800')
              }
            >
              <Brush size={14} /> {t('solve.btn.paint')}
            </button>
            <button
              type="button"
              onClick={() => setMode((m) => (m === 'camera' ? 'idle' : 'camera'))}
              className={
                'flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium shadow-sm transition ' +
                (mode === 'camera'
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950 dark:text-indigo-200'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800')
              }
            >
              <Camera size={14} /> {t('solve.btn.camera')}
            </button>
            <button
              type="button"
              onClick={session.solve}
              disabled={session.status === 'solving' || !isScrambled}
              className="flex items-center gap-2 rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm enabled:hover:bg-indigo-600 disabled:opacity-50"
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
              className="ml-auto rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {t('solve.btn.reset')}
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
    </div>
  );
}
