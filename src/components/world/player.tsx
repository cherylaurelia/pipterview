"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { nearestCritter } from "./critters";
import { canStand, getUp, held, nearestDoor, nearestSeat, player, seatAt, stick, type Nearby } from "./explore";
import { BRIDGE, groundY, onPath, POND, pondEdge, surfaceY } from "./island";
import { slideRoundPlants } from "./landscape";
import { ripple } from "./pond";
import { Figure } from "./people";
import { reducedMotion } from "./quality";
import { softDot } from "./textures";

// You, out on the island: your chick walks where you steer it (WASD or the arrow keys, relative to the camera, Shift to
// run) or where you click, gliding round trees and bushes and stopping at water, buildings and benches rather than
// going through them, and waddles as it goes. It picks up speed and slows down rather than starting and stopping dead,
// hops (Space) with a stretch on the way up and a squash when it lands, and kicks up little puffs of pollen or dust as it
// goes. It can sit on a bench (and gets up again as soon as you walk). It notices what's close enough to use (the
// table, a bench, a door, a creature) and says so through `onNear`.

const WALK = 2.4, RUN = 4.4, BODY = 0.22, HOP = 2.8, GRAVITY = 9.8;
const turn = (from: number, to: number, f: number) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * f;
const nearKey = (n: Nearby | null) =>
  !n ? "" : n.type === "table" ? "table" : n.type === "seat" ? `seat:${n.id}:${n.sitting}` : n.type === "door" ? `door:${n.id}` : `${n.pick.kind}${n.pick.index}`;

export function Player({
  active,
  visible,
  onNear,
  onStep,
}: {
  active: boolean;
  visible: boolean;
  onNear: (near: Nearby | null) => void;
  /** Each footstep, and what it landed on. */
  onStep?: (surface: "grass" | "wood" | "stone" | "dirt") => void;
}) {
  const group = useRef<THREE.Group>(null);
  const gait = useRef(0);
  const marker = useRef<THREE.Mesh>(null);
  const lastNear = useRef("");
  const nextRipple = useRef(0);
  const stepClock = useRef(0);
  const tmp = useRef({ f: new THREE.Vector2(), move: new THREE.Vector2(), want: new THREE.Vector2() });
  const rise = useRef(0); // upward speed mid-hop
  const squash = useRef(0); // 1 just after landing, easing back to 0

  useFrame(({ camera, clock }, delta) => {
    const dt = Math.min(delta, 0.05), p = player, { f, move, want } = tmp.current;
    let speed = 0;
    p.out = active;
    if (!active) p.vel.set(0, 0); // at the table or on the splash: standing still
    if (active) {
      // the camera's forward along the ground, and its right
      f.set(p.pos.x - camera.position.x, p.pos.z - camera.position.z).normalize();
      const has = (...k: string[]) => k.some((x) => held.has(x));
      const keyAhead = (has("w", "arrowup") ? 1 : 0) - (has("s", "arrowdown") ? 1 : 0);
      const keySide = (has("d", "arrowright") ? 1 : 0) - (has("a", "arrowleft") ? 1 : 0);
      // the joystick (touch screens) steers too, and how far it's pushed sets the pace
      const push = Math.min(1, Math.hypot(stick.x, stick.y));
      const usingStick = !keyAhead && !keySide && push > 0.12;
      const ahead = usingStick ? stick.y : keyAhead, side = usingStick ? stick.x : keySide;
      move.set(f.x * ahead - f.y * side, f.y * ahead + f.x * side);
      if (move.lengthSq() > 0) {
        p.goal = null;
        if (p.sitting) getUp(); // walking off gets you up
      }
      else if (p.goal) {
        move.set(p.goal.x - p.pos.x, p.goal.z - p.pos.z);
        if (move.length() < 0.15) {
          p.goal = null;
          move.set(0, 0);
        }
      }
      want.set(0, 0);
      if (move.lengthSq() > 0) {
        const pace = usingStick ? RUN * Math.max(0.2, push) : has("shift") ? RUN : WALK; // the pace rises smoothly with the push
        want.copy(move).normalize().multiplyScalar(pace);
      }
      // up to speed in about a fifth of a second, and a slightly longer glide to a stop
      p.vel.lerp(want, 1 - Math.exp(-dt * (want.lengthSq() >= p.vel.lengthSq() ? 12 : 8)));
      if (p.vel.lengthSq() < 1e-4 && want.lengthSq() === 0) p.vel.set(0, 0);
      move.copy(p.vel).multiplyScalar(dt);
      if (move.lengthSq() > 0) {
        speed = p.vel.length();
        // glide round trees and bushes; slide along anything else that's in the way rather than stopping dead
        const to = slideRoundPlants(p.pos.x + move.x, p.pos.z + move.y, BODY);
        if (canStand(to.x, to.z)) p.pos.set(to.x, 0, to.z);
        else {
          const alongX = slideRoundPlants(p.pos.x + move.x, p.pos.z, BODY), alongZ = slideRoundPlants(p.pos.x, p.pos.z + move.y, BODY);
          if (canStand(alongX.x, alongX.z)) p.pos.set(alongX.x, 0, alongX.z);
          else if (canStand(alongZ.x, alongZ.z)) p.pos.set(alongZ.x, 0, alongZ.z);
          else {
            p.goal = null;
            p.vel.set(0, 0);
            speed = 0;
          }
        }
        p.heading = turn(p.heading, Math.atan2(move.x, move.y), Math.min(1, dt * 12));
      }

      // what's close enough to use
      const near: Nearby | null = (() => {
        if (p.sitting) return { type: "seat", id: p.sitting, sitting: true };
        if (Math.hypot(p.pos.x, p.pos.z) < 2.1) return { type: "table" };
        const seat = nearestSeat(p.pos.x, p.pos.z, 1.3);
        if (seat) return { type: "seat", id: seat, sitting: false };
        const door = nearestDoor(p.pos.x, p.pos.z, 1.2);
        if (door) return { type: "door", id: door };
        const pick = nearestCritter(p.pos.x, p.pos.z, 2.4); // generous: most of them are out on the water
        return pick ? { type: "critter", pick } : null;
      })();
      const key = nearKey(near);
      if (key !== lastNear.current) {
        lastNear.current = key;
        onNear(near);
      }
    } else if (lastNear.current) {
      lastNear.current = "";
      onNear(null);
    }
    gait.current += ((speed > 0.05 && p.air === 0 ? speed / WALK : 0) - gait.current) * Math.min(1, dt * 10);
    // a hop: straight up and back down, a stretch on the way up and a squash as it lands, with a puff where it lands
    if (p.hop) {
      p.hop = false;
      if (active && p.air === 0 && !p.sitting) rise.current = HOP;
    }
    if (rise.current !== 0 || p.air > 0) {
      rise.current -= GRAVITY * dt;
      p.air += rise.current * dt;
      if (p.air <= 0) {
        p.air = 0;
        if (rise.current < -1) {
          squash.current = 1;
          const y = surfaceY(p.pos.x, p.pos.z);
          puff(p.pos.x, y, p.pos.z, onPath(p.pos.x, p.pos.z) ? DUST : POLLEN, 7, 0.32);
          onStep?.(surfaceY(p.pos.x, p.pos.z) > groundY(p.pos.x, p.pos.z) + 0.05 ? "wood" : onPath(p.pos.x, p.pos.z) ? "dirt" : "grass");
        }
        rise.current = 0;
      }
    }
    squash.current *= Math.exp(-dt * 9);
    const still = reducedMotion();
    const sy = still ? 1 : 1 + Math.max(0, Math.min(1, rise.current / HOP)) * 0.14 - squash.current * 0.22;
    group.current?.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
    // footsteps, faster when running: hollow on the dock, a knock on the stone bridge, crunchy on the paths, soft on grass
    if (speed > 0) {
      stepClock.current -= dt * (speed / WALK);
      if (stepClock.current <= 0) {
        stepClock.current = 0.3;
        const x = p.pos.x, z = p.pos.z;
        const raised = surfaceY(x, z) > groundY(x, z) + 0.05, path = onPath(x, z);
        if (p.air === 0) {
          onStep?.(raised ? (Math.hypot(x - BRIDGE.x, z - BRIDGE.z) < 2 ? "stone" : "wood") : path ? "dirt" : "grass");
          // a little puff from the foot that just landed, a touch behind: pollen off the grass, dust off the paths
          if (!raised) puff(x - Math.sin(p.heading) * 0.12, surfaceY(x, z), z - Math.cos(p.heading) * 0.12, path ? DUST : POLLEN, path ? 2 : 1, 0.08);
        }
      }
    } else stepClock.current = 0;
    // walking along the shore or out on the dock sends little rings across the water
    const edge = pondEdge(p.pos.x, p.pos.z);
    if (speed > 0 && edge < 0.6 && clock.elapsedTime > nextRipple.current) {
      const d = Math.hypot(POND.x - p.pos.x, POND.z - p.pos.z) || 1, inward = Math.max(0.3, edge + 0.35);
      ripple(p.pos.x + ((POND.x - p.pos.x) / d) * inward, p.pos.z + ((POND.z - p.pos.z) / d) * inward, 0.5);
      nextRipple.current = clock.elapsedTime + 0.45;
    }
    const seat = p.sitting ? seatAt(p.sitting) : undefined;
    if (seat) {
      // on the bench: settled into the seat, looking out the way it faces
      p.pos.set(seat.x, 0, seat.z);
      p.heading = turn(p.heading, seat.heading, Math.min(1, dt * 8));
    }
    group.current?.position.set(p.pos.x, (seat ? seat.y : surfaceY(p.pos.x, p.pos.z)) + p.air, p.pos.z);
    if (group.current) group.current.rotation.y = p.heading;

    // a soft ring where you clicked to go
    if (marker.current) {
      marker.current.visible = active && !!p.goal;
      if (p.goal) {
        marker.current.position.set(p.goal.x, surfaceY(p.goal.x, p.goal.z) + 0.03, p.goal.z);
        marker.current.scale.setScalar(0.25 + Math.sin(clock.elapsedTime * 6) * 0.03);
      }
    }
  });

  return (
    <>
      <group ref={group} visible={visible}>
        <Figure position={[0, 0, 0]} rotationY={0} outfit="you" seated={false} gait={gait} />
      </group>
      <mesh ref={marker} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.7, 1, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.8} depthWrite={false} />
      </mesh>
      <Puffs />
    </>
  );
}

const POLLEN = new THREE.Color("#f3f0b8"), DUST = new THREE.Color("#e2c69a");

// A small pool of soft puffs, reused round and round: each rises a little, spreads and fades over about two-thirds of
// a second.
const PUFFS = Array.from({ length: 28 }, () => ({ age: 1, pos: new THREE.Vector3(), drift: new THREE.Vector3(), color: new THREE.Color() }));
let nextPuff = 0;

/** Kicks up `n` puffs round (x, y, z), `spread` metres out. */
function puff(x: number, y: number, z: number, color: THREE.Color, n: number, spread: number) {
  for (let i = 0; i < n; i++) {
    const p = PUFFS[nextPuff];
    nextPuff = (nextPuff + 1) % PUFFS.length;
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
    p.age = 0;
    p.pos.set(x + Math.cos(a) * spread * 0.4, y + 0.04, z + Math.sin(a) * spread * 0.4);
    p.drift.set(Math.cos(a) * spread * 1.6, 0.25 + Math.random() * 0.15, Math.sin(a) * spread * 1.6);
    p.color.copy(color);
  }
}

function Puffs() {
  const sprites = useRef<(THREE.Sprite | null)[]>([]);
  const map = useMemo(() => softDot(), []);
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    PUFFS.forEach((p, i) => {
      const s = sprites.current[i];
      if (!s) return;
      s.visible = p.age < 1;
      if (!s.visible) return;
      p.age = Math.min(1, p.age + dt / 0.65);
      p.pos.addScaledVector(p.drift, dt);
      p.drift.multiplyScalar(Math.exp(-dt * 3));
      s.position.copy(p.pos);
      s.scale.setScalar(0.1 + p.age * 0.22);
      const m = s.material as THREE.SpriteMaterial;
      m.color.copy(p.color);
      m.opacity = (1 - p.age) * 0.7;
    });
  });
  return (
    <>
      {PUFFS.map((_, i) => (
        <sprite key={i} ref={(s) => void (sprites.current[i] = s)} visible={false}>
          <spriteMaterial map={map} transparent opacity={0} depthWrite={false} />
        </sprite>
      ))}
    </>
  );
}

/** A little lantern-gold marker bobbing over the table, so you can always find your way back to Pip. */
export function TableMarker({ visible }: { visible: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock, camera }) => {
    const g = ref.current;
    if (!g) return;
    // only when you're away from the table, and never right in front of the camera
    const far = Math.hypot(player.pos.x, player.pos.z) > 3.5 && camera.position.distanceTo(g.position) > 5;
    g.visible = visible && far;
    const t = clock.elapsedTime;
    g.position.y = 2.3 + Math.sin(t * 2) * 0.12;
    g.rotation.y = t * 0.8;
  });
  return (
    <group ref={ref} position={[0, 2.3, 0]}>
      <mesh scale={[0.11, 0.17, 0.11]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#ffe2a0" emissive="#ffb34d" emissiveIntensity={1.1} flatShading />
      </mesh>
    </group>
  );
}
