"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { nearestCritter } from "./critters";
import { canStand, getUp, held, nearestSeat, player, seatAt, type Nearby } from "./explore";
import { surfaceY } from "./island";
import { slideRoundPlants } from "./landscape";
import { Figure } from "./people";

// You, out on the island: your chick walks where you steer it (WASD or the arrow keys, relative to the camera, Shift to
// run) or where you click, gliding round trees and bushes and stopping at water, buildings and benches rather than
// going through them, and waddles as it goes. It can sit on a bench (and gets up again as soon as you walk). It notices
// what's close enough to use (the table, a bench, a creature) and says so through `onNear`.

const WALK = 2.4, RUN = 4.4, BODY = 0.22;
const turn = (from: number, to: number, f: number) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * f;
const nearKey = (n: Nearby | null) => (!n ? "" : n.type === "table" ? "table" : n.type === "seat" ? `seat:${n.id}:${n.sitting}` : `${n.pick.kind}${n.pick.index}`);

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
      if (move.lengthSq() > 0) {
        speed = has("shift") ? RUN : WALK;
        move.normalize().multiplyScalar(speed * dt);
        // glide round trees and bushes; slide along anything else that's in the way rather than stopping dead
        const to = slideRoundPlants(p.pos.x + move.x, p.pos.z + move.y, BODY);
        if (canStand(to.x, to.z)) p.pos.set(to.x, 0, to.z);
        else {
          const alongX = slideRoundPlants(p.pos.x + move.x, p.pos.z, BODY), alongZ = slideRoundPlants(p.pos.x, p.pos.z + move.y, BODY);
          if (canStand(alongX.x, alongX.z)) p.pos.set(alongX.x, 0, alongX.z);
          else if (canStand(alongZ.x, alongZ.z)) p.pos.set(alongZ.x, 0, alongZ.z);
          else {
            p.goal = null;
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
    gait.current += ((speed > 0 ? speed / WALK : 0) - gait.current) * Math.min(1, dt * 10);
    const seat = p.sitting ? seatAt(p.sitting) : undefined;
    if (seat) {
      // on the bench: settled into the seat, looking out the way it faces
      p.pos.set(seat.x, 0, seat.z);
      p.heading = turn(p.heading, seat.heading, Math.min(1, dt * 8));
    }
    group.current?.position.set(p.pos.x, seat ? seat.y : surfaceY(p.pos.x, p.pos.z), p.pos.z);
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
  useFrame(({ clock, camera }) => {
    const g = ref.current;
    if (!g) return;
    // only when you're away from the table, and never right in front of the camera
    const far = Math.hypot(player.pos.x, player.pos.z) > 3.5 && camera.position.distanceTo(g.position) > 5;
    g.visible = visible && far;
    const t = clock.getElapsedTime();
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
