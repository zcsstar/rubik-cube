import { useEffect, useMemo, useState } from 'react';
import { Lightbulb, RotateCcw, Shuffle } from 'lucide-react';
import type { CubeSize, ICube } from '@core/cube/ICube';
import type { Tutorial, TutorialCase } from '@core/tutorials/ITutorial';
import { getTutorial } from '@core/tutorials';
import { invertMoves, parseMoves } from '@core/cube/moves';
import { Cube2x2 } from '@core/cube/Cube2x2';
import { Cube3x3 } from '@core/cube/Cube3x3';
import { CubeViewer3D } from '@ui/components/CubeViewer3D/CubeViewer3D';
import { MovePad } from '@ui/components/MovePad/MovePad';
import { MoveCard } from '@ui/components/MoveCard/MoveCard';
import { CubeMiniNet } from '@ui/components/CubeMiniNet/CubeMiniNet';
import { SizeSelector } from '@ui/components/SizeSelector/SizeSelector';
import { usePracticeSession } from '@ui/hooks/usePracticeSession';
import { useI18n } from '@ui/i18n/I18nProvider';

export interface PracticePageProps {
  size: CubeSize;
}

/**
 * Practice mode: pick a tutorial step + a case, the cube starts in that
 * case's setup state, and the user has to drive it back to solved with
 * the on-screen MovePad. Stays kid-friendly: success banner when solved,
 * "Show answer" if stuck.
 */
export function PracticePage({ size }: PracticePageProps) {
  const { locale, t } = useI18n();
  const tutorial = getTutorial(size, locale);

  if (!tutorial) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
          {t('notfound.title')}
        </h1>
      </div>
    );
  }

  return <PracticeBody tutorial={tutorial} size={size} />;
}

function newSolved(size: CubeSize): ICube {
  if (size === 2) return Cube2x2.solved();
  if (size === 3) return Cube3x3.solved();
  throw new Error(`Unsupported size: ${size}`);
}

function PracticeBody({ tutorial, size }: { tutorial: Tutorial; size: CubeSize }) {
  const { t } = useI18n();
  const [stepId, setStepId] = useState<string>(() => tutorial.steps[0]!.id);
  const step = tutorial.steps.find((s) => s.id === stepId) ?? tutorial.steps[0]!;
  const [caseIndex, setCaseIndex] = useState(0);
  const activeCase = step.cases[caseIndex % step.cases.length]!;
  const [showAnswer, setShowAnswer] = useState(false);

  // When step changes, reset case index and answer-reveal.
  useEffect(() => {
    setCaseIndex(0);
    setShowAnswer(false);
  }, [stepId]);

  // When case changes, hide the answer again.
  useEffect(() => {
    setShowAnswer(false);
  }, [activeCase.id]);

  const initial = useMemo(() => {
    const setup = activeCase.setup
      ? parseMoves(activeCase.setup)
      : invertMoves(parseMoves(activeCase.algorithm));
    return newSolved(size).applyAll(setup);
  }, [size, activeCase]);

  const session = usePracticeSession(size, initial, (cube) => cube.isSolved());

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:gap-5 sm:py-6 lg:py-10">
      <header className="flex flex-col gap-2">
        <SizeSelector section="practice" sizes={[2, 3]} />
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">
          {t('practice.title')}
        </h1>
        <p className="hidden text-sm text-slate-600 dark:text-slate-300 sm:block">{t('practice.blurb')}</p>
      </header>

      <StepPicker tutorial={tutorial} activeId={stepId} onChange={setStepId} />

      {/* Mobile: single column. Cube on top (capped height so MovePad fits
          without scrolling), status compact, MovePad immediately below.
          Desktop: 2-column with cube/status/actions on the left and
          CaseInfo + MovePad on the right. */}
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-6">
        <section className="flex flex-col gap-2 lg:order-1 lg:gap-3">
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-0 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-950 sm:p-3">
            <CubeViewer3D
              facelets={session.displayCube.toFaceletString()}
              size={size}
              animation={session.animating}
              onAnimationEnd={session.finishAnimation}
              // Cap on phones so cube + status + MovePad share one screen.
              className="mx-auto aspect-square w-full max-w-[34vh] sm:max-w-[42vh] lg:max-w-none"
            />
          </div>
          <SolveStatus
            reached={session.reached}
            historyCount={session.history.length}
            optimalCount={parseMoves(activeCase.algorithm).length}
          />
        </section>

        <section className="flex flex-col gap-3 lg:order-2">
          <MovePad
            size={size}
            onMove={session.applyMove}
            onUndo={session.history.length > 0 ? session.undo : undefined}
            disabled={!!session.animating}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={session.reset}
              className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RotateCcw size={14} /> {t('practice.btn.reset')}
            </button>
            <button
              type="button"
              onClick={() => setCaseIndex((i) => i + 1)}
              disabled={step.cases.length <= 1}
              className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Shuffle size={14} /> {t('practice.btn.nextCase')}
            </button>
            <button
              type="button"
              onClick={() => setShowAnswer((s) => !s)}
              className="ml-auto flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100 dark:hover:bg-amber-900"
            >
              <Lightbulb size={14} />
              {showAnswer ? t('practice.btn.hideAnswer') : t('practice.btn.showAnswer')}
            </button>
          </div>
          <CaseInfo
            caseData={activeCase}
            size={size}
            showAnswer={showAnswer}
          />
        </section>
      </div>
    </div>
  );
}

function StepPicker({
  tutorial,
  activeId,
  onChange,
}: {
  tutorial: Tutorial;
  activeId: string;
  onChange: (id: string) => void;
}) {
  return (
    <nav className="flex flex-wrap gap-1.5">
      {tutorial.steps.map((s) => {
        const active = s.id === activeId;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            className={
              'flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition ' +
              (active
                ? 'border-indigo-500 bg-indigo-500 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800')
            }
          >
            <span
              className={
                'flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold ' +
                (active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')
              }
            >
              {s.number}
            </span>
            {s.title}
          </button>
        );
      })}
    </nav>
  );
}

function SolveStatus({
  reached,
  historyCount,
  optimalCount,
}: {
  reached: boolean;
  historyCount: number;
  optimalCount: number;
}) {
  const { t } = useI18n();
  if (reached) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
        {t('practice.success', { moves: historyCount, optimal: optimalCount })}
      </div>
    );
  }
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
      {t('practice.statusPlaying', { moves: historyCount })}
    </div>
  );
}

function CaseInfo({
  caseData,
  size,
  showAnswer,
}: {
  caseData: TutorialCase;
  size: CubeSize;
  showAnswer: boolean;
}) {
  const { t } = useI18n();
  const algorithm = useMemo(() => parseMoves(caseData.algorithm), [caseData.algorithm]);
  const facelets = useMemo(() => {
    const setup = caseData.setup
      ? parseMoves(caseData.setup)
      : invertMoves(algorithm);
    return newSolved(size).applyAll(setup).toFaceletString();
  }, [size, caseData, algorithm]);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <CubeMiniNet facelets={facelets} size={size} width={96} />
        <div className="flex-1">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">{caseData.name}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{caseData.description}</p>
          {caseData.recognition && (
            <p className="mt-1 text-xs italic text-slate-500 dark:text-slate-400">{caseData.recognition}</p>
          )}
        </div>
      </div>
      {showAnswer ? (
        <div className="mt-3 flex flex-wrap gap-1.5 rounded-md bg-amber-50/60 p-2 dark:bg-amber-950/30">
          {algorithm.map((m, i) => (
            <MoveCard key={i} move={m} variant="small" />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          {t('practice.answerHidden')}
        </p>
      )}
    </div>
  );
}
