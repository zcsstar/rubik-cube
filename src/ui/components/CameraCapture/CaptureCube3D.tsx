import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CubeSize } from '@core/cube/ICube';
import type { FaceLetter } from '@core/cube/colors';
import { FACE_COLORS } from '@core/cube/colors';
import { buildCubies, type Cubie } from '@ui/components/CubeViewer3D/cubies';

/**
 * 3D cube guide for the camera-capture flow. Shows captured-face stickers in
 * their detected colours and not-yet-captured faces as a neutral placeholder,
 * then animates the cube so the active face rotates toward the camera. Gives
 * the user a clear "this is what you've recorded so far + this is the next
 * face to show" mental model without leaving the camera screen.
 */
export interface CaptureCube3DProps {
  size: CubeSize;
  /**
   * For each face, the per-sticker letters in row-major order (length size*size)
   * if the face has been captured, or null if it hasn't yet.
   */
  captures: Record<FaceLetter, FaceLetter[] | null>;
  /** The face the user is about to capture next; cube animates to face it. */
  activeFace: FaceLetter;
  className?: string;
}

const STICKER_GAP = 0.1;
const STICKER_CORNER_RADIUS_RATIO = 0.14;

/**
 * Whole-cube rotation that brings each face to the +Z position (the position
 * most-aligned with the camera at [2.4, 2.0, 2.8]). Verified by composing with
 * the FRAME_NEIGHBOURS map in CameraCapture: after rotation, the +Y / +X
 * positions hold the same neighbours that the cross-net guide would show.
 */
const FACE_TO_FRONT_ROTATION: Record<FaceLetter, [number, number, number]> = {
  F: [0, 0, 0],
  B: [0, Math.PI, 0],
  R: [0, -Math.PI / 2, 0],
  L: [0, Math.PI / 2, 0],
  U: [Math.PI / 2, 0, 0],
  D: [-Math.PI / 2, 0, 0],
};

const PLACEHOLDER_COLOR = '#475569'; // slate-600 — reads as "no data yet"
const ACTIVE_HIGHLIGHT_COLOR = '#fde68a'; // amber-200 — soft pulsing edge on the target face

const FACE_OFFSETS: Record<FaceLetter, [number, number, number]> = {
  U: [0, 1, 0],
  D: [0, -1, 0],
  R: [1, 0, 0],
  L: [-1, 0, 0],
  F: [0, 0, 1],
  B: [0, 0, -1],
};

const FACE_ROTATIONS: Record<FaceLetter, [number, number, number]> = {
  U: [-Math.PI / 2, 0, 0],
  D: [Math.PI / 2, 0, 0],
  F: [0, 0, 0],
  B: [0, Math.PI, 0],
  R: [0, Math.PI / 2, 0],
  L: [0, -Math.PI / 2, 0],
};

function makeRoundedSquareShape(side: number, radius: number): THREE.Shape {
  const w = side / 2;
  const r = Math.min(radius, w);
  const s = new THREE.Shape();
  s.moveTo(-w + r, -w);
  s.lineTo(w - r, -w);
  s.quadraticCurveTo(w, -w, w, -w + r);
  s.lineTo(w, w - r);
  s.quadraticCurveTo(w, w, w - r, w);
  s.lineTo(-w + r, w);
  s.quadraticCurveTo(-w, w, -w, w - r);
  s.lineTo(-w, -w + r);
  s.quadraticCurveTo(-w, -w, -w + r, -w);
  return s;
}

/**
 * Synthesize a facelet string for buildCubies. Captured faces use their real
 * detected letters; uncaptured faces use a placeholder (the face's own letter,
 * which we then re-color to neutral grey via the per-cubie sticker render).
 *
 * We need a separate "is captured" lookup because once the user paints e.g.
 * white on the U face, we can't distinguish "captured-as-white" from
 * "placeholder-using-U-letter" by the letter alone.
 */
function buildCaptureFacelets(
  size: CubeSize,
  captures: Record<FaceLetter, FaceLetter[] | null>,
): { facelets: string; faceCaptured: Record<FaceLetter, boolean> } {
  const order: readonly FaceLetter[] = ['U', 'R', 'F', 'D', 'L', 'B'];
  const perFace = size * size;
  const out: string[] = [];
  const faceCaptured = {} as Record<FaceLetter, boolean>;
  for (const f of order) {
    const cap = captures[f];
    faceCaptured[f] = cap !== null;
    if (cap) {
      out.push(...cap);
    } else {
      for (let i = 0; i < perFace; i++) out.push(f);
    }
  }
  return { facelets: out.join(''), faceCaptured };
}

interface CubieMeshProps {
  cubie: Cubie;
  cubieSize: number;
  faceCaptured: Record<FaceLetter, boolean>;
  activeFace: FaceLetter;
}

function CubieMesh({ cubie, cubieSize, faceCaptured, activeFace }: CubieMeshProps) {
  const stickerSide = cubieSize * (1 - STICKER_GAP);
  const stickerShape = useMemo(
    () => makeRoundedSquareShape(stickerSide, stickerSide * STICKER_CORNER_RADIUS_RATIO),
    [stickerSide],
  );
  return (
    <group position={cubie.position}>
      <mesh>
        <boxGeometry args={[cubieSize, cubieSize, cubieSize]} />
        <meshStandardMaterial color="#0b0b0b" roughness={0.6} metalness={0.05} />
      </mesh>
      {(Object.entries(cubie.stickers) as [FaceLetter, FaceLetter][]).map(([face, color]) => {
        const offset = FACE_OFFSETS[face];
        const captured = faceCaptured[face];
        const isActive = face === activeFace;
        // Active face: lifted slightly + colour mixed toward amber, so the
        // target reads as "the next thing to do" without obscuring its colour.
        const lift = cubieSize / 2 + 0.001 + (isActive ? 0.012 : 0);
        const baseColor = captured ? FACE_COLORS[color] : PLACEHOLDER_COLOR;
        const stickerColor = isActive
          ? new THREE.Color(baseColor).lerp(new THREE.Color(ACTIVE_HIGHLIGHT_COLOR), 0.35)
          : new THREE.Color(baseColor);
        return (
          <mesh
            key={face}
            position={[offset[0] * lift, offset[1] * lift, offset[2] * lift]}
            rotation={FACE_ROTATIONS[face]}
          >
            <shapeGeometry args={[stickerShape]} />
            <meshBasicMaterial color={stickerColor} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
}

interface SceneProps {
  size: CubeSize;
  facelets: string;
  faceCaptured: Record<FaceLetter, boolean>;
  activeFace: FaceLetter;
}

function Scene({ size, facelets, faceCaptured, activeFace }: SceneProps) {
  const groupRef = useRef<THREE.Group>(null);
  const targetQuat = useMemo(() => {
    const e = new THREE.Euler(...FACE_TO_FRONT_ROTATION[activeFace]);
    return new THREE.Quaternion().setFromEuler(e);
  }, [activeFace]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    // Slerp current rotation toward target. Rate tuned so 90° rotations land
    // in ~500ms — fast enough to feel responsive, slow enough to read.
    const rate = Math.min(1, delta * 6);
    groupRef.current.quaternion.slerp(targetQuat, rate);
  });

  const cubies = useMemo(() => buildCubies(facelets, size), [facelets, size]);
  const cubieSize = 1 / size;

  return (
    <group ref={groupRef}>
      {cubies.map((c) => (
        <CubieMesh
          key={`${c.i},${c.j},${c.k}`}
          cubie={c}
          cubieSize={cubieSize}
          faceCaptured={faceCaptured}
          activeFace={activeFace}
        />
      ))}
    </group>
  );
}

export function CaptureCube3D({ size, captures, activeFace, className }: CaptureCube3DProps) {
  const { facelets, faceCaptured } = useMemo(
    () => buildCaptureFacelets(size, captures),
    [size, captures],
  );
  return (
    <div
      className={className ?? 'h-[220px] w-full'}
      // Let vertical page scroll pass through on touch devices — there's no
      // OrbitControls here, so swallowing touch would only block scrolling.
      style={{ touchAction: 'pan-y' }}
    >
      <Canvas flat camera={{ position: [2.0, 1.7, 2.4], fov: 35 }} dpr={[1, 2]}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.85} />
          <directionalLight position={[5, 8, 6]} intensity={0.85} />
          <directionalLight position={[-4, -2, -3]} intensity={0.3} />
          <Scene
            size={size}
            facelets={facelets}
            faceCaptured={faceCaptured}
            activeFace={activeFace}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
