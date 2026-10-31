"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { CritterPick } from "./critters";
import { daylight } from "./daylight";
import { reducedMotion } from "./quality";
import { groundY, Island, islandRadius, isOpen, nearGardenSlot, rng } from "./island";
import { Pond } from "./pond";
import { Village } from "./village";
import { softDot } from "./textures";
import { gradientMap, painterly, paleGradientMap, swayingToon, toon, wind } from "./toon";

// The backdrop and the life around the floating island (see island.tsx for the island itself, pond.tsx for the pond),
// in the look of a little painted diorama: a plain warm-cream backdrop that turns to sunset when you finish, puffy clay
// clouds, bright painterly grass with a fuzzy edge and specks of wildflowers, puffy round bubble trees (a few of them
// pink), butterflies and blossom petals by day, fireflies at dusk.

/** The render layer the grass is on; the main camera sees it, the pond's reflection doesn't. */
export const GRASS_LAYER = 1;

export const COLORS = {
  fog: "#ece6dc",
  fogSunset: "#e3aeb0",
};

function Sky() {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false,
        uniforms: { sunDir: { value: new THREE.Vector3(-0.55, 0.12, -0.83).normalize() }, uEvening: { value: 0 } },
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
          uniform vec3 sunDir; uniform float uEvening; varying vec3 vDir;
          void main(){
            float h = vDir.y;
            // afternoon: a plain warm cream all round, like paper behind a diorama; sunset: gold and rose into lavender
            vec3 horizon = mix(vec3(0.96, 0.94, 0.89), vec3(1.0, 0.74, 0.56), uEvening);
            vec3 mid = mix(vec3(0.95, 0.93, 0.88), vec3(0.93, 0.62, 0.70), uEvening);
            vec3 top = mix(vec3(0.91, 0.91, 0.90), vec3(0.47, 0.40, 0.72), uEvening);
            vec3 haze = mix(vec3(0.94, 0.91, 0.86), vec3(0.78, 0.58, 0.66), uEvening);  // the void below the island
            vec3 c = mix(horizon, mid, smoothstep(-0.02, 0.22, h));
            c = mix(c, top, smoothstep(0.22, 0.8, h));
            c = mix(c, haze, smoothstep(-0.02, -0.5, h));
            float s = max(dot(vDir, sunDir), 0.0);
            c += vec3(1.0, 0.62, 0.40) * pow(s, 6.0) * (0.25 + uEvening * 0.5) * (1.0 - smoothstep(0.0, 0.5, h));
            c += vec3(1.0, 0.85, 0.6) * pow(s, 400.0) * uEvening;   // the sun itself, once it's low
            // written as display colours, decoded to the linear light the effects chain expects; kept just under the
            // bloom threshold so the sky itself never glows over the scene
            gl_FragColor = vec4(min(pow(c, vec3(2.2)), vec3(0.97)), 1.0);
          }`,
      }),
    [],
  );
  useFrame(() => {
    const m = mesh.current?.material as THREE.ShaderMaterial | undefined;
    if (!m) return;
    m.uniforms.uEvening.value = daylight.evening;
    // the sun sinks towards the horizon as evening comes
    m.uniforms.sunDir.value.set(-0.55, 0.12 - daylight.evening * 0.1, -0.83).normalize();
  });
  return (
    <mesh ref={mesh} material={material} renderOrder={-1}>
      <sphereGeometry args={[400, 32, 16]} />
    </mesh>
  );
}

// Tufts of grass and specks of wildflowers (mostly buttercups, some daisies, a little orange and pink) over the island's
// open ground, plus a fringe of longer blades leaning out over the rim, so the edge looks soft and brushed rather than
// cut. Three instanced meshes.
function Grass() {
  const blades = useRef<THREE.InstancedMesh>(null);
  const flowers = useRef<THREE.InstancedMesh>(null);
  const fringe = useRef<THREE.InstancedMesh>(null);
  const tufts = useRef<THREE.InstancedMesh>(null);
  const BLADES = 8000, FLOWERS = 2400, FRINGE = 2600, TUFTS = 3200;
  // a tuft: six short, wide blades splayed out from one spot, darker at the root, for a soft, thick carpet underfoot
  const tuftGeo = useMemo(() => {
    const parts = Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2, h = 0.1 + (i % 3) * 0.025;
      const g = new THREE.ConeGeometry(0.03, h, 4).translate(0, h / 2, 0).rotateZ(0.35).rotateY(a).translate(Math.cos(a) * 0.025, 0, -Math.sin(a) * 0.025);
      g.deleteAttribute("uv");
      const pos = g.attributes.position, colors = new Float32Array(pos.count * 3);
      for (let k = 0; k < pos.count; k++) colors.fill(0.6 + (pos.getY(k) / h) * 0.55, k * 3, k * 3 + 3);
      g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      return g;
    });
    return mergeGeometries(parts);
  }, []);
  // a soft four-sided blade, darker at the root and catching the light at the tip
  const bladeGeo = useMemo(() => {
    const g = new THREE.ConeGeometry(0.034, 0.2, 4).translate(0, 0.1, 0);
    const pos = g.attributes.position, colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) colors.fill(0.62 + (pos.getY(i) / 0.2) * 0.55, i * 3, i * 3 + 3);
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  }, []);

  useLayoutEffect(() => {
    const r = rng(7), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const c = new THREE.Color();
    const scatter = (mesh: THREE.InstancedMesh, count: number, each: (i: number) => void) => {
      for (let i = 0; i < count; i++) {
        let x = 0, z = 0;
        do {
          x = (r() - 0.5) * 28;
          z = (r() - 0.5) * 28;
        } while (!isOpen(x, z));
        p.set(x, groundY(x, z), z);
        each(i);
        m.compose(p, q.setFromEuler(e), s);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    // the grass lives on layer 1, which the pond's reflection (and click picking) skip: thousands of blades for little gain
    for (const mesh of [blades.current, flowers.current, fringe.current, tufts.current]) mesh?.layers.set(GRASS_LAYER);
    if (tufts.current) {
      const mesh = tufts.current;
      scatter(mesh, TUFTS, (i) => {
        e.set(0, r() * Math.PI * 2, 0);
        const k = 0.8 + r() * 0.7;
        s.set(k, k * (0.7 + r() * 0.5), k);
        mesh.setColorAt(i, c.setHSL(0.24 + r() * 0.04, 0.55 + r() * 0.15, 0.46 + r() * 0.12));
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    if (blades.current) {
      const mesh = blades.current;
      scatter(mesh, BLADES, (i) => {
        e.set((r() - 0.5) * 0.4, r() * Math.PI, (r() - 0.5) * 0.4);
        const k = 0.5 + r() * 0.7;
        s.set(k, k * (0.7 + r() * 0.8), k);
        mesh.setColorAt(i, c.setHSL(0.24 + r() * 0.04, 0.55 + r() * 0.15, 0.44 + r() * 0.12));
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    if (flowers.current) {
      const mesh = flowers.current;
      const petals = ["#ffd84a", "#ffd84a", "#ffe680", "#ffffff", "#ffffff", "#ffb347", "#ffb8cf"];
      scatter(mesh, FLOWERS, (i) => {
        e.set(0, 0, 0);
        p.y += 0.08 + r() * 0.08;
        const k = 0.5 + r() * 0.6;
        s.set(k * 1.2, k * 0.4, k * 1.2); // flat little flower heads, not beads
        mesh.setColorAt(i, c.set(petals[Math.floor(r() * petals.length)]));
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    if (fringe.current) {
      const mesh = fringe.current, tilt = new THREE.Quaternion(), axis = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < FRINGE; i++) {
        let theta = 0, x = 0, z = 0, y = -1;
        while (y < -0.05) {
          // anywhere round the rim except where the stream pours over
          theta = r() * Math.PI * 2;
          const R = islandRadius(theta) * (0.975 + r() * 0.035);
          x = Math.cos(theta) * R;
          z = Math.sin(theta) * R;
          y = groundY(x, z);
        }
        // leaning outwards over the edge (a turn about the rim's tangent), each at its own angle
        axis.set(-Math.sin(theta), 0, Math.cos(theta));
        tilt.setFromAxisAngle(axis, -(0.45 + r() * 0.7));
        q.setFromAxisAngle(up, r() * Math.PI * 2).premultiply(tilt);
        const k = 0.9 + r() * 0.8;
        s.set(k, k * (0.8 + r() * 0.7), k);
        m.compose(p.set(x, y - 0.02, z), q, s);
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, c.setHSL(0.24 + r() * 0.04, 0.55 + r() * 0.15, 0.46 + r() * 0.14));
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }, [BLADES, FLOWERS]);

  useFrame(({ clock }) => {
    wind.value = clock.getElapsedTime() * (reducedMotion() ? 0.3 : 1); // a gentler breeze for reduced motion
  });

  return (
    <>
      <instancedMesh ref={blades} args={[bladeGeo, swayingToon(true), BLADES]} receiveShadow />
      <instancedMesh ref={fringe} args={[bladeGeo, swayingToon(true), FRINGE]} />
      <instancedMesh ref={tufts} args={[tuftGeo, swayingToon(true), TUFTS]} receiveShadow />
      <instancedMesh ref={flowers} args={[undefined, undefined, FLOWERS]}>
        <sphereGeometry args={[0.024, 8, 6]} />
        <meshToonMaterial gradientMap={gradientMap()} emissive="#fff3d0" emissiveIntensity={0.15} />
      </instancedMesh>
    </>
  );
}

/**
 * A puffy "cauliflower" ball, like the trees and clouds in a clay diorama: a core with overlapping blobs round its
 * upper part and smaller bumps over those, coloured from `base` underneath to `light` on top. Adds the blobs' geometry
 * (centred at x, y, z) to `out`, to be merged into one mesh with everything else of its kind.
 */
function puff(out: THREE.BufferGeometry[], r: () => number, at: THREE.Vector3, size: number, base: THREE.Color, light: THREE.Color, blobs = 12, flat = 1) {
  const c = new THREE.Color();
  const add = (bx: number, by: number, bz: number, rad: number, detail: number) => {
    const g = new THREE.IcosahedronGeometry(rad, detail).scale(1, flat, 1).translate(at.x + bx, at.y + by * flat, at.z + bz);
    g.deleteAttribute("uv");
    const pos = g.attributes.position, colors = new Float32Array(pos.count * 3);
    const tint = (r() - 0.5) * 0.08; // each blob a shade lighter or darker
    for (let i = 0; i < pos.count; i++) {
      const up = (pos.getY(i) - at.y) / (size * flat);
      c.copy(base).lerp(light, Math.min(1, Math.max(0, up * 0.55 + 0.4 + tint)));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    out.push(g);
  };
  add(0, 0, 0, size * 0.78, 3);
  for (let k = 0; k < blobs; k++) {
    // spread evenly (a golden-angle spiral) over all but the very bottom of the ball
    const yk = 1 - ((k + 0.5) / blobs) * 1.5, ring = Math.sqrt(Math.max(0, 1 - yk * yk)), a = k * 2.39996 + r() * 0.5, d = size * 0.6;
    add(Math.cos(a) * ring * d, yk * d * 0.85, Math.sin(a) * ring * d, size * (0.36 + r() * 0.12), 3);
  }
  for (let k = 0; k < Math.round(blobs * 0.7); k++) {
    const yk = 0.95 - (k / blobs) * 1.2, ring = Math.sqrt(Math.max(0, 1 - yk * yk)), a = k * 2.39996 + 1.2, d = size * 0.86;
    add(Math.cos(a) * ring * d, yk * d * 0.85, Math.sin(a) * ring * d, size * (0.2 + r() * 0.06), 1);
  }
}

// Where the trees and bushes stand: on open ground away from the table, spread out over the whole island with a good
// gap between them (so it reads as a few trees dotted about, not a wood). Worked out once, so walking about can slide
// round them (see `slideRoundPlants`).
const PLANTS = (() => {
  const r = rng(42);
  const out: { x: number; z: number; s: number; tree: boolean; pink: boolean; tone: number }[] = [];
  // every crown placed so far (centre and how far its blobs reach), so no two grow into each other
  const taken: { x: number; z: number; reach: number }[] = [];
  const place = (count: number, minR: number, pad: number, tree: boolean, gap: number, sizes: () => number) => {
    for (let placed = 0, tries = 0; placed < count && tries < count * 120; tries++) {
      const x = (r() - 0.5) * 28, z = (r() - 0.5) * 28, s = sizes(), reach = (tree ? s : s * 0.55) * 1.2;
      if (Math.hypot(x, z) <= minR || !isOpen(x, z, pad) || nearGardenSlot(x, z, 1.6)) continue;
      if (taken.some((t) => Math.hypot(t.x - x, t.z - z) < t.reach + reach + gap)) continue;
      taken.push({ x, z, reach });
      out.push({ x, z, s, tree, pink: tree && r() < 0.17, tone: Math.floor(r() * 3) });
      placed++;
    }
  };
  place(16, 6, 1, true, 2.4, () => 0.75 + r() * 0.5);
  place(14, 3.2, 0.3, false, 1.2, () => 0.45 + r() * 0.35);
  return out;
})();

/** The tree crowns, as balls, so the camera can keep out of them (see WorldScene). */
export const CROWNS = [
  // padded well past the leaves, so the camera doesn't even brush past one
  ...PLANTS.filter((p) => p.tree).map((p) => ({ x: p.x, y: groundY(p.x, p.z) + 1.75 * p.s, z: p.z, r: 1.2 * p.s + 0.9 })),
  { x: 0, y: 0.9, z: -1.15, r: 1.5 }, // Pip (wide, so the camera never hovers in Pip's face)
  { x: 0, y: 0.6, z: 0, r: 1.3 }, // the table
];

/**
 * Walking about: if a body `r` metres round at (x, z) overlaps a trunk or a bush, it's nudged out to just touch it, so
 * you glide round the curve instead of catching on it.
 */
export function slideRoundPlants(x: number, z: number, r: number) {
  for (const p of PLANTS) {
    const reach = (p.tree ? 0.16 * p.s : 0.42 * p.s) + r, dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    if (d >= reach) continue;
    const k = d > 1e-4 ? reach / d : 0;
    x = d > 1e-4 ? p.x + dx * k : p.x + reach;
    z = d > 1e-4 ? p.z + dz * k : p.z;
  }
  return { x, z };
}

// Puffy bubble trees and bushes, as in the reference diorama: mostly green with a few pink ones, on short trunks. All
// the crowns are merged into one mesh (and the trunks into another), so a forest of blobs is still only two draw calls.
function Trees() {
  // finer, stronger dabs than the ground, so the crowns read as leafy clumps of paint
  const crownMaterial = useMemo(() => painterly(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradientMap() }), 2.2, 1.1, "dabs"), []);
  const { crowns, trunks } = useMemo(() => {
    const r = rng(43);
    const greens = [["#4f9c3c", "#9ad65a"], ["#58a842", "#a6dc63"], ["#468f37", "#8fce52"]].map(([a, b]) => [new THREE.Color(a), new THREE.Color(b)]);
    const pink = [new THREE.Color("#d9739a"), new THREE.Color("#ffb3cc")];
    const crownParts: THREE.BufferGeometry[] = [], trunkParts: THREE.BufferGeometry[] = [];
    const at = new THREE.Vector3();
    for (const p of PLANTS) {
      const [base, light] = p.pink ? pink : greens[p.tone], y = groundY(p.x, p.z), s = p.s;
      if (p.tree) {
        trunkParts.push(new THREE.CapsuleGeometry(0.13 * s, 0.9 * s, 4, 8).translate(p.x, y + 0.55 * s, p.z));
        puff(crownParts, r, at.set(p.x, y + 1.75 * s, p.z), 1.05 * s, base, light, 12);
      } else puff(crownParts, r, at.set(p.x, y + 0.32 * s, p.z), 0.55 * s, base, light, 7, 0.85);
    }
    return { crowns: mergeGeometries(crownParts), trunks: mergeGeometries(trunkParts) };
  }, []);
  return (
    <>
      <mesh geometry={trunks} material={toon("#9a6a46")} castShadow />
      <mesh geometry={crowns} material={crownMaterial} castShadow />
    </>
  );
}

const CLOUD_SUNSET = new THREE.Color("#ffb08e");

// Puffy clay clouds floating round the island at about its height, white on top and lavender underneath, drifting
// slowly round and blushing at sunset; and soft hazy clouds drifting below it (it's floating, after all).
function Clouds() {
  const ring = useRef<THREE.Group>(null);
  const haze = useRef<THREE.Group>(null);
  const map = useMemo(() => softDot(), []);
  // lit softly from within too, so they stay white rather than going grey on their shaded side
  const material = useMemo(() => new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: paleGradientMap(), emissive: "#fff6ee", emissiveIntensity: 0.3 }), []);
  const puffy = useMemo(() => {
    const r = rng(3), parts: THREE.BufferGeometry[] = [], at = new THREE.Vector3();
    const top = new THREE.Color("#ffffff"), under = new THREE.Color("#e6e3f6");
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + r() * 0.5, d = 18 + r() * 14, y = k % 3 === 2 ? -5 - r() * 4 : 2 + r() * 6;
      const cx = Math.cos(a) * d, cz = Math.sin(a) * d, size = 1.3 + r() * 1.1;
      // three to five puffs in a row, biggest in the middle
      const n = 3 + Math.floor(r() * 3);
      for (let j = 0; j < n; j++) {
        const off = (j - (n - 1) / 2) * size * 0.95, big = 1 - Math.abs(off) / (size * n * 0.6);
        puff(parts, r, at.set(cx - Math.sin(a) * off, y + big * size * 0.25, cz + Math.cos(a) * off), size * (0.6 + big * 0.45), under, top, 6, 0.8);
      }
    }
    return mergeGeometries(parts);
  }, []);
  const low = useMemo(() => {
    const r = rng(5);
    const below = Array.from({ length: 16 }, () => {
      const a = r() * Math.PI * 2, d = 22 + r() * 60;
      return { p: [Math.cos(a) * d, -9 - r() * 14, Math.sin(a) * d] as const, s: [24 + r() * 30, 8 + r() * 6] as const, o: 0.35 + r() * 0.3 };
    });
    // a soft band of cloud all round the horizon, so the view from the island has distance rather than a flat wall
    const horizon = Array.from({ length: 22 }, (_, i) => {
      const a = (i / 22) * Math.PI * 2 + r() * 0.2, d = 120 + r() * 50;
      return { p: [Math.cos(a) * d, -4 + r() * 10, Math.sin(a) * d] as const, s: [60 + r() * 50, 12 + r() * 10] as const, o: 0.22 + r() * 0.2 };
    });
    return [...below, ...horizon];
  }, []);
  useFrame(({ clock }, dt) => {
    if (ring.current) {
      ring.current.rotation.y += dt * 0.006;
      ring.current.position.y = Math.sin(clock.getElapsedTime() * 0.3) * 0.3;
    }
    if (haze.current) haze.current.rotation.y += dt * 0.004;
    material.color.set("#ffffff").lerp(CLOUD_SUNSET, daylight.evening * 0.6);
    haze.current?.children.forEach((sprite) => ((sprite as THREE.Sprite).material as THREE.SpriteMaterial).color.set("#ffffff").lerp(CLOUD_SUNSET, daylight.evening * 0.8));
  });
  return (
    <>
      <group ref={ring}>
        <mesh geometry={puffy} material={material} />
      </group>
      <group ref={haze}>
        {low.map((c, i) => (
          <sprite key={i} position={[...c.p]} scale={[c.s[0], c.s[1], 1]}>
            <spriteMaterial map={map} opacity={c.o} transparent depthWrite={false} fog={false} />
          </sprite>
        ))}
      </group>
    </>
  );
}

// A few butterflies looping lazily around the table (they go home at sunset).
/** A few small birds wheeling high over the island by day, wings beating then gliding. */
function Birds() {
  const group = useRef<THREE.Group>(null);
  const birds = useMemo(() => {
    const r = rng(61);
    return Array.from({ length: 5 }, (_, i) => ({ r: 9 + r() * 7, y: 7 + r() * 4, speed: (0.08 + r() * 0.05) * (i % 2 ? 1 : -1), phase: r() * Math.PI * 2, flap: 6 + r() * 3 }));
  }, []);
  const wing = useMemo(() => new THREE.PlaneGeometry(0.34, 0.09).translate(0.17, 0, 0), []);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime(), g = group.current;
    if (!g) return;
    g.visible = daylight.evening < 0.7;
    g.children.forEach((b, i) => {
      const k = birds[i], a = t * k.speed + k.phase;
      b.position.set(Math.cos(a) * k.r, k.y + Math.sin(t * 0.5 + i) * 0.6, Math.sin(a) * k.r);
      b.rotation.y = -a + (k.speed > 0 ? 0 : Math.PI);
      // beat for a bit, then glide
      const beating = Math.sin(t * 0.7 + i * 1.3) > -0.2;
      const f = beating ? Math.sin(t * k.flap + i) * 0.7 : 0.12;
      b.children[0].rotation.z = f;
      b.children[1].rotation.z = Math.PI - f;
    });
  });
  return (
    <group ref={group}>
      {birds.map((_, i) => (
        <group key={i}>
          {[0, 1].map((side) => (
            <mesh key={side} geometry={wing} rotation={[-Math.PI / 2, 0, 0]}>
              <meshBasicMaterial color="#5e5560" side={THREE.DoubleSide} fog={false} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Butterflies() {
  const group = useRef<THREE.Group>(null);
  const flyers = useMemo(() => {
    const r = rng(19);
    return Array.from({ length: 5 }, (_, i) => ({ r: 2.2 + r() * 2.5, speed: 0.15 + r() * 0.12, phase: r() * Math.PI * 2, y: 0.9 + r() * 0.8, color: ["#ffb8cf", "#ffffff", "#ffe066", "#cdb8f5", "#a9d4f5"][i] }));
  }, []);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (group.current) group.current.visible = daylight.evening < 0.6;
    group.current?.children.forEach((b, i) => {
      const f = flyers[i];
      const a = t * f.speed + f.phase;
      b.position.set(Math.cos(a) * f.r, f.y + Math.sin(t * 1.3 + f.phase) * 0.25, Math.sin(a * 1.3) * f.r * 0.8);
      b.rotation.y = -a;
      const flap = Math.sin(t * 14 + f.phase) * 0.9;
      b.children[0].rotation.z = flap;
      b.children[1].rotation.z = -flap;
    });
  });
  return (
    <group ref={group}>
      {flyers.map((f, i) => (
        <group key={i}>
          {/* two wings, each hinged at the body and flapping up and down */}
          {[-1, 1].map((side) => (
            <group key={side}>
              <mesh position={[side * 0.035, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.07, 0.05]} />
                <meshBasicMaterial color={f.color} side={THREE.DoubleSide} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

// Blossom petals drifting down through the air by day.
function Petals() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const COUNT = 40;
  const petals = useMemo(() => {
    const r = rng(23);
    return Array.from({ length: COUNT }, () => ({ x: (r() - 0.5) * 14, z: (r() - 0.5) * 14, y0: r() * 5, speed: 0.15 + r() * 0.15, spin: r() * 6, sway: r() * 6 }));
  }, []);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1) }), []);
  useLayoutEffect(() => {
    const colors = ["#ffc4d6", "#ffffff", "#ffd9e4"];
    const c = new THREE.Color();
    petals.forEach((_, i) => mesh.current?.setColorAt(i, c.set(colors[i % 3])));
    if (mesh.current?.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [petals]);
  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    const t = clock.getElapsedTime();
    m.visible = daylight.evening < 0.9;
    petals.forEach((pt, i) => {
      const y = 5 - ((pt.y0 + t * pt.speed) % 5); // fall from 5 m to the ground, then start again at the top
      tmp.p.set(pt.x + Math.sin(t * 0.7 + pt.sway) * 0.6, y, pt.z + Math.cos(t * 0.5 + pt.sway) * 0.4);
      tmp.e.set(t * 1.3 + pt.spin, t * 0.9 + pt.spin, t * 0.5);
      tmp.m.compose(tmp.p, tmp.q.setFromEuler(tmp.e), tmp.s);
      m.setMatrixAt(i, tmp.m);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      <planeGeometry args={[0.05, 0.035]} />
      <meshBasicMaterial side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

// Fireflies, which come out with the sunset: soft glowing dots drifting and twinkling around the table.
function Fireflies() {
  const points = useRef<THREE.Points>(null);
  const COUNT = 60;
  const map = useMemo(() => softDot(), []);
  const flies = useMemo(() => {
    const r = rng(31);
    return Array.from({ length: COUNT }, () => ({ a: r() * Math.PI * 2, d: 1.6 + r() * 6, y: 0.3 + r() * 1.8, speed: 0.05 + r() * 0.1, phase: r() * 10 }));
  }, []);
  const positions = useMemo(() => new Float32Array(COUNT * 3), []);
  useFrame(({ clock }) => {
    const p = points.current;
    if (!p) return;
    const t = clock.getElapsedTime();
    const attr = p.geometry.attributes.position as THREE.BufferAttribute;
    flies.forEach((f, i) => {
      const a = f.a + t * f.speed;
      attr.setXYZ(i, Math.cos(a) * f.d + Math.sin(t * 0.6 + f.phase) * 0.3, f.y + Math.sin(t * 0.9 + f.phase) * 0.25, Math.sin(a) * f.d);
    });
    attr.needsUpdate = true;
    const m = p.material as THREE.PointsMaterial;
    m.opacity = daylight.evening * (0.75 + Math.sin(t * 3) * 0.25);
    p.visible = daylight.evening > 0.02;
  });
  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial map={map} color="#fff1a8" size={0.16} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} fog={false} />
    </points>
  );
}

export function Landscape({ critters }: { critters: { interactive: boolean; picked: CritterPick | null; onPick: (pick: CritterPick) => void } }) {
  return (
    <>
      <Sky />
      <Clouds />
      <Island />
      <Pond {...critters} />
      <Village />
      <Grass />
      <Trees />
      <Butterflies />
      <Birds />
      <Petals />
      <Fireflies />
    </>
  );
}
