import type { CubeSize } from '@core/cube/ICube';
import { CameraCapture3x3 } from './CameraCapture3x3';
import { CameraCaptureGuided } from './CameraCaptureGuided';

export interface CameraCaptureProps {
  size: CubeSize;
  /** Called once all faces have been captured. Hands back a facelet string
   *  in canonical URFDLB order — for 3×3 this is the resolver output;
   *  for 2×2 / 4×4 it's the guided-flow output (K-means refined). */
  onComplete: (facelets: string) => void;
  onCancel: () => void;
}

/**
 * Dispatcher: 3×3 cubes get the free-order, free-rotation flow built around
 * the rotation resolver (better for kids / beginners — no need to follow a
 * scripted sequence). 2×2 has no centres so face identity can't be inferred
 * from a single capture, and the 4×4 path hasn't been migrated yet — both
 * keep the original guided flow.
 */
export function CameraCapture({ size, onComplete, onCancel }: CameraCaptureProps) {
  if (size === 3) {
    return <CameraCapture3x3 onComplete={onComplete} onCancel={onCancel} />;
  }
  return <CameraCaptureGuided size={size} onComplete={onComplete} onCancel={onCancel} />;
}
