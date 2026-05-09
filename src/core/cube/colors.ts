/**
 * Display palette for stickers across the UI (3D viewer, color picker, mini net).
 * Lifted slightly from raw WCA hex for a brighter, more modern look on screen.
 * Camera-matching uses its own canonical WCA reference (see colorRecognition/classifier.ts);
 * keep the two decoupled so display tweaks never affect physical-sticker classification.
 */
export type FaceLetter = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';

export const FACES: readonly FaceLetter[] = ['U', 'R', 'F', 'D', 'L', 'B'] as const;

export const FACE_COLORS: Record<FaceLetter, string> = {
  U: '#FFFFFF',
  D: '#FFEC57',
  F: '#3DD66E',
  B: '#4F87FF',
  R: '#FF4848',
  L: '#FF9636',
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
