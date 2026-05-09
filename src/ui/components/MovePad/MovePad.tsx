import type { Move } from '@core/cube/moves';
import { parseMove } from '@core/cube/moves';
import type { CubeSize } from '@core/cube/ICube';
import { useI18n } from '@ui/i18n/I18nProvider';
import { Undo2 } from 'lucide-react';

export interface MovePadProps {
  size: CubeSize;
  onMove: (move: Move) => void;
  onUndo?: () => void;
  /** Disable all buttons (e.g., while a move is animating). Default false. */
  disabled?: boolean;
  className?: string;
}

const FACE_BUTTONS = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
const MODIFIERS: Array<['' | "'" | '2', string]> = [
  ['', ''],
  ["'", "'"],
  ['2', '2'],
];

/**
 * Compact button pad for inputting cube moves. Six rows (one per face)
 * with three columns (cw / ccw / 180°). For 3×3 we additionally show a
 * row of slice moves M / E / S.
 *
 * Keep it kid-friendly: face buttons are colour-coded to the face they
 * turn, modifiers are large monospace symbols, and the undo button is
 * obvious in the corner.
 */
export function MovePad({ size, onMove, onUndo, disabled, className }: MovePadProps) {
  const { t } = useI18n();
  const showSlices = size === 3;
  return (
    <div
      className={
        'flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 ' +
        (className ?? '')
      }
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t('practice.movePad')}
        </span>
        {onUndo && (
          <button
            type="button"
            onClick={onUndo}
            disabled={disabled}
            aria-label={t('practice.undo')}
            className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Undo2 size={14} /> {t('practice.undo')}
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {FACE_BUTTONS.map((face) => (
          <div key={face} className="flex flex-col gap-1">
            {MODIFIERS.map(([mod, label]) => {
              const token = `${face}${mod}`;
              return (
                <button
                  key={token}
                  type="button"
                  onClick={() => onMove(parseMove(token))}
                  disabled={disabled}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1.5 font-mono text-sm text-slate-700 transition hover:border-indigo-400 hover:bg-indigo-50 active:scale-95 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-500 dark:hover:bg-indigo-950"
                >
                  {face}
                  <span className="ml-px text-slate-400">{label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {showSlices && (
        <div className="grid grid-cols-3 gap-1.5">
          {(['M', 'E', 'S'] as const).map((slice) => (
            <div key={slice} className="flex gap-1">
              {MODIFIERS.map(([mod, label]) => {
                const token = `${slice}${mod}`;
                return (
                  <button
                    key={token}
                    type="button"
                    onClick={() => onMove(parseMove(token))}
                    disabled={disabled}
                    className="flex-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 active:scale-95 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400 dark:hover:bg-indigo-950"
                  >
                    {slice}
                    <span className="ml-px text-slate-400">{label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
