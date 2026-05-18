import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, RefreshCw, X, ArrowRight, Check } from 'lucide-react';
import type { CubeSize } from '@core/cube/ICube';
import { URFDLB } from '@core/cube/ICube';
import type { FaceLetter } from '@core/cube/colors';
import { classifyColor, samplePatch } from '@core/colorRecognition/classifier';
import { refineWithKMeans, type Sample } from '@core/colorRecognition/refine';
import { FACE_COLORS } from '@core/cube/colors';
import { CaptureCube3D } from './CaptureCube3D';
import { useI18n } from '@ui/i18n/I18nProvider';

export interface CameraCaptureProps {
  size: CubeSize;
  /** Called once all six faces have been captured. */
  onComplete: (facelets: string) => void;
  onCancel: () => void;
}

/**
 * Capture order — front-loads the awkward U↔D flip (single forward-roll
 * around the X axis, passing through the F-pose) so the user encounters the
 * "non-continuous" transition early. The remaining faces are reached by a
 * clean equator walk (F→R→B→L), so the LAST step is always a simple 90°
 * y-axis rotation — which is the easiest one to follow. Stickers are still
 * stored in canonical URFDLB order; only the user-facing sequence changes.
 */
const FACE_ORDER: readonly FaceLetter[] = ['U', 'D', 'F', 'R', 'B', 'L'];

/** Tap-to-cycle order used by the preview correction grid. URFDLB so users
 *  with a mental model of the cube notation see the colours in a familiar
 *  sequence. */
const CYCLE_ORDER: readonly FaceLetter[] = ['U', 'R', 'F', 'D', 'L', 'B'];

interface FaceCapture {
  /** Per-sticker letter, row-major. Reflects classifier output + any user
   *  corrections (overrides). Final labels for non-overridden stickers are
   *  recomputed via K-means across all six faces just before handoff. */
  stickers: FaceLetter[];
  /** Raw averaged RGB per patch — kept so we can re-classify with K-means. */
  rgb: Array<{ r: number; g: number; b: number }>;
  /** Patch indices the user (or the center pre-fill) has locked. K-means
   *  refinement won't touch these — the locked sticker letter wins. */
  overrides: Set<number>;
}

const MULTI_SAMPLE_FRAMES = 4; // frames per Capture press (averaged together)
const MULTI_SAMPLE_DELAY_MS = 50;

/** Auto-advance window after a successful capture, in ms. Long enough for a
 *  glance + a tap if needed, short enough to not feel like a wait. */
const AUTO_ADVANCE_MS = 1800;

/**
 * Indices of patches that must equal the face's own colour by construction
 * (the user oriented the cube as instructed → the centre of the captured
 * face is the face's defining colour).
 *
 * 3x3: single centre at (1,1). 4x4: four "centre" patches at (1..2, 1..2).
 * 2x2: no centre (every patch is a corner) — return empty.
 */
function centerPatchIndices(size: CubeSize): number[] {
  if (size === 2) return [];
  if (size === 3) return [4];
  if (size === 4) return [5, 6, 9, 10];
  return [];
}

export function CameraCapture({ size, onComplete, onCancel }: CameraCaptureProps) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [stage, setStage] = useState<'init' | 'live' | 'preview' | 'denied' | 'unsupported'>('init');
  const [faceIndex, setFaceIndex] = useState(0);
  const [captures, setCaptures] = useState<Record<FaceLetter, FaceCapture | null>>(() => ({
    U: null,
    R: null,
    F: null,
    D: null,
    L: null,
    B: null,
  }));
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  /** Set true once the user taps a sticker / Retake. Suppresses auto-advance
   *  for the rest of this preview so they have time to inspect & correct. */
  const [autoAdvancePaused, setAutoAdvancePaused] = useState(false);
  /** Incremented each time we enter `preview` so the countdown bar (and its
   *  CSS keyframe) remounts and restarts cleanly. */
  const [previewKey, setPreviewKey] = useState(0);

  const currentFace = FACE_ORDER[faceIndex]!;
  const isFinalFace = faceIndex >= FACE_ORDER.length - 1;
  const currentCenters = useMemo(() => new Set(centerPatchIndices(size)), [size]);

  // Lock body scroll while the fullscreen capture overlay is mounted —
  // otherwise a stray scroll bleeds through to the page underneath on iOS.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startStream = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setStage('unsupported');
      return;
    }
    try {
      stopStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStage('live');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('camera error', err);
      setStage('denied');
    }
  }, [facing, stopStream]);

  useEffect(() => {
    void startStream();
    return () => stopStream();
  }, [startStream, stopStream]);

  // Build a working facelet string from collected captures plus the centre-fill
  // for unfilled faces (so the running mini-net preview always renders something).
  const previewFacelets = useMemo(() => buildFaceletString(size, captures), [size, captures]);

  // Per-face sticker arrays (or null) for the 3D capture guide. Lets the cube
  // render real detected colours on captured faces and a neutral placeholder
  // on the rest.
  const cubeStickers = useMemo<Record<FaceLetter, FaceLetter[] | null>>(() => {
    const out = {} as Record<FaceLetter, FaceLetter[] | null>;
    for (const f of URFDLB) {
      out[f] = captures[f] ? captures[f]!.stickers : null;
    }
    return out;
  }, [captures]);

  const captureFace = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;
    const side = Math.min(vw, vh);
    const sx = (vw - side) / 2;
    const sy = (vh - side) / 2;
    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const radius = Math.max(8, side / size / 8);

    // Multi-sample: capture MULTI_SAMPLE_FRAMES frames spaced ~50ms apart
    // and average each patch across them. Knocks down per-frame noise from
    // JPEG compression / camera AE flicker / hand jitter.
    const accum = new Array(size * size).fill(null).map(() => ({ r: 0, g: 0, b: 0 }));
    for (let frame = 0; frame < MULTI_SAMPLE_FRAMES; frame++) {
      ctx.drawImage(video, sx, sy, side, side, 0, 0, side, side);
      const img = ctx.getImageData(0, 0, side, side);
      let idx = 0;
      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          const cx = ((col + 0.5) / size) * side;
          const cy = ((row + 0.5) / size) * side;
          const { r, g, b } = samplePatch(img.data, side, cx, cy, radius);
          accum[idx]!.r += r;
          accum[idx]!.g += g;
          accum[idx]!.b += b;
          idx++;
        }
      }
      if (frame < MULTI_SAMPLE_FRAMES - 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, MULTI_SAMPLE_DELAY_MS));
      }
    }
    const stickers: FaceLetter[] = [];
    const rgb: Array<{ r: number; g: number; b: number }> = [];
    for (let i = 0; i < accum.length; i++) {
      const r = accum[i]!.r / MULTI_SAMPLE_FRAMES;
      const g = accum[i]!.g / MULTI_SAMPLE_FRAMES;
      const b = accum[i]!.b / MULTI_SAMPLE_FRAMES;
      rgb.push({ r, g, b });
      stickers.push(classifyColor(r, g, b));
    }

    // Centre patches are the face's defining colour by construction (the
    // wizard told the user which face to show). Pre-fill them with the face
    // letter and mark them as overrides so K-means won't drag them. User can
    // still tap to change if they disagree (catches the rare orientation
    // mistake).
    const overrides = new Set<number>();
    for (const ci of centerPatchIndices(size)) {
      stickers[ci] = currentFace;
      overrides.add(ci);
    }

    setCaptures((prev) => ({ ...prev, [currentFace]: { stickers, rgb, overrides } }));
    setAutoAdvancePaused(false);
    setPreviewKey((k) => k + 1);
    setStage('preview');
  }, [currentFace, size]);

  const acceptAndAdvance = useCallback(() => {
    if (faceIndex < FACE_ORDER.length - 1) {
      setFaceIndex(faceIndex + 1);
      setStage('live');
    } else {
      stopStream();
      // Final pass: K-means refinement across all six faces. Before this pass,
      // each patch was classified independently and may have suffered from
      // changing lighting between captures. K-means anchors all 54 / 96 / 24
      // patches against six common centroids. User-overridden patches bypass
      // the K-means label so manual corrections always win.
      const refined = refineCaptures(captures);
      onComplete(refined ?? previewFacelets);
    }
  }, [faceIndex, onComplete, previewFacelets, stopStream, captures]);

  // Auto-advance: 1.8s timer fires after a successful capture, unless the user
  // taps a sticker / Retake (which paused it) or this is the final face (we
  // always want an explicit Done on the commit step).
  useEffect(() => {
    if (stage !== 'preview') return;
    if (autoAdvancePaused) return;
    if (isFinalFace) return;
    const id = window.setTimeout(() => acceptAndAdvance(), AUTO_ADVANCE_MS);
    return () => window.clearTimeout(id);
  }, [stage, autoAdvancePaused, isFinalFace, previewKey, acceptAndAdvance]);

  function refineCaptures(allCaptures: Record<FaceLetter, FaceCapture | null>): string | null {
    // Build samples (skipping user-overridden patches so they don't pull the
    // centroids), and the output in canonical URFDLB order — that's what the
    // facelet string convention expects, regardless of capture sequence.
    const samples: Sample[] = [];
    for (let f = 0; f < URFDLB.length; f++) {
      const cap = allCaptures[URFDLB[f]!];
      if (!cap) return null;
      cap.rgb.forEach((rgb, patchIndex) => {
        if (cap.overrides.has(patchIndex)) return;
        samples.push({ faceIndex: f, patchIndex, rgb });
      });
    }
    const labels = refineWithKMeans(samples);
    let out = '';
    for (let f = 0; f < URFDLB.length; f++) {
      const cap = allCaptures[URFDLB[f]!]!;
      for (let p = 0; p < cap.stickers.length; p++) {
        if (cap.overrides.has(p)) {
          out += cap.stickers[p];
        } else {
          out += labels.get(`${f},${p}`) ?? cap.stickers[p];
        }
      }
    }
    return out;
  }

  const retake = useCallback(() => {
    setCaptures((prev) => ({ ...prev, [currentFace]: null }));
    setAutoAdvancePaused(true);
    setStage('live');
  }, [currentFace]);

  const cancel = useCallback(() => {
    stopStream();
    onCancel();
  }, [stopStream, onCancel]);

  const flipCamera = useCallback(() => {
    setFacing((f) => (f === 'environment' ? 'user' : 'environment'));
  }, []);

  /** Cycle a sticker through the 6 colours; mark it as user-overridden so
   *  K-means leaves it alone. Also pauses the auto-advance — the user is
   *  clearly inspecting, don't rush them. */
  const cycleSticker = useCallback(
    (patchIndex: number) => {
      setAutoAdvancePaused(true);
      setCaptures((prev) => {
        const cap = prev[currentFace];
        if (!cap) return prev;
        const nextStickers = cap.stickers.slice();
        const curIdx = CYCLE_ORDER.indexOf(cap.stickers[patchIndex]!);
        const nextIdx = (curIdx + 1) % CYCLE_ORDER.length;
        nextStickers[patchIndex] = CYCLE_ORDER[nextIdx]!;
        const nextOverrides = new Set(cap.overrides);
        nextOverrides.add(patchIndex);
        return { ...prev, [currentFace]: { ...cap, stickers: nextStickers, overrides: nextOverrides } };
      });
    },
    [currentFace],
  );

  // ----- render -----

  if (stage === 'unsupported' || stage === 'denied') {
    return (
      <FullscreenShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="max-w-sm text-sm text-amber-100">
            {stage === 'denied' ? t('camera.permissionDenied') : t('camera.unsupported')}
          </p>
          <button
            type="button"
            onClick={cancel}
            className="rounded-md border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
          >
            {t('camera.btn.cancel')}
          </button>
        </div>
      </FullscreenShell>
    );
  }

  const currentCapture = captures[currentFace];
  const showCountdown = stage === 'preview' && !autoAdvancePaused && !isFinalFace;

  return (
    <FullscreenShell>
      {/* Compact top bar: step counter · face label · close. Single row so it
          takes ~52px instead of the previous header+meta+orient stack. */}
      <header className="flex items-center justify-between gap-3 px-4 py-2 text-white">
        <div className="flex flex-col leading-tight">
          <span className="text-[11px] uppercase tracking-wide text-white/70">
            {t('camera.faceCount', { n: faceIndex + 1 })}
          </span>
          <span
            className="text-sm font-semibold"
            style={{
              color: FACE_COLORS[currentFace] === '#FFFFFF' ? '#fff' : FACE_COLORS[currentFace],
            }}
          >
            {t(`camera.face.${currentFace}`)}
          </span>
        </div>
        <button
          type="button"
          onClick={cancel}
          aria-label={t('camera.btn.cancel')}
          className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        >
          <X size={18} />
        </button>
      </header>

      {/* Video fills available space; 3D guide pip + instruction text + grid
          overlay sit on top so nothing competes for vertical room. */}
      <div className="relative flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          playsInline
          muted
          style={{ transform: facing === 'user' ? 'scaleX(-1)' : undefined }}
        />
        <canvas ref={canvasRef} className="hidden" />

        {stage !== 'preview' && (
          <>
            {/* Centered square framing guide — keeps the cube in the same
                crop the classifier samples (Math.min(vw, vh)). Hidden in
                preview so the correction grid has clean focus. */}
            <FramingOverlay size={size} />

            {/* Single-line orientation hint anchored to the bottom of the
                video. Hidden in preview to make room for Tap-to-fix copy. */}
            <p className="absolute inset-x-3 bottom-3 rounded-md bg-slate-950/70 px-3 py-1.5 text-center text-[12px] leading-snug text-white shadow-md backdrop-blur-sm">
              {t(`camera.orient.${currentFace}`)}
            </p>
          </>
        )}

        {/* Picture-in-picture 3D guide. Top-left so it stays clear of the
            framing square and the preview correction grid. */}
        <div className="pointer-events-none absolute left-3 top-3 w-[34vw] max-w-[160px] rounded-lg border border-white/15 bg-slate-950/60 p-1 shadow-lg backdrop-blur-sm">
          <CaptureCube3D
            size={size}
            captures={cubeStickers}
            activeFace={currentFace}
            className="h-[26vw] max-h-[120px] w-full"
          />
        </div>

        {/* Preview correction grid — big, centred, tappable. Replaces the old
            60px corner swatch. Each cell cycles through the 6 face colours on
            tap; centre cells (W-by-construction etc.) are pre-locked but still
            tappable for the rare orientation-mistake case. */}
        {stage === 'preview' && currentCapture && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4">
            <CorrectionGrid
              size={size}
              stickers={currentCapture.stickers}
              overrides={currentCapture.overrides}
              centers={currentCenters}
              onCellTap={cycleSticker}
            />
            <p className="rounded-md bg-slate-950/75 px-3 py-1 text-[11px] text-white shadow backdrop-blur-sm">
              {t('camera.preview.hint')}
            </p>
          </div>
        )}
      </div>

      {/* Bottom toolbar: action row + face-progress dots. Inset-safe so it
          clears the iOS home indicator. */}
      <div
        className="flex flex-col gap-2 bg-slate-950 px-4 pt-2 text-white"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
      >
        <div className="flex items-center gap-2">
          {stage === 'live' ? (
            <>
              <button
                type="button"
                onClick={captureFace}
                className="flex flex-1 items-center justify-center gap-2 rounded-md bg-indigo-500 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-600"
              >
                <Camera size={18} /> {t('camera.btn.capture')}
              </button>
              <button
                type="button"
                onClick={flipCamera}
                aria-label={
                  facing === 'environment'
                    ? t('camera.facing.environment')
                    : t('camera.facing.user')
                }
                className="rounded-md border border-white/15 bg-white/5 p-2.5 text-white hover:bg-white/10"
              >
                <RefreshCw size={18} />
              </button>
            </>
          ) : stage === 'preview' ? (
            <>
              <button
                type="button"
                onClick={retake}
                className="flex items-center gap-2 rounded-md border border-white/20 bg-white/5 px-3 py-2.5 text-sm font-medium text-white hover:bg-white/10"
              >
                <RefreshCw size={16} /> {t('camera.btn.retake')}
              </button>
              <button
                type="button"
                onClick={acceptAndAdvance}
                className="relative flex flex-1 items-center justify-center gap-2 overflow-hidden rounded-md bg-indigo-500 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-600"
              >
                {isFinalFace ? (
                  <>
                    <Check size={18} /> {t('camera.btn.done')}
                  </>
                ) : (
                  <>
                    <ArrowRight size={18} /> {t('camera.btn.next')}
                  </>
                )}
                {showCountdown && (
                  <span
                    key={previewKey}
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-1 origin-left bg-white/70"
                    style={{ animation: `camera-countdown ${AUTO_ADVANCE_MS}ms linear forwards` }}
                  />
                )}
              </button>
            </>
          ) : null}
        </div>

        {/* Step-order checklist: numbered swatches show the capture sequence
            and which faces are done. */}
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {FACE_ORDER.map((f, i) => {
            const captured = captures[f] !== null;
            const active = i === faceIndex;
            return (
              <div
                key={f}
                title={`${i + 1}. ${f}`}
                className={
                  'relative flex h-6 w-6 items-center justify-center rounded border text-[10px] font-semibold ' +
                  (active
                    ? 'border-indigo-300 ring-2 ring-indigo-400/70'
                    : 'border-white/20')
                }
                style={{ backgroundColor: FACE_COLORS[f], color: '#0f172a' }}
              >
                {captured ? <Check size={12} strokeWidth={3} /> : f}
              </div>
            );
          })}
        </div>
      </div>
    </FullscreenShell>
  );
}

/**
 * Fullscreen overlay container. Sits above the app's bottom tab bar (z-30) so
 * the capture flow owns the whole viewport and there's nothing to scroll.
 */
function FullscreenShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {children}
    </div>
  );
}

function FramingOverlay({ size }: { size: CubeSize }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${size}, 1fr)`,
          gridTemplateRows: `repeat(${size}, 1fr)`,
          // Match the classifier's center-square crop (min of vw/vh): on a
          // portrait phone that's the full width, on landscape the full height.
          width: 'min(100vw, calc(100vh - 200px))',
          height: 'min(100vw, calc(100vh - 200px))',
          maxWidth: '100%',
          maxHeight: '100%',
        }}
      >
        {Array.from({ length: size * size }).map((_, i) => (
          <div key={i} className="border border-white/60" />
        ))}
      </div>
    </div>
  );
}

interface CorrectionGridProps {
  size: CubeSize;
  stickers: FaceLetter[];
  overrides: Set<number>;
  centers: Set<number>;
  onCellTap: (patchIndex: number) => void;
}

/**
 * Big tappable grid shown in `preview` stage. Each cell shows the detected
 * (or corrected) sticker colour; tap cycles through W → R → G → Y → O → B.
 * Centre cells get a subtle anchor ring to communicate "this is locked to
 * the face colour by default" without preventing taps.
 */
function CorrectionGrid({ size, stickers, overrides, centers, onCellTap }: CorrectionGridProps) {
  return (
    <div
      className="grid gap-1.5 rounded-lg bg-slate-950/40 p-1.5 shadow-2xl ring-1 ring-white/15"
      style={{
        gridTemplateColumns: `repeat(${size}, 1fr)`,
        // Cap at ~70% viewport width / ~50% viewport height so it stays well
        // clear of the bottom toolbar and top bar.
        width: 'min(70vw, 320px, 50vh)',
        aspectRatio: '1 / 1',
      }}
    >
      {stickers.map((s, i) => {
        const isCenter = centers.has(i);
        const isOverridden = overrides.has(i);
        return (
          <button
            key={i}
            type="button"
            onClick={() => onCellTap(i)}
            className={
              'relative rounded-md transition active:scale-95 ' +
              (isCenter
                ? 'ring-2 ring-white/80'
                : isOverridden
                  ? 'ring-2 ring-indigo-300'
                  : 'ring-1 ring-black/40')
            }
            style={{ backgroundColor: FACE_COLORS[s] }}
            aria-label={`Sticker ${i + 1}: ${s}`}
          />
        );
      })}
    </div>
  );
}

/**
 * Compose a facelet string from per-face captures, falling back to the face's
 * own identity letter for any face not yet captured. This means the running
 * mini-net preview is always renderable.
 */
function buildFaceletString(size: CubeSize, captures: Record<FaceLetter, FaceCapture | null>): string {
  const out: string[] = [];
  for (const f of URFDLB) {
    const cap = captures[f];
    if (cap) {
      out.push(...cap.stickers);
    } else {
      for (let i = 0; i < size * size; i++) out.push(f);
    }
  }
  return out.join('');
}
