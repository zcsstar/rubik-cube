import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, RefreshCw, X, Check, AlertTriangle } from 'lucide-react';
import { URFDLB } from '@core/cube/ICube';
import type { FaceLetter } from '@core/cube/colors';
import { FACE_COLORS } from '@core/cube/colors';
import { classifyColor, samplePatch } from '@core/colorRecognition/classifier';
import { refineWithKMeansConstrained, type Sample } from '@core/colorRecognition/refine';
import {
  remap3x3ByCenters,
  resolveOrientation2x2InSlots,
  resolveOrientation3x3,
  type ResolveResult,
} from '@core/cameraIntake/resolveOrientation';
import { useI18n } from '@ui/i18n/I18nProvider';

/**
 * Position-based camera capture for 2×2 / 3×3.
 *
 * The user taps any empty slot in the unfolded-net mini view, then aims at
 * any face of the cube and tap Capture. The capture lands in that slot.
 * They can re-tap a slot to retake. *Nothing* about the flow ties a slot to
 * a specific colour — the user just decides which face goes where in the
 * net. After all 6 are in:
 *   - 3×3: centres are read post-K-means and the 6 positional faces are
 *     remapped into URFDLB order based on which centre colour landed
 *     where. The standard rotation resolver then finds each face's
 *     rotation. If the 6 centres aren't 6 distinct colours, that surfaces
 *     as a colour-recognition error.
 *   - 2×2: no centres, no remap needed. The captures feed straight into
 *     the slot-anchored resolver; the 24 whole-cube rotation symmetries
 *     mean any positional convention solves correctly.
 *
 * Constrained K-means: refinement enforces exactly N stickers per colour
 * (4 / 9 per face minus user overrides). That kills the "R=3, L=5" count
 * errors the unconstrained classifier let through under warm light.
 */

export interface CameraCaptureFreeProps {
  size: 2 | 3;
  onComplete: (facelets: string) => void;
  onCancel: () => void;
}

const MULTI_SAMPLE_FRAMES = 4;
const MULTI_SAMPLE_DELAY_MS = 50;

/** URFDLB cycle so tap-to-fix on a sticker matches the rest of the app. */
const CYCLE_ORDER: readonly FaceLetter[] = ['U', 'R', 'F', 'D', 'L', 'B'];

interface FaceCapture {
  /** Stickers row-major in whatever rotation the camera saw. */
  stickers: FaceLetter[];
  /** Averaged per-sticker RGB samples. K-means uses these at resolve time. */
  rgbs: { r: number; g: number; b: number }[];
  /** Patch indices the user manually pinned (tap-to-cycle). K-means leaves
   *  these untouched and they count against the per-colour quota. */
  overrides: Set<number>;
}

type Stage = 'init' | 'live' | 'preview' | 'resolving' | 'error' | 'denied' | 'unsupported';

export function CameraCaptureFree({ size, onComplete, onCancel }: CameraCaptureFreeProps) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stickersPerFace = size * size;

  const [stage, setStage] = useState<Stage>('init');
  /** Length 6, indexed by positional slot (same cross-net layout as URFDLB
   *  but the meaning is purely visual: slot 0 is "top of the net", slot 2
   *  is "front of the net", etc. No slot is tied to any particular colour. */
  const [captures, setCaptures] = useState<(FaceCapture | null)[]>(() =>
    new Array(6).fill(null),
  );
  /** Positional slot the next capture lands in. */
  const [armedSlot, setArmedSlot] = useState<number | null>(0);
  /** Slot currently being previewed after a capture. */
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [resolveError, setResolveError] = useState<
    'no_valid_orientation' | 'ambiguous' | 'bad_centres' | null
  >(null);

  const capturedCount = useMemo(() => captures.filter((c) => c !== null).length, [captures]);
  const allCaptured = capturedCount === 6;
  const previewCap = previewIndex !== null ? captures[previewIndex] : null;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
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

  const sampleFace = useCallback(
    async (): Promise<{
      stickers: FaceLetter[];
      rgbs: { r: number; g: number; b: number }[];
    } | null> => {
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
      const radius = Math.max(8, side / size / 8);
      const accum = new Array(stickersPerFace).fill(null).map(() => ({ r: 0, g: 0, b: 0 }));
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
      const rgbs = accum.map((a) => ({
        r: a.r / MULTI_SAMPLE_FRAMES,
        g: a.g / MULTI_SAMPLE_FRAMES,
        b: a.b / MULTI_SAMPLE_FRAMES,
      }));
      const stickers = rgbs.map((c) => classifyColor(c.r, c.g, c.b));
      return { stickers, rgbs };
    },
    [size, stickersPerFace],
  );

  /** Next empty slot in cross-net order, starting from `startAfter+1`. */
  const findNextEmpty = useCallback(
    (startAfter: number, caps: readonly (FaceCapture | null)[]): number | null => {
      for (let offset = 1; offset <= 6; offset++) {
        const idx = (startAfter + offset) % 6;
        if (caps[idx] === null) return idx;
      }
      return null;
    },
    [],
  );

  const capture = useCallback(async () => {
    if (armedSlot === null) return;
    const sampled = await sampleFace();
    if (!sampled) return;
    const { stickers, rgbs } = sampled;
    setCaptures((prev) => {
      const out = [...prev];
      out[armedSlot] = { stickers, rgbs, overrides: new Set<number>() };
      return out;
    });
    setPreviewIndex(armedSlot);
    setStage('preview');
  }, [armedSlot, sampleFace]);

  const cycleSticker = useCallback(
    (patchIndex: number) => {
      if (previewIndex === null) return;
      setCaptures((prev) => {
        const cap = prev[previewIndex];
        if (!cap) return prev;
        const next = [...cap.stickers];
        const cur = CYCLE_ORDER.indexOf(next[patchIndex]!);
        next[patchIndex] = CYCLE_ORDER[(cur + 1) % CYCLE_ORDER.length]!;
        const newOverrides = new Set(cap.overrides);
        newOverrides.add(patchIndex);
        const out = [...prev];
        out[previewIndex] = { stickers: next, rgbs: cap.rgbs, overrides: newOverrides };
        return out;
      });
    },
    [previewIndex],
  );

  const retake = useCallback(() => {
    if (previewIndex !== null) {
      setCaptures((prev) => {
        const out = [...prev];
        out[previewIndex] = null;
        return out;
      });
      setArmedSlot(previewIndex);
    }
    setPreviewIndex(null);
    setStage('live');
  }, [previewIndex]);

  const confirmFace = useCallback(() => {
    setCaptures((prev) => {
      const cur = previewIndex ?? -1;
      setArmedSlot(findNextEmpty(cur, prev));
      return prev;
    });
    setPreviewIndex(null);
    setStage('live');
  }, [previewIndex, findNextEmpty]);

  /** Tap a slot: arm it (drop+arm if it was filled, so the user can retake). */
  const armSlot = useCallback((slot: number) => {
    setCaptures((prev) => {
      if (prev[slot] !== null) {
        const out = [...prev];
        out[slot] = null;
        return out;
      }
      return prev;
    });
    setArmedSlot(slot);
    setPreviewIndex(null);
    setStage('live');
  }, []);

  const resolveCube = useCallback(() => {
    setStage('resolving');
    setResolveError(null);
    setTimeout(() => {
      // Constrained K-means: enforce N per colour, minus user overrides.
      const expectedCounts: Record<FaceLetter, number> = {
        U: stickersPerFace,
        R: stickersPerFace,
        F: stickersPerFace,
        D: stickersPerFace,
        L: stickersPerFace,
        B: stickersPerFace,
      };
      const samples: Sample[] = [];
      for (let f = 0; f < 6; f++) {
        const cap = captures[f];
        if (!cap) continue;
        for (let p = 0; p < cap.rgbs.length; p++) {
          if (cap.overrides.has(p)) {
            // Override sticker doesn't go to K-means but takes one of its
            // colour's allotted slots.
            const overrideLetter = cap.stickers[p]!;
            expectedCounts[overrideLetter] = Math.max(0, expectedCounts[overrideLetter]! - 1);
            continue;
          }
          samples.push({ faceIndex: f, patchIndex: p, rgb: cap.rgbs[p]! });
        }
      }
      const refined =
        samples.length > 0 ? refineWithKMeansConstrained(samples, expectedCounts) : null;
      const positionalFaces = captures.map((cap, f) =>
        cap!.stickers.map((orig, p) =>
          cap!.overrides.has(p) ? orig : (refined?.get(`${f},${p}`) ?? orig),
        ),
      );

      let result: ResolveResult;
      if (size === 3) {
        const reordered = remap3x3ByCenters(positionalFaces);
        if (!reordered) {
          setResolveError('bad_centres');
          setStage('error');
          return;
        }
        result = resolveOrientation3x3({ faces: reordered });
      } else {
        result = resolveOrientation2x2InSlots({ faces: positionalFaces });
      }
      if (result.ok) {
        stopStream();
        onComplete(result.facelets);
      } else {
        setResolveError(result.reason);
        setStage('error');
      }
    }, 0);
  }, [captures, onComplete, size, stickersPerFace, stopStream]);

  const retakeFromIndex = useCallback((idx: number) => {
    setCaptures((prev) => {
      const out = [...prev];
      out[idx] = null;
      return out;
    });
    setArmedSlot(idx);
    setPreviewIndex(null);
    setResolveError(null);
    setStage('live');
  }, []);

  const editManually = useCallback(() => {
    stopStream();
    let s = '';
    for (let i = 0; i < 6; i++) {
      const cap = captures[i];
      if (cap) {
        s += cap.stickers.join('');
      } else {
        const letter = URFDLB[i]!;
        s += letter.repeat(stickersPerFace);
      }
    }
    onComplete(s);
  }, [captures, onComplete, stickersPerFace, stopStream]);

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
            <FramingOverlay size={size} />
            <p className="absolute inset-x-3 bottom-3 rounded-md bg-slate-950/70 px-3 py-1.5 text-center text-[12px] leading-snug text-white shadow-md backdrop-blur-sm">
              {allCaptured
                ? t('camera.free.allDone')
                : armedSlot !== null
                  ? t('camera.free.armedHint')
                  : t('camera.free.pickSlot')}
            </p>
          </>
        )}

        {stage === 'preview' && previewCap && previewIndex !== null && (
          <PreviewLayer
            size={size}
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
            onRetakeIndex={retakeFromIndex}
            onEditManually={editManually}
          />
        )}
      </div>

      <div
        className="flex flex-col gap-2 bg-slate-950 px-4 pt-2 text-white"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
      >
        {(stage === 'live' || stage === 'preview') && (
          <CrossNet
            size={size}
            captures={captures}
            armedSlot={armedSlot}
            previewIndex={previewIndex}
            onSlotTap={armSlot}
          />
        )}

        <div className="flex items-center gap-2">
          {stage === 'live' && !allCaptured && (
            <>
              <button
                type="button"
                onClick={() => void capture()}
                disabled={armedSlot === null}
                className="flex flex-1 items-center justify-center gap-2 rounded-md bg-indigo-500 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-600 disabled:opacity-40"
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

          {stage === 'preview' && (
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
                onClick={confirmFace}
                className="flex flex-1 items-center justify-center gap-2 rounded-md bg-indigo-500 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-600"
              >
                <Check size={18} /> {t('camera.free.useFace')}
              </button>
            </>
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

function FramingOverlay({ size }: { size: 2 | 3 }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${size}, 1fr)`,
          gridTemplateRows: `repeat(${size}, 1fr)`,
          width: 'min(70vw, calc(100vh - 320px))',
          height: 'min(70vw, calc(100vh - 320px))',
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

interface PreviewLayerProps {
  size: 2 | 3;
  stickers: FaceLetter[];
  onCellTap: (patchIndex: number) => void;
}

function PreviewLayer({ size, stickers, onCellTap }: PreviewLayerProps) {
  const { t } = useI18n();
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/40 px-4">
      <div
        className="grid gap-1.5 rounded-lg bg-slate-950/40 p-1.5 shadow-2xl ring-1 ring-white/15"
        style={{
          gridTemplateColumns: `repeat(${size}, 1fr)`,
          width: 'min(60vw, 280px, 45vh)',
          aspectRatio: '1 / 1',
        }}
      >
        {stickers.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onCellTap(i)}
            className="relative rounded-md ring-1 ring-black/40 transition active:scale-95"
            style={{ backgroundColor: FACE_COLORS[s] }}
            aria-label={`Sticker ${i + 1}: ${s}`}
          />
        ))}
      </div>
      <p className="rounded-md bg-slate-950/75 px-3 py-1 text-[11px] text-white shadow backdrop-blur-sm">
        {t('camera.preview.hint')}
      </p>
    </div>
  );
}

interface CrossNetProps {
  size: 2 | 3;
  captures: (FaceCapture | null)[];
  armedSlot: number | null;
  previewIndex: number | null;
  onSlotTap: (slot: number) => void;
}

/** Cross-net layout positions, indexed by capture-array slot. The slot
 *  number is positional only — slot 0 sits at the top of the net, slot 2
 *  in the middle (where F lives in a URFDLB net), etc. No colour identity
 *  is implied by the position. */
const SLOT_LAYOUT: readonly string[] = [
  'col-start-2 row-start-1', // 0 - top
  'col-start-3 row-start-2', // 1 - right
  'col-start-2 row-start-2', // 2 - middle (front)
  'col-start-2 row-start-3', // 3 - bottom
  'col-start-1 row-start-2', // 4 - left
  'col-start-4 row-start-2', // 5 - far right (back)
];

/**
 * Interactive cross-net. Empty slots are dashed boxes with no colour hint.
 * Tap empty → arm. Tap filled → drop the capture and arm so the user can
 * re-shoot. The currently armed slot is ringed indigo.
 */
function CrossNet({ size, captures, armedSlot, previewIndex, onSlotTap }: CrossNetProps) {
  const stickersPerFace = size * size;
  const cellSize = size === 3 ? '0.75rem' : '1rem';
  return (
    <div className="grid grid-cols-4 grid-rows-3 gap-0.5 self-center">
      {SLOT_LAYOUT.map((pos, idx) => {
        const cap = captures[idx];
        const isArmed = idx === armedSlot && previewIndex === null;
        const isPreviewing = idx === previewIndex;
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onSlotTap(idx)}
            aria-label={`Slot ${idx + 1}`}
            className={
              pos +
              ' relative rounded p-0.5 transition ' +
              (isArmed
                ? 'ring-2 ring-indigo-300 bg-indigo-500/15'
                : isPreviewing
                  ? 'ring-2 ring-white/60'
                  : 'hover:ring-1 hover:ring-white/40')
            }
          >
            <div
              className="grid gap-[2px]"
              style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
            >
              {Array.from({ length: stickersPerFace }).map((_, i) => {
                const letter = cap?.stickers[i];
                return (
                  <div
                    key={i}
                    className={
                      'aspect-square rounded-[2px] border ' +
                      (cap ? 'border-black/30' : 'border-dashed border-white/30')
                    }
                    style={{
                      width: cellSize,
                      backgroundColor: letter ? FACE_COLORS[letter] : 'transparent',
                    }}
                  />
                );
              })}
            </div>
          </button>
        );
      })}
    </div>
  );
}

interface ErrorLayerProps {
  reason: 'no_valid_orientation' | 'ambiguous' | 'bad_centres' | null;
  captures: (FaceCapture | null)[];
  onRetakeIndex: (idx: number) => void;
  onEditManually: () => void;
}

function ErrorLayer({ reason, captures, onRetakeIndex, onEditManually }: ErrorLayerProps) {
  const { t } = useI18n();
  const msgKey =
    reason === 'ambiguous'
      ? 'camera.free.errorAmbiguous'
      : reason === 'bad_centres'
        ? 'camera.free.errorBadCentres'
        : 'camera.free.errorInvalid';
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/85 px-6 text-center">
      <AlertTriangle size={28} className="text-amber-300" />
      <p className="max-w-sm text-sm text-white">{t(msgKey)}</p>
      <p className="text-xs text-white/70">{t('camera.free.errorAction')}</p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {captures.map((cap, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onRetakeIndex(idx)}
            disabled={!cap}
            className="flex h-12 w-12 items-center justify-center rounded-md border border-white/30 bg-white/5 p-1 disabled:opacity-30"
          >
            {cap ? (
              <div className="grid grid-cols-3 gap-[1px]">
                {cap.stickers.slice(0, 9).map((s, j) => (
                  <div
                    key={j}
                    className="h-2 w-2 rounded-[1px]"
                    style={{ backgroundColor: FACE_COLORS[s] }}
                  />
                ))}
              </div>
            ) : (
              <span className="text-[10px] font-semibold text-white/60">{idx + 1}</span>
            )}
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
