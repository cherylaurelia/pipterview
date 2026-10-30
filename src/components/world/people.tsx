"use client";

import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useRef, useState } from "react";
import * as THREE from "three";
import { gradientMap, toon } from "./toon";
import { isDrag } from "./controls";

// The two characters at the table: soft, matte, clay-toy chicks after the Pip logo (public/design/logo/pip-logo.png):
// a plump gumdrop body that is head and body in one, with a full round head, black oval eyes, a small rounded beak,
// rosy cheeks level with it, a two-lobed tuft on top, little wings low at the sides, a tail tuft, and two round blob
// feet in front. They squash and stretch when they bounce, nod while you talk, and tilt their heads to think. Local
// coordinates: the chick faces +z, towards the table, sitting on the chair seat.

type V3 = [number, number, number];

export type Outfit = "guide" | "you";

const SEAT_Y = 0.56; // on a plump cushion, so more of the chick shows above the table

const PALETTES: Record<Outfit, { body: string; wing: string; cushion: string }> = {
  guide: { body: "#f3e6af", wing: "#e8d79a", cushion: "#f6b8aa" },
  you: { body: "#a9d1f0", wing: "#93c1e8", cushion: "#b9dcc4" },
};

// the body's silhouette as (radius, height), after the logo: a slightly flattened round bottom, the round belly at its
// widest a quarter of the way up, a subtle waist, a cheek bulge for the face, and a round dome of a head
const PROFILE: [number, number][] = [
  [0, 0], [0.2, 0.006], [0.3, 0.022], [0.37, 0.06], [0.405, 0.13], [0.418, 0.23], [0.402, 0.33], [0.376, 0.423], [0.385, 0.5],
  [0.393, 0.58], [0.372, 0.66], [0.334, 0.736], [0.259, 0.828], [0.176, 0.88], [0.11, 0.905], [0.064, 0.915], [0, 0.92],
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

// a wing's outline as (half-width, height): slim where it joins the body at the top, fullest in the lower half and
// ending in a soft round tip, so it hangs from the side like the logo's; spun round and then flattened into a flap
const WING_PROFILE: [number, number][] = [
  [0, -1.8], [0.4, -1.75], [0.68, -1.6], [0.88, -1.38], [0.98, -1.12], [1, -0.85], [0.95, -0.5], [0.82, -0.15], [0.62, 0.2], [0.4, 0.45], [0.2, 0.58], [0, 0.62],
];

const wingGeometry = (() => {
  const pts = new THREE.SplineCurve(WING_PROFILE.map(([r, y]) => new THREE.Vector2(r, y))).getPoints(40);
  pts[0].x = 0;
  pts[pts.length - 1].x = 0;
  const g = new THREE.LatheGeometry(pts, 32);
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

const eyeMat = toon("#120e0c");
const blushMat = new THREE.MeshBasicMaterial({ color: "#ecb39f", transparent: true, opacity: 0.85, depthWrite: false });
const COMB = "#e07a66", BEAK = "#df9e66", BEAK_INSIDE = "#b8774a";

const EYE_Y = 0.58, EYE_ANGLE = 0.32; // on the cheek bulge
const BEAK_Y = 0.55;

/** A black oval of an eye, taller than it is wide. Blinks by squashing flat. */
function Eye({ side, eyeRef }: { side: -1 | 1; eyeRef: React.Ref<THREE.Group> }) {
  const a = side * EYE_ANGLE;
  return (
    <group position={surface(a, EYE_Y, -0.004)} rotation={[leanAt(EYE_Y), a, 0, "YXZ"]}>
      <group ref={eyeRef}>
        <mesh scale={[1, 1.9, 0.5]} material={eyeMat}>
          <sphereGeometry args={[0.027, 16, 12]} />
        </mesh>
      </group>
    </group>
  );
}

/** Rosy cheeks, outside each eye and level with the beak. */
function Blush({ side }: { side: -1 | 1 }) {
  const a = side * 0.7;
  return (
    <mesh position={surface(a, BEAK_Y, 0.004)} rotation={[leanAt(BEAK_Y), a, 0, "YXZ"]} scale={[1.1, 0.55, 1]} material={blushMat}>
      <circleGeometry args={[0.04, 24]} />
    </mesh>
  );
}

/** A round orange blob of a foot, resting in front of the body. */
function Foot({ side }: { side: -1 | 1 }) {
  return (
    <mesh position={[side * 0.12, 0.04, 0.3]} rotation={[0, side * 0.2, 0]} scale={[0.08, 0.05, 0.07]} material={toon(BEAK)} castShadow>
      <sphereGeometry args={[1, 20, 14]} />
    </mesh>
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

  const bodyMat = toon(pal.body, outfit === "guide"); // Pip stays pale cream in the sunset, as in the logo
  const beakAt = surface(0, BEAK_Y, -0.004);
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
          {/* the tuft: two rounded lobes splaying out from one point on top of the head, like a little heart */}
          {[
            [-0.028, 0.955, 0.042, 0.5],
            [0.03, 0.948, 0.035, -0.6],
          ].map(([x, y, r, tilt], i) => (
            <mesh key={i} position={[x, y, 0]} rotation={[0, 0, tilt]} scale={[1, 1.25, 0.6]} material={toon(COMB)} castShadow>
              <sphereGeometry args={[r, 16, 12]} />
            </mesh>
          ))}
          {/* small flaps hanging at the sides, the inner edge hugging the body from the shoulder down while the fuller
              lower half shows past it, the tips angled back, hinged at the top so they can flap */}
          {[0, 1].map((i) => {
            const side = i ? 1 : -1;
            return (
              <group key={i} ref={wings[i]} position={[side * (radiusAt(0.4) - 0.02), 0.4, 0.02]}>
                <mesh geometry={wingGeometry} position={[side * 0.042, -0.075, -0.01]} rotation={[0.3, 0, side * 0.24]} scale={[0.051, 0.103, 0.105]} material={toon(pal.wing, outfit === "guide")} castShadow />
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
          {/* a small rounded beak (a half-oval, flat underneath), and a thin lower beak hinged so it can talk */}
          <group position={beakAt} rotation={[leanAt(BEAK_Y), 0, 0]}>
            <mesh scale={[1, 0.9, 0.55]} material={toon(BEAK)}>
              <sphereGeometry args={[0.044, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.55, 1]} material={toon(BEAK_INSIDE)}>
              <circleGeometry args={[0.044, 20]} />
            </mesh>
            <group ref={jaw} position={[0, 0, -0.006]}>
              <mesh position={[0, 0, 0.006]} scale={[1, 0.3, 0.5]} material={toon(BEAK)}>
                <sphereGeometry args={[0.036, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
              </mesh>
            </group>
          </group>
        </group>
        <Foot side={-1} />
        <Foot side={1} />
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
