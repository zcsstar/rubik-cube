import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react';
import { useI18n } from '@ui/i18n/I18nProvider';

/**
 * Fixed-bottom step controls for phone screens. Mirrors the bottom row of
 * StepViewer (which is hidden on mobile) so play/prev/next/reset stay one
 * tap away regardless of scroll position. Pairs with `pb-20` on the
 * SolvePage container so content scrolls above this bar instead of being
 * obscured by it.
 */
export interface MobileStepBarProps {
  totalSteps: number;
  currentStep: number;
  playing: boolean;
  onStepChange: (step: number) => void;
  onPlayingChange: (playing: boolean) => void;
}

export function MobileStepBar({
  totalSteps,
  currentStep,
  playing,
  onStepChange,
  onPlayingChange,
}: MobileStepBarProps) {
  const { t } = useI18n();
  const atStart = currentStep <= 0;
  const atEnd = currentStep >= totalSteps;

  return (
    <div
      className="fixed inset-x-0 z-40 flex items-center gap-2 border-t border-slate-200 bg-white/95 px-3 py-2 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:hidden"
      // Sit above the bottom tab bar (and the ad banner if shown) so step
      // controls remain reachable while the page scrolls.
      style={{ bottom: 'calc(var(--ad-banner-h) + var(--tab-bar-h) + var(--safe-bottom))' }}
      role="toolbar"
      aria-label={t('player.title')}
    >
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
      <span className="ml-1 shrink-0 font-mono text-xs tabular-nums text-slate-500">
        {currentStep}/{totalSteps}
      </span>
    </div>
  );
}
