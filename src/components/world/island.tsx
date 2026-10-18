"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { daylight } from "./daylight";
import { softDot } from "./textures";
import { gradientMap, toon } from "./toon";

// The floating island the table sits on, like a little diorama: a grassy top with a stream running across it (under a
// stone bridge and off the edge in a waterfall), a lily pond with floating lanterns, a cottage, a windmill and a wheat
// field, all on pale stone cliffs that taper away into the haze below. Local layout, seen from above (the guide sits at
// z = -1.15 facing +z, so everything at -z is the view behind it when you're seated):
//
//            windmill   wheat      cottage
//      ~~~~~~~~~~~~~~ stream ~~~~~~[bridge]~~~~~~~~~ waterfall →
//                pond      (table)   path
//
// Everything here is procedural and seeded, so the island is the same on every load.

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Seeded random, so the island looks the same on every load. */
export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The island's edge, as a radius at each angle: a wobbly circle about 13.5 m across. */
export function islandRadius(theta: number) {
  return 13.5 + Math.sin(theta * 3) * 0.8 + Math.sin(theta * 5 + 1) * 0.5 + Math.sin(theta * 9 + 2) * 0.3;
}

const curve = (pts: number[][]) => new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)));
const STREAM_CURVE = curve([[-11.2, -3.4], [-7, -4.6], [-3.5, -5.6], [0, -5.4], [2.3, -5.2], [5, -4.2], [8.5, -3.2], [15, -2.4]]);
const PATH_CURVE = curve([[-1.5, 12], [1.8, 6], [2.9, 2.2], [2.6, -2.5], [2.3, -5.2], [2.8, -7.6], [4.3, -8.9]]);
const STREAM_PTS = STREAM_CURVE.getSpacedPoints(200);
const PATH_PTS = PATH_CURVE.getSpacedPoints(160);

export const POND = { x: -4.6, z: 2.8, r: 1.7 };
export const COTTAGE = { x: 5.4, z: -9.6 };
export const WINDMILL = { x: -3.2, z: -9.4 };
export const FIELD = { x0: -7.6, x1: -4.6, z0: -8.8, z1: -6.8 };

const insideRadius = (x: number, z: number) => Math.hypot(x, z) / islandRadius(Math.atan2(z, x));

/** Distance from (x, z) to the nearest of `pts`. */
function distTo(pts: THREE.Vector3[], x: number, z: number) {
  let best = Infinity;
  for (const p of pts) {
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

// where the stream runs off the edge, and where the path crosses it
const FALL_INDEX = STREAM_PTS.findIndex((p) => insideRadius(p.x, p.z) > 1);
const FALL = (() => {
  const p = STREAM_PTS[FALL_INDEX];
  const theta = Math.atan2(p.z, p.x), r = islandRadius(theta);
  return { x: Math.cos(theta) * r, z: Math.sin(theta) * r, theta };
})();
const BRIDGE = (() => {
  let best = { i: 0, d: Infinity };
  PATH_PTS.forEach((p, i) => {
    const d = distTo(STREAM_PTS, p.x, p.z);
    if (d < best.d) best = { i, d };
  });
  const p = PATH_PTS[best.i], t = PATH_CURVE.getTangentAt(best.i / (PATH_PTS.length - 1));
  return { x: p.x, z: p.z, angle: Math.atan2(t.x, t.z) };
})();

/** Height of the island's top: flat around the table, with a channel for the stream and a hollow for the pond. */
export function groundY(x: number, z: number) {
  // gentle bumps, flat by the table and at the rim (so the top meets the cliffs)
  const bumps = Math.sin(x * 0.5) * Math.cos(z * 0.45) * 0.06 * smooth(3, 7, Math.hypot(x, z)) * (1 - smooth(0.85, 0.96, insideRadius(x, z)));
  const stream = -0.42 * (1 - smooth(0.75, 1.35, distTo(STREAM_PTS, x, z)));
  const pond = -0.36 * (1 - smooth(POND.r - 0.1, POND.r + 0.5, Math.hypot(x - POND.x, z - POND.z)));
  return bumps + Math.min(stream, pond);
}

/** Free ground for scattering grass, flowers and trees: on the island, clear of water, paths and buildings. */
export function isOpen(x: number, z: number, pad = 0) {
  if (insideRadius(x, z) > 1 - (0.5 + pad) / 13) return false;
  if (Math.hypot(x, z) < 1.4 + pad * 2) return false; // the table
  if (distTo(STREAM_PTS, x, z) < 1.25 + pad) return false;
  if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 0.45 + pad) return false;
  if (distTo(PATH_PTS, x, z) < 0.7 + pad) return false;
  if (x > FIELD.x0 - 0.3 - pad && x < FIELD.x1 + 0.3 + pad && z > FIELD.z0 - 0.3 - pad && z < FIELD.z1 + 0.3 + pad) return false;
  if (Math.hypot(x - COTTAGE.x, z - COTTAGE.z) < 2.1 + pad) return false;
  if (Math.hypot(x - WINDMILL.x, z - WINDMILL.z) < 1.4 + pad) return false;
  return true;
}

// The world view looks at the table from the +x/+z side; keep tall things out of that line of sight.
const VIEW_BEARING = Math.atan2(9.5, 8.5);
export const inView = (x: number, z: number) => Math.abs(Math.atan2(z, x) - VIEW_BEARING) < 0.85;

/**
 * Where the things you grow by practising go (see lib/garden.ts): spread-out open spots, clear of the view from the
 * world camera, in a fixed order so your island always grows the same way.
 */
export const GARDEN_SLOTS: { x: number; z: number; angle: number }[] = (() => {
  const r = rng(123), slots: { x: number; z: number; angle: number }[] = [];
  for (let tries = 0; slots.length < 16 && tries < 4000; tries++) {
    const x = (r() - 0.5) * 24, z = (r() - 0.5) * 24, d = Math.hypot(x, z);
    if (d < 3.2 || d > 11 || inView(x, z) || !isOpen(x, z, 0.7)) continue;
    if (slots.some((s) => Math.hypot(s.x - x, s.z - z) < 2.4)) continue;
    slots.push({ x, z, angle: Math.atan2(-x, -z) }); // facing the table
  }
  // nearest the table first, so the first few things grow where you'll see them
  return slots.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
})();
export const nearGardenSlot = (x: number, z: number, pad: number) => GARDEN_SLOTS.some((s) => Math.hypot(s.x - x, s.z - z) < pad);

const C = (hex: string) => new THREE.Color(hex);
const GRASS = C("#96c95f"), GRASS_LIGHT = C("#b7d96e"), GRASS_DARK = C("#78b257");
const DIRT = C("#dcbd8c"), BANK = C("#c9c3b4"), BED = C("#8fb0b4"), SOIL = C("#b58a57");
const STONE_TOP = C("#e4dccd"), STONE = C("#cfc8bb"), STONE_DARK = C("#a8a4ab");

/** The grassy top: a grid clamped to the island's outline, with the paths, banks and field painted in. */
function IslandTop() {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(30, 30, 170, 170);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i), z = pos.getZ(i);
      const theta = Math.atan2(z, x), r = Math.hypot(x, z), R = islandRadius(theta);
      if (r > R) {
        // outside the outline: fold the vertex onto the edge
        x = Math.cos(theta) * R;
        z = Math.sin(theta) * R;
        pos.setX(i, x);
        pos.setZ(i, z);
      }
      pos.setY(i, groundY(x, z));
      const n = Math.sin(x * 0.35) * Math.cos(z * 0.3) * 0.5 + Math.sin(x * 0.11 + z * 0.17) * 0.5;
      c.copy(GRASS).lerp(n > 0 ? GRASS_LIGHT : GRASS_DARK, Math.abs(n) * 0.6);
      const ds = distTo(STREAM_PTS, x, z), dp = Math.hypot(x - POND.x, z - POND.z) - POND.r;
      const water = Math.min(ds - 0.65, dp);
      if (water < 0.45) c.copy(BANK).lerp(BED, smooth(0.25, -0.2, water)); // stone banks into the bed
      if (distTo(PATH_PTS, x, z) < 0.55) c.copy(DIRT);
      if (x > FIELD.x0 - 0.2 && x < FIELD.x1 + 0.2 && z > FIELD.z0 - 0.2 && z < FIELD.z1 + 0.2) c.copy(SOIL);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshToonMaterial vertexColors gradientMap={gradientMap()} />
    </mesh>
  );
}

/**
 * The island's stone body: faceted cliffs with vertical ridges and a lip of grass, tapering to a jagged point below.
 * `seed` varies the ridges, so the far-off islands don't look identical; `carved` notches the rim where the stream
 * pours over (only the main island has a stream).
 */
export function islandBodyGeometry(seed: number, carved = false) {
  const N = 150;
  const r = rng(seed);
  const ridge = Array.from({ length: N }, () => (r() - 0.5) * 0.5); // per column: vertical ridges down the cliff
  // [y, radius scale, colour]
  const rows: [number, number, THREE.Color][] = [
    [0, 1, GRASS], [-0.22, 1, GRASS_DARK], [-0.3, 0.995, STONE_TOP], [-1.6, 0.985, STONE], [-3.2, 0.97, STONE],
    [-4.8, 0.95, STONE], [-6.2, 0.92, STONE_DARK], [-7.6, 0.78, STONE_DARK], [-9.4, 0.55, STONE_DARK], [-11.8, 0.28, STONE_DARK],
  ];
  const verts: number[] = [], colors: number[] = [], idx: number[] = [];
  rows.forEach(([y, scale, color], row) => {
    for (let i = 0; i < N; i++) {
      const theta = (i / N) * Math.PI * 2;
      const wobble = row < 3 ? 0 : ridge[i] * Math.min(1, row / 4) + (r() - 0.5) * 0.08;
      const R = islandRadius(theta) * scale + wobble;
      const x = Math.cos(theta) * R, z = Math.sin(theta) * R;
      const rim = carved && row < 3 ? groundY(x, z) : 0; // the top rows follow the ground, so the stream has a notch to pour through
      verts.push(x, y + rim + (row > 6 ? (r() - 0.5) * 0.35 : 0), z);
      colors.push(color.r, color.g, color.b);
    }
  });
  const tip = verts.length / 3;
  verts.push(0, -14.5, 0);
  colors.push(STONE_DARK.r, STONE_DARK.g, STONE_DARK.b);
  for (let row = 0; row < rows.length - 1; row++) {
    for (let i = 0; i < N; i++) {
      const a = row * N + i, b = row * N + ((i + 1) % N), c = a + N, d = b + N;
      idx.push(a, b, c, b, d, c);
    }
  }
  const last = (rows.length - 1) * N;
  for (let i = 0; i < N; i++) idx.push(last + i, last + ((i + 1) % N), tip);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(idx);
  const flat = g.toNonIndexed(); // faceted, like carved stone: each triangle gets its own flat normal
  flat.computeVertexNormals();
  return flat;
}

function IslandBody() {
  const geometry = useMemo(() => islandBodyGeometry(5, true), []);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshToonMaterial vertexColors gradientMap={gradientMap()} side={THREE.DoubleSide} />
    </mesh>
  );
}

// the water's colours by day, and at sunset (when it mirrors the peach and rose of the sky)
const WATER = { shallow: C("#9fdcec"), deep: C("#4d9cc4"), shallowDusk: C("#ffcfae"), deepDusk: C("#b88ac4") };

// Water: an unlit shader with drifting light streaks (or ripples for the pond), coloured by the time of day, with fog.
const WATER_VERTEX = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

function waterMaterial(fragment: string, extra: Record<string, THREE.IUniform> = {}, transparent = false) {
  return new THREE.ShaderMaterial({
    vertexShader: WATER_VERTEX,
    fragmentShader: fragment,
    fog: true,
    transparent,
    depthWrite: !transparent,
    side: THREE.DoubleSide,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uEvening: { value: 0 },
        uShallow: { value: WATER.shallow.clone() },
        uDeep: { value: WATER.deep.clone() },
        ...extra,
      },
    ]),
  });
}

const WATER_COMMON = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>
  uniform float uTime, uEvening; uniform vec3 uShallow, uDeep;
  varying vec2 vUv;`;
const WATER_END = /* glsl */ `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>`;

const STREAM_FRAGMENT = /* glsl */ `${WATER_COMMON}
  void main() {
    // vUv.x runs downstream, vUv.y across
    float across = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
    vec3 col = mix(uShallow, uDeep, across * 0.75);
    float a = sin(vUv.x * 260.0 - uTime * 3.0 + sin(vUv.y * 7.0 + vUv.x * 40.0) * 2.0) * 0.5 + 0.5;
    float b = sin(vUv.x * 150.0 - uTime * 2.2 + vUv.y * 11.0) * 0.5 + 0.5;
    col = mix(col, vec3(1.0), smoothstep(0.9, 1.0, a * b) * 0.6);
    gl_FragColor = vec4(col, 1.0);
    ${WATER_END}
  }`;

const POND_FRAGMENT = /* glsl */ `${WATER_COMMON}
  uniform vec2 uLanterns[4];
  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;
    vec3 col = mix(uDeep, uShallow, smoothstep(0.55, 1.0, r));
    col = mix(col, vec3(1.0), smoothstep(0.85, 1.0, sin(r * 38.0 - uTime * 1.4) * 0.5 + 0.5) * 0.18 * (1.0 - r));
    // the lanterns' warm reflections, once the sun is down
    float glow = 0.0;
    for (int i = 0; i < 4; i++) glow += exp(-length((p - uLanterns[i]) * vec2(1.0, 0.45)) * 22.0);
    col += vec3(1.0, 0.72, 0.35) * glow * (0.15 + uEvening * 0.9);
    gl_FragColor = vec4(col, 1.0);
    ${WATER_END}
  }`;

const FALL_FRAGMENT = /* glsl */ `${WATER_COMMON}
  void main() {
    // vUv.y is 1 at the lip and 0 at the bottom; streaks pour downwards and fade into mist
    float streak = sin(vUv.x * 55.0 + sin(vUv.x * 13.0) * 3.0) * 0.5 + 0.5;
    float pour = fract(vUv.y * 7.0 + uTime * 1.8 + streak * 0.6);
    vec3 col = mix(uShallow, vec3(1.0), 0.25 + 0.35 * streak);
    col = mix(col, vec3(1.0), smoothstep(0.7, 1.0, pour) * 0.8);
    col = mix(col, vec3(1.0), smoothstep(0.88, 1.0, vUv.y) * 0.6);   // white water where it tips over the lip
    float alpha = smoothstep(0.0, 0.35, vUv.y) * (0.88 + 0.12 * streak);
    gl_FragColor = vec4(col, alpha);
    ${WATER_END}
  }`;

/** Moves a water shader's clock and sunset colours on; call it from a frame loop. */
function tickWater(mesh: THREE.Mesh | null, time: number) {
  const m = mesh?.material as THREE.ShaderMaterial | undefined;
  if (!m) return;
  m.uniforms.uTime.value = time;
  m.uniforms.uEvening.value = daylight.evening;
  m.uniforms.uShallow.value.copy(WATER.shallow).lerp(WATER.shallowDusk, daylight.evening);
  m.uniforms.uDeep.value.copy(WATER.deep).lerp(WATER.deepDusk, daylight.evening);
}

const FALL_DROP = 10, FALL_REACH = 1.1;

/**
 * The waterfall's sheet, in a frame where +z points out from the island: it leaves the lip moving outwards and curves
 * down (a ballistic arc), so it clears the cliff face, and spreads a little as it falls. uv.y is 1 at the lip.
 */
function waterfallGeometry() {
  const ROWS = 28, COLS = 4, verts: number[] = [], uvs: number[] = [], idx: number[] = [];
  for (let j = 0; j <= ROWS; j++) {
    const t = j / ROWS;
    const out = 0.05 + FALL_REACH * Math.sqrt(t) * 0.9 + t * 0.1;
    const y = -FALL_DROP * t * t - 0.02 * Math.sin(t * Math.PI);
    const width = 1.35 + t * 0.9;
    for (let i = 0; i <= COLS; i++) {
      const u = i / COLS;
      verts.push((u - 0.5) * width, y, out);
      uvs.push(u, 1 - t);
    }
  }
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      const a = j * (COLS + 1) + i, b = a + 1, c = a + COLS + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return g;
}

function Stream() {
  const ref = useRef<THREE.Mesh>(null);
  const fall = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    tickWater(ref.current, clock.getElapsedTime());
    tickWater(fall.current, clock.getElapsedTime());
  });
  const { geometry, material } = useMemo(() => {
    const pts = STREAM_PTS.slice(0, FALL_INDEX + 1);
    pts[pts.length - 1] = new THREE.Vector3(FALL.x, 0, FALL.z);
    const W = 1.35, Y = -0.13;
    const verts: number[] = [], uvs: number[] = [], idx: number[] = [];
    pts.forEach((p, i) => {
      const next = pts[Math.min(i + 1, pts.length - 1)], prev = pts[Math.max(i - 1, 0)];
      const tx = next.x - prev.x, tz = next.z - prev.z, len = Math.hypot(tx, tz) || 1;
      const sx = -tz / len, sz = tx / len;
      for (const s of [-1, 1]) {
        verts.push(p.x + (sx * W * s) / 2, Y, p.z + (sz * W * s) / 2);
        uvs.push(i / (pts.length - 1), s < 0 ? 0 : 1);
      }
      if (i < pts.length - 1) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    return { geometry: g, material: waterMaterial(STREAM_FRAGMENT) };
  }, []);
  const fallMaterial = useMemo(() => waterMaterial(FALL_FRAGMENT, {}, true), []);
  const fallGeometry = useMemo(() => waterfallGeometry(), []);
  const mist = useRef<THREE.Group>(null);
  const mistMap = useMemo(() => softDot(), []);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    mist.current?.children.forEach((m, i) => {
      const k = (t * 0.12 + i / 7) % 1; // each puff billows out and fades, then starts again
      m.position.set(Math.sin(i * 2.3) * (0.6 + k), -FALL_DROP + 0.4 + k * 1.2, FALL_REACH + Math.cos(i * 1.7) * 0.4 + k * 0.5);
      m.scale.setScalar(1.6 + k * 2.4);
      ((m as THREE.Sprite).material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI) * 0.45;
    });
  });
  return (
    <>
      <mesh ref={ref} geometry={geometry} material={material} />
      {/* mossy rocks where the stream bubbles up */}
      {[[0, 0, 0.55], [0.6, 0.35, 0.4], [-0.3, 0.6, 0.35], [0.4, -0.55, 0.3]].map(([dx, dz, s], i) => (
        <mesh key={i} position={[STREAM_PTS[0].x - 0.5 + dx, -0.1, STREAM_PTS[0].z + dz]} scale={[s, s * 0.7, s]} material={toon(i % 2 ? "#bfc0bb" : "#cfd0ca")} castShadow>
          <dodecahedronGeometry args={[1, 0]} />
        </mesh>
      ))}
      {/* the waterfall, pouring off the edge into the haze */}
      <group position={[FALL.x, -0.13, FALL.z]} rotation={[0, Math.PI / 2 - FALL.theta, 0]}>
        <mesh ref={fall} geometry={fallGeometry} material={fallMaterial} />
        <group ref={mist}>
          {Array.from({ length: 7 }, (_, i) => (
            <sprite key={i}>
              <spriteMaterial map={mistMap} color="#ffffff" transparent opacity={0} depthWrite={false} />
            </sprite>
          ))}
        </group>
      </group>
    </>
  );
}

/** A small square lantern (a glowing cube in a dark frame), brighter as the sun goes down. */
export function BoxLantern({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const core = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (core.current) core.current.emissiveIntensity = (0.35 + daylight.evening * 2.4) * (1 + Math.sin(clock.getElapsedTime() * 6 + position[0]) * 0.05);
  });
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.09, 0]}>
        <boxGeometry args={[0.13, 0.13, 0.13]} />
        <meshStandardMaterial ref={core} color="#ffe2a0" emissive="#ffbe5c" emissiveIntensity={0.35} />
      </mesh>
      {[0, 0.18].map((y) => (
        <mesh key={y} position={[0, y + 0.01, 0]} material={toon("#4a3a30")}>
          <boxGeometry args={[0.17, 0.03, 0.17]} />
        </mesh>
      ))}
    </group>
  );
}

// where the pond's lanterns float, in its uv space (centred on 0)
const POND_LANTERNS: [number, number][] = [[-0.25, 0.2], [0.3, -0.1], [0.05, -0.3], [-0.1, 0.33]];

/** The lily pond: lily pads, pink lotus flowers, and lanterns floating on the pads. */
function Pond() {
  const ref = useRef<THREE.Mesh>(null);
  const material = useMemo(() => waterMaterial(POND_FRAGMENT, { uLanterns: { value: POND_LANTERNS.map(([x, y]) => new THREE.Vector2(x, y)) } }), []);
  const pads = useMemo(() => {
    const r = rng(77);
    return Array.from({ length: 9 }, (_, i) => {
      const a = (i / 9) * Math.PI * 2 + r(), d = 0.35 + r() * 0.95;
      return { x: Math.cos(a) * d, z: Math.sin(a) * d, s: 0.16 + r() * 0.1, rot: r() * 6, lotus: r() > 0.55 };
    });
  }, []);
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    tickWater(ref.current, clock.getElapsedTime());
    if (light.current) light.current.intensity = daylight.evening * 1.1;
  });
  return (
    <group position={[POND.x, 0, POND.z]}>
      <mesh ref={ref} position={[0, -0.11, 0]} rotation={[-Math.PI / 2, 0, 0]} material={material}>
        <circleGeometry args={[POND.r + 0.15, 48]} />
      </mesh>
      {pads.map((p, i) => (
        <group key={i} position={[p.x, -0.095, p.z]} rotation={[0, p.rot, 0]}>
          {/* a pad with a notch cut out */}
          <mesh material={toon("#6db159")}>
            <cylinderGeometry args={[p.s, p.s, 0.02, 20, 1, false, 0.4, Math.PI * 2 - 0.4]} />
          </mesh>
          {p.lotus && (
            <group position={[0.02, 0.04, 0]}>
              {[0, 1, 2, 3, 4].map((k) => (
                <mesh key={k} rotation={[0.5, (k / 5) * Math.PI * 2, 0]} position={[Math.sin((k / 5) * Math.PI * 2) * 0.03, 0.02, Math.cos((k / 5) * Math.PI * 2) * 0.03]} material={toon("#ff9cc8")}>
                  <coneGeometry args={[0.03, 0.08, 6]} />
                </mesh>
              ))}
              <mesh position={[0, 0.04, 0]} material={toon("#ffe066")}>
                <sphereGeometry args={[0.02, 8, 6]} />
              </mesh>
            </group>
          )}
        </group>
      ))}
      {POND_LANTERNS.map(([u, v], i) => (
        // uv → local: the circle's uv spans the diameter, with v pointing towards -z once it's laid flat
        <group key={i} position={[u * (POND.r + 0.15) * 2, -0.09, -v * (POND.r + 0.15) * 2]}>
          <mesh material={toon("#5fa64e")}>
            <cylinderGeometry args={[0.16, 0.16, 0.02, 18]} />
          </mesh>
          <BoxLantern position={[0, 0.01, 0]} />
        </group>
      ))}
      <pointLight ref={light} position={[0, 0.6, 0]} color="#ffb860" intensity={0} distance={4.5} decay={2} />
    </group>
  );
}

/** An arched stone footbridge where the path crosses the stream. */
function Bridge() {
  const L = 2.9, SEG = 11, stone = toon("#dedad1"), cap = toon("#cbc6bb");
  const arch = (t: number) => 0.06 + 0.38 * Math.sin(Math.PI * t);
  return (
    <group position={[BRIDGE.x, 0, BRIDGE.z]} rotation={[0, BRIDGE.angle, 0]}>
      {Array.from({ length: SEG }, (_, k) => {
        const t = (k + 0.5) / SEG, z = (t - 0.5) * L, slope = Math.atan(0.38 * Math.PI * Math.cos(Math.PI * t) / L);
        return (
          <group key={k} position={[0, arch(t), z]} rotation={[-slope, 0, 0]}>
            <mesh material={stone} castShadow receiveShadow>
              <boxGeometry args={[1.2, 0.22, (L / SEG) * 1.08]} />
            </mesh>
            {[-1, 1].map((side) => (
              <mesh key={side} position={[side * 0.56, 0.17, 0]} material={cap} castShadow>
                <boxGeometry args={[0.1, 0.16, (L / SEG) * 1.08]} />
              </mesh>
            ))}
          </group>
        );
      })}
      {/* end posts */}
      {[-1, 1].flatMap((end) =>
        [-1, 1].map((side) => (
          <mesh key={`${end}${side}`} position={[side * 0.56, 0.22, end * (L / 2)]} material={cap} castShadow>
            <boxGeometry args={[0.16, 0.36, 0.16]} />
          </mesh>
        )),
      )}
    </group>
  );
}

/** A little cottage with a pitched red roof, a chimney, and windows that light up at sunset. */
function Cottage() {
  const windows = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (windows.current) windows.current.emissiveIntensity = 0.1 + daylight.evening * 1.6;
  });
  const roof = useMemo(() => {
    const shape = new THREE.Shape([new THREE.Vector2(-1.25, 0), new THREE.Vector2(1.25, 0), new THREE.Vector2(0, 1.05)]);
    return new THREE.ExtrudeGeometry(shape, { depth: 2.3, bevelEnabled: false }).translate(0, 0, -1.15);
  }, []);
  return (
    <group position={[COTTAGE.x, groundY(COTTAGE.x, COTTAGE.z), COTTAGE.z]} rotation={[0, -0.5, 0]}>
      <mesh position={[0, 0.65, 0]} material={toon("#f6ecdc")} castShadow receiveShadow>
        <boxGeometry args={[2.1, 1.3, 2.0]} />
      </mesh>
      <mesh position={[0, 1.3, 0]} geometry={roof} material={toon("#c8644c")} castShadow />
      <mesh position={[0.55, 1.95, -0.3]} material={toon("#b6a898")} castShadow>
        <boxGeometry args={[0.25, 0.6, 0.25]} />
      </mesh>
      {/* the door and windows, facing the path */}
      <mesh position={[0, 0.4, 1.01]} material={toon("#8a5a3c")}>
        <boxGeometry args={[0.42, 0.8, 0.04]} />
      </mesh>
      {[-0.65, 0.65].map((x) => (
        <mesh key={x} position={[x, 0.75, 1.01]}>
          <boxGeometry args={[0.36, 0.34, 0.04]} />
          <meshStandardMaterial ref={x < 0 ? windows : undefined} color="#ffe7b0" emissive="#ffb34d" emissiveIntensity={0.1} />
        </mesh>
      ))}
      <BoxLantern position={[0.38, 0.85, 1.07]} scale={0.8} />
    </group>
  );
}

/** A windmill whose sails turn slowly in the breeze. */
function Windmill() {
  const sails = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (sails.current) sails.current.rotation.z += dt * 0.5;
  });
  return (
    <group position={[WINDMILL.x, groundY(WINDMILL.x, WINDMILL.z), WINDMILL.z]} rotation={[0, 0.5, 0]}>
      <mesh position={[0, 1.2, 0]} material={toon("#efe6d6")} castShadow receiveShadow>
        <cylinderGeometry args={[0.45, 0.7, 2.4, 8]} />
      </mesh>
      <mesh position={[0, 2.75, 0]} material={toon("#c8644c")} castShadow>
        <coneGeometry args={[0.62, 0.8, 8]} />
      </mesh>
      <mesh position={[0, 0.35, 0.66]} material={toon("#8a5a3c")}>
        <boxGeometry args={[0.32, 0.6, 0.06]} />
      </mesh>
      <group ref={sails} position={[0, 2.25, 0.62]}>
        <mesh material={toon("#7a5a40")}>
          <cylinderGeometry args={[0.08, 0.08, 0.16, 10]} />
        </mesh>
        {[0, 1, 2, 3].map((k) => (
          <group key={k} rotation={[0, 0, (k * Math.PI) / 2]}>
            <mesh position={[0, 0.75, 0]} material={toon("#7a5a40")}>
              <boxGeometry args={[0.05, 1.5, 0.04]} />
            </mesh>
            <mesh position={[0.12, 0.85, 0.01]} material={toon("#f3ede2")}>
              <boxGeometry args={[0.2, 1.1, 0.02]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/** Rows of golden wheat, in raised bundles like the reference. */
function WheatField() {
  const bundles = useMemo(() => {
    const r = rng(91), out: { x: number; z: number; w: number; d: number; h: number; c: string }[] = [];
    for (let x = FIELD.x0 + 0.35; x < FIELD.x1; x += 0.75) {
      for (let z = FIELD.z0 + 0.3; z < FIELD.z1; z += 0.62) {
        out.push({ x: x + (r() - 0.5) * 0.08, z: z + (r() - 0.5) * 0.08, w: 0.62, d: 0.5, h: 0.22 + r() * 0.1, c: ["#efc85d", "#e3b54e", "#f3d474"][Math.floor(r() * 3)] });
      }
    }
    return out;
  }, []);
  return (
    <group>
      {bundles.map((b, i) => (
        <mesh key={i} position={[b.x, b.h / 2, b.z]} material={toon(b.c)} castShadow receiveShadow>
          <boxGeometry args={[b.w, b.h, b.d]} />
        </mesh>
      ))}
    </group>
  );
}

/** Two or three little islands floating far off in the haze, each with a tree, for depth. */
function FarIslands() {
  const islands = useMemo(
    () => [
      { p: [-46, -9, -34] as const, s: 0.28, seed: 11 },
      { p: [52, -14, -22] as const, s: 0.22, seed: 12 },
      { p: [30, -20, 50] as const, s: 0.32, seed: 13 },
      { p: [-40, -24, 44] as const, s: 0.18, seed: 14 },
    ],
    [],
  );
  const geometries = useMemo(() => islands.map((i) => islandBodyGeometry(i.seed)), [islands]);
  return (
    <>
      {islands.map((isl, i) => (
        <group key={i} position={[...isl.p]} scale={isl.s}>
          <mesh geometry={geometries[i]}>
            <meshToonMaterial vertexColors gradientMap={gradientMap()} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} material={toon("#8cc565")}>
            <circleGeometry args={[13.6, 32]} />
          </mesh>
          <group scale={3}>
            <mesh position={[0, 1.4, 0]} material={toon("#4f8f55")}>
              <coneGeometry args={[0.9, 2.2, 8]} />
            </mesh>
            <mesh position={[0, 0.35, 0]} material={toon("#8a6248")}>
              <cylinderGeometry args={[0.15, 0.2, 0.7, 8]} />
            </mesh>
          </group>
        </group>
      ))}
    </>
  );
}

export function Island() {
  return (
    <>
      <IslandTop />
      <IslandBody />
      <Stream />
      <Pond />
      <Bridge />
      <Cottage />
      <Windmill />
      <WheatField />
      <FarIslands />
    </>
  );
}
