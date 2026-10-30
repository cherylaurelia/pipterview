"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { nearestCritter } from "./critters";
import { canStand, held, player, type Nearby } from "./explore";
import { surfaceY } from "./island";
import { Figure } from "./people";

// You, out on the island: your chick walks where you steer it (WASD or the arrow keys, relative to the camera, Shift to
// run) or where you click, bumping round trees, water and buildings rather than through them, and waddles as it goes.
// It notices what's close enough to use (the table, a creature) and says so through `onNear`.

const WALK = 2.4, RUN = 4.4;
const turn = (from: number, to: number, f: number) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * f;
const nearKey = (n: Nearby | null) => (!n ? "" : n.type === "table" ? "table" : `${n.pick.kind}${n.pick.index}`);

export function Player({ active, visible, onNear }: { active: boolean; visible: boolean; onNear: (near: Nearby | null) => void }) {
  const group = useRef<THREE.Group>(null);
  const gait = useRef(0);
  const marker = useRef<THREE.Mesh>(null);
  const lastNear = useRef("");
  const tmp = useRef({ f: new THREE.Vector2(), move: new THREE.Vector2() });

  useFrame(({ camera, clock }, delta) => {
    const dt = Math.min(delta, 0.05), p = player, { f, move } = tmp.current;
    let speed = 0;
    if (active) {
      // the camera's forward along the ground, and its right
      f.set(p.pos.x - camera.position.x, p.pos.z - camera.position.z).normalize();
      const has = (...k: string[]) => k.some((x) => held.has(x));
      const ahead = (has("w", "arrowup") ? 1 : 0) - (has("s", "arrowdown") ? 1 : 0);
      const side = (has("d", "arrowright") ? 1 : 0) - (has("a", "arrowleft") ? 1 : 0);
      move.set(f.x * ahead - f.y * side, f.y * ahead + f.x * side);
      if (move.lengthSq() > 0) p.goal = null;
      else if (p.goal) {
        move.set(p.goal.x - p.pos.x, p.goal.z - p.pos.z);
        if (move.length() < 0.15) {
          p.goal = null;
          move.set(0, 0);
        }
      }
      if (move.lengthSq() > 0) {
        speed = has("shift") ? RUN : WALK;
        move.normalize().multiplyScalar(speed * dt);
        const x = p.pos.x + move.x, z = p.pos.z + move.y;
        // slide along whatever's in the way rather than stopping dead
        if (canStand(x, z)) p.pos.set(x, 0, z);
        else if (canStand(x, p.pos.z)) p.pos.x = x;
        else if (canStand(p.pos.x, z)) p.pos.z = z;
        else {
          p.goal = null;
          speed = 0;
        }
        p.heading = turn(p.heading, Math.atan2(move.x, move.y), Math.min(1, dt * 12));
      }

      // what's close enough to use
      const near: Nearby | null = Math.hypot(p.pos.x, p.pos.z) < 2.1 ? { type: "table" } : (() => {
        const pick = nearestCritter(p.pos.x, p.pos.z, 2.4); // generous: most of them are out on the water
        return pick ? { type: "critter" as const, pick } : null;
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
    gait.current += ((speed > 0 ? speed / WALK : 0) - gait.current) * Math.min(1, dt * 10);
    group.current?.position.set(p.pos.x, surfaceY(p.pos.x, p.pos.z), p.pos.z);
    if (group.current) group.current.rotation.y = p.heading;

    // a soft ring where you clicked to go
    if (marker.current) {
      marker.current.visible = active && !!p.goal;
      if (p.goal) {
        marker.current.position.set(p.goal.x, surfaceY(p.goal.x, p.goal.z) + 0.03, p.goal.z);
        marker.current.scale.setScalar(0.25 + Math.sin(clock.getElapsedTime() * 6) * 0.03);
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
    </>
  );
}

/** A little lantern-gold marker bobbing over the table, so you can always find your way back to Pip. */
export function TableMarker({ visible }: { visible: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const far = Math.hypot(player.pos.x, player.pos.z) > 3.5;
    g.visible = visible && far;
    const t = clock.getElapsedTime();
    g.position.y = 2.3 + Math.sin(t * 2) * 0.12;
    g.rotation.y = t * 0.8;
  });
  return (
    <group ref={ref} position={[0, 2.3, 0]}>
      <mesh scale={[0.16, 0.24, 0.16]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#ffd27a" emissive="#ffb34d" emissiveIntensity={1.2} />
      </mesh>
    </group>
  );
}
