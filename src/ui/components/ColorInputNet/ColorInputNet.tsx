import { useMemo, useState } from 'react';
import type { CubeSize } from '@core/cube/ICube';
import { faceOffset, stickersPerFace, totalStickers, URFDLB } from '@core/cube/ICube';
import type { FaceLetter } from '@core/cube/colors';
import { FACE_COLORS, FACE_NAMES } from '@core/cube/colors';
import { validateFacelets } from '@core/cube/validate';
import { Check, X } from 'lucide-react';

export interface ColorInputNetProps {
  size: CubeSize;
  /** Initial facelet state. Defaults to solved. */
  initial?: string;
  /** Called when user confirms a valid state. */
  onSubmit: (facelets: string) => void;
  onCancel?: () => void;
}

function solvedFacelets(size: CubeSize): string {
  return URFDLB.map((f) => f.repeat(stickersPerFace(size))).join('');
}

export function ColorInputNet({ size, initial, onSubmit, onCancel }: ColorInputNetProps) {
  const [facelets, setFacelets] = useState(() => initial ?? solvedFacelets(size));
  const [paint, setPaint] = useState<FaceLetter>('U');

  const errors = useMemo(() => validateFacelets(size, facelets), [size, facelets]);
  const valid = errors.length === 0;
  const N = size;

  const setSticker = (absIndex: number, letter: FaceLetter) => {
    if (size === 3) {
      // Block edits to centre stickers (one per face at index 4).
      const localIdx = absIndex % 9;
      if (localIdx === 4) return;
    }
    setFacelets((s) => s.substring(0, absIndex) + letter + s.substring(absIndex + 1));
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Paint your cube</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Pick a colour, then click stickers to paint. {size === 3 && 'Centres are fixed by face identity.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFacelets(solvedFacelets(size))}
          className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Reset
        </button>
      </header>

      {/* Colour palette */}
      <div className="flex flex-wrap items-center gap-2">
        {URFDLB.map((f) => {
          const selected = paint === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setPaint(f)}
              title={`${FACE_NAMES[f]} colour`}
              className={
                'flex h-8 w-12 items-center justify-center rounded-md border text-xs font-semibold transition ' +
                (selected
                  ? 'border-slate-900 ring-2 ring-indigo-300 dark:border-slate-100'
                  : 'border-slate-200 dark:border-slate-700')
              }
              style={{ backgroundColor: FACE_COLORS[f], color: f === 'U' ? '#000' : '#000' }}
            >
              {f}
            </button>
          );
        })}
      </div>

      {/* Cross-net layout */}
      <NetLayout size={N} facelets={facelets} paint={paint} onPaint={setSticker} />

      {/* Validation summary */}
      {valid ? (
        <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200">
          <Check size={14} /> Looks valid — ready to solve.
        </div>
      ) : (
        <ul className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-200">
          {errors.slice(0, 3).map((err, i) => (
            <li key={i} className="flex items-start gap-2">
              <X size={14} className="mt-0.5 shrink-0" />
              <span>{err.message}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onSubmit(facelets)}
          disabled={!valid}
          className="flex-1 rounded-md bg-indigo-500 px-3 py-2 text-sm font-medium text-white shadow-sm enabled:hover:bg-indigo-600 disabled:opacity-50"
        >
          Use this state
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Cross-net layout of the cube. Faces in a 4×3 grid with the standard
 *
 *     . U . .
 *     L F R B
 *     . D . .
 */
function NetLayout({
  size,
  facelets,
  paint,
  onPaint,
}: {
  size: CubeSize;
  facelets: string;
  paint: FaceLetter;
  onPaint: (absIndex: number, color: FaceLetter) => void;
}) {
  const renderFace = (face: FaceLetter) => {
    const off = faceOffset(size, face);
    return (
      <div
        key={face}
        className="grid gap-[3px] rounded-md p-1"
        style={{
          gridTemplateColumns: `repeat(${size}, 1fr)`,
          gridTemplateRows: `repeat(${size}, 1fr)`,
        }}
        aria-label={`${FACE_NAMES[face]} face`}
      >
        {Array.from({ length: size * size }, (_, i) => {
          const abs = off + i;
          const letter = facelets[abs] as FaceLetter;
          const isCentre = size === 3 && i === 4;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPaint(abs, paint)}
              disabled={isCentre}
              style={{ backgroundColor: FACE_COLORS[letter] }}
              className={
                'aspect-square rounded-sm border border-slate-300 transition disabled:cursor-not-allowed disabled:opacity-95 dark:border-slate-700 ' +
                (isCentre ? '' : 'hover:scale-105 hover:shadow-md')
              }
              aria-label={`${face} sticker ${i}, currently ${letter}`}
            />
          );
        })}
      </div>
    );
  };

  // Grid placement: U at row1 col2, L F R B in row2 cols 1..4, D at row3 col2.
  // Use Tailwind explicit grid coordinates.
  const facePos: Partial<Record<FaceLetter, string>> = {
    U: 'col-start-2 row-start-1',
    L: 'col-start-1 row-start-2',
    F: 'col-start-2 row-start-2',
    R: 'col-start-3 row-start-2',
    B: 'col-start-4 row-start-2',
    D: 'col-start-2 row-start-3',
  };
  return (
    <div className="grid grid-cols-4 grid-rows-3 gap-1 rounded-lg bg-slate-100/50 p-2 dark:bg-slate-950/50">
      {URFDLB.map((face) => (
        <div key={face} className={`${facePos[face]}`}>
          {renderFace(face)}
        </div>
      ))}
    </div>
  );
}

void totalStickers; // keep import resolved without lint warning
