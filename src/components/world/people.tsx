"use client";

import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useRef, useState } from "react";
import * as THREE from "three";
import { gradientMap, toon } from "./toon";
import { isDrag } from "./controls";

// The two characters at the table: soft, matte, clay-toy chicks (after the reference render): a smooth pear-shaped
// body that is head and body in one, tiny black dot eyes, a little orange beak with a red wattle under it, a red comb,
// pink cheeks, puffy rounded wings, a tail tuft, and thin orange legs with three toes. They squash and stretch when
// they bounce, nod while you talk, and tilt their heads to think. Local coordinates: the chick faces +z, towards the
// table, sitting on the chair seat.

type V3 = [number, number, number];

export type Outfit = "guide" | "you";

const SEAT_Y = 0.56; // on a plump cushion, so more of the chick shows above the table

const PALETTES: Record<Outfit, { body: string; wing: string; cushion: string }> = {
  guide: { body: "#fbe08f", wing: "#f6d27a", cushion: "#f6b8aa" },
  you: { body: "#a9d1f0", wing: "#93c1e8", cushion: "#b9dcc4" },
};

// the body's silhouette as (radius, height): a wide, round bottom tapering into a smaller, rounded head
const PROFILE: [number, number][] = [
  [0, 0], [0.2, 0.012], [0.32, 0.06], [0.395, 0.16], [0.415, 0.28], [0.4, 0.41], [0.345, 0.54], [0.288, 0.66], [0.238, 0.77], [0.155, 0.86], [0.06, 0.915], [0, 0.92],
];
const DEPTH = 0.9; // a little flatter front to back

const bodyGeometry = (() => {
  const pts = new THREE.SplineCurve(PROFILE.map(([r, y]) => new THREE.Vector2(r, y))).getPoints(56);
  pts[0].x = 0;
  pts[pts.length - 1].x = 0;
  const g = new THREE.LatheGeometry(pts, 72);
  g.scale(1, 1, DEPTH);
  g.computeVertexNormals();
  return g;
})();

/** The body's radius at height y, from the silhouette. */
function radiusAt(y: number) {
  for (let i = 1; i < PROFILE.length; i++) {
    const [r0, y0] = PROFILE[i - 1], [r1, y1] = PROFILE[i];
    if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
  }
  return 0;
}

/** A point on the body's surface at `angle` round from the front and height `y`, pushed `out` along the normal. */
function surface(angle: number, y: number, out = 0): V3 {
  const r = radiusAt(y);
  return [Math.sin(angle) * (r + out), y, Math.cos(angle) * (r * DEPTH + out)];
}
/** How far the surface leans back at height `y` (it faces upwards where the body narrows), for things that sit flat on it. */
const leanAt = (y: number) => -Math.atan((radiusAt(y - 0.02) - radiusAt(y + 0.02)) / 0.04);

const dotMat = new THREE.MeshStandardMaterial({ color: "#241a16", roughness: 0.2 });
const sparkleMat = new THREE.MeshBasicMaterial({ color: "#ffffff" });
const blushMat = new THREE.MeshBasicMaterial({ color: "#ff9a94", transparent: true, opacity: 0.5, depthWrite: false });
const COMB = "#e5564a", BEAK = "#f39a4f", BEAK_LOW = "#e3863c";

const EYE_Y = 0.665, EYE_ANGLE = 0.4;

/** A tiny glossy dot of an eye. Blinks by squashing flat. */
function Eye({ side, eyeRef }: { side: -1 | 1; eyeRef: React.Ref<THREE.Group> }) {
  const a = side * EYE_ANGLE;
  return (
    <group position={surface(a, EYE_Y, -0.004)} rotation={[leanAt(EYE_Y), a, 0, "YXZ"]}>
      <group ref={eyeRef}>
        <mesh scale={[1, 1.15, 0.55]} material={dotMat}>
          <sphereGeometry args={[0.027, 16, 12]} />
        </mesh>
        <mesh position={[-0.008, 0.01, 0.014]} material={sparkleMat}>
          <sphereGeometry args={[0.0075, 8, 6]} />
        </mesh>
      </group>
    </group>
  );
}

/** Rosy cheeks, just below and outside each eye. */
function Blush({ side }: { side: -1 | 1 }) {
  const a = side * 0.6, y = 0.6;
  return (
    <mesh position={surface(a, y, 0.004)} rotation={[leanAt(y), a, 0, "YXZ"]} scale={[1.3, 0.8, 1]} material={blushMat}>
      <circleGeometry args={[0.04, 24]} />
    </mesh>
  );
}

/** Thin orange legs dangling off the front of the seat, each with three toes. */
function Leg({ side }: { side: -1 | 1 }) {
  const legMat = toon(BEAK);
  return (
    <group position={[side * 0.11, 0.05, 0.24]}>
      <mesh position={[0, -0.12, 0.07]} rotation={[0.55, 0, 0]} material={legMat}>
        <cylinderGeometry args={[0.017, 0.019, 0.27, 10]} />
      </mesh>
      <group position={[0, -0.23, 0.14]} rotation={[0.25, side * 0.15, 0]}>
        {[-0.5, 0, 0.5].map((a) => (
          <mesh key={a} position={[Math.sin(a) * 0.045, 0, Math.cos(a) * 0.045]} rotation={[Math.PI / 2, 0, -a]} material={legMat}>
            <capsuleGeometry args={[0.015, 0.075, 4, 8]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export const WOOD = "#c99a6a", WOOD_DARK = "#a77a4f";

/** A small wooden chair with a soft cushion. */
function WoodChair({ cushion }: { cushion: string }) {
  const wood = toon(WOOD), dark = toon(WOOD_DARK);
  return (
    <group>
      <mesh position={[0, 0.44, -0.06]} material={wood} castShadow receiveShadow>
        <boxGeometry args={[0.52, 0.05, 0.52]} />
      </mesh>
      <mesh position={[0, 0.5, -0.04]} scale={[1, 0.6, 1]} material={toon(cushion)} castShadow receiveShadow>
        <sphereGeometry args={[0.25, 24, 12]} />
      </mesh>
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <mesh key={`${x}${z}`} position={[x * 0.22, 0.21, -0.06 + z * 0.21]} material={dark} castShadow>
            <cylinderGeometry args={[0.026, 0.03, 0.42, 10]} />
          </mesh>
        )),
      )}
      {/* the back: two posts and rounded rails, behind the chick */}
      {[-1, 1].map((x) => (
        <mesh key={x} position={[x * 0.22, 0.75, -0.36]} material={dark} castShadow>
          <cylinderGeometry args={[0.026, 0.026, 0.6, 10]} />
        </mesh>
      ))}
      {[0.66, 0.92].map((y) => (
        <mesh key={y} position={[0, y, -0.36]} rotation={[0, 0, Math.PI / 2]} material={wood} castShadow>
          <capsuleGeometry args={[0.035, 0.42, 4, 10]} />
        </mesh>
      ))}
    </group>
  );
}

export interface FigureProps {
  position: V3;
  rotationY: number;
  outfit: Outfit;
  /** Talking: beak, bobbing and wing waves. Listening: little nods. Thinking: a head tilt. Happy: bounces and flaps. */
  mood?: Mood;
  /** Hide the chick when the camera is inside it (first-person). */
  firstPerson?: boolean;
  /** Clicking the chick pokes it. */
  onPoke?: () => void;
}

// gentle, never-repeating drift: a few sines at unrelated rates
const drift = (t: number, seed: number) => Math.sin(t * 0.31 + seed) * 0.5 + Math.sin(t * 0.73 + seed * 2.1) * 0.3 + Math.sin(t * 1.37 + seed * 3.7) * 0.2;

/** What the guide is doing, for its body language. */
export type Mood = "idle" | "speaking" | "listening" | "thinking" | "happy";

export function Figure({ position, rotationY, outfit, mood = "idle", firstPerson = false, onPoke }: FigureProps) {
  const chick = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const jaw = useRef<THREE.Group>(null);
  const eyeL = useRef<THREE.Group>(null), eyeR = useRef<THREE.Group>(null);
  const wings = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const talk = useRef(0);
  const nod = useRef(0), tilt = useRef(0), hop = useRef(0);
  const nextBlink = useRef(outfit === "guide" ? 2.2 : 3.6);
  const world = useRef(new THREE.Vector3());
  const seed = outfit === "guide" ? 1.7 : 5.3;
  const pal = PALETTES[outfit];

  useFrame(({ clock, camera }, dt) => {
    const t = clock.getElapsedTime();
    const ease = (r: React.RefObject<number>, on: boolean) => (r.current += ((on ? 1 : 0) - r.current) * Math.min(1, dt * 3));
    const k = ease(talk, mood === "speaking");
    const n = ease(nod, mood === "listening");
    const th = ease(tilt, mood === "thinking");
    const hp = ease(hop, mood === "happy");
    if (body.current) {
      // bounces: little ones of emphasis while talking, big happy ones; squash at the bottom, stretch at the top
      const bounce = k * Math.abs(Math.sin(t * 6.5)) * 0.015 + hp * Math.abs(Math.sin(t * 4.5)) * 0.07;
      const stretch = k * (Math.abs(Math.sin(t * 6.5)) - 0.5) * 0.04 + hp * (Math.abs(Math.sin(t * 4.5)) - 0.5) * 0.14 + Math.sin(t * 1.3 + seed) * 0.012;
      body.current.scale.set(1 - stretch * 0.5, 1 + stretch, 1 - stretch * 0.5);
      body.current.position.y = bounce;
      body.current.rotation.z = drift(t * 0.5, seed) * 0.04 + th * 0.14; // a slow sway; a curious tilt while thinking
      // listening: an encouraging nod every couple of seconds
      const nodding = n * Math.pow(Math.max(0, Math.sin(t * 2.4)), 6) * 0.09;
      body.current.rotation.x = k * 0.05 + nodding + drift(t * 0.4, seed + 2) * 0.02;
      body.current.rotation.y = drift(t * 0.3, seed + 4) * 0.12 * (1 - Math.max(k, n) * 0.7);
    }
    // beak: chatters while talking
    if (jaw.current) jaw.current.rotation.x = k * (0.15 + 0.3 * Math.abs(Math.sin(t * 11)));
    // quick blinks: the dot eyes squash flat for a moment
    if (t > nextBlink.current + 0.14) nextBlink.current = t + 2.2 + Math.random() * 3;
    const blink = t > nextBlink.current ? Math.sin(((t - nextBlink.current) / 0.14) * Math.PI) : 0;
    [eyeL, eyeR].forEach((e) => e.current?.scale.set(1, 1 - blink * 0.9, 1));
    wings.forEach((w, i) => {
      if (!w.current) return;
      const side = i ? 1 : -1;
      w.current.rotation.z = side * (0.08 + k * (0.15 + 0.2 * Math.sin(t * 5 + i)) + hp * (0.5 + 0.4 * Math.sin(t * 9)));
    });
    if (chick.current) {
      if (firstPerson) {
        const w = chick.current.getWorldPosition(world.current);
        w.y += 0.5;
        chick.current.visible = w.distanceTo(camera.position) > 1.0;
      } else chick.current.visible = true;
    }
  });

  const bodyMat = toon(pal.body);
  const beakAt = surface(0, 0.6, -0.006);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <WoodChair cushion={pal.cushion} />
      <group
        ref={chick}
        position={[0, SEAT_Y, 0.04]}
        onClick={(e) => {
          if (!onPoke || isDrag(e.delta)) return; // dragging to look around isn't a poke
          e.stopPropagation();
          onPoke();
        }}
        onPointerOver={(e) => {
          if (!onPoke) return;
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => onPoke && (document.body.style.cursor = "")}
      >
        <group ref={body}>
          {/* casts a shadow but doesn't receive the scenery's (a tree's shadow across the face reads as a smudge) */}
          <mesh geometry={bodyGeometry} material={bodyMat} castShadow />
          {/* the comb: three little red bumps along the top of the head */}
          {[
            [0.07, 0.9, 0.036],
            [0.015, 0.93, 0.046],
            [-0.04, 0.91, 0.036],
          ].map(([z, y, r], i) => (
            <mesh key={i} position={[0, y, z]} material={toon(COMB)}>
              <sphereGeometry args={[r, 14, 12]} />
            </mesh>
          ))}
          {/* puffy, rounded wings, hinged at the shoulder */}
          {[0, 1].map((i) => {
            const side = i ? 1 : -1;
            return (
              <group key={i} ref={wings[i]} position={[side * (radiusAt(0.48) - 0.02), 0.48, 0.02]}>
                <mesh position={[side * 0.05, -0.12, 0]} rotation={[0.15, 0, side * 0.18]} scale={[0.085, 0.165, 0.15]} material={toon(pal.wing)} castShadow>
                  <sphereGeometry args={[1, 24, 18]} />
                </mesh>
              </group>
            );
          })}
          {/* a tail tuft at the back */}
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.045, 0.52, -radiusAt(0.52) * DEPTH + 0.02]} rotation={[-0.7, 0, side * 0.25]} scale={[0.07, 0.13, 0.06]} material={bodyMat} castShadow>
              <sphereGeometry args={[1, 16, 12]} />
            </mesh>
          ))}
          <Eye side={-1} eyeRef={eyeR} />
          <Eye side={1} eyeRef={eyeL} />
          <Blush side={-1} />
          <Blush side={1} />
          {/* a small beak, and a lower beak hinged so it can talk, with the red wattle hanging from it */}
          <group position={beakAt}>
            <mesh rotation={[Math.PI / 2 + 0.25, 0, 0]} scale={[1.3, 1, 0.8]} material={toon(BEAK)}>
              <coneGeometry args={[0.046, 0.08, 18]} />
            </mesh>
            <group ref={jaw} position={[0, -0.018, -0.008]}>
              <mesh position={[0, -0.004, 0.018]} rotation={[Math.PI / 2 + 0.55, 0, 0]} scale={[1.1, 1, 0.5]} material={toon(BEAK_LOW)}>
                <coneGeometry args={[0.032, 0.046, 14]} />
              </mesh>
              <mesh position={[0, -0.058, 0.02]} scale={[0.85, 1.3, 0.7]} material={toon(COMB)}>
                <sphereGeometry args={[0.04, 14, 12]} />
              </mesh>
            </group>
          </group>
        </group>
        <Leg side={-1} />
        <Leg side={1} />
      </group>
    </group>
  );
}

export const TABLE_TOP = 0.76;

/** A mug of tea with a wisp of steam. */
function Mug({ position, color }: { position: V3; color: string }) {
  const steam = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    steam.current?.children.forEach((puff, i) => {
      const k = (clock.getElapsedTime() * 0.35 + i / 3) % 1; // each puff rises, drifts and fades, then starts again
      puff.position.set(Math.sin(k * 6 + i) * 0.015, 0.1 + k * 0.22, 0);
      puff.scale.setScalar(0.4 + k * 0.8);
      ((puff as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = Math.sin(k * Math.PI) * 0.18;
    });
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.045, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.04, 0.09, 24]} />
        <primitive object={toon(color)} attach="material" />
      </mesh>
      <mesh position={[0, 0.088, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.04, 24]} />
        <primitive object={toon("#a8703e")} attach="material" />
      </mesh>
      <mesh position={[0.05, 0.048, 0]}>
        <torusGeometry args={[0.022, 0.007, 8, 16]} />
        <primitive object={toon(color)} attach="material" />
      </mesh>
      <group ref={steam}>
        {[0, 1, 2].map((i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.018, 10, 8]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** A little jar of wildflowers. */
function Flowers({ position }: { position: V3 }) {
  const stems: [number, number, string][] = [[-0.03, 0.2, "#f6b6c8"], [0.025, 0.24, "#ffffff"], [0, 0.27, "#f5d43c"], [0.035, 0.19, "#c9b6f2"]];
  return (
    <group position={position}>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.04, 0.035, 0.1, 20]} />
        <meshPhysicalMaterial color="#d8ecf2" roughness={0.1} transparent opacity={0.55} />
      </mesh>
      {stems.map(([x, h, c], i) => (
        <group key={i} position={[x, 0, (i % 2 ? 1 : -1) * 0.015]} rotation={[0, 0, -x * 4]}>
          <mesh position={[0, h / 2, 0]}>
            <cylinderGeometry args={[0.003, 0.003, h, 5]} />
            <primitive object={toon("#6fae5a")} attach="material" />
          </mesh>
          <mesh position={[0, h, 0]}>
            <sphereGeometry args={[0.018, 10, 8]} />
            <primitive object={toon(c)} attach="material" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** A small paper lantern that glows warmly while it's your turn to talk. */
function Lantern({ position, lit }: { position: V3; lit: boolean }) {
  const glow = useRef(0);
  const shade = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }, dt) => {
    glow.current += ((lit ? 1 : 0) - glow.current) * Math.min(1, dt * 2.5);
    const flicker = 1 + Math.sin(clock.getElapsedTime() * 7) * 0.04;
    if (shade.current) shade.current.emissiveIntensity = (0.1 + glow.current * 0.75) * flicker;
    if (light.current) light.current.intensity = glow.current * 0.3 * flicker;
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.075, 0]} scale={[1, 1.15, 1]}>
        <sphereGeometry args={[0.06, 20, 14]} />
        <meshStandardMaterial ref={shade} color="#ffe2b0" emissive="#ffb85c" emissiveIntensity={0.15} roughness={0.9} />
      </mesh>
      {[0.005, 0.15].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.012, 16]} />
          <primitive object={toon("#7a5a40")} attach="material" />
        </mesh>
      ))}
      <pointLight ref={light} position={[0, 0.1, 0]} color="#ffbf73" intensity={0} distance={1.6} decay={2} />
    </group>
  );
}

/** The round wooden table, set for tea. Clickable while `interactive`; the lantern lights up on your turn. */
export function RoundTable({ interactive, yourTurn = false, onSelect }: { interactive: boolean; yourTurn?: boolean; onSelect: () => void }) {
  const [hover, setHover] = useState(false);
  const ring = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ring.current) return;
    const t = clock.getElapsedTime();
    ring.current.visible = interactive;
    const s = 1 + (Math.sin(t * 2.2) * 0.5 + 0.5) * 0.08 + (hover ? 0.06 : 0);
    ring.current.scale.set(s, s, 1);
    (ring.current.material as THREE.MeshBasicMaterial).opacity = hover ? 0.95 : 0.6 + Math.sin(t * 2.2) * 0.2;
  });

  const over = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive) return;
    e.stopPropagation();
    setHover(true);
    document.body.style.cursor = "pointer";
  };
  const out = () => {
    setHover(false);
    document.body.style.cursor = interactive ? "grab" : ""; // back to the island's drag-to-look cursor
  };

  return (
    <group
      onPointerOver={over}
      onPointerOut={out}
      onClick={(e) => {
        if (!interactive || isDrag(e.delta)) return; // dragging to orbit isn't a click on the table
        e.stopPropagation();
        out();
        onSelect();
      }}
    >
      <mesh position={[0, TABLE_TOP - 0.01, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.78, 0.76, 0.05, 64]} />
        <meshToonMaterial color="#e8cba4" gradientMap={gradientMap()} emissive="#f5c84c" emissiveIntensity={hover ? 0.12 : 0} />
      </mesh>
      <mesh position={[0, TABLE_TOP - 0.05, 0]}>
        <cylinderGeometry args={[0.72, 0.72, 0.04, 48]} />
        <primitive object={toon(WOOD_DARK)} attach="material" />
      </mesh>
      <mesh position={[0, TABLE_TOP / 2, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, TABLE_TOP, 16]} />
        <primitive object={toon(WOOD_DARK)} attach="material" />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0, 0.03, 0]} rotation={[0, (i * Math.PI) / 2 + Math.PI / 4, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.07, 0.05, 0.75]} />
          <primitive object={toon(WOOD_DARK)} attach="material" />
        </mesh>
      ))}

      {/* set for tea */}
      <Mug position={[0.36, TABLE_TOP + 0.015, -0.42]} color="#f4ede1" />
      <Mug position={[-0.46, TABLE_TOP + 0.015, 0.02]} color="#cfe3f0" />
      <Flowers position={[-0.34, TABLE_TOP + 0.015, -0.32]} />
      <Lantern position={[0.44, TABLE_TOP + 0.015, 0.05]} lit={yourTurn} />

      {/* a soft yellow ring on the grass that says "click me" */}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[1.75, 1.85, 72]} />
        <meshBasicMaterial color="#f5c84c" transparent opacity={0.6} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
