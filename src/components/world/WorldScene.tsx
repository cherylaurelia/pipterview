"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { COLORS, Landscape } from "./landscape";
import { Figure, RoundTable } from "./people";

export type WorldMode = "splash" | "world" | "seated";

// Where the camera is for each mode. Splash slowly circles the table; world is the wide view from the wireframes;
// seated is your own eyes, across the table from the guide.
const OVERVIEW = { pos: new THREE.Vector3(5.2, 2.9, 4.8), look: new THREE.Vector3(0, 0.75, 0), fov: 40 };
const SEATED = { pos: new THREE.Vector3(0, 1.5, 1.45), look: new THREE.Vector3(0, 1.1, -1.15), fov: 46 };

function goalFor(mode: WorldMode, t: number, pointer: THREE.Vector2, pos: THREE.Vector3, look: THREE.Vector3) {
  if (mode === "splash") {
    const a = 0.55 + t * 0.045;
    pos.set(Math.sin(a) * 10.5, 4.4, Math.cos(a) * 10.5);
    look.set(0, 0.9, 0);
    return 40;
  }
  if (mode === "world") {
    // a little parallax with the pointer, so the scene feels alive
    pos.copy(OVERVIEW.pos).add(new THREE.Vector3(pointer.x * 0.5, pointer.y * 0.25, -pointer.x * 0.35));
    look.copy(OVERVIEW.look);
    return OVERVIEW.fov;
  }
  // seated: look around a touch with the pointer, like turning your head
  pos.copy(SEATED.pos);
  look.copy(SEATED.look).add(new THREE.Vector3(pointer.x * 0.35, pointer.y * 0.15, 0));
  return SEATED.fov;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function CameraRig({ mode, onArrive }: { mode: WorldMode; onArrive: (mode: WorldMode) => void }) {
  const look = useRef(new THREE.Vector3(0, 0.9, 0));
  const goal = useRef({ pos: new THREE.Vector3(), look: new THREE.Vector3() });
  // a flight in progress; `from` is filled in on its first frame, from wherever the camera is then
  const tween = useRef<{ t0: number; dur: number; from: { pos: THREE.Vector3; look: THREE.Vector3; fov: number } | null } | null>(null);
  const arrive = useRef(onArrive);
  useEffect(() => {
    arrive.current = onArrive;
  }, [onArrive]);

  // every mode change is a flight: from wherever the camera is now to the new mode's pose
  useEffect(() => {
    tween.current = { t0: performance.now(), dur: mode === "splash" ? 900 : 1700, from: null };
  }, [mode]);

  useFrame(({ clock, camera, pointer }, dt) => {
    const cam = camera as THREE.PerspectiveCamera;
    const g = goal.current;
    const fov = goalFor(mode, clock.getElapsedTime(), pointer, g.pos, g.look);
    const tw = tween.current;
    if (tw) {
      tw.from ??= { pos: cam.position.clone(), look: look.current.clone(), fov: cam.fov };
      const from = tw.from;
      const k = ease(Math.min(1, (performance.now() - tw.t0) / tw.dur));
      cam.position.lerpVectors(from.pos, g.pos, k);
      look.current.lerpVectors(from.look, g.look, k);
      // arc up a little mid-flight, so going to your seat feels like stepping in rather than sliding
      cam.position.y += Math.sin(Math.PI * k) * (mode === "seated" ? 0.6 : 0.3);
      cam.fov = from.fov + (fov - from.fov) * k;
      if (k >= 1) {
        tween.current = null;
        arrive.current(mode);
      }
    } else {
      const f = 1 - Math.exp(-Math.min(dt, 0.05) * 3.5);
      cam.position.lerp(g.pos, f);
      look.current.lerp(g.look, f);
      cam.fov += (fov - cam.fov) * f;
    }
    cam.lookAt(look.current);
    cam.updateProjectionMatrix();
  });
  return null;
}

export default function WorldScene({
  mode,
  speaking,
  onSit,
  onArrive,
}: {
  mode: WorldMode;
  /** The guide is talking (nods and gestures). */
  speaking: boolean;
  onSit: () => void;
  onArrive: (mode: WorldMode) => void;
}) {
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 2]}
      camera={{ position: [Math.sin(0.55) * 10.5, 4.4, Math.cos(0.55) * 10.5], fov: 40, near: 0.05, far: 900 }}
      onPointerMissed={() => (document.body.style.cursor = "")}
    >
      <fog attach="fog" args={[COLORS.fog, 35, 280]} />
      <hemisphereLight args={["#dbe8ff", "#7d9a55", 1.6]} />
      {/* the low evening sun, behind the guide, so the figures get a warm rim and shadows fall towards you */}
      <directionalLight
        position={[-10, 18, -14]}
        intensity={2.2}
        color="#ffe2c4"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[8, 6, 10]} intensity={1.5} color="#fff4e8" />

      <Landscape />
      <RoundTable interactive={mode === "world"} onSelect={onSit} />
      <Figure position={[0, 0, -1.15]} rotationY={0} outfit="guide" speaking={speaking} />
      <Figure position={[0, 0, 1.15]} rotationY={Math.PI} outfit="you" firstPerson />

      <CameraRig mode={mode} onArrive={onArrive} />
    </Canvas>
  );
}
