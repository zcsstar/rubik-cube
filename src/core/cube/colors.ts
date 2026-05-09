/**
 * WCA-standard sticker colors. Single source of truth.
 * Letters (U/R/F/D/L/B) are face IDs; the hex is the color of that face on a solved cube.
 */
export type FaceLetter = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';

export const FACES: readonly FaceLetter[] = ['U', 'R', 'F', 'D', 'L', 'B'] as const;

export const FACE_COLORS: Record<FaceLetter, string> = {
  U: '#FFFFFF',
  D: '#FFD500',
  F: '#00B04B',
  B: '#1A66FF',
  R: '#EE0000',
  L: '#FF6F00',
};

export const HIGH_CONTRAST_COLORS: Record<FaceLetter, string> = {
  U: '#FFFFFF',
  D: '#FFD500',
  F: '#00B04B',
  B: '#1A66FF',
  R: '#D60000',
  L: '#FF6BD6',
};

export const FACE_NAMES: Record<FaceLetter, string> = {
  U: 'Up',
  R: 'Right',
  F: 'Front',
  D: 'Down',
  L: 'Left',
  B: 'Back',
};
