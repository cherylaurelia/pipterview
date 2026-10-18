"use client";

import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";

// The two characters at the table: fluffy, slightly grumpy chicks (a tall fuzzy bean with heavy-lidded eyes, a little
// beak and skinny orange legs), after the reference render. The fur is shell texturing: the body is drawn ~30 times,
// each shell pushed a little further out along the normals, and a per-strand noise pattern cuts each shell down to
// tapering hairs. Local coordinates: the chick faces +z, towards the table, sitting on the chair seat.

type V3 = [number, number, number];

export type Outfit = "guide" | "you";

const SEAT_Y = 0.48;

// colours as display (sRGB) values for the fur shader, which writes them straight out
const srgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

const PALETTES: Record<Outfit, { root: string; tip: string; skin: string; lid: string }> = {
  guide: { root: "#b7a24a", tip: "#f2e8a6", skin: "#a8933f", lid: "#d9c76c" },
  you: { root: "#8aabc8", tip: "#e6f3fd", skin: "#7f9fbd", lid: "#b4d2ec" },
};

// the sun and fill directions from WorldScene, for the fur's own simple lighting
const SUN = new THREE.Vector3(-10, 18, -14).normalize();
const FILL = new THREE.Vector3(8, 6, 10).normalize();

const furVertex = /* glsl */ `
  uniform float uLen, uShells, uTime, uTuft;
  varying vec2 vUv; varying float vH; varying vec3 vN;
  void main() {
    float h = (float(gl_InstanceID) + 1.0) / uShells;
    vec3 n = normalize(normal);
    float L = uLen * (1.0 + smoothstep(0.86, 1.0, uv.y) * uTuft);   // a scruffy tuft on top
    vec3 p = position + n * h * L;
    // messy fur: each patch leans its own way, more so towards the tips
    vec3 q = position * 17.0;
    p += vec3(sin(q.y + q.z * 1.3), sin(q.x * 1.7 + q.z) * 0.5, sin(q.x + q.y * 1.1)) * h * L * 0.4;
    // gravity, and a faint breeze
    p.y -= h * h * L * 0.45;
    p.x += sin(uTime * 1.4 + position.y * 5.0) * h * h * L * 0.12;
    vUv = uv; vH = h;
    vN = normalize(mat3(modelMatrix) * n);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`;

const furFragment = /* glsl */ `
  uniform vec3 uRoot, uTip, uSun, uFill; uniform vec2 uDensity;
  varying vec2 vUv; varying float vH; varying vec3 vN;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec2 g = vUv * uDensity;
    vec2 cell = floor(g);
    vec2 f = fract(g) - 0.5 + (vec2(hash(cell + 7.0), hash(cell + 13.0)) - 0.5) * 0.4;
    float len = 0.6 + 0.4 * hash(cell);                 // strands of different lengths
    if (vH > len) discard;
    if (length(f) > 0.68 * pow(1.0 - vH / len, 0.7)) discard;     // each strand tapers to a point
    vec3 col = mix(uRoot, uTip, pow(vH, 0.8)) * (0.85 + 0.3 * hash(cell + 3.1));
    vec3 n = normalize(vN);
    float sky = n.y * 0.5 + 0.5;
    vec3 light = mix(vec3(0.62, 0.66, 0.55), vec3(1.0, 1.0, 1.02), sky) * 0.86
      + vec3(1.0, 0.9, 0.78) * max(dot(n, uSun), 0.0) * 0.45
      + vec3(1.0, 0.97, 0.92) * max(dot(n, uFill), 0.0) * 0.3;
    gl_FragColor = vec4(col * light * mix(0.66, 1.06, vH), 1.0);
  }`;

/** Shell-textured fur over `geometry`, plus an opaque skin underneath that casts the shadow. */
function Fur({ geometry, root, tip, skin, length = 0.07, density = [170, 110], shells = 36, tuft = 0 }: {
  geometry: THREE.BufferGeometry; root: string; tip: string; skin: string; length?: number; density?: [number, number]; shells?: number; tuft?: number;
}) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: furVertex,
        fragmentShader: furFragment,
        toneMapped: false,
        uniforms: {
          uLen: { value: length }, uShells: { value: shells }, uTime: { value: 0 }, uTuft: { value: tuft },
          uRoot: { value: srgb(root) }, uTip: { value: srgb(tip) }, uSun: { value: SUN }, uFill: { value: FILL },
          uDensity: { value: new THREE.Vector2(...density) },
        },
      }),
    [length, shells, tuft, root, tip, density],
  );
  const shellsRef = useRef<THREE.InstancedMesh>(null);
  useFrame(({ clock }) => {
    const m = shellsRef.current?.material as THREE.ShaderMaterial | undefined;
    if (m) m.uniforms.uTime.value = clock.getElapsedTime();
  });
  return (
    <>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial color={skin} roughness={1} />
      </mesh>
      <instancedMesh ref={shellsRef} args={[geometry, material, shells]} frustumCulled={false} />
    </>
  );
}

// the body: a tall bean, a little wider at the bottom, slightly flattened front to back
const BODY_H = 1.0;
const bodyProfile: [number, number][] = [
  [0, 0], [0.2, 0.01], [0.32, 0.07], [0.37, 0.2], [0.375, 0.38], [0.36, 0.58], [0.34, 0.75], [0.3, 0.87], [0.2, 0.96], [0, 1.0],
];
const bodyGeometry = (() => {
  const g = new THREE.LatheGeometry(bodyProfile.map(([r, y]) => new THREE.Vector2(r, y * BODY_H)), 64, 0, Math.PI * 2);
  g.scale(1, 1, 0.88);
  return g;
})();
const wingGeometry = new THREE.SphereGeometry(0.15, 32, 24).scale(0.5, 1, 0.85);

/** The body's radius at height y (0..1), from the profile; used to put the eyes and beak on the surface. */
function radiusAt(y: number) {
  for (let i = 1; i < bodyProfile.length; i++) {
    const [r0, y0] = bodyProfile[i - 1], [r1, y1] = bodyProfile[i];
    if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
  }
  return 0;
}

const eyeWhite = new THREE.MeshStandardMaterial({ color: "#e9eef0", roughness: 0.25 });
const pupilMat = new THREE.MeshStandardMaterial({ color: "#1c1d22", roughness: 0.2 });
const beakMat = new THREE.MeshStandardMaterial({ color: "#dfa07e", roughness: 0.55 });
const legMat = new THREE.MeshStandardMaterial({ color: "#e3a06c", roughness: 0.6 });

const EYE_Y = 0.7, EYE_ANGLE = 0.38, EYE_R = 0.095;

/** One heavy-lidded eye. `side` is -1 for the chick's right, 1 for its left. */
function Eye({ side, lidColor, lidRef, pupilRef }: { side: -1 | 1; lidColor: string; lidRef: React.Ref<THREE.Group>; pupilRef: React.Ref<THREE.Group> }) {
  const r = radiusAt(EYE_Y) * 1.06;
  const a = side * EYE_ANGLE;
  return (
    <group position={[Math.sin(a) * r, EYE_Y * BODY_H, Math.cos(a) * r * 0.88]} rotation={[0, a, 0]}>
      <mesh material={eyeWhite} castShadow>
        <sphereGeometry args={[EYE_R, 32, 24]} />
      </mesh>
      <group ref={pupilRef}>
        <mesh position={[-side * 0.014, -0.022, EYE_R - 0.012]} scale={[1, 0.85, 0.5]} material={pupilMat}>
          <sphereGeometry args={[0.02, 16, 12]} />
        </mesh>
      </group>
      {/* the lid: a cap over the top half, tipped forward and sloping down towards the beak (the grumpy look) */}
      <group rotation={[0, 0, side * 0.22]}>
        <group ref={lidRef}>
          <mesh>
            <sphereGeometry args={[EYE_R * 1.07, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
            <meshStandardMaterial color={lidColor} roughness={0.9} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function Leg({ side }: { side: -1 | 1 }) {
  const x = side * 0.11;
  return (
    <group position={[x, 0.04, 0.22]}>
      {/* the legs dangle off the front of the seat */}
      <mesh position={[0, -0.12, 0.08]} rotation={[0.55, 0, 0]} material={legMat} castShadow>
        <cylinderGeometry args={[0.016, 0.018, 0.28, 10]} />
      </mesh>
      <group position={[0, -0.24, 0.155]} rotation={[0.25, side * 0.15, 0]}>
        {[-0.5, 0, 0.5].map((a) => (
          <mesh key={a} position={[Math.sin(a) * 0.05, 0, Math.cos(a) * 0.05]} rotation={[Math.PI / 2, 0, -a]} material={legMat} castShadow>
            <capsuleGeometry args={[0.014, 0.08, 4, 8]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function OfficeChair() {
  const dark = "#3a3d44";
  return (
    <group>
      <mesh position={[0, 0.45, -0.02]} castShadow receiveShadow>
        <boxGeometry args={[0.52, 0.06, 0.5]} />
        <meshStandardMaterial color={dark} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.82, -0.3]} rotation={[-0.12, 0, 0]} castShadow>
        <boxGeometry args={[0.48, 0.6, 0.05]} />
        <meshStandardMaterial color={dark} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.25, -0.02]}>
        <cylinderGeometry args={[0.03, 0.03, 0.4, 10]} />
        <meshStandardMaterial color="#b8bcc4" metalness={0.8} roughness={0.3} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} rotation={[0, (i / 5) * Math.PI * 2, 0]} position={[0, 0.05, -0.02]}>
          <boxGeometry args={[0.04, 0.03, 0.55]} />
          <meshStandardMaterial color="#b8bcc4" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

export interface FigureProps {
  position: V3;
  rotationY: number;
  outfit: Outfit;
  /** Talks (beak, bobbing, wing waves) while true. */
  speaking?: boolean;
  /** Hide the chick when the camera is inside it (first-person). */
  firstPerson?: boolean;
}

// gentle, never-repeating drift: a few sines at unrelated rates
const drift = (t: number, seed: number) => Math.sin(t * 0.31 + seed) * 0.5 + Math.sin(t * 0.73 + seed * 2.1) * 0.3 + Math.sin(t * 1.37 + seed * 3.7) * 0.2;

const LID_REST = 0.06, LID_SHUT = 1.45;

export function Figure({ position, rotationY, outfit, speaking = false, firstPerson = false }: FigureProps) {
  const chick = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const jaw = useRef<THREE.Group>(null);
  const lidL = useRef<THREE.Group>(null), lidR = useRef<THREE.Group>(null);
  const pupilL = useRef<THREE.Group>(null), pupilR = useRef<THREE.Group>(null);
  const wings = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const talk = useRef(0);
  const nextBlink = useRef(outfit === "guide" ? 2.2 : 3.6);
  const world = useRef(new THREE.Vector3());
  const seed = outfit === "guide" ? 1.7 : 5.3;
  const pal = PALETTES[outfit];

  useFrame(({ clock, camera }, dt) => {
    const t = clock.getElapsedTime();
    talk.current += ((speaking ? 1 : 0) - talk.current) * Math.min(1, dt * 3);
    const k = talk.current;
    if (body.current) {
      const breathe = Math.sin(t * 1.3 + seed);
      body.current.scale.set(1 - breathe * 0.008, 1 + breathe * 0.014, 1 - breathe * 0.008);
      body.current.rotation.z = drift(t * 0.5, seed) * 0.05;                     // a slow, bored sway
      body.current.rotation.x = 0.03 + k * 0.06 + drift(t * 0.4, seed + 2) * 0.02;
      body.current.rotation.y = drift(t * 0.3, seed + 4) * 0.12 * (1 - k * 0.7);
      body.current.position.y = k * Math.abs(Math.sin(t * 6.5)) * 0.012;          // little hops of emphasis while talking
    }
    // beak: chatters while talking
    if (jaw.current) jaw.current.rotation.x = k * (0.15 + 0.25 * Math.abs(Math.sin(t * 11)));
    // slow grumpy blinks
    if (t > nextBlink.current + 0.18) nextBlink.current = t + 2.5 + Math.random() * 3.5;
    const blink = t > nextBlink.current ? Math.sin(((t - nextBlink.current) / 0.18) * Math.PI) : 0;
    [lidL, lidR].forEach((l) => {
      if (l.current) l.current.rotation.x = LID_REST + (LID_SHUT - LID_REST) * blink;
    });
    [pupilL, pupilR].forEach((p) => {
      if (p.current) p.current.rotation.y = drift(t * 0.7, seed + 6) * 0.25;
    });
    wings.forEach((w, i) => {
      if (!w.current) return;
      const side = i ? 1 : -1;
      w.current.rotation.z = side * (0.18 + k * (0.15 + 0.2 * Math.sin(t * 5 + i)));
    });
    if (chick.current) {
      if (firstPerson) {
        const w = chick.current.getWorldPosition(world.current);
        w.y += 0.6;
        chick.current.visible = w.distanceTo(camera.position) > 1.0;
      } else chick.current.visible = true;
    }
  });

  const beakR = radiusAt(0.6) * 0.88;
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <OfficeChair />
      <group ref={chick} position={[0, SEAT_Y, 0.02]}>
        <group ref={body}>
          <Fur geometry={bodyGeometry} root={pal.root} tip={pal.tip} skin={pal.skin} tuft={1.6} />
          {[0, 1].map((i) => {
            const side = i ? 1 : -1;
            return (
              <group key={i} ref={wings[i]} position={[side * 0.34, 0.48, 0.06]}>
                <group position={[0, -0.1, 0]} rotation={[0.35, side * -0.5, 0]}>
                  <Fur geometry={wingGeometry} root={pal.root} tip={pal.tip} skin={pal.skin} length={0.06} density={[60, 34]} shells={22} />
                </group>
              </group>
            );
          })}
          <Eye side={-1} lidColor={pal.lid} lidRef={lidR} pupilRef={pupilR} />
          <Eye side={1} lidColor={pal.lid} lidRef={lidL} pupilRef={pupilL} />
          {/* beak: a small upper beak, and a lower one hinged so it can talk */}
          <group position={[0, 0.6 * BODY_H, beakR + 0.035]}>
            <mesh rotation={[Math.PI / 2 + 0.2, 0, 0]} scale={[1.25, 1, 0.75]} material={beakMat} castShadow>
              <coneGeometry args={[0.045, 0.085, 20]} />
            </mesh>
            <group ref={jaw} position={[0, -0.018, -0.01]}>
              <mesh position={[0, -0.006, 0.02]} rotation={[Math.PI / 2 + 0.5, 0, 0]} scale={[1.1, 1, 0.5]} material={beakMat}>
                <coneGeometry args={[0.03, 0.05, 16]} />
              </mesh>
            </group>
          </group>
          {outfit === "guide" && (
            // a tiny navy tie, peeking out of the fluff: this one is the interviewer
            <group position={[0, 0.42, radiusAt(0.42) * 0.88 + 0.05]} rotation={[-0.12, 0, 0]}>
              <mesh position={[0, 0.03, 0]}>
                <boxGeometry args={[0.04, 0.03, 0.02]} />
                <meshStandardMaterial color="#13233f" roughness={0.6} />
              </mesh>
              <mesh position={[0, -0.05, 0]}>
                <boxGeometry args={[0.035, 0.13, 0.015]} />
                <meshStandardMaterial color="#13233f" roughness={0.6} />
              </mesh>
            </group>
          )}
        </group>
        <Leg side={-1} />
        <Leg side={1} />
      </group>
    </group>
  );
}

export const TABLE_TOP = 0.76;

/** The round glass-topped table on a chrome stand. Clickable while `interactive`. */
export function RoundTable({ interactive, onSelect }: { interactive: boolean; onSelect: () => void }) {
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
    document.body.style.cursor = "";
  };

  return (
    <group
      onPointerOver={over}
      onPointerOut={out}
      onClick={(e) => {
        if (!interactive) return;
        e.stopPropagation();
        out();
        onSelect();
      }}
    >
      <mesh position={[0, TABLE_TOP, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.78, 0.78, 0.04, 64]} />
        <meshPhysicalMaterial color={hover ? "#d9eeff" : "#c4e0f2"} roughness={0.08} metalness={0.05} clearcoat={1} transparent opacity={0.88} emissive="#f5c84c" emissiveIntensity={hover ? 0.12 : 0} />
      </mesh>
      <mesh position={[0, TABLE_TOP / 2, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, TABLE_TOP, 16]} />
        <meshStandardMaterial color="#c9ccd2" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <cylinderGeometry args={[0.36, 0.4, 0.04, 32]} />
        <meshStandardMaterial color="#c9ccd2" metalness={0.85} roughness={0.2} />
      </mesh>
      {/* a soft yellow ring on the grass that says "click me" */}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[1.75, 1.85, 72]} />
        <meshBasicMaterial color="#f5c84c" transparent opacity={0.6} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
