import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, RefreshCw, X, Check, AlertTriangle } from 'lucide-react';
import { URFDLB } from '@core/cube/ICube';
import type { FaceLetter } from '@core/cube/colors';
import { FACE_COLORS } from '@core/cube/colors';
import { classifyColor, samplePatch } from '@core/colorRecognition/classifier';
import { refineWithKMeans, type Sample } from '@core/colorRecognition/refine';
import {
  resolveOrientation2x2InSlots,
  resolveOrientation3x3,
  type ResolveResult,
} from '@core/cameraIntake/resolveOrientation';
import { useI18n } from '@ui/i18n/I18nProvider';

/**
 * Slot-anchored camera capture for 2×2 / 3×3. The user picks the URFDLB slot
 * they're about to scan (tap the cross-net) BEFORE capturing — this removes
 * the brittle "centre colour determines slot" routing that the previous flow
 * used (red↔orange misreads silently shipped faces to the wrong slot), and
 * gives 2×2 a slot anchor it never had before, collapsing its resolver from
 * 6!×4⁶ to just 4⁶.
 *
 * Invariants:
 *   - `captures[]` is URFDLB-indexed for both sizes.
 *   - `armedSlot` points to where the next capture lands. After Confirm it
 *     auto-advances to the next empty slot in URFDLB order; the user can
 *     also tap any slot in the cross-net to jump.
 *   - On 3×3, the captured centre is force-set to the armed slot's defining
 *     colour and marked as an override so K-means can't drift it. If the
 *     camera-read centre disagrees, we still pin to the slot but surface a
 *     warning in the preview so the user catches a mis-tap.
 *   - On 2×2 there's no centre to pin; slot identity exists only as the
 *     index and feeds the slot-anchored resolver.
 */

export interface CameraCaptureFreeProps {
  size: 2 | 3;
  onComplete: (facelets: string) => void;
  onCancel: () => void;
}

const MULTI_SAMPLE_FRAMES = 4;
const MULTI_SAMPLE_DELAY_MS = 50;

/** URFDLB cycle so colour tap-to-fix matches the rest of the app. */
const CYCLE_ORDER: readonly FaceLetter[] = ['U', 'R', 'F', 'D', 'L', 'B'];

interface FaceCapture {
  /** Stickers row-major in whatever rotation the camera saw. Length =
   *  size×size. On 3×3 the centre (index 4) is always the armed slot's
   *  letter (forced + override-pinned at capture time). */
  stickers: FaceLetter[];
  /** Averaged per-sticker RGB samples (post multi-frame averaging), aligned
   *  with `stickers`. Kept so the final K-means refinement pass can re-label
   *  borderline patches against this cube's own observed centroids. */
  rgbs: { r: number; g: number; b: number }[];
  /** Patch indices to lock against K-means: user tap-corrections, plus the
   *  3×3 centre (pinned by armed slot). */
  overrides: Set<number>;
}

type Stage = 'init' | 'live' | 'preview' | 'resolving' | 'error' | 'denied' | 'unsupported';

export function CameraCaptureFree({ size, onComplete, onCancel }: CameraCaptureFreeProps) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stickersPerFace = size * size;
  const centerIndex = size === 3 ? 4 : -1;
  const hasCenters = size === 3;

  const [stage, setStage] = useState<Stage>('init');
  const [captures, setCaptures] = useState<(FaceCapture | null)[]>(() =>
    new Array(6).fill(null),
  );
  /** Slot the next capture lands in (URFDLB index). Null when all six slots
   *  are filled or the user has explicitly unarmed (rare — currently the UI
   *  only unarms when everything is captured). */
  const [armedSlot, setArmedSlot] = useState<number | null>(0);
  /** Slot currently being previewed after a capture. Always equals the slot
   *  that was just armed when we transitioned into 'preview'. */
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  /** 3×3 only: colour the camera *read* for the centre when it disagrees
   *  with the armed slot's expected colour. The centre is pinned to the
   *  slot's colour regardless; this is purely a heads-up. */
  const [centerMismatchSeen, setCenterMismatchSeen] = useState<FaceLetter | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [resolveError, setResolveError] = useState<'no_valid_orientation' | 'ambiguous' | null>(
    null,
  );

  const capturedCount = useMemo(() => captures.filter((c) => c !== null).length, [captures]);
  const allCaptured = capturedCount === 6;
  const previewCap = previewIndex !== null ? captures[previewIndex] : null;
  const armedLetter: FaceLetter | null = armedSlot !== null ? URFDLB[armedSlot]! : null;

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

  /**
   * Multi-sample the live video into a size×size sticker face. Averaging
   * across a few frames knocks down per-frame camera noise.
   */
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

  /** Find the next empty slot in URFDLB order, starting from `startAfter+1`
   *  (wraps). Returns null if all six are full. */
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
    let stickers = sampled.stickers;
    const { rgbs } = sampled;
    const overrides = new Set<number>();
    let mismatch: FaceLetter | null = null;

    if (hasCenters) {
      const cameraSawCenter = stickers[centerIndex]!;
      const expectedCenter = URFDLB[armedSlot]!;
      if (cameraSawCenter !== expectedCenter) {
        mismatch = cameraSawCenter;
      }
      // The user has declared this is the {expectedCenter} face. Trust the
      // tap over the classifier — force the centre and pin so K-means can't
      // drift it back.
      stickers = [...stickers];
      stickers[centerIndex] = expectedCenter;
      overrides.add(centerIndex);
    }

    setCaptures((prev) => {
      const out = [...prev];
      out[armedSlot] = { stickers, rgbs, overrides };
      return out;
    });
    setCenterMismatchSeen(mismatch);
    setPreviewIndex(armedSlot);
    setStage('preview');
  }, [armedSlot, centerIndex, hasCenters, sampleFace]);

  const cycleSticker = useCallback(
    (patchIndex: number) => {
      if (previewIndex === null) return;
      // 3×3 centre: ignored. Slot identity is fixed by the armed-slot tap.
      // To change face identity, drop and re-arm a different slot.
      if (hasCenters && patchIndex === centerIndex) return;
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
    [previewIndex, hasCenters, centerIndex],
  );

  const retake = useCallback(() => {
    if (previewIndex !== null) {
      setCaptures((prev) => {
        const out = [...prev];
        out[previewIndex] = null;
        return out;
      });
      // Stay armed on the same slot — user wants to redo this exact face.
      setArmedSlot(previewIndex);
    }
    setPreviewIndex(null);
    setCenterMismatchSeen(null);
    setStage('live');
  }, [previewIndex]);

  const confirmFace = useCallback(() => {
    // captures[previewIndex] is already filled. Advance armedSlot to the
    // next empty slot (URFDLB order). We use functional setCaptures purely
    // to read the latest array — no actual mutation.
    setCaptures((prev) => {
      const cur = previewIndex ?? -1;
      setArmedSlot(findNextEmpty(cur, prev));
      return prev;
    });
    setPreviewIndex(null);
    setCenterMismatchSeen(null);
    setStage('live');
  }, [previewIndex, findNextEmpty]);

  /** Tap a slot in the cross-net. Empty → arm. Filled → drop + arm (so the
   *  user can retake that face without using the preview retake button). */
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
    setCenterMismatchSeen(null);
    setStage('live');
  }, []);

  const resolveCube = useCallback(() => {
    setStage('resolving');
    setResolveError(null);
    setTimeout(() => {
      // K-means refinement across all 54 / 24 patches. Overrides (user
      // hand-corrections and 3×3 centres pinned by the armed-slot mechanism)
      // are skipped so anchored input always wins.
      const samples: Sample[] = [];
      for (let f = 0; f < 6; f++) {
        const cap = captures[f];
        if (!cap) continue;
        for (let p = 0; p < cap.rgbs.length; p++) {
          if (cap.overrides.has(p)) continue;
          samples.push({ faceIndex: f, patchIndex: p, rgb: cap.rgbs[p]! });
        }
      }
      const refined = samples.length > 0 ? refineWithKMeans(samples) : null;
      const faces = captures.map((cap, f) =>
        cap!.stickers.map((orig, p) =>
          cap!.overrides.has(p) ? orig : (refined?.get(`${f},${p}`) ?? orig),
        ),
      );
      const result: ResolveResult =
        size === 3 ? resolveOrientation3x3({ faces }) : resolveOrientation2x2InSlots({ faces });
      if (result.ok) {
        stopStream();
        onComplete(result.facelets);
      } else {
        setResolveError(result.reason);
        setStage('error');
      }
    }, 0);
  }, [captures, onComplete, size, stopStream]);

  const retakeFromIndex = useCallback((idx: number) => {
    setCaptures((prev) => {
      const out = [...prev];
      out[idx] = null;
      return out;
    });
    setArmedSlot(idx);
    setPreviewIndex(null);
    setCenterMismatchSeen(null);
    setResolveError(null);
    setStage('live');
  }, []);

  /** Escape hatch: bail into manual paint with whatever we have so far. */
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
            {armedLetter ? (
              <p className="absolute inset-x-3 bottom-3 flex items-center justify-center gap-2 rounded-md bg-slate-950/70 px-3 py-1.5 text-center text-[12px] leading-snug text-white shadow-md backdrop-blur-sm">
                <span
                  aria-hidden="true"
                  className="inline-block h-3 w-3 rounded-sm ring-1 ring-white/60"
                  style={{ backgroundColor: FACE_COLORS[armedLetter] }}
                />
                <span>
                  {t('camera.free.armedHint', {
                    slot: armedLetter,
                    color: t(`camera.face.${armedLetter}.short`),
                  })}
                </span>
              </p>
            ) : (
              <p className="absolute inset-x-3 bottom-3 rounded-md bg-slate-950/70 px-3 py-1.5 text-center text-[12px] leading-snug text-white shadow-md backdrop-blur-sm">
                {allCaptured ? t('camera.free.allDone') : t('camera.free.pickSlot')}
              </p>
            )}
          </>
        )}

        {stage === 'preview' && previewCap && previewIndex !== null && (
          <PreviewLayer
            size={size}
            slotLetter={URFDLB[previewIndex]!}
            stickers={previewCap.stickers}
            onCellTap={cycleSticker}
            centerMismatch={hasCenters ? centerMismatchSeen : null}
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
  slotLetter: FaceLetter;
  stickers: FaceLetter[];
  onCellTap: (patchIndex: number) => void;
  /** 3×3 only: the colour the camera read for the centre, when it
   *  disagrees with the slot's expected colour. Surfaced as a non-blocking
   *  warning — the centre is pinned to the slot's colour regardless. */
  centerMismatch: FaceLetter | null;
}

function PreviewLayer({ size, slotLetter, stickers, onCellTap, centerMismatch }: PreviewLayerProps) {
  const { t } = useI18n();
  const centerIndex = size === 3 ? 4 : -1;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/40 px-4">
      <p className="flex items-center gap-2 rounded-md bg-slate-950/80 px-3 py-1.5 text-sm font-semibold text-white shadow">
        <span
          aria-hidden="true"
          className="inline-block h-3.5 w-3.5 rounded-sm ring-1 ring-white/60"
          style={{ backgroundColor: FACE_COLORS[slotLetter] }}
        />
        <span>
          {t('camera.free.capturedSlot', {
            slot: slotLetter,
            color: t(`camera.face.${slotLetter}.short`),
          })}
        </span>
      </p>
      {centerMismatch && (
        <p className="flex items-center gap-2 rounded-md bg-amber-500/20 px-3 py-1 text-[11px] text-amber-100 shadow ring-1 ring-amber-300/40">
          <AlertTriangle size={12} />
          <span>
            {t('camera.free.centerMismatch', {
              seen: t(`camera.face.${centerMismatch}.short`),
              expected: t(`camera.face.${slotLetter}.short`),
            })}
          </span>
        </p>
      )}
      <div
        className="grid gap-1.5 rounded-lg bg-slate-950/40 p-1.5 shadow-2xl ring-1 ring-white/15"
        style={{
          gridTemplateColumns: `repeat(${size}, 1fr)`,
          width: 'min(60vw, 280px, 45vh)',
          aspectRatio: '1 / 1',
        }}
      >
        {stickers.map((s, i) => {
          const isCenter = i === centerIndex;
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

interface CrossNetProps {
  size: 2 | 3;
  captures: (FaceCapture | null)[];
  armedSlot: number | null;
  previewIndex: number | null;
  onSlotTap: (slot: number) => void;
}

const FACE_POS: Record<FaceLetter, string> = {
  U: 'col-start-2 row-start-1',
  L: 'col-start-1 row-start-2',
  F: 'col-start-2 row-start-2',
  R: 'col-start-3 row-start-2',
  B: 'col-start-4 row-start-2',
  D: 'col-start-2 row-start-3',
};

/**
 * Interactive cross-net. Empty slots show the slot letter and a low-opacity
 * tint of the expected face colour so the user can see "this is F, show me
 * the green-centre face here." Tap = arm. Tap a filled slot = drop the
 * capture so the user can re-shoot that face.
 */
function CrossNet({ size, captures, armedSlot, previewIndex, onSlotTap }: CrossNetProps) {
  const stickersPerFace = size * size;
  const cellSize = size === 3 ? '0.75rem' : '1rem';
  return (
    <div className="grid grid-cols-4 grid-rows-3 gap-0.5 self-center">
      {URFDLB.map((face, idx) => {
        const cap = captures[idx];
        const isArmed = idx === armedSlot && previewIndex === null;
        const isPreviewing = idx === previewIndex;
        const slotColor = FACE_COLORS[face];
        return (
          <button
            key={face}
            type="button"
            onClick={() => onSlotTap(idx)}
            aria-label={face}
            className={
              FACE_POS[face] +
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
                      backgroundColor: letter
                        ? FACE_COLORS[letter]
                        : isArmed
                          ? slotColor + '60'
                          : slotColor + '24',
                    }}
                  />
                );
              })}
            </div>
            {!cap && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-md">
                {face}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface ErrorLayerProps {
  reason: 'no_valid_orientation' | 'ambiguous' | null;
  captures: (FaceCapture | null)[];
  onRetakeIndex: (idx: number) => void;
  onEditManually: () => void;
}

function ErrorLayer({ reason, captures, onRetakeIndex, onEditManually }: ErrorLayerProps) {
  const { t } = useI18n();
  const msgKey = reason === 'ambiguous' ? 'camera.free.errorAmbiguous' : 'camera.free.errorInvalid';
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/85 px-6 text-center">
      <AlertTriangle size={28} className="text-amber-300" />
      <p className="max-w-sm text-sm text-white">{t(msgKey)}</p>
      <p className="text-xs text-white/70">{t('camera.free.errorAction')}</p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {URFDLB.map((f, idx) => (
          <button
            key={f}
            type="button"
            onClick={() => onRetakeIndex(idx)}
            disabled={!captures[idx]}
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
