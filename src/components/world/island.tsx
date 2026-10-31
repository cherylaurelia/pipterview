"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { daylight } from "./daylight";
import { softDot } from "./textures";
import { gradientMap, painterly, swayingToon, toon } from "./toon";

// The floating island the table sits on, like a little diorama: a grassy top with a stream running across it (under a
// stone bridge and off the edge in a waterfall), a big pond with a sandy shore and a wooden dock (see pond.tsx for the
// pond and its creatures), a cottage, a windmill and a wheat field, all on pale stone cliffs that taper away into the
// haze below. Local layout, seen from above (the guide sits at z = -1.15 facing +z, so everything at -z is the view
// behind it when you're seated):
//
//            windmill   wheat      cottage
//      ~~~~~~~~~~~~~~ stream ~~~~~~[bridge]~~~~~~~~~ waterfall →
//             pond  (table)   path
//               dock ⌟__________/
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

export const POND = { x: -5, z: 3.4, r: 2.6 };
export const COTTAGE = { x: 5.4, z: -9.6 };
export const WINDMILL = { x: -3.2, z: -9.4 };
export const FIELD = { x0: -7.6, x1: -4.6, z0: -8.8, z1: -6.8 };

/** Where (x, z) lands in the frame of something at (ox, oz) turned by `angle`, turned back into the world's frame. */
const place = (ox: number, oz: number, angle: number, lx: number, lz: number) => ({
  x: ox + lx * Math.cos(angle) + lz * Math.sin(angle),
  z: oz - lx * Math.sin(angle) + lz * Math.cos(angle),
});
export const COTTAGE_TURN = -0.5, WINDMILL_TURN = 0.5;

/**
 * The benches you can sit on (see village.tsx): one looking out over the pond, one by the cottage door and one at the
 * foot of the windmill. Each faces `angle` (its seat looks along +z when turned by it).
 */
export const BENCHES: { id: string; x: number; z: number; angle: number }[] = (() => {
  const facing = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z);
  const pondTheta = 2.25, pondR = 2.6 * 1.05 + 1.6;
  const pond = { x: -5 + Math.cos(pondTheta) * pondR, z: 3.4 + Math.sin(pondTheta) * pondR };
  const cottage = place(COTTAGE.x, COTTAGE.z, COTTAGE_TURN, 1.95, 0.85);
  const windmill = place(WINDMILL.x, WINDMILL.z, WINDMILL_TURN, 1.45, -0.1); // round the side, not in front of the door
  return [
    { id: "pond", ...pond, angle: facing(pond.x, pond.z, -5, 3.4) },
    { id: "cottage", ...cottage, angle: COTTAGE_TURN },
    { id: "windmill", ...windmill, angle: WINDMILL_TURN + Math.PI / 2 },
  ];
})();

const insideRadius = (x: number, z: number) => Math.hypot(x, z) / islandRadius(Math.atan2(z, x));

/** The pond's edge, as a radius from its centre at each angle: a lopsided kidney shape rather than a circle. */
export function pondRadius(theta: number) {
  return POND.r * (1 + Math.sin(theta * 2 + 0.6) * 0.14 + Math.sin(theta * 3 + 2.1) * 0.07 + Math.sin(theta * 5) * 0.04);
}

/** How far (x, z) is outside the pond's edge (negative in the water). */
export function pondEdge(x: number, z: number) {
  const dx = x - POND.x, dz = z - POND.z;
  return Math.hypot(dx, dz) - pondRadius(Math.atan2(dz, dx));
}

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
/** The wooden dock: where it leaves the shore, and its heading out over the water (towards the pond's middle). */
export const DOCK = (() => {
  const theta = 0.8, R = pondRadius(theta);
  const x = POND.x + Math.cos(theta) * R, z = POND.z + Math.sin(theta) * R;
  return { x, z, angle: Math.atan2(POND.x - x, POND.z - z), length: 1.9 };
})();

// a little dirt path from the main path down to the dock
const SPUR_PTS = (() => {
  const out = { x: Math.sin(DOCK.angle + Math.PI), z: Math.cos(DOCK.angle + Math.PI) };
  const aim = { x: DOCK.x + out.x * 3.5, z: DOCK.z + out.z * 3.5 };
  const join = PATH_PTS.reduce((a, b) => (Math.hypot(b.x - aim.x, b.z - aim.z) < Math.hypot(a.x - aim.x, a.z - aim.z) ? b : a));
  return curve([
    [DOCK.x - out.x * 0.2, DOCK.z - out.z * 0.2],
    [DOCK.x + out.x * 1.4, DOCK.z + out.z * 1.4],
    [(DOCK.x + out.x * 1.4 + join.x) / 2 + 0.3, (DOCK.z + out.z * 1.4 + join.z) / 2 - 0.3],
    [join.x, join.z],
  ]).getSpacedPoints(50);
})();
const PATHS = [...PATH_PTS, ...SPUR_PTS];

export const BRIDGE = (() => {
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
  const pond = -0.36 * (1 - smooth(-0.35, 0.25, pondEdge(x, z))); // meets the water level right at the edge
  return bumps + Math.min(stream, pond);
}

/** Free ground for scattering grass, flowers and trees: on the island, clear of water, paths and buildings. */
export function isOpen(x: number, z: number, pad = 0) {
  if (insideRadius(x, z) > 1 - (0.5 + pad) / 13) return false;
  if (Math.hypot(x, z) < 1.4 + pad * 2) return false; // the table
  if (distTo(STREAM_PTS, x, z) < 1.25 + pad) return false;
  if (pondEdge(x, z) < 0.45 + pad) return false;
  if (distTo(PATHS, x, z) < 0.7 + pad) return false;
  if (x > FIELD.x0 - 0.3 - pad && x < FIELD.x1 + 0.3 + pad && z > FIELD.z0 - 0.3 - pad && z < FIELD.z1 + 0.3 + pad) return false;
  if (Math.hypot(x - COTTAGE.x, z - COTTAGE.z) < 2.1 + pad) return false;
  if (Math.hypot(x - WINDMILL.x, z - WINDMILL.z) < 1.4 + pad) return false;
  if (BENCHES.some((b) => Math.hypot(x - b.x, z - b.z) < 1 + pad)) return false;
  return true;
}

/** (x, z) in a frame set at (ox, oz) and turned by `angle` (as a group with rotation-y `angle` would be). */
function local(x: number, z: number, ox: number, oz: number, angle: number) {
  const dx = x - ox, dz = z - oz;
  return { x: dx * Math.cos(angle) - dz * Math.sin(angle), z: dx * Math.sin(angle) + dz * Math.cos(angle) };
}

const BRIDGE_LENGTH = 2.9;
const onBridge = (x: number, z: number) => {
  const p = local(x, z, BRIDGE.x, BRIDGE.z, BRIDGE.angle);
  return Math.abs(p.x) < 0.5 && Math.abs(p.z) < BRIDGE_LENGTH / 2 + 0.1 ? p : null;
};
const onDock = (x: number, z: number) => {
  const p = local(x, z, DOCK.x, DOCK.z, DOCK.angle);
  return Math.abs(p.x) < 0.36 && p.z > -0.5 && p.z < DOCK.length - 0.05;
};

/**
 * Whether you can stand at (x, z) when walking about the island: on it, out of the pond (unless you're on the dock)
 * and the stream (unless you're on the bridge), and not inside the buildings, the wheat or the table and chairs.
 * Trees are left to the caller (see landscape.tsx).
 */
export function walkable(x: number, z: number) {
  if (insideRadius(x, z) > 0.96) return false;
  if (onDock(x, z) || onBridge(x, z)) return true;
  if (pondEdge(x, z) < 0.05) return false;
  if (distTo(STREAM_PTS, x, z) < 1.25) return false;
  if (Math.hypot(x, z) < 0.95 || Math.hypot(x, z - 1.15) < 0.4 || Math.hypot(x, z + 1.15) < 0.4) return false; // table and chairs
  if (Math.hypot(x - COTTAGE.x, z - COTTAGE.z) < 1.7 || Math.hypot(x - WINDMILL.x, z - WINDMILL.z) < 0.85) return false;
  if (x > FIELD.x0 - 0.35 && x < FIELD.x1 + 0.35 && z > FIELD.z0 - 0.35 && z < FIELD.z1 + 0.35) return false; // the fenced wheat
  return true;
}

/** The height you stand at, at (x, z): the ground, the dock's boards or the bridge's arch. */
export function surfaceY(x: number, z: number) {
  if (onDock(x, z)) return 0.095;
  const b = onBridge(x, z);
  if (b) {
    const t = Math.min(1, Math.max(0, b.z / BRIDGE_LENGTH + 0.5));
    return Math.max(groundY(x, z), 0.06 + 0.38 * Math.sin(Math.PI * t) + 0.11);
  }
  return groundY(x, z);
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
const GRASS = C("#8fcf4a"), GRASS_LIGHT = C("#b4df5c"), GRASS_DARK = C("#6fb843");
const DIRT = C("#e8c992"), BANK = C("#d9caa6"), BED = C("#8fb0b4"), SOIL = C("#b58a57"), SAND = C("#eedbab");
// warm sandstone, pale under the grass and deepening to a soft terracotta at the bottom
const STONE_TOP = C("#efe1c8"), STONE = C("#e0c9a8"), STONE_DARK = C("#c8a088");

/**
 * A map of where the paths, the pond's sandy shore and the stream's banks are, painted onto a canvas (red, green and
 * blue) at about 3 cm a pixel, so the ground can draw them with smooth, brushy edges rather than following its grid.
 */
function groundSplat() {
  const S = 1024, k = S / 30, px = (v: number) => (v + 15) * k;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = "lighter";
  g.lineCap = g.lineJoin = "round";
  const line = (pts: THREE.Vector3[], width: number, color: string, blur: number) => {
    g.filter = `blur(${blur}px)`;
    g.strokeStyle = color;
    g.lineWidth = width * k;
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(px(p.x), px(p.z)) : g.moveTo(px(p.x), px(p.z))));
    g.stroke();
  };
  // the pond's shore: its outline, grown by the width of the sand
  g.filter = "blur(4px)";
  g.fillStyle = "#00ff00";
  g.beginPath();
  for (let j = 0; j <= 96; j++) {
    const theta = (j / 96) * Math.PI * 2, R = pondRadius(theta) + 0.42;
    const x = px(POND.x + Math.cos(theta) * R), z = px(POND.z + Math.sin(theta) * R);
    if (j) g.lineTo(x, z);
    else g.moveTo(x, z);
  }
  g.fill();
  line(STREAM_PTS, 3.1, "#0000ff", 4); // a pebbly strip each side, above the waterline
  // the paths, then dabs of the brush along their edges so they don't look ruled
  line(PATH_PTS, 1.1, "#ff0000", 2.5);
  line(SPUR_PTS, 1.0, "#ff0000", 2.5);
  g.filter = "blur(1px)";
  g.fillStyle = "#ff0000";
  const r = rng(29);
  // dabs at irregular spacing and sizes, some pushing out and some biting in (black), so no rhythm shows
  [...PATH_PTS, ...SPUR_PTS].forEach((p, i, all) => {
    if (r() < 0.55) return;
    const q = all[Math.min(i + 1, all.length - 1)], tx = q.x - p.x, tz = q.z - p.z, len = Math.hypot(tx, tz) || 1;
    const side = r() > 0.5 ? 1 : -1, bite = r() < 0.35, out = bite ? 0.62 + r() * 0.1 : 0.4 + r() * 0.25;
    g.globalCompositeOperation = bite ? "destination-out" : "lighter";
    g.beginPath();
    g.ellipse(px(p.x - (tz / len) * out * side), px(p.z + (tx / len) * out * side), (0.05 + r() * r() * 0.22) * k, (0.04 + r() * 0.1) * k, Math.atan2(tz, tx), 0, Math.PI * 2);
    g.fill();
  });
  g.globalCompositeOperation = "lighter";
  const t = new THREE.CanvasTexture(canvas);
  t.flipY = false; // canvas rows run with +z, which is what the shader expects
  t.anisotropy = 4;
  return t;
}

/** The ground's material: painted brush strokes over everything, and the paths, sand and banks from `groundSplat`. */
function groundMaterial() {
  const m = painterly(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradientMap() }));
  const strokes = m.onBeforeCompile, key = m.customProgramCacheKey;
  const splat = groundSplat();
  m.onBeforeCompile = (shader, renderer) => {
    strokes(shader, renderer); // adds the world position and noise this uses, and the strokes, which paint over it
    shader.uniforms.uSplat = { value: splat };
    shader.uniforms.uDirt = { value: DIRT };
    shader.uniforms.uSand = { value: SAND };
    shader.uniforms.uBank = { value: BANK };
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform sampler2D uSplat;\nuniform vec3 uDirt, uSand, uBank;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        {
          vec4 sp = texture2D(uSplat, (vPaintPos.xz + 15.0) / 30.0);
          // a wobble on the threshold, so every edge is a little ragged, like paint
          float wob = (pnNoise(vPaintPos.xz * 3.5) - 0.5) * 0.4 + (pnNoise(vPaintPos.xz * 11.0) - 0.5) * 0.15;
          float sand = smoothstep(0.38, 0.58, sp.g + wob), bank = smoothstep(0.38, 0.58, sp.b + wob), path = smoothstep(0.42, 0.6, sp.r + wob);
          diffuseColor.rgb = mix(diffuseColor.rgb, uSand * (0.95 + 0.1 * pnNoise(vPaintPos.xz * 7.0)), sand);
          diffuseColor.rgb = mix(diffuseColor.rgb, uBank * (0.9 + 0.2 * pnNoise(vPaintPos.xz * 9.0)), bank * (1.0 - sand));
          diffuseColor.rgb = mix(diffuseColor.rgb, uDirt * (0.93 + 0.14 * pnNoise(vPaintPos.xz * 5.0)), path);
        }`,
      );
  };
  m.customProgramCacheKey = () => `${key()}-ground`;
  return m;
}

/** The grassy top: a grid clamped to the island's outline, with the paths, banks and field painted in. */
function IslandTop() {
  // brush strokes over the grass, with the paths and shores painted on (see groundMaterial)
  const topMaterial = useMemo(() => groundMaterial(), []);
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(30, 30, 170, 170);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const rand = rng(17);
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
      c.lerp(rand() > 0.5 ? GRASS_LIGHT : GRASS_DARK, rand() * 0.35); // a speckle of brush strokes, like painted grass
      // under the water, the beds (the shores, banks and paths are painted on by the material)
      const ds = distTo(STREAM_PTS, x, z) - 0.65, dp = pondEdge(x, z);
      if (ds < 0) c.lerp(BED, smooth(0, -0.3, ds));
      if (dp < -0.05) c.lerp(BED, smooth(-0.05, -0.35, dp));
      if (x > FIELD.x0 - 0.2 && x < FIELD.x1 + 0.2 && z > FIELD.z0 - 0.2 && z < FIELD.z1 + 0.2) c.copy(SOIL);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geometry} receiveShadow>
      <primitive object={topMaterial} attach="material" />
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

/** Roots and trailing moss hanging from under the island's rim, swaying a little in the breeze. */
function HangingRoots() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const COUNT = 90;
  const geo = useMemo(() => new THREE.CylinderGeometry(0.035, 0.012, 1, 5).translate(0, -0.5, 0), []);
  const roots = useMemo(() => {
    const r = rng(81);
    return Array.from({ length: COUNT }, () => {
      const theta = r() * Math.PI * 2;
      return { theta, len: 0.3 + r() * r() * 1.6, moss: r() > 0.45, lean: (r() - 0.5) * 0.3, phase: r() * 6 };
    });
  }, []);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    const c = new THREE.Color();
    roots.forEach((root, i) => mesh.current?.setColorAt(i, c.set(root.moss ? "#6fae48" : "#8a6a4a")));
    if (mesh.current?.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [roots]);
  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    const t = clock.getElapsedTime();
    roots.forEach((root, i) => {
      const R = islandRadius(root.theta) * 0.985;
      tmp.position.set(Math.cos(root.theta) * R, root.moss ? -0.2 : -0.35, Math.sin(root.theta) * R);
      tmp.rotation.set(Math.sin(t * 0.8 + root.phase) * 0.05 + root.lean, root.theta, Math.cos(t * 0.6 + root.phase) * 0.05);
      tmp.scale.set(root.moss ? 1.4 : 1, root.len, root.moss ? 1.4 : 1);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[geo, undefined, COUNT]} castShadow>
      <meshToonMaterial gradientMap={gradientMap()} />
    </instancedMesh>
  );
}

function IslandBody() {
  const geometry = useMemo(() => islandBodyGeometry(5, true), []);
  const bodyMaterial = useMemo(() => painterly(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradientMap(), side: THREE.DoubleSide }), 1.4, 0.8), []);
  return (
    <>
      <mesh geometry={geometry} castShadow receiveShadow>
        <primitive object={bodyMaterial} attach="material" />
      </mesh>
      <HangingRoots />
    </>
  );
}

// the water's colours by day, and at sunset (when it mirrors the peach and rose of the sky)
const WATER = { shallow: C("#93dccf"), deep: C("#2f86a3"), shallowDusk: C("#ffcfae"), deepDusk: C("#b88ac4") };

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

export function waterMaterial(fragment: string, extra: Record<string, THREE.IUniform> = {}, transparent = false, vertex = WATER_VERTEX) {
  return new THREE.ShaderMaterial({
    vertexShader: vertex,
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

export const WATER_COMMON = /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>
  uniform float uTime, uEvening; uniform vec3 uShallow, uDeep;
  varying vec2 vUv;`;
export const WATER_END = /* glsl */ `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>`;

const STREAM_FRAGMENT = /* glsl */ `${WATER_COMMON}
  void main() {
    // vUv.x runs downstream, vUv.y across
    float across = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.65, vUv.y);
    vec3 col = mix(uShallow * 1.05 + 0.03, uDeep, across * 0.85);
    float a = sin(vUv.x * 260.0 - uTime * 3.0 + sin(vUv.y * 7.0 + vUv.x * 40.0) * 2.0) * 0.5 + 0.5;
    float b = sin(vUv.x * 150.0 - uTime * 2.2 + vUv.y * 11.0) * 0.5 + 0.5;
    col = mix(col, vec3(1.0), smoothstep(0.9, 1.0, a * b) * 0.6);
    // foam where it laps the banks, broken up and drifting downstream
    float edge = min(vUv.y, 1.0 - vUv.y);
    float foam = smoothstep(0.07, 0.02, edge + sin(vUv.x * 90.0 - uTime * 2.0 + vUv.y * 20.0) * 0.012);
    col = mix(col, vec3(1.0), foam * 0.75);
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
export function tickWater(mesh: THREE.Mesh | null, time: number) {
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
    const width = 2.2 + t * 0.8;
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
    const W = 2.3, Y = -0.13; // out to where the banks rise past the water, so it meets them rather than leaving a ditch
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
      <StreamBanks />
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

/** Rocks and clumps of reeds along the stream's banks, leaving the bridge and the waterfall's lip clear. */
function StreamBanks() {
  const reeds = useRef<THREE.InstancedMesh>(null);
  const REEDS = 260;
  const reedGeo = useMemo(() => new THREE.ConeGeometry(0.02, 1, 3).translate(0, 0.5, 0), []);
  const spots = useMemo(() => {
    const r = rng(73), rocks: { x: number; z: number; s: number; rot: number; c: string }[] = [], clumps: { x: number; z: number }[] = [];
    for (let i = 6; i < FALL_INDEX - 4; i += 5) {
      const p = STREAM_PTS[i], q = STREAM_PTS[i + 1], tx = q.x - p.x, tz = q.z - p.z, len = Math.hypot(tx, tz) || 1;
      const side = r() > 0.5 ? 1 : -1, out = 1.15 + r() * 0.35;
      const x = p.x - (tz / len) * out * side, z = p.z + (tx / len) * out * side;
      if (Math.hypot(x - BRIDGE.x, z - BRIDGE.z) < 2) continue;
      if (r() < 0.45) rocks.push({ x, z, s: 0.1 + r() * 0.16, rot: r() * 6, c: ["#cfc8bf", "#bdb6ad", "#a9b49a"][Math.floor(r() * 3)] });
      else clumps.push({ x, z });
    }
    return { rocks, clumps };
  }, []);
  useLayoutEffect(() => {
    const mesh = reeds.current;
    if (!mesh || !spots.clumps.length) return;
    const r = rng(74), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
    for (let i = 0; i < REEDS; i++) {
      const at = spots.clumps[i % spots.clumps.length], a = r() * Math.PI * 2, d = r() * 0.25;
      const x = at.x + Math.cos(a) * d, z = at.z + Math.sin(a) * d;
      p.set(x, Math.max(groundY(x, z), -0.13) - 0.02, z);
      e.set((r() - 0.5) * 0.5, r() * Math.PI, (r() - 0.5) * 0.5);
      const k = 0.8 + r() * 0.5;
      s.set(k, 0.3 + r() * 0.45, k);
      m.compose(p, q.setFromEuler(e), s);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.setHSL(0.25 + r() * 0.04, 0.45 + r() * 0.15, 0.36 + r() * 0.12));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [spots]);
  return (
    <>
      <instancedMesh ref={reeds} args={[reedGeo, swayingToon(), REEDS]} castShadow />
      {spots.rocks.map((k, i) => (
        <mesh key={i} position={[k.x, groundY(k.x, k.z) + k.s * 0.3, k.z]} rotation={[0, k.rot, 0]} scale={[k.s, k.s * 0.6, k.s * 0.85]} material={toon(k.c, true)} castShadow receiveShadow>
          <dodecahedronGeometry args={[1, 1]} />
        </mesh>
      ))}
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

/** An arched stone footbridge where the path crosses the stream. */
function Bridge() {
  const L = BRIDGE_LENGTH, SEG = 11, stone = toon("#eadfc9", true), cap = toon("#d8c8ad", true);
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

/** Two or three little islands floating far off in the haze, each with a puffy tree, for depth. */
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
            {[[0, 1.6, 0, 0.8], [0.55, 1.35, 0.1, 0.55], [-0.5, 1.4, -0.1, 0.55], [0.1, 2.15, 0.05, 0.5]].map(([x, y, z, r], j) => (
              <mesh key={j} position={[x, y, z]} material={toon(j % 2 ? "#6db84a" : "#5aa83f")}>
                <sphereGeometry args={[r, 16, 12]} />
              </mesh>
            ))}
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
      <Bridge />
      <FarIslands />
    </>
  );
}
