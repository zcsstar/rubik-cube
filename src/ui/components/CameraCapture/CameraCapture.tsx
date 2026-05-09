import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, RefreshCw, X, ArrowRight, Check } from 'lucide-react';
import type { CubeSize } from '@core/cube/ICube';
import { URFDLB } from '@core/cube/ICube';
import type { FaceLetter } from '@core/cube/colors';
import { classifyColor, samplePatch } from '@core/colorRecognition/classifier';
import { refineWithKMeans, type Sample } from '@core/colorRecognition/refine';
import { FACE_COLORS } from '@core/cube/colors';
import { CubeMiniNet } from '@ui/components/CubeMiniNet/CubeMiniNet';
import { useI18n } from '@ui/i18n/I18nProvider';

export interface CameraCaptureProps {
  size: CubeSize;
  /** Called once all six faces have been captured. */
  onComplete: (facelets: string) => void;
  onCancel: () => void;
}

/** URFDLB capture order. */
const FACE_ORDER: readonly FaceLetter[] = URFDLB;

interface FaceCapture {
  /** Provisional per-sticker letter, row-major (used for the live preview).
   *  Final labels are recomputed via K-means across all six faces just
   *  before handoff. */
  stickers: FaceLetter[];
  /** Raw averaged RGB per patch — kept so we can re-classify with K-means. */
  rgb: Array<{ r: number; g: number; b: number }>;
}

const MULTI_SAMPLE_FRAMES = 4; // frames per Capture press (averaged together)
const MULTI_SAMPLE_DELAY_MS = 50;

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

  const currentFace = FACE_ORDER[faceIndex]!;

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
    setCaptures((prev) => ({ ...prev, [currentFace]: { stickers, rgb } }));
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
      // patches against six common centroids.
      const refined = refineCaptures(captures);
      onComplete(refined ?? previewFacelets);
    }
  }, [faceIndex, onComplete, previewFacelets, stopStream, captures]);

  function refineCaptures(allCaptures: Record<FaceLetter, FaceCapture | null>): string | null {
    const samples: Sample[] = [];
    for (let f = 0; f < FACE_ORDER.length; f++) {
      const cap = allCaptures[FACE_ORDER[f]!];
      if (!cap) return null;
      cap.rgb.forEach((rgb, patchIndex) => {
        samples.push({ faceIndex: f, patchIndex, rgb });
      });
    }
    const labels = refineWithKMeans(samples);
    let out = '';
    for (let f = 0; f < FACE_ORDER.length; f++) {
      const stickers = allCaptures[FACE_ORDER[f]!]!.stickers;
      for (let p = 0; p < stickers.length; p++) {
        out += labels.get(`${f},${p}`) ?? stickers[p];
      }
    }
    return out;
  }

  const retake = useCallback(() => {
    setCaptures((prev) => ({ ...prev, [currentFace]: null }));
    setStage('live');
  }, [currentFace]);

  const cancel = useCallback(() => {
    stopStream();
    onCancel();
  }, [stopStream, onCancel]);

  const flipCamera = useCallback(() => {
    setFacing((f) => (f === 'environment' ? 'user' : 'environment'));
  }, []);

  // ----- render -----

  if (stage === 'unsupported' || stage === 'denied') {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
        <p>{stage === 'denied' ? t('camera.permissionDenied') : t('camera.unsupported')}</p>
        <button
          type="button"
          onClick={cancel}
          className="self-start rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-50"
        >
          {t('camera.btn.cancel')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {t('camera.title')}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('camera.hint')}</p>
        </div>
        <button
          type="button"
          onClick={cancel}
          aria-label={t('camera.btn.cancel')}
          className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <X size={16} />
        </button>
      </header>

      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{t('camera.faceCount', { n: faceIndex + 1 })}</span>
        <span className="font-medium" style={{ color: FACE_COLORS[currentFace] === '#FFFFFF' ? undefined : FACE_COLORS[currentFace] }}>
          {t(`camera.face.${currentFace}`)}
        </span>
      </div>

      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-950">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          playsInline
          muted
          style={{ transform: facing === 'user' ? 'scaleX(-1)' : undefined }}
        />
        <canvas ref={canvasRef} className="hidden" />
        <GridOverlay size={size} />
        {stage === 'preview' && captures[currentFace] && (
          <div className="absolute bottom-2 right-2 rounded-md bg-white/85 p-2 shadow-md">
            <FacePreview face={currentFace} stickers={captures[currentFace]!.stickers} size={size} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {stage === 'live' && (
          <>
            <button
              type="button"
              onClick={captureFace}
              className="flex flex-1 items-center justify-center gap-2 rounded-md bg-indigo-500 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-600"
            >
              <Camera size={16} /> {t('camera.btn.capture')}
            </button>
            <button
              type="button"
              onClick={flipCamera}
              aria-label={facing === 'environment' ? t('camera.facing.environment') : t('camera.facing.user')}
              className="rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <RefreshCw size={16} />
            </button>
          </>
        )}
        {stage === 'preview' && (
          <>
            <button
              type="button"
              onClick={retake}
              className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCw size={16} /> {t('camera.btn.retake')}
            </button>
            <button
              type="button"
              onClick={acceptAndAdvance}
              className="flex flex-1 items-center justify-center gap-2 rounded-md bg-indigo-500 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-600"
            >
              {faceIndex < FACE_ORDER.length - 1 ? (
                <>
                  <ArrowRight size={16} /> {t('camera.btn.next')}
                </>
              ) : (
                <>
                  <Check size={16} /> {t('camera.btn.done')}
                </>
              )}
            </button>
          </>
        )}
      </div>

      {/* Live preview of progress so far */}
      <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 p-2 dark:bg-slate-950/50">
        <CubeMiniNet facelets={previewFacelets} size={size} width={140} />
        <div className="flex flex-wrap gap-1.5 text-xs">
          {FACE_ORDER.map((f, i) => {
            const captured = captures[f] !== null;
            const active = i === faceIndex;
            return (
              <span
                key={f}
                className={
                  'rounded px-1.5 py-0.5 ' +
                  (captured
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200'
                    : active
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200'
                      : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400')
                }
              >
                {f}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GridOverlay({ size }: { size: CubeSize }) {
  const cells = Array.from({ length: size * size }, (_, i) => ({
    row: Math.floor(i / size),
    col: i % size,
  }));
  return (
    <div className="pointer-events-none absolute inset-0 grid"
      style={{
        gridTemplateColumns: `repeat(${size}, 1fr)`,
        gridTemplateRows: `repeat(${size}, 1fr)`,
      }}
    >
      {cells.map(({ row, col }) => (
        <div
          key={`${row}-${col}`}
          className="border border-white/60"
        />
      ))}
    </div>
  );
}

function FacePreview({ face, stickers, size }: { face: FaceLetter; stickers: FaceLetter[]; size: CubeSize }) {
  return (
    <div
      className="grid gap-[2px] rounded-sm"
      style={{
        gridTemplateColumns: `repeat(${size}, 1fr)`,
        width: 60,
        height: 60,
      }}
      aria-label={`Detected ${face} face`}
    >
      {stickers.map((s, i) => (
        <div
          key={i}
          className="rounded-[1px]"
          style={{ backgroundColor: FACE_COLORS[s], border: '1px solid #1e293b88' }}
        />
      ))}
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
