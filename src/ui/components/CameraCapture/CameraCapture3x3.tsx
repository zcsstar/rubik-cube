import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, RefreshCw, X, Check, AlertTriangle } from 'lucide-react';
import { URFDLB } from '@core/cube/ICube';
import type { FaceLetter } from '@core/cube/colors';
import { FACE_COLORS } from '@core/cube/colors';
import { classifyColor, samplePatch } from '@core/colorRecognition/classifier';
import { resolveOrientation3x3 } from '@core/cameraIntake/resolveOrientation';
import { useI18n } from '@ui/i18n/I18nProvider';

/**
 * Free-order, free-rotation camera capture for 3×3 cubes.
 *
 * Unlike the guided flow (used for 2×2 / 4×4), this component lets the user
 * shoot the 6 faces in any order and held in any rotation around the face
 * normal. Each capture is auto-slotted by its centre colour (W→U, G→F, …)
 * with a Wrong-face? affordance for misclassifications. After all 6 are
 * captured we run resolveOrientation3x3 to figure out the per-face rotation
 * and emit a canonical facelet string.
 *
 * No auto-advance, no fixed face order, no orientation hints. The cross-net
 * progress diagram makes "what's done / what's left" entirely visual.
 */

export interface CameraCapture3x3Props {
  onComplete: (facelets: string) => void;
  onCancel: () => void;
}

const MULTI_SAMPLE_FRAMES = 4;
const MULTI_SAMPLE_DELAY_MS = 50;

/** Cycle order for tap-to-fix stickers; URFDLB so the colour wheel matches
 *  the user's mental model from the rest of the app. */
const CYCLE_ORDER: readonly FaceLetter[] = ['U', 'R', 'F', 'D', 'L', 'B'];

interface FaceCapture {
  /** 9 stickers row-major in whatever rotation the camera saw them. */
  stickers: FaceLetter[];
}

type Stage = 'init' | 'live' | 'preview' | 'resolving' | 'error' | 'denied' | 'unsupported';

export function CameraCapture3x3({ onComplete, onCancel }: CameraCapture3x3Props) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [stage, setStage] = useState<Stage>('init');
  const [captures, setCaptures] = useState<Record<FaceLetter, FaceCapture | null>>({
    U: null, R: null, F: null, D: null, L: null, B: null,
  });
  /** The face slot the most recent capture was placed in. Drives the preview
   *  view (correction grid + "Looks like the W face" copy). */
  const [previewFace, setPreviewFace] = useState<FaceLetter | null>(null);
  /** Toggles the "Wrong face?" picker between the action row and 6 swatches. */
  const [showReassign, setShowReassign] = useState(false);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [resolveError, setResolveError] = useState<'no_valid_orientation' | 'ambiguous' | null>(null);

  const capturedCount = useMemo(
    () => URFDLB.reduce((n, f) => n + (captures[f] ? 1 : 0), 0),
    [captures],
  );
  const allCaptured = capturedCount === 6;

  // Lock body scroll while overlay is mounted (matches the guided flow).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
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

  /**
   * Sample the live video into a 9-sticker face. Same multi-frame averaging
   * the guided flow uses — knocks down per-frame camera noise so the centre
   * colour we use for face identification is reliable.
   */
  const sampleFace = useCallback(async (): Promise<FaceLetter[] | null> => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;
    const side = Math.min(vw, vh);
    const sx = (vw - side) / 2;
    const sy = (vh - side) / 2;
    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    const radius = Math.max(8, side / 3 / 8);
    const accum = new Array(9).fill(null).map(() => ({ r: 0, g: 0, b: 0 }));
    for (let frame = 0; frame < MULTI_SAMPLE_FRAMES; frame++) {
      ctx.drawImage(video, sx, sy, side, side, 0, 0, side, side);
      const img = ctx.getImageData(0, 0, side, side);
      let idx = 0;
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const cx = ((col + 0.5) / 3) * side;
          const cy = ((row + 0.5) / 3) * side;
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
    return accum.map((a) => classifyColor(
      a.r / MULTI_SAMPLE_FRAMES,
      a.g / MULTI_SAMPLE_FRAMES,
      a.b / MULTI_SAMPLE_FRAMES,
    ));
  }, []);

  const capture = useCallback(async () => {
    const stickers = await sampleFace();
    if (!stickers) return;
    // Centre sticker drives face identity. The face letter IS the centre
    // colour (W=U, Y=D, G=F, B=B, R=R, O=L) on a standard-scheme cube.
    const detectedFace = stickers[4]!;
    setCaptures((prev) => ({ ...prev, [detectedFace]: { stickers } }));
    setPreviewFace(detectedFace);
    setShowReassign(false);
    setStage('preview');
  }, [sampleFace]);

  /** Move the just-captured stickers to a different face slot. Used when the
   *  centre-colour detection routes the photo to the wrong slot — common
   *  failure modes are red↔orange and white↔yellow under harsh lighting. */
  const reassignTo = useCallback((targetFace: FaceLetter) => {
    if (!previewFace) return;
    setCaptures((prev) => {
      const cap = prev[previewFace];
      if (!cap) return prev;
      // Force the centre sticker to the new face letter so the resolver
      // (which trusts the centre) lines up.
      const newStickers = [...cap.stickers];
      newStickers[4] = targetFace;
      const next = { ...prev };
      next[previewFace] = null;
      next[targetFace] = { stickers: newStickers };
      return next;
    });
    setPreviewFace(targetFace);
    setShowReassign(false);
  }, [previewFace]);

  const cycleSticker = useCallback((patchIndex: number) => {
    if (!previewFace) return;
    setCaptures((prev) => {
      const cap = prev[previewFace];
      if (!cap) return prev;
      // Centre tap reassigns the face — easier than digging into the picker
      // when the user is already eyeballing the centre square.
      if (patchIndex === 4) return prev;
      const next = [...cap.stickers];
      const cur = CYCLE_ORDER.indexOf(next[patchIndex]!);
      next[patchIndex] = CYCLE_ORDER[(cur + 1) % CYCLE_ORDER.length]!;
      return { ...prev, [previewFace]: { stickers: next } };
    });
  }, [previewFace]);

  const retake = useCallback(() => {
    if (previewFace) {
      setCaptures((prev) => ({ ...prev, [previewFace]: null }));
    }
    setPreviewFace(null);
    setShowReassign(false);
    setStage('live');
  }, [previewFace]);

  const confirmFace = useCallback(() => {
    setPreviewFace(null);
    setShowReassign(false);
    setStage('live');
  }, []);

  const resolveCube = useCallback(() => {
    setStage('resolving');
    setResolveError(null);
    // Run in a microtask to let the spinner render before the (synchronous)
    // 4096-rotation enumeration starts.
    setTimeout(() => {
      const faces = URFDLB.map((f) => captures[f]!.stickers);
      const result = resolveOrientation3x3({ faces });
      if (result.ok) {
        stopStream();
        onComplete(result.facelets);
      } else {
        setResolveError(result.reason);
        setStage('error');
      }
    }, 0);
  }, [captures, onComplete, stopStream]);

  /** Discard one face from the error screen, jump back to live to retake it. */
  const retakeFromError = useCallback((face: FaceLetter) => {
    setCaptures((prev) => ({ ...prev, [face]: null }));
    setPreviewFace(null);
    setShowReassign(false);
    setResolveError(null);
    setStage('live');
  }, []);

  /** Bail out of the camera flow into manual edit mode. The caller routes
   *  the partial captures to ColorInputNet. */
  const editManually = useCallback(() => {
    stopStream();
    // Build best-effort facelet string from current captures (rotation may
    // be wrong, but the user is about to manually fix things anyway).
    let s = '';
    for (const f of URFDLB) {
      const cap = captures[f];
      if (cap) s += cap.stickers.join('');
      else s += f.repeat(9);
    }
    onComplete(s);
  }, [captures, onComplete, stopStream]);

  const flipCamera = useCallback(() => {
    setFacing((f) => (f === 'environment' ? 'user' : 'environment'));
  }, []);

  const cancel = useCallback(() => {
    stopStream();
    onCancel();
  }, [stopStream, onCancel]);

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

  const previewCap = previewFace ? captures[previewFace] : null;

  return (
    <FullscreenShell>
      <header className="flex items-center justify-between gap-3 px-4 py-2 text-white">
        <div className="flex flex-col leading-tight">
          <span className="text-[11px] uppercase tracking-wide text-white/70">
            {t('camera.free.title')}
          </span>
          <span className="text-sm font-semibold">
            {t('camera.free.progress', { n: capturedCount })}
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

      <div className="relative flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          playsInline
          muted
          style={{ transform: facing === 'user' ? 'scaleX(-1)' : undefined }}
        />
        <canvas ref={canvasRef} className="hidden" />

        {stage === 'live' && (
          <>
            <FramingOverlay />
            <p className="absolute inset-x-3 bottom-3 rounded-md bg-slate-950/70 px-3 py-1.5 text-center text-[12px] leading-snug text-white shadow-md backdrop-blur-sm">
              {allCaptured ? t('camera.free.allDone') : t('camera.free.hint')}
            </p>
          </>
        )}

        {stage === 'preview' && previewFace && previewCap && (
          <PreviewLayer
            previewFace={previewFace}
            stickers={previewCap.stickers}
            onCellTap={cycleSticker}
          />
        )}

        {stage === 'resolving' && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70">
            <div className="flex items-center gap-3 rounded-lg bg-slate-900 px-4 py-3 text-white shadow-lg">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              <span className="text-sm">{t('camera.free.resolving')}</span>
            </div>
          </div>
        )}

        {stage === 'error' && (
          <ErrorLayer
            reason={resolveError}
            captures={captures}
            onRetakeFace={retakeFromError}
            onEditManually={editManually}
          />
        )}
      </div>

      {/* Bottom: cross-net progress + actions. */}
      <div
        className="flex flex-col gap-2 bg-slate-950 px-4 pt-2 text-white"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
      >
        {(stage === 'live' || stage === 'preview') && (
          <CrossNet captures={captures} highlight={previewFace} />
        )}

        <div className="flex items-center gap-2">
          {stage === 'live' && !allCaptured && (
            <>
              <button
                type="button"
                onClick={() => void capture()}
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
          )}

          {stage === 'live' && allCaptured && (
            <button
              type="button"
              onClick={resolveCube}
              className="flex flex-1 items-center justify-center gap-2 rounded-md bg-emerald-500 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600"
            >
              <Check size={18} /> {t('camera.btn.done')}
            </button>
          )}

          {stage === 'preview' && !showReassign && (
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
                onClick={() => setShowReassign(true)}
                className="rounded-md border border-amber-300/40 bg-amber-400/10 px-3 py-2.5 text-sm font-medium text-amber-100 hover:bg-amber-400/20"
              >
                {t('camera.free.wrongFace')}
              </button>
              <button
                type="button"
                onClick={confirmFace}
                className="flex flex-1 items-center justify-center gap-2 rounded-md bg-indigo-500 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-600"
              >
                <Check size={18} /> {t('camera.free.useFace')}
              </button>
            </>
          )}

          {stage === 'preview' && showReassign && (
            <ReassignBar
              currentFace={previewFace}
              captures={captures}
              onPick={reassignTo}
              onCancel={() => setShowReassign(false)}
            />
          )}
        </div>
      </div>
    </FullscreenShell>
  );
}

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

function FramingOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div
        className="grid"
        style={{
          gridTemplateColumns: 'repeat(3, 1fr)',
          gridTemplateRows: 'repeat(3, 1fr)',
          width: 'min(70vw, calc(100vh - 320px))',
          height: 'min(70vw, calc(100vh - 320px))',
          maxWidth: '100%',
          maxHeight: '100%',
        }}
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="border border-white/60" />
        ))}
      </div>
    </div>
  );
}

interface PreviewLayerProps {
  previewFace: FaceLetter;
  stickers: FaceLetter[];
  onCellTap: (patchIndex: number) => void;
}

function PreviewLayer({ previewFace, stickers, onCellTap }: PreviewLayerProps) {
  const { t } = useI18n();
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/40 px-4">
      <p className="flex items-center gap-2 rounded-md bg-slate-950/80 px-3 py-1.5 text-sm font-semibold text-white shadow">
        <span
          aria-hidden="true"
          className="inline-block h-3.5 w-3.5 rounded-sm ring-1 ring-white/60"
          style={{ backgroundColor: FACE_COLORS[previewFace] }}
        />
        <span>{t('camera.free.centerLabel')}</span>
        <span style={{ color: FACE_COLORS[previewFace] }}>
          {t(`camera.face.${previewFace}.short`)}
        </span>
      </p>
      <div
        className="grid gap-1.5 rounded-lg bg-slate-950/40 p-1.5 shadow-2xl ring-1 ring-white/15"
        style={{
          gridTemplateColumns: 'repeat(3, 1fr)',
          width: 'min(60vw, 280px, 45vh)',
          aspectRatio: '1 / 1',
        }}
      >
        {stickers.map((s, i) => {
          const isCenter = i === 4;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onCellTap(i)}
              className={
                'relative rounded-md transition active:scale-95 ' +
                (isCenter ? 'ring-2 ring-white/80' : 'ring-1 ring-black/40')
              }
              style={{ backgroundColor: FACE_COLORS[s] }}
              aria-label={`Sticker ${i + 1}: ${s}`}
            />
          );
        })}
      </div>
      <p className="rounded-md bg-slate-950/75 px-3 py-1 text-[11px] text-white shadow backdrop-blur-sm">
        {t('camera.preview.hint')}
      </p>
    </div>
  );
}

interface ReassignBarProps {
  currentFace: FaceLetter | null;
  captures: Record<FaceLetter, FaceCapture | null>;
  onPick: (face: FaceLetter) => void;
  onCancel: () => void;
}

function ReassignBar({ currentFace, captures, onPick, onCancel }: ReassignBarProps) {
  const { t } = useI18n();
  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-white/70">{t('camera.free.reassignPrompt')}</span>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-white/60 underline hover:text-white"
        >
          {t('camera.btn.cancel')}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {URFDLB.map((f) => {
          const isCurrent = f === currentFace;
          // A different face already captured this slot — picking it will
          // overwrite, so flag it.
          const willOverwrite = !isCurrent && captures[f] !== null;
          return (
            <button
              key={f}
              type="button"
              onClick={() => onPick(f)}
              disabled={isCurrent}
              className={
                'flex h-9 flex-1 min-w-[50px] items-center justify-center rounded-md border text-xs font-semibold transition disabled:opacity-40 ' +
                (willOverwrite ? 'border-amber-300 ring-1 ring-amber-300/40' : 'border-white/30')
              }
              style={{ backgroundColor: FACE_COLORS[f], color: '#0f172a' }}
            >
              {f}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface CrossNetProps {
  captures: Record<FaceLetter, FaceCapture | null>;
  highlight: FaceLetter | null;
}

/**
 * Cross-layout net showing all 6 faces. Each face is a 3×3 grid of captured
 * stickers, or a dashed placeholder if not yet captured. Highlights the
 * preview face during the preview stage.
 *
 *     . U . .
 *     L F R B
 *     . D . .
 */
function CrossNet({ captures, highlight }: CrossNetProps) {
  const facePos: Record<FaceLetter, string> = {
    U: 'col-start-2 row-start-1',
    L: 'col-start-1 row-start-2',
    F: 'col-start-2 row-start-2',
    R: 'col-start-3 row-start-2',
    B: 'col-start-4 row-start-2',
    D: 'col-start-2 row-start-3',
  };
  return (
    <div className="grid grid-cols-4 grid-rows-3 gap-0.5 self-center">
      {URFDLB.map((face) => {
        const cap = captures[face];
        const isHighlight = face === highlight;
        return (
          <div key={face} className={facePos[face]}>
            <div
              className={
                'grid gap-[2px] rounded p-0.5 ' +
                (isHighlight ? 'ring-2 ring-indigo-300' : '')
              }
              style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}
              aria-label={face}
            >
              {Array.from({ length: 9 }).map((_, i) => {
                const letter = cap?.stickers[i];
                return (
                  <div
                    key={i}
                    className={
                      'aspect-square w-3 rounded-[2px] border ' +
                      (cap ? 'border-black/30' : 'border-dashed border-white/30')
                    }
                    style={{ backgroundColor: letter ? FACE_COLORS[letter] : 'transparent' }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface ErrorLayerProps {
  reason: 'no_valid_orientation' | 'ambiguous' | null;
  captures: Record<FaceLetter, FaceCapture | null>;
  onRetakeFace: (face: FaceLetter) => void;
  onEditManually: () => void;
}

function ErrorLayer({ reason, captures, onRetakeFace, onEditManually }: ErrorLayerProps) {
  const { t } = useI18n();
  const msgKey = reason === 'ambiguous' ? 'camera.free.errorAmbiguous' : 'camera.free.errorInvalid';
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/85 px-6 text-center">
      <AlertTriangle size={28} className="text-amber-300" />
      <p className="max-w-sm text-sm text-white">{t(msgKey)}</p>
      <p className="text-xs text-white/70">{t('camera.free.errorAction')}</p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {URFDLB.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onRetakeFace(f)}
            disabled={!captures[f]}
            className="flex h-8 min-w-[44px] items-center justify-center rounded-md border border-white/30 text-xs font-semibold disabled:opacity-30"
            style={{ backgroundColor: FACE_COLORS[f], color: '#0f172a' }}
          >
            {f}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onEditManually}
        className="rounded-md border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
      >
        {t('camera.free.editManually')}
      </button>
    </div>
  );
}
