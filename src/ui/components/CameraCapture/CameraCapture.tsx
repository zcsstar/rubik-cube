import type { CubeSize } from '@core/cube/ICube';
import { CameraCaptureFree } from './CameraCaptureFree';
import { CameraCaptureGuided } from './CameraCaptureGuided';

export interface CameraCaptureProps {
  size: CubeSize;
  /** Called once all faces have been captured. Hands back a facelet string
   *  in canonical URFDLB order — for 2×2 / 3×3 this is the resolver output;
   *  for 4×4 it's the guided-flow output (K-means refined). */
  onComplete: (facelets: string) => void;
  onCancel: () => void;
}

/**
 * Dispatcher: 2×2 and 3×3 cubes use the free-order, free-rotation flow with
 * the rotation resolver (no scripted sequence — better for kids / beginners).
 * 4×4 keeps the original guided flow until a 4×4 solver lands; capturing a
 * 4×4 without a solver to consume it has no downstream payoff today, so the
 * resolver work is deferred.
 */
export function CameraCapture({ size, onComplete, onCancel }: CameraCaptureProps) {
  if (size === 2 || size === 3) {
    return <CameraCaptureFree size={size} onComplete={onComplete} onCancel={onCancel} />;
  }
  return <CameraCaptureGuided size={size} onComplete={onComplete} onCancel={onCancel} />;
}
