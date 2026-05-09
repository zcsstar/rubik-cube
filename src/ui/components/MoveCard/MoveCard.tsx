import type { Move } from '@core/cube/moves';
import { moveToString } from '@core/cube/moves';
import type { FaceLetter } from '@core/cube/colors';
import { FACE_COLORS, FACE_NAMES } from '@core/cube/colors';

export interface MoveCardProps {
  move: Move;
  /** Visual emphasis: 'large' for current move, 'small' for chip-list item. */
  variant?: 'large' | 'small';
  /** Whether the move has already been performed (chip-list only). */
  done?: boolean;
  /** Whether this is the currently-highlighted move in the chip list. */
  active?: boolean;
  onClick?: () => void;
}

/**
 * Plain-English description for a face turn. Designed for kids: avoids cubing
 * jargon and uses everyday words ("the right side", "halfway", "clockwise").
 */
export function describeMove(move: Move): string {
  const faceName = FACE_NAMES[move.face].toLowerCase();
  const article = move.face === 'U' || move.face === 'D' ? 'the' : 'the';
  const direction =
    move.modifier === '2'
      ? 'halfway around (180°)'
      : move.modifier === "'"
        ? 'counter-clockwise'
        : 'clockwise';
  return `Turn ${article} ${faceName} side ${direction}.`;
}

/**
 * SVG glyph showing one cube face with a curved arrow indicating direction.
 * The arrow flips direction for prime moves, doubles for 180°.
 */
function FaceArrowIcon({
  face,
  modifier,
  size = 56,
  className,
}: {
  face: FaceLetter;
  modifier: Move['modifier'];
  size?: number;
  className?: string;
}) {
  const color = FACE_COLORS[face];
  const cw = modifier !== "'"; // ' is CCW; '' and '2' are conceptually CW
  const isDouble = modifier === '2';
  // Arrow direction in SVG: clockwise → arrow points right at top.
  // Use a curved arc inside a rounded square representing the face.
  const stroke = '#0f172a';
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="6" y="6" width="52" height="52" rx="8" fill={color} stroke={stroke} strokeWidth="2" />
      {/* Inner grid lines to suggest a face of a cube */}
      <line x1="23.3" y1="6" x2="23.3" y2="58" stroke={stroke} strokeOpacity="0.25" strokeWidth="1" />
      <line x1="40.6" y1="6" x2="40.6" y2="58" stroke={stroke} strokeOpacity="0.25" strokeWidth="1" />
      <line x1="6" y1="23.3" x2="58" y2="23.3" stroke={stroke} strokeOpacity="0.25" strokeWidth="1" />
      <line x1="6" y1="40.6" x2="58" y2="40.6" stroke={stroke} strokeOpacity="0.25" strokeWidth="1" />

      {/* Arrow */}
      {cw ? (
        <path
          d="M 22 17 A 16 16 0 0 1 47 17"
          stroke={stroke}
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
          markerEnd="url(#arrow-cw)"
        />
      ) : (
        <path
          d="M 47 17 A 16 16 0 0 0 22 17"
          stroke={stroke}
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
          markerEnd="url(#arrow-ccw)"
        />
      )}
      {isDouble && (
        <text
          x="32"
          y="48"
          textAnchor="middle"
          fontFamily="ui-sans-serif, system-ui"
          fontSize="14"
          fontWeight="700"
          fill={stroke}
        >
          ×2
        </text>
      )}
      <defs>
        <marker id="arrow-cw" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 Z" fill={stroke} />
        </marker>
        <marker id="arrow-ccw" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 Z" fill={stroke} />
        </marker>
      </defs>
    </svg>
  );
}

export function MoveCard({ move, variant = 'small', done, active, onClick }: MoveCardProps) {
  const notation = moveToString(move);
  if (variant === 'large') {
    return (
      <div className="flex items-center gap-4 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm dark:border-indigo-900 dark:from-indigo-950 dark:to-slate-900">
        <FaceArrowIcon face={move.face} modifier={move.modifier} size={68} />
        <div className="flex flex-col">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold text-slate-900 dark:text-slate-50">
              {notation}
            </span>
            <span className="text-sm text-slate-500">
              {move.modifier === '2' ? '180° turn' : '90° turn'}
            </span>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-200">{describeMove(move)}</p>
        </div>
      </div>
    );
  }
  // small variant: a button-shaped chip with mini icon + notation
  return (
    <button
      type="button"
      onClick={onClick}
      title={describeMove(move)}
      className={
        'flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-sm transition ' +
        (done
          ? 'border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
          : active
            ? 'border-indigo-500 bg-indigo-500 text-white shadow-sm dark:bg-indigo-500'
            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800')
      }
    >
      <FaceArrowIcon face={move.face} modifier={move.modifier} size={20} className="shrink-0" />
      {notation}
    </button>
  );
}
