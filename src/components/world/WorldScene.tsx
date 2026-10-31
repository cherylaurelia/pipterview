"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { CritterPick } from "./critters";
import { daylight } from "./daylight";
import { Effects } from "./effects";
import { Garden } from "./garden";
import { COLORS, CROWNS, GRASS_LAYER, Landscape } from "./landscape";
import { goHomeSpot, held, player, walkTo, type Nearby } from "./explore";
import { surfaceY } from "./island";
import { Figure, RoundTable, type Mood } from "./people";
import { Player, TableMarker } from "./player";
import { reducedMotion } from "./quality";

export type WorldMode = "splash" | "world" | "seated";

// Where the camera is for each mode, plus whatever you've done with it. Splash slowly circles the whole floating
// island (drag to spin it). On the island you walk about as your own chick (see player.tsx) and the camera follows
// just behind and above you: drag to look round, scroll to come closer or stand back. Seated is your own eyes across
// the table from the guide, and you can look around (it drifts back to the guide when you let go).
const SPLASH = { radius: 36, height: 21, fov: 38 };
const ISLAND = { az: 0.37, el: 0.42, dist: 6.5, fov: 45, lift: 0.7 };
const SEATED = { pos: new THREE.Vector3(0, 1.5, 1.45), pitch: -0.15, reach: 2.6, fov: 46 };
const LIMITS = { el: [0.12, 1.25], dist: [2.5, 18], yaw: 1.2, pitch: [-0.5, 0.55], zoom: [0.6, 1.25] } as const;

/** What you've done with the camera (kept across mode changes, so the island stays how you left it). */
interface UserView {
  spin: number; // splash: extra turn
  az: number; // island: orbit around you
  el: number;
  dist: number;
  yaw: number; // seated: looking around
  pitch: number;
  zoom: number;
  lastDrag: number;
}

const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, v));

/** How far along from `from` to `to` (0 to 1) the line first enters a tree crown or other camera blocker; 1 if never. */
function blockedAt(from: THREE.Vector3, to: THREE.Vector3) {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z, len2 = dx * dx + dy * dy + dz * dz;
  let nearest = 1;
  for (const c of CROWNS) {
    const ox = from.x - c.x, oy = from.y - c.y, oz = from.z - c.z;
    const b = (ox * dx + oy * dy + oz * dz) / len2, cc = (ox * ox + oy * oy + oz * oz - c.r * c.r) / len2, disc = b * b - cc;
    if (disc <= 0) continue;
    const t = -b - Math.sqrt(disc);
    if (t > 0 && t < nearest) nearest = t;
  }
  return nearest;
}

function goalFor(mode: WorldMode, t: number, view: UserView, aside: number, pos: THREE.Vector3, look: THREE.Vector3) {
  if (mode === "splash") {
    const a = 0.55 + (reducedMotion() ? 0 : t * 0.03) + view.spin; // a slow orbit, unless you've asked for less motion
    pos.set(Math.sin(a) * SPLASH.radius, SPLASH.height, Math.cos(a) * SPLASH.radius);
    look.set(0, -1.5, 0);
    return SPLASH.fov;
  }
  if (mode === "world") {
    const { az, el, dist } = view;
    look.set(player.pos.x, surfaceY(player.pos.x, player.pos.z) + ISLAND.lift, player.pos.z);
    // if a tree (or Pip, or the table) is between you and the camera, the camera rises over it, and only if that's not
    // enough does it come in closer, rather than sitting inside the leaves
    let nearest = 1;
    for (const lift of [0, 0.18, 0.36, 0.54]) {
      const e = Math.min(LIMITS.el[1], el + lift);
      pos.set(Math.sin(az) * Math.cos(e), Math.sin(e), Math.cos(az) * Math.cos(e)).multiplyScalar(dist).add(look);
      nearest = blockedAt(look, pos);
      if (nearest >= 1) break;
    }
    if (nearest < 1) pos.lerpVectors(look, pos, Math.max(0.3, nearest - 0.06));
    return ISLAND.fov;
  }
  const p = SEATED.pitch + view.pitch;
  const yaw = view.yaw + aside; // turned a little so the guide sits in the open space beside the side panel
  pos.copy(SEATED.pos);
  look.set(Math.sin(yaw) * Math.cos(p), Math.sin(p), -Math.cos(yaw) * Math.cos(p)).multiplyScalar(SEATED.reach).add(SEATED.pos);
  return SEATED.fov * view.zoom;
}

const typing = () => {
  const el = document.activeElement;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable);
};

const WALK_KEYS = ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"];

/**
 * Drag to look around, scroll to zoom. On the island, the walking keys go to your chick (R takes you back to the
 * table), and a click or tap on the ground (not a drag, and not on something clickable) walks you there: see
 * `clickToWalk`, which the canvas calls when a click misses everything clickable.
 */
function useViewControls(mode: WorldMode, view: React.RefObject<UserView>) {
  const canvas = useThree((s) => s.gl.domElement);
  const camera = useThree((s) => s.camera);
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
    document.body.style.cursor = "";
    if (mode !== "world") held.clear();
  }, [mode, canvas]);
  useEffect(() => {
    let down: { x: number; y: number } | null = null, pressedAt = { x: 0, y: 0 };
    // two fingers on a touch screen: pinch to zoom (and no orbiting or walking while they're down)
    const touches = new Map<number, { x: number; y: number }>();
    let pinch: { span: number; dist: number; zoom: number } | null = null;
    const span = () => {
      const [a, b] = [...touches.values()];
      return Math.hypot(a.x - b.x, a.y - b.y) || 1;
    };
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
      pressedAt = { ...down };
      if (e.pointerType !== "touch") return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) {
        pinch = { span: span(), dist: view.current.dist, zoom: view.current.zoom };
        down = null;
        pressedAt = { x: -1e9, y: -1e9 }; // a pinch is never a tap-to-walk
      }
    };
    const onMove = (e: PointerEvent) => {
      if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && touches.size >= 2) {
        const v = view.current, k = pinch.span / span();
        if (modeRef.current === "world") v.dist = clamp(pinch.dist * k, LIMITS.dist);
        else if (modeRef.current === "seated") {
          v.zoom = clamp(pinch.zoom * k, LIMITS.zoom);
          v.lastDrag = performance.now();
        }
        return;
      }
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      down = { x: e.clientX, y: e.clientY };
      const v = view.current, m = modeRef.current;
      v.lastDrag = performance.now();
      if (m === "splash") v.spin -= dx * 0.004;
      else if (m === "world") {
        v.az -= dx * 0.006;
        v.el = clamp(v.el + dy * 0.004, LIMITS.el);
      } else {
        v.yaw = Math.min(LIMITS.yaw, Math.max(-LIMITS.yaw, v.yaw - dx * 0.004));
        v.pitch = clamp(v.pitch - dy * 0.003, LIMITS.pitch);
      }
    };
    const onUp = (e: PointerEvent) => {
      down = null;
      touches.delete(e.pointerId);
      if (touches.size < 2) pinch = null;
    };
    const onWheel = (e: WheelEvent) => {
      const v = view.current, m = modeRef.current;
      if (m === "world") v.dist = clamp(v.dist * (1 + e.deltaY * 0.001), LIMITS.dist);
      else if (m === "seated") {
        v.zoom = clamp(v.zoom * (1 + e.deltaY * 0.001), LIMITS.zoom);
        v.lastDrag = performance.now();
      }
    };
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ray = new THREE.Raycaster(), hit = new THREE.Vector3();
    clickToWalk.current = (e: MouseEvent) => {
      if (modeRef.current !== "world" || Math.hypot(e.clientX - pressedAt.x, e.clientY - pressedAt.y) > 6) return;
      const r = canvas.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      if (ray.ray.intersectPlane(ground, hit) && Math.hypot(hit.x, hit.z) < 13) walkTo(hit.x, hit.z);
    };
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (e.type === "keyup") return void held.delete(key);
      if (modeRef.current !== "world" || typing() || e.metaKey || e.ctrlKey || e.altKey) return;
      if (key === "r") return goHomeSpot();
      if (!WALK_KEYS.includes(key)) return;
      e.preventDefault();
      held.add(key);
    };
    const onBlur = () => held.clear();
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", onBlur);
    return () => {
      clickToWalk.current = null;
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", onBlur);
    };
  }, [canvas, camera, view]);
}

/** Pip keeps an eye on you while you're out on the island. */
const watchPlayer = () => player.pos;

/** Set by the controls (inside the canvas), called by the canvas when a click lands on nothing clickable. */
const clickToWalk: { current: ((e: MouseEvent) => void) | null } = { current: null };

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function CameraRig({ mode, aside, onArrive }: { mode: WorldMode; aside: number; onArrive: (mode: WorldMode) => void }) {
  const look = useRef(new THREE.Vector3(0, 0.9, 0));
  const view = useRef<UserView>({ spin: 0, az: ISLAND.az, el: ISLAND.el, dist: ISLAND.dist, yaw: 0, pitch: 0, zoom: 1, lastDrag: 0 });
  useViewControls(mode, view);
  const camera = useThree((s) => s.camera);
  useEffect(() => void camera.layers.enable(GRASS_LAYER), [camera]);
  const goal = useRef({ pos: new THREE.Vector3(), look: new THREE.Vector3() });
  // a flight in progress; `from` is filled in on its first frame, from wherever the camera is then
  const tween = useRef<{ t0: number; dur: number; from: { pos: THREE.Vector3; look: THREE.Vector3; fov: number } | null } | null>(null);
  const arrive = useRef(onArrive);
  useEffect(() => {
    arrive.current = onArrive;
  }, [onArrive]);

  // every mode change is a flight: from wherever the camera is now to the new mode's pose
  useEffect(() => {
    // reduced motion: a cut rather than a flight
    tween.current = { t0: performance.now(), dur: reducedMotion() ? 1 : mode === "splash" ? 900 : 1700, from: null };
  }, [mode]);

  useFrame(({ clock, camera }, dt) => {
    const cam = camera as THREE.PerspectiveCamera;
    const g = goal.current;
    const v = view.current;
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
      const f = 1 - Math.exp(-Math.min(dt, 0.05) * (mode === "world" ? 6 : 3.5)); // follows you closely when walking
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
  sky: new THREE.Color("#d2d3ee"), ground: new THREE.Color("#c2c98a"), sun: new THREE.Color("#ffd9a6"), fill: new THREE.Color("#ffd8cc"), fog: new THREE.Color(COLORS.fog),
};
const SUNSET = {
  sky: new THREE.Color("#c7a6e6"), ground: new THREE.Color("#a07a6a"), sun: new THREE.Color("#ffab78"), fill: new THREE.Color("#ffb6c2"), fog: new THREE.Color(COLORS.fogSunset),
};
const SUN_POS = new THREE.Vector3(-11, 15, -13); // fairly low, behind the guide: soft shadows that don't swallow the island, warm rim light

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
      hemi.current.intensity = 1.4 - e * 0.25; // a strong, warm sky light, so shade stays soft rather than murky
    }
    if (sun.current) {
      sun.current.color.copy(DAY.sun).lerp(SUNSET.sun, e);
      sun.current.intensity = 2.0 - e * 0.4;
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
      <hemisphereLight ref={hemi} args={[DAY.sky, DAY.ground, 1.4]} />
      {/* the low sun, behind the guide, so the figures get a warm rim and shadows fall towards you */}
      <directionalLight
        ref={sun}
        position={SUN_POS.toArray()}
        intensity={2.0}
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
  onNear,
  onStep,
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
  /** What you've walked up to (the table, a creature), or nothing. */
  onNear: (near: Nearby | null) => void;
  /** Your chick's footsteps, for their sound. */
  onStep?: (surface: "grass" | "wood" | "dirt") => void;
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
      style={{ touchAction: "none" }} // touch drags and pinches are ours, not the page's
      onPointerMissed={(e) => {
        document.body.style.cursor = "";
        clickToWalk.current?.(e);
      }}
    >
      <fog attach="fog" args={[COLORS.fog, 45, 170]} />
      <DayCycle evening={evening} />

      <Landscape critters={{ interactive: mode === "world", picked: critter, onPick: onPickCritter }} />
      <Garden count={garden.count} freshFrom={garden.freshFrom} />
      <RoundTable interactive={mode === "world"} yourTurn={yourTurn || evening} onSelect={onSit} />
      <Figure position={[0, 0, -1.15]} rotationY={0} outfit="guide" mood={mood} onPoke={onPokePip} watch={mode === "world" ? watchPlayer : undefined} />
      {/* your chair: you're in it at the table, otherwise it waits empty while you walk about as your chick */}
      <Figure position={[0, 0, 1.15]} rotationY={Math.PI} outfit="you" firstPerson occupied={mode === "seated"} />
      <Player active={mode === "world"} visible={mode !== "seated"} onNear={onNear} onStep={onStep} />
      <TableMarker visible={mode === "world"} />

      <CameraRig mode={mode} aside={aside} onArrive={onArrive} />
      <Effects />
    </Canvas>
  );
}
