import { useMemo, Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { CubeSize } from '@core/cube/ICube';
import type { FaceLetter } from '@core/cube/colors';
import { FACE_COLORS } from '@core/cube/colors';
import type { Move } from '@core/cube/moves';
import {
  buildCubies,
  cubieInSlice,
  rotationForMove,
  type Cubie,
} from './cubies';

export interface CubeAnimation {
  /** The move whose slice is rotating. */
  move: Move;
  /** Animation duration in ms. Default 280. */
  durationMs?: number;
}

export interface CubeViewer3DProps {
  /**
   * Facelet string the viewer renders. While `animation` is non-null, this is
   * interpreted as the PRE-move state — the slice rotates visually, and the
   * parent should update `facelets` to the post-move state when the viewer
   * fires `onAnimationEnd`.
   */
  facelets: string;
  size: CubeSize;
  animation?: CubeAnimation | null;
  onAnimationEnd?: () => void;
  colors?: Record<FaceLetter, string>;
  className?: string;
}

const STICKER_GAP = 0.1; // fraction of cubie face left as black plastic
const STICKER_CORNER_RADIUS_RATIO = 0.14; // sticker corner radius as fraction of side

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

interface CubieMeshProps {
  cubie: Cubie;
  cubieSize: number;
  colors: Record<FaceLetter, string>;
}

function CubieMesh({ cubie, cubieSize, colors }: CubieMeshProps) {
  const stickerSide = cubieSize * (1 - STICKER_GAP);
  const stickerShape = useMemo(
    () => makeRoundedSquareShape(stickerSide, stickerSide * STICKER_CORNER_RADIUS_RATIO),
    [stickerSide],
  );
  // Render a black body box with rounded sticker shapes flush on each outward face.
  return (
    <group position={cubie.position}>
      <mesh>
        <boxGeometry args={[cubieSize, cubieSize, cubieSize]} />
        <meshStandardMaterial color="#0b0b0b" roughness={0.6} metalness={0.05} />
      </mesh>
      {(Object.entries(cubie.stickers) as [FaceLetter, FaceLetter][]).map(([face, color]) => {
        const offset = FACE_OFFSETS[face];
        const lift = cubieSize / 2 + 0.001;
        return (
          <mesh
            key={face}
            position={[offset[0] * lift, offset[1] * lift, offset[2] * lift]}
            rotation={FACE_ROTATIONS[face]}
          >
            <shapeGeometry args={[stickerShape]} />
            <meshBasicMaterial color={colors[color] ?? '#888'} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
}

interface RotatingSliceProps {
  axis: [number, number, number];
  targetAngle: number;
  durationMs: number;
  onDone: () => void;
  children: React.ReactNode;
}

function RotatingSlice({ axis, targetAngle, durationMs, onDone, children }: RotatingSliceProps) {
  const groupRef = useRef<THREE.Group>(null);
  const elapsedRef = useRef(0);
  const doneRef = useRef(false);
  const axisVec = useMemo(() => new THREE.Vector3(...axis).normalize(), [axis]);

  useFrame((_, delta) => {
    if (doneRef.current || !groupRef.current) return;
    elapsedRef.current += delta * 1000;
    const t = Math.min(1, elapsedRef.current / durationMs);
    // ease-out-cubic for a snappy-but-smooth feel
    const eased = 1 - Math.pow(1 - t, 3);
    groupRef.current.setRotationFromAxisAngle(axisVec, targetAngle * eased);
    if (t >= 1) {
      doneRef.current = true;
      // Defer the parent's state update to avoid re-rendering inside useFrame.
      queueMicrotask(onDone);
    }
  });

  return <group ref={groupRef}>{children}</group>;
}

function Scene({
  facelets,
  size,
  animation,
  onAnimationEnd,
  colors,
}: Required<Pick<CubeViewer3DProps, 'facelets' | 'size'>> & {
  animation: CubeAnimation | null | undefined;
  onAnimationEnd: (() => void) | undefined;
  colors: Record<FaceLetter, string>;
}) {
  const cubies = useMemo(() => buildCubies(facelets, size), [facelets, size]);
  const cubieSize = 1 / size;

  if (!animation) {
    return (
      <>
        {cubies.map((c) => (
          <CubieMesh key={`${c.i},${c.j},${c.k}`} cubie={c} cubieSize={cubieSize} colors={colors} />
        ))}
      </>
    );
  }

  const slice = cubies.filter((c) => cubieInSlice(c, animation.move, size));
  const rest = cubies.filter((c) => !cubieInSlice(c, animation.move, size));
  const { axis, angle } = rotationForMove(animation.move);

  return (
    <>
      {rest.map((c) => (
        <CubieMesh key={`${c.i},${c.j},${c.k}`} cubie={c} cubieSize={cubieSize} colors={colors} />
      ))}
      <RotatingSlice
        // Re-mount on move change so animation restarts cleanly.
        key={`anim-${animation.move.face}${animation.move.modifier}-${facelets.length}-${facelets.slice(0, 6)}`}
        axis={axis}
        targetAngle={angle}
        durationMs={animation.durationMs ?? 280}
        onDone={onAnimationEnd ?? (() => {})}
      >
        {slice.map((c) => (
          <CubieMesh key={`${c.i},${c.j},${c.k}`} cubie={c} cubieSize={cubieSize} colors={colors} />
        ))}
      </RotatingSlice>
    </>
  );
}

export function CubeViewer3D({
  facelets,
  size,
  animation,
  onAnimationEnd,
  colors = FACE_COLORS,
  className,
}: CubeViewer3DProps) {
  return (
    <div
      className={className ?? 'h-[360px] w-full'}
      // Let vertical page scroll pass through the canvas on touch devices.
      // OrbitControls still rotates the cube on horizontal / two-finger drag.
      style={{ touchAction: 'pan-y' }}
    >
      <Canvas flat camera={{ position: [2.4, 2.0, 2.8], fov: 35 }} dpr={[1, 2]}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[5, 8, 6]} intensity={0.85} />
          <directionalLight position={[-4, -2, -3]} intensity={0.3} />
          <Scene
            facelets={facelets}
            size={size}
            animation={animation}
            onAnimationEnd={onAnimationEnd}
            colors={colors}
          />
          <OrbitControls
            enablePan={false}
            enableZoom={false}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI - Math.PI / 6}
            rotateSpeed={0.7}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
