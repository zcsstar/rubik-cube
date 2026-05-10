import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react';
import { useEffect } from 'react';
import type { Move } from '@core/cube/moves';
import { MoveCard } from '@ui/components/MoveCard/MoveCard';
import { useI18n } from '@ui/i18n/I18nProvider';

export interface PhaseSpec {
  /** Move index where this phase starts (inclusive). */
  start: number;
  /** Display name (e.g., "White cross"). */
  name: string;
  /** Optional one-line plain-English explanation. */
  hint?: string;
}

export interface StepViewerProps {
  moves: readonly Move[];
  /** Current visible step (= number of moves applied). 0 = before first move. */
  currentStep: number;
  /** Whether playback is auto-advancing. */
  playing: boolean;
  /** True while a slice rotation is mid-animation; pauses auto-advance. */
  animating: boolean;
  /** Optional phase markers — must be sorted by `start`. */
  phases?: readonly PhaseSpec[];
  /** Translation key for the panel title. Defaults to 'player.title'. */
  titleKey?: string;
  onStepChange: (step: number) => void;
  onPlayingChange: (playing: boolean) => void;
  /** Pause between auto-advanced moves in ms (in addition to animation time). */
  pauseMs?: number;
}

function findPhase(phases: readonly PhaseSpec[] | undefined, step: number): PhaseSpec | undefined {
  if (!phases || phases.length === 0) return undefined;
  let cur: PhaseSpec | undefined;
  for (const p of phases) {
    if (p.start <= step) cur = p;
    else break;
  }
  return cur;
}

export function StepViewer({
  moves,
  currentStep,
  playing,
  animating,
  phases,
  titleKey = 'player.title',
  onStepChange,
  onPlayingChange,
  pauseMs = 250,
}: StepViewerProps) {
  const { t } = useI18n();
  const totalSteps = moves.length;

  // Auto-advance: while playing and not animating, after pauseMs, advance one step.
  useEffect(() => {
    if (!playing) return;
    if (animating) return; // wait for the current rotation to settle
    if (currentStep >= totalSteps) {
      onPlayingChange(false);
      return;
    }
    const id = window.setTimeout(() => {
      onStepChange(currentStep + 1);
    }, pauseMs);
    return () => window.clearTimeout(id);
  }, [playing, animating, currentStep, totalSteps, pauseMs, onStepChange, onPlayingChange]);

  const atStart = currentStep <= 0;
  const atEnd = currentStep >= totalSteps;

  const upcomingMove = moves[currentStep]; // the move that NEXT will play
  const phase = findPhase(phases, currentStep);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-wide text-slate-700 dark:text-slate-200">{t(titleKey)}</h3>
        <span className="font-mono text-xs text-slate-500">
          {currentStep} / {totalSteps}
        </span>
      </div>

      {phase && (
        <div className="rounded-md bg-indigo-50 px-3 py-2 text-sm dark:bg-indigo-950/50">
          <div className="font-medium text-indigo-700 dark:text-indigo-200">{t('player.step')}: {phase.name}</div>
          {phase.hint && (
            <div className="text-xs text-indigo-600/80 dark:text-indigo-300/80">{phase.hint}</div>
          )}
        </div>
      )}

      {upcomingMove ? (
        <div>
          <div className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">
            {t('player.nextMove')}
          </div>
          <MoveCard move={upcomingMove} variant="large" />
        </div>
      ) : (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-center text-sm font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
          {t('player.solved')}
        </div>
      )}

      {moves.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {moves.map((move, i) => (
            <MoveCard
              key={i}
              move={move}
              variant="small"
              done={i < currentStep}
              active={i === currentStep}
              onClick={() => onStepChange(i)}
            />
          ))}
        </div>
      )}

      {/* Step controls — sized for touch (~44pt min). Hidden on mobile;
          SolvePage renders a fixed-bottom step bar there so play/prev/next
          stay reachable without scrolling past the move chips. */}
      <div className="hidden items-center gap-2 sm:flex">
        <button
          type="button"
          onClick={() => onStepChange(0)}
          disabled={atStart && !playing}
          aria-label={t('player.aria.reset')}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-600 enabled:hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:enabled:hover:bg-slate-800"
        >
          <RotateCcw size={20} />
        </button>
        <button
          type="button"
          onClick={() => onStepChange(currentStep - 1)}
          disabled={atStart}
          aria-label={t('player.aria.prev')}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-600 enabled:hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:enabled:hover:bg-slate-800"
        >
          <ChevronLeft size={22} />
        </button>
        <button
          type="button"
          onClick={() => onPlayingChange(!playing)}
          disabled={atEnd && !playing}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-indigo-500 px-3 text-sm font-medium text-white shadow-sm enabled:hover:bg-indigo-600 disabled:opacity-40"
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
          {playing ? t('player.btn.pause') : atEnd ? t('player.btn.finished') : t('player.btn.play')}
        </button>
        <button
          type="button"
          onClick={() => onStepChange(currentStep + 1)}
          disabled={atEnd}
          aria-label={t('player.aria.next')}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-600 enabled:hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:enabled:hover:bg-slate-800"
        >
          <ChevronRight size={22} />
        </button>
      </div>
    </div>
  );
}
