"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { CritterPick } from "./critters";
import { daylight } from "./daylight";
import { Effects } from "./effects";
import { Garden } from "./garden";
import { COLORS, Landscape } from "./landscape";
import { takeFlight } from "./nav";
import { Figure, RoundTable, type Mood } from "./people";

export type WorldMode = "splash" | "world" | "seated";

// Where the camera is for each mode, plus whatever you've done with it. Splash slowly circles the whole floating
// island (drag to spin it); on the island you orbit, zoom and move about freely (drag to orbit, right-drag or
// shift-drag to move, WASD or the arrow keys to walk, Q and E to turn, double-click to go somewhere, R to come back to
// the table, or the "Go to" buttons); seated is your own eyes across the table from the guide, and you can look around
// (it drifts back to the guide when you let go).
const SPLASH = { radius: 36, height: 21, fov: 38 };
const ISLAND = { target: new THREE.Vector3(0, 0.2, -0.8), az: 0.69, el: 0.47, dist: 15, fov: 40 };
const SEATED = { pos: new THREE.Vector3(0, 1.5, 1.45), pitch: -0.15, reach: 2.6, fov: 46 };
const LIMITS = { el: [0.12, 1.32], dist: [4, 42], yaw: 1.2, pitch: [-0.5, 0.55], zoom: [0.6, 1.25], reach: 11 } as const;

/** What you've done with the camera (kept across mode changes, so the island stays how you left it). */
interface UserView {
  spin: number; // splash: extra turn
  target: THREE.Vector3; // island: the spot on the ground you're looking at, which you can move about
  az: number; // island: orbit around the target
  el: number;
  dist: number;
  yaw: number; // seated: looking around
  pitch: number;
  zoom: number;
  lastDrag: number;
}

const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, v));

function goalFor(mode: WorldMode, t: number, view: UserView, aside: number, pos: THREE.Vector3, look: THREE.Vector3) {
  if (mode === "splash") {
    const a = 0.55 + t * 0.03 + view.spin;
    pos.set(Math.sin(a) * SPLASH.radius, SPLASH.height, Math.cos(a) * SPLASH.radius);
    look.set(0, -1.5, 0);
    return SPLASH.fov;
  }
  if (mode === "world") {
    const { az, el, dist, target } = view;
    look.copy(target);
    pos.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(dist).add(target);
    return ISLAND.fov;
  }
  const p = SEATED.pitch + view.pitch;
  const yaw = view.yaw + aside; // turned a little so the guide sits in the open space beside the side panel
  pos.copy(SEATED.pos);
  look.set(Math.sin(yaw) * Math.cos(p), Math.sin(p), -Math.cos(yaw) * Math.cos(p)).multiplyScalar(SEATED.reach).add(SEATED.pos);
  return SEATED.fov * view.zoom;
}

/** Moves the island view's target by (right, forward) metres as seen from the camera, keeping it on the island. */
function moveTarget(v: UserView, right: number, forward: number) {
  const fx = -Math.sin(v.az), fz = -Math.cos(v.az); // towards the target, along the ground
  v.target.x += Math.cos(v.az) * right + fx * forward;
  v.target.z += -Math.sin(v.az) * right + fz * forward;
  const d = Math.hypot(v.target.x, v.target.z);
  if (d > LIMITS.reach) v.target.multiplyScalar(LIMITS.reach / d).setY(ISLAND.target.y);
}

const typing = () => {
  const el = document.activeElement;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable);
};

/**
 * Drag to orbit (or look around, when seated), scroll to zoom; on the island also right-drag or shift-drag to move,
 * keys to walk and turn, and double-click to go to a spot. Clicks still reach the scene: see `isDrag`. Returns the
 * keys held down, for the camera's frame loop.
 */
function useViewControls(mode: WorldMode, view: React.RefObject<UserView>) {
  const canvas = useThree((s) => s.gl.domElement);
  const camera = useThree((s) => s.camera);
  const held = useRef(new Set<string>());
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
    document.body.style.cursor = mode === "world" ? "grab" : "";
  }, [mode, canvas]);
  useEffect(() => {
    let down: { x: number; y: number; pan: boolean } | null = null;
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey };
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      down = { ...down, x: e.clientX, y: e.clientY };
      const v = view.current, m = modeRef.current;
      v.lastDrag = performance.now();
      if (m === "splash") v.spin -= dx * 0.004;
      else if (m === "world" && down.pan) {
        // grab the ground and slide it: the further out you are, the further it moves
        const k = v.dist * 0.0016;
        moveTarget(v, -dx * k, dy * k);
        document.body.style.cursor = "grabbing";
      } else if (m === "world") {
        v.az -= dx * 0.006;
        v.el = clamp(v.el + dy * 0.004, LIMITS.el);
        document.body.style.cursor = "grabbing";
      } else {
        v.yaw = Math.min(LIMITS.yaw, Math.max(-LIMITS.yaw, v.yaw - dx * 0.004));
        v.pitch = clamp(v.pitch - dy * 0.003, LIMITS.pitch);
      }
    };
    const onUp = () => {
      down = null;
      if (modeRef.current === "world") document.body.style.cursor = "grab";
    };
    const onWheel = (e: WheelEvent) => {
      const v = view.current, m = modeRef.current;
      if (m === "world") v.dist = clamp(v.dist * (1 + e.deltaY * 0.001), LIMITS.dist);
      else if (m === "seated") {
        v.zoom = clamp(v.zoom * (1 + e.deltaY * 0.001), LIMITS.zoom);
        v.lastDrag = performance.now();
      }
    };
    const noMenu = (e: MouseEvent) => e.preventDefault(); // right-drag moves, so no right-click menu over the island
    // double-click: go to that spot on the ground
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ray = new THREE.Raycaster(), hit = new THREE.Vector3();
    const onDoubleClick = (e: MouseEvent) => {
      if (modeRef.current !== "world") return;
      const r = canvas.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      if (!ray.ray.intersectPlane(ground, hit)) return;
      const v = view.current;
      v.target.set(hit.x, ISLAND.target.y, hit.z);
      moveTarget(v, 0, 0); // keeps it on the island
      v.dist = Math.min(v.dist, 10);
    };
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (e.type === "keyup") return void held.current.delete(key);
      if (modeRef.current !== "world" || typing() || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!["w", "a", "s", "d", "q", "e", "arrowup", "arrowdown", "arrowleft", "arrowright", "r", "+", "=", "-"].includes(key)) return;
      e.preventDefault();
      if (key === "r") {
        const v = view.current;
        v.target.copy(ISLAND.target);
        v.az = ISLAND.az;
        v.el = ISLAND.el;
        v.dist = ISLAND.dist;
      } else held.current.add(key);
    };
    const onBlur = () => held.current.clear();
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: true });
    canvas.addEventListener("contextmenu", noMenu);
    canvas.addEventListener("dblclick", onDoubleClick);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", onBlur);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", noMenu);
      canvas.removeEventListener("dblclick", onDoubleClick);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", onBlur);
    };
  }, [canvas, camera, view]);
  return held;
}

/** Walks, turns and zooms the island view while keys are held. */
function applyKeys(v: UserView, keys: Set<string>, dt: number) {
  if (!keys.size) return;
  const step = v.dist * 0.45 * dt, has = (...k: string[]) => k.some((x) => keys.has(x));
  moveTarget(v, (has("d", "arrowright") ? step : 0) - (has("a", "arrowleft") ? step : 0), (has("w", "arrowup") ? step : 0) - (has("s", "arrowdown") ? step : 0));
  v.az += ((has("q") ? 1 : 0) - (has("e") ? 1 : 0)) * 1.3 * dt;
  v.dist = clamp(v.dist * (1 + ((has("-") ? 1 : 0) - (has("+", "=") ? 1 : 0)) * 1.2 * dt), LIMITS.dist);
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function CameraRig({ mode, aside, onArrive }: { mode: WorldMode; aside: number; onArrive: (mode: WorldMode) => void }) {
  const look = useRef(new THREE.Vector3(0, 0.9, 0));
  const view = useRef<UserView>({ spin: 0, target: ISLAND.target.clone(), az: ISLAND.az, el: ISLAND.el, dist: ISLAND.dist, yaw: 0, pitch: 0, zoom: 1, lastDrag: 0 });
  const keys = useViewControls(mode, view);
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

  useFrame(({ clock, camera }, dt) => {
    const cam = camera as THREE.PerspectiveCamera;
    const g = goal.current;
    const v = view.current;
    const flight = takeFlight();
    if (flight && mode === "world") {
      v.target.set(flight.x, ISLAND.target.y, flight.z);
      v.dist = flight.dist;
    }
    if (mode === "world") applyKeys(v, keys.current, Math.min(dt, 0.05));
    // seated: a few seconds after you stop looking around, your gaze drifts back to the guide
    if (mode === "seated" && performance.now() - v.lastDrag > 4000) {
      const f = Math.min(1, dt * 1.5);
      v.yaw -= v.yaw * f;
      v.pitch -= v.pitch * f;
      v.zoom += (1 - v.zoom) * f;
    }
    const fov = goalFor(mode, clock.getElapsedTime(), v, aside, g.pos, g.look);
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

// golden afternoon → sunset, for the lights and fog. The colours are chosen as pairs: a warm sun against a cool,
// lavender sky light, so lit sides glow gold and shaded sides fall to soft violet-blue (the shader-pack look).
const DAY = {
  sky: new THREE.Color("#b8c4f2"), ground: new THREE.Color("#b3c27a"), sun: new THREE.Color("#ffd9a6"), fill: new THREE.Color("#ffd8cc"), fog: new THREE.Color(COLORS.fog),
};
const SUNSET = {
  sky: new THREE.Color("#c7a6e6"), ground: new THREE.Color("#a07a6a"), sun: new THREE.Color("#ffab78"), fill: new THREE.Color("#ffb6c2"), fog: new THREE.Color(COLORS.fogSunset),
};
const SUN_POS = new THREE.Vector3(-11, 10, -13); // low, behind the guide: long shadows, warm rim light

/** The sun, sky light and fog, easing from afternoon to sunset (over ~4 s) and back. */
function DayCycle({ evening }: { evening: boolean }) {
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const fill = useRef<THREE.DirectionalLight>(null);
  const scene = useThree((s) => s.scene);
  useFrame((_, dt) => {
    daylight.evening += ((evening ? 1 : 0) - daylight.evening) * Math.min(1, dt * 0.6);
    const e = daylight.evening;
    if (hemi.current) {
      hemi.current.color.copy(DAY.sky).lerp(SUNSET.sky, e);
      hemi.current.groundColor.copy(DAY.ground).lerp(SUNSET.ground, e);
      hemi.current.intensity = 1.1 - e * 0.15;
    }
    if (sun.current) {
      sun.current.color.copy(DAY.sun).lerp(SUNSET.sun, e);
      sun.current.intensity = 2.3 - e * 0.5;
      sun.current.position.set(SUN_POS.x, SUN_POS.y - e * 6, SUN_POS.z); // lower still at sunset, longer shadows
    }
    if (fill.current) {
      fill.current.color.copy(DAY.fill).lerp(SUNSET.fill, e);
      fill.current.intensity = 0.35;
    }
    if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(DAY.fog).lerp(SUNSET.fog, e);
  });
  return (
    <>
      <hemisphereLight ref={hemi} args={[DAY.sky, DAY.ground, 1.1]} />
      {/* the low sun, behind the guide, so the figures get a warm rim and shadows fall towards you */}
      <directionalLight
        ref={sun}
        position={SUN_POS.toArray()}
        intensity={2.3}
        color={DAY.sun}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-camera-far={80}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={5}
        shadow-blurSamples={12}
      />
      {/* a faint warm bounce from your side, so faces aren't lost in shadow */}
      <directionalLight ref={fill} position={[8, 6, 10]} intensity={0.35} color={DAY.fill} />
    </>
  );
}

export default function WorldScene({
  mode,
  mood,
  yourTurn,
  evening,
  aside = 0,
  garden,
  critter,
  onPickCritter,
  onPokePip,
  onSit,
  onArrive,
}: {
  mode: WorldMode;
  /** What the guide is doing, for its body language. */
  mood: Mood;
  /** Your turn to answer: the lantern on the table glows. */
  yourTurn: boolean;
  /** You've finished: the sun sets and the fireflies come out. */
  evening: boolean;
  /** Seated: how far (radians) to turn right, so the guide shows beside the side panel rather than behind it. */
  aside?: number;
  /** What you've grown on the island by practising; items from `freshFrom` on pop in. */
  garden: { count: number; freshFrom: number };
  /** The pond creature you've clicked on (on the island only), if any. */
  critter: CritterPick | null;
  onPickCritter: (pick: CritterPick) => void;
  onPokePip: () => void;
  onSit: () => void;
  onArrive: (mode: WorldMode) => void;
}) {
  return (
    <Canvas
      // variance shadow maps: soft, blurred shadow edges (three no longer has soft PCF)
      shadows="variance"
      // neutral tone mapping keeps the pastels saturated (the default ACES washes them out)
      gl={{ toneMapping: THREE.NeutralToneMapping }}
      dpr={[1, 1.5]} // the effects chain is per pixel; 1.5x is plenty
      camera={{ position: [Math.sin(0.55) * SPLASH.radius, SPLASH.height, Math.cos(0.55) * SPLASH.radius], fov: SPLASH.fov, near: 0.05, far: 900 }}
      onPointerMissed={() => (document.body.style.cursor = "")}
    >
      <fog attach="fog" args={[COLORS.fog, 45, 170]} />
      <DayCycle evening={evening} />

      <Landscape critters={{ interactive: mode === "world", picked: critter, onPick: onPickCritter }} />
      <Garden count={garden.count} freshFrom={garden.freshFrom} />
      <RoundTable interactive={mode === "world"} yourTurn={yourTurn || evening} onSelect={onSit} />
      <Figure position={[0, 0, -1.15]} rotationY={0} outfit="guide" mood={mood} onPoke={onPokePip} />
      <Figure position={[0, 0, 1.15]} rotationY={Math.PI} outfit="you" firstPerson />

      <CameraRig mode={mode} aside={aside} onArrive={onArrive} />
      <Effects />
    </Canvas>
  );
}
