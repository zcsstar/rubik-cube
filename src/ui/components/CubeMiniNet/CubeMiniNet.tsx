import type { CubeSize } from '@core/cube/ICube';
import { faceOffset, URFDLB } from '@core/cube/ICube';
import type { FaceLetter } from '@core/cube/colors';
import { FACE_COLORS } from '@core/cube/colors';

export interface CubeMiniNetProps {
  facelets: string;
  size: CubeSize;
  /** Total width in pixels of the whole net. Default 96. */
  width?: number;
  className?: string;
}

/**
 * Lightweight SVG thumbnail of a cube state — flat unfolded cross net.
 * Useful for case thumbnails where a full 3D viewer would be overkill.
 */
export function CubeMiniNet({ facelets, size, width = 96, className }: CubeMiniNetProps) {
  // Net layout: 4 faces wide, 3 faces tall.
  // Each face is an N×N grid. Sticker side = (width / 4) / N.
  const faceSide = width / 4;
  const stickerSide = faceSide / size;
  const totalWidth = faceSide * 4;
  const totalHeight = faceSide * 3;
  // Position of each face's top-left corner in the net.
  const FACE_POS: Record<FaceLetter, { x: number; y: number }> = {
    U: { x: faceSide, y: 0 },
    L: { x: 0, y: faceSide },
    F: { x: faceSide, y: faceSide },
    R: { x: faceSide * 2, y: faceSide },
    B: { x: faceSide * 3, y: faceSide },
    D: { x: faceSide, y: faceSide * 2 },
  };

  return (
    <svg
      width={totalWidth}
      height={totalHeight}
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      className={className}
      role="img"
      aria-label="Cube state"
    >
      {URFDLB.map((face) => {
        const off = faceOffset(size, face);
        const pos = FACE_POS[face];
        return Array.from({ length: size * size }, (_, i) => {
          const row = Math.floor(i / size);
          const col = i % size;
          const letter = facelets[off + i] as FaceLetter | undefined;
          const fill = letter ? FACE_COLORS[letter] : '#888';
          return (
            <rect
              key={`${face}-${i}`}
              x={pos.x + col * stickerSide + 0.5}
              y={pos.y + row * stickerSide + 0.5}
              width={stickerSide - 1}
              height={stickerSide - 1}
              fill={fill}
              stroke="#1e293b"
              strokeOpacity="0.35"
              strokeWidth="0.6"
              rx={1}
            />
          );
        });
      })}
    </svg>
  );
}
