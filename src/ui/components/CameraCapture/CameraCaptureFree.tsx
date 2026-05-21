import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, RefreshCw, X, Check, AlertTriangle } from 'lucide-react';
import { URFDLB } from '@core/cube/ICube';
import type { FaceLetter } from '@core/cube/colors';
import { FACE_COLORS } from '@core/cube/colors';
import { classifyColor, samplePatch } from '@core/colorRecognition/classifier';
import { refineWithKMeans, type Sample } from '@core/colorRecognition/refine';
import {
  resolveOrientation2x2,
  resolveOrientation3x3,
  type ResolveResult,
} from '@core/cameraIntake/resolveOrientation';
import { useI18n } from '@ui/i18n/I18nProvider';

/**
 * Free-order, free-rotation camera capture. Shared between 2×2 and 3×3 with
 * size-aware branches in three places:
 *
 *   1. Face identification. 3×3 has fixed centres, so the centre sticker's
 *      colour tells us which slot a capture belongs in (W→U, G→F, …). 2×2
 *      has no centres, so captures are slotted by sequence (1st shot → slot
 *      0, 2nd → slot 1, …) and the resolver figures out the assignment
 *      after all 6 are in.
 *   2. UI affordances tied to identity: "Centre is {colour}" label,
 *      "Wrong face?" reassign picker — both 3×3-only.
 *   3. Progress visual: 3×3 uses a cross-net at canonical slot positions;
 *      2×2 uses a linear strip of capture thumbnails (no slot identity to
 *      anchor on).
 *
 * Everything else — capture/preview/confirm flow, correction grid, resolver
 * call, error recovery — is identical between the two sizes. Adding a new
 * size that fits this pattern (e.g. 4×4 once a solver exists) should only
 * need a new resolver and a flag to enable / disable the centre-identity
 * branches.
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
   *  size×size. For 3×3 the centre (index 4) drives face identity. */
  stickers: FaceLetter[];
  /** Averaged per-sticker RGB samples (post multi-frame averaging), aligned
   *  with `stickers`. Kept so the final K-means refinement pass can re-label
   *  borderline patches against this cube's own observed centroids. */
  rgbs: { r: number; g: number; b: number }[];
  /** Patch indices the user manually corrected (tap-to-fix or reassignTo).
   *  K-means skips these so user input always wins. */
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
  const isCenterIdentified = size === 3;

  const [stage, setStage] = useState<Stage>('init');
  /** Length 6. For 3×3 indexed by URFDLB slot; for 2×2 indexed by capture
   *  sequence (slot identity unknown until the resolver runs). */
  const [captures, setCaptures] = useState<(FaceCapture | null)[]>(() =>
    new Array(6).fill(null),
  );
  /** Index in `captures` of the just-captured face. Interpretation depends on
   *  size — see comment on `captures`. */
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  /** 3×3 only: toggles the "Wrong face?" reassign picker. */
  const [showReassign, setShowReassign] = useState(false);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [resolveError, setResolveError] = useState<'no_valid_orientation' | 'ambiguous' | null>(
    null,
  );

  const capturedCount = useMemo(() => captures.filter((c) => c !== null).length, [captures]);
  const allCaptured = capturedCount === 6;
  const previewCap = previewIndex !== null ? captures[previewIndex] : null;
  const previewSlotLetter: FaceLetter | null =
    isCenterIdentified && previewIndex !== null ? URFDLB[previewIndex]! : null;

  // Lock body scroll while overlay is mounted — stray scrolls leak through to
  // the page underneath on iOS otherwise.
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
   * over a few frames knocks down per-frame camera noise so the centre
   * classification (for 3×3 face identity) is reliable. Returns both the
   * per-sticker classification (used immediately for face-slot routing on
   * 3×3) and the averaged RGB (kept so the resolve-time K-means pass can
   * re-label patches against this cube's own observed colour centroids).
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

  const capture = useCallback(async () => {
    const sampled = await sampleFace();
    if (!sampled) return;
    const { stickers, rgbs } = sampled;
    let targetIndex: number;
    if (isCenterIdentified) {
      // 3×3: centre sticker is the face's identity, so slot it by URFDLB index.
      const centerLetter = stickers[centerIndex]!;
      targetIndex = URFDLB.indexOf(centerLetter);
    } else {
      // 2×2: append to the first empty slot in capture sequence.
      const next = captures.findIndex((c) => c === null);
      if (next === -1) return;
      targetIndex = next;
    }
    setCaptures((prev) => {
      const out = [...prev];
      out[targetIndex] = { stickers, rgbs, overrides: new Set<number>() };
      return out;
    });
    setPreviewIndex(targetIndex);
    setShowReassign(false);
    setStage('preview');
  }, [captures, centerIndex, isCenterIdentified, sampleFace]);

  /** 3×3 only: re-slot the just-captured stickers to a different URFDLB
   *  face. Used when the centre-colour classifier misroutes (typical
   *  failure modes: red↔orange, white↔yellow under harsh light). */
  const reassignTo = useCallback(
    (targetSlot: number) => {
      if (previewIndex === null || !isCenterIdentified) return;
      setCaptures((prev) => {
        const cap = prev[previewIndex];
        if (!cap) return prev;
        const newStickers = [...cap.stickers];
        // Force the centre to the new face letter so the resolver
        // (which trusts the centre) lines up.
        newStickers[centerIndex] = URFDLB[targetSlot]!;
        // The user just told us what face this is, so pin the centre as an
        // override — K-means must not re-label it.
        const newOverrides = new Set(cap.overrides);
        newOverrides.add(centerIndex);
        const next = [...prev];
        next[previewIndex] = null;
        next[targetSlot] = { stickers: newStickers, rgbs: cap.rgbs, overrides: newOverrides };
        return next;
      });
      setPreviewIndex(targetSlot);
      setShowReassign(false);
    },
    [previewIndex, isCenterIdentified, centerIndex],
  );

  const cycleSticker = useCallback(
    (patchIndex: number) => {
      if (previewIndex === null) return;
      // 3×3 centre tap: ignored. The centre is the face's defining colour;
      // changing it means "this is the wrong face", which is what
      // "Wrong face?" is for.
      if (isCenterIdentified && patchIndex === centerIndex) return;
      setCaptures((prev) => {
        const cap = prev[previewIndex];
        if (!cap) return prev;
        const next = [...cap.stickers];
        const cur = CYCLE_ORDER.indexOf(next[patchIndex]!);
        next[patchIndex] = CYCLE_ORDER[(cur + 1) % CYCLE_ORDER.length]!;
        // User just hand-corrected this sticker — pin it so the K-means pass
        // can't undo their choice.
        const newOverrides = new Set(cap.overrides);
        newOverrides.add(patchIndex);
        const out = [...prev];
        out[previewIndex] = { stickers: next, rgbs: cap.rgbs, overrides: newOverrides };
        return out;
      });
    },
    [previewIndex, isCenterIdentified, centerIndex],
  );

  const retake = useCallback(() => {
    if (previewIndex !== null) {
      setCaptures((prev) => {
        const out = [...prev];
        out[previewIndex] = null;
        return out;
      });
    }
    setPreviewIndex(null);
    setShowReassign(false);
    setStage('live');
  }, [previewIndex]);

  const confirmFace = useCallback(() => {
    setPreviewIndex(null);
    setShowReassign(false);
    setStage('live');
  }, []);

  const resolveCube = useCallback(() => {
    setStage('resolving');
    setResolveError(null);
    // Defer to a microtask so the spinner has a chance to paint before the
    // (synchronous, ~50ms–3s) resolver runs.
    setTimeout(() => {
      // Final pass: K-means refinement across all six faces' raw RGB before
      // we hand the labels to the resolver. The per-pixel HSV classifier ran
      // independently on each capture and can drift across faces under
      // varying light (red↔orange, white↔yellow). K-means clusters all the
      // patches against six common centroids so borderline stickers get
      // pulled back to the cluster the rest of the cube agrees on. Patches
      // the user manually corrected (or centres locked via reassignTo) are
      // skipped so human input always wins.
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
        size === 3 ? resolveOrientation3x3({ faces }) : resolveOrientation2x2({ faces });
      if (result.ok) {
        stopStream();
        onComplete(result.facelets);
      } else {
        setResolveError(result.reason);
        setStage('error');
      }
    }, 0);
  }, [captures, onComplete, size, stopStream]);

  /** Discard one face from the error screen and jump back to live to retake it. */
  const retakeFromIndex = useCallback((idx: number) => {
    setCaptures((prev) => {
      const out = [...prev];
      out[idx] = null;
      return out;
    });
    setPreviewIndex(null);
    setShowReassign(false);
    setResolveError(null);
    setStage('live');
  }, []);

  /** Escape hatch: bail into ColorInputNet for manual editing. */
  const editManually = useCallback(() => {
    stopStream();
    // Best-effort facelet string from current captures. Rotation/slot may be
    // wrong but the user is about to fix things by hand anyway.
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
              {allCaptured ? t('camera.free.allDone') : t('camera.free.hint')}
            </p>
          </>
        )}

        {stage === 'preview' && previewCap && (
          <PreviewLayer
            size={size}
            slotLetter={previewSlotLetter}
            sequenceIndex={previewIndex}
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
            size={size}
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
        {(stage === 'live' || stage === 'preview') &&
          (isCenterIdentified ? (
            <CrossNet captures={captures} highlightIndex={previewIndex} />
          ) : (
            <CaptureStrip size={size} captures={captures} highlightIndex={previewIndex} />
          ))}

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
              {isCenterIdentified && (
                <button
                  type="button"
                  onClick={() => setShowReassign(true)}
                  className="rounded-md border border-amber-300/40 bg-amber-400/10 px-3 py-2.5 text-sm font-medium text-amber-100 hover:bg-amber-400/20"
                >
                  {t('camera.free.wrongFace')}
                </button>
              )}
              <button
                type="button"
                onClick={confirmFace}
                className="flex flex-1 items-center justify-center gap-2 rounded-md bg-indigo-500 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-600"
              >
                <Check size={18} /> {t('camera.free.useFace')}
              </button>
            </>
          )}

          {stage === 'preview' && showReassign && isCenterIdentified && (
            <ReassignBar
              currentSlot={previewIndex}
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
  /** 3×3 only: the URFDLB face this capture was slotted into. Drives the
   *  "Centre is {colour}" label. Null on 2×2 (no identity yet). */
  slotLetter: FaceLetter | null;
  /** 2×2 only: which capture this is in the sequence (0..5). Null on 3×3. */
  sequenceIndex: number | null;
  stickers: FaceLetter[];
  onCellTap: (patchIndex: number) => void;
}

function PreviewLayer({ size, slotLetter, sequenceIndex, stickers, onCellTap }: PreviewLayerProps) {
  const { t } = useI18n();
  const centerIndex = size === 3 ? 4 : -1;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/40 px-4">
      {slotLetter !== null ? (
        // 3×3: name the face by centre colour. The swatch + coloured word
        // ties the label to the centre sticker visually.
        <p className="flex items-center gap-2 rounded-md bg-slate-950/80 px-3 py-1.5 text-sm font-semibold text-white shadow">
          <span
            aria-hidden="true"
            className="inline-block h-3.5 w-3.5 rounded-sm ring-1 ring-white/60"
            style={{ backgroundColor: FACE_COLORS[slotLetter] }}
          />
          <span>{t('camera.free.centerLabel')}</span>
          <span style={{ color: FACE_COLORS[slotLetter] }}>
            {t(`camera.face.${slotLetter}.short`)}
          </span>
        </p>
      ) : (
        // 2×2: no face identity; just confirm the captured face by its
        // sequence number.
        sequenceIndex !== null && (
          <p className="rounded-md bg-slate-950/80 px-3 py-1.5 text-sm font-semibold text-white shadow">
            {t('camera.free.faceN', { n: sequenceIndex + 1 })}
          </p>
        )
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

interface ReassignBarProps {
  /** 3×3 only — captures' current URFDLB slot. */
  currentSlot: number | null;
  captures: (FaceCapture | null)[];
  onPick: (slot: number) => void;
  onCancel: () => void;
}

function ReassignBar({ currentSlot, captures, onPick, onCancel }: ReassignBarProps) {
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
        {URFDLB.map((f, idx) => {
          const isCurrent = idx === currentSlot;
          // Picking a slot that already has a capture overwrites it — flag it.
          const willOverwrite = !isCurrent && captures[idx] !== null;
          return (
            <button
              key={f}
              type="button"
              onClick={() => onPick(idx)}
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
  captures: (FaceCapture | null)[];
  highlightIndex: number | null;
}

/**
 * 3×3 progress visual: cross-net layout at canonical slot positions.
 *
 *     . U . .
 *     L F R B
 *     . D . .
 */
function CrossNet({ captures, highlightIndex }: CrossNetProps) {
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
      {URFDLB.map((face, idx) => {
        const cap = captures[idx];
        const isHighlight = idx === highlightIndex;
        return (
          <div key={face} className={facePos[face]}>
            <div
              className={
                'grid gap-[2px] rounded p-0.5 ' + (isHighlight ? 'ring-2 ring-indigo-300' : '')
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

interface CaptureStripProps {
  size: 2 | 3;
  captures: (FaceCapture | null)[];
  highlightIndex: number | null;
}

/**
 * 2×2 progress visual: a row of 6 thumbnails. Without centres we can't show
 * captured faces at "their" slots — there are no slots yet. The strip just
 * communicates "n of 6 done" with enough detail that the user can see what
 * they've shot so far (helps spot accidental duplicate-face captures).
 */
function CaptureStrip({ size, captures, highlightIndex }: CaptureStripProps) {
  return (
    <div className="flex justify-center gap-1.5">
      {captures.map((cap, idx) => {
        const isHighlight = idx === highlightIndex;
        return (
          <div
            key={idx}
            className={
              'grid gap-[2px] rounded p-0.5 ' + (isHighlight ? 'ring-2 ring-indigo-300' : '')
            }
            style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
            aria-label={`Capture ${idx + 1}`}
          >
            {Array.from({ length: size * size }).map((_, i) => {
              const letter = cap?.stickers[i];
              return (
                <div
                  key={i}
                  className={
                    'aspect-square w-3.5 rounded-[2px] border ' +
                    (cap ? 'border-black/30' : 'border-dashed border-white/30')
                  }
                  style={{ backgroundColor: letter ? FACE_COLORS[letter] : 'transparent' }}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

interface ErrorLayerProps {
  reason: 'no_valid_orientation' | 'ambiguous' | null;
  size: 2 | 3;
  captures: (FaceCapture | null)[];
  /** Retake the capture at this index (URFDLB slot for 3×3, sequence
   *  position for 2×2). */
  onRetakeIndex: (idx: number) => void;
  onEditManually: () => void;
}

function ErrorLayer({ reason, size, captures, onRetakeIndex, onEditManually }: ErrorLayerProps) {
  const { t } = useI18n();
  const msgKey = reason === 'ambiguous' ? 'camera.free.errorAmbiguous' : 'camera.free.errorInvalid';
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/85 px-6 text-center">
      <AlertTriangle size={28} className="text-amber-300" />
      <p className="max-w-sm text-sm text-white">{t(msgKey)}</p>
      <p className="text-xs text-white/70">{t('camera.free.errorAction')}</p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {size === 3
          ? URFDLB.map((f, idx) => (
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
            ))
          : captures.map((cap, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onRetakeIndex(idx)}
                disabled={!cap}
                className="flex h-9 min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-md border border-white/30 px-1.5 text-[10px] font-semibold text-white/80 disabled:opacity-30"
              >
                {/* Mini-thumbnail of the captured face so the user can pick
                    by what they see, not by an opaque index. */}
                {cap ? (
                  <div className="grid grid-cols-2 gap-[1px]">
                    {cap.stickers.map((s, j) => (
                      <div
                        key={j}
                        className="h-2 w-2 rounded-[1px]"
                        style={{ backgroundColor: FACE_COLORS[s] }}
                      />
                    ))}
                  </div>
                ) : (
                  <span>{idx + 1}</span>
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
