"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { daylight, sun } from "./daylight";
import { groundY, isOpen, rng } from "./island";
import { quality } from "./quality";
import { castNoShadow, gradientMap, gusts, NOISE_GLSL, trample, wind, windAmp } from "./toon";

// The meadow: tens of thousands of real grass blades (curved, tapered, darker at the root and lighter at the tip) in
// clumps over the island's open ground, as in the cosy games this scene takes after. Each blade bends from its root in
// the breeze and further in the gusts that roll across, parts round your chick, and glows a little where the sun
// shines through it from behind. Big soft patches are lusher or sun-dried. Instanced in 16 chunks, so the parts of
// the island out of view aren't drawn.

const CLUMPS = 14000; // five blades each
const LITE = 0.35; // the share drawn on the lightest quality

/** One clump: five blades splayed from a point, each a tapered strip curving forward as it rises (local height 1). */
function clumpGeometry() {
  const r = rng(11), blades: THREE.BufferGeometry[] = [], LEVELS = 5;
  for (let b = 0; b < 5; b++) {
    const h = 0.7 + r() * 0.3, w = 0.045 + r() * 0.025, curl = 0.25 + r() * 0.35;
    const pos: number[] = [], tip: number[] = [], col: number[] = [], idx: number[] = [];
    for (let i = 0; i <= LEVELS; i++) {
      const t = i / LEVELS, half = (w / 2) * Math.pow(1 - t, 0.75), y = t * h, z = curl * t * t * h;
      if (i < LEVELS) {
        pos.push(-half, y, z, half, y, z);
        tip.push(t, t);
        col.push(...Array(6).fill(0.4 + t * 0.66));
      } else {
        pos.push(0, y, z);
        tip.push(1);
        col.push(1.06, 1.06, 1.06);
      }
    }
    for (let i = 0; i < LEVELS - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const last = (LEVELS - 1) * 2;
    idx.push(last, last + 1, last + 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("tip", new THREE.Float32BufferAttribute(tip, 1));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    const angle = (b / 5) * Math.PI * 2 + r() * 0.8, out = 0.015 + r() * 0.035;
    g.rotateY(angle).translate(Math.sin(angle) * out, 0, Math.cos(angle) * out);
    blades.push(g);
  }
  const g = mergeGeometries(blades);
  g.computeVertexNormals();
  return g;
}

/** Where the sun is and its colour, for the light through the blades (moved on each frame by the meadow). */
const light = { dir: { value: new THREE.Vector3(0, 1, 0) }, color: { value: new THREE.Color("#ffd27a") } };
const DAY_GLOW = new THREE.Color("#ffd27a"), DUSK_GLOW = new THREE.Color("#ff9a5c");

/**
 * How far the meadow leans at `at` (world x, z) for a point `bend` of the way up its sway (0 at the root, 1 at a tip):
 * the breeze, the gusts rolling across, and pushed aside round your chick. Shared by the blades and the flowers among
 * them, so they move together.
 */
const LEAN_GLSL = /* glsl */ `
  uniform float uWind, uWindAmp, uGusts;
  uniform vec3 uTrample;
  vec2 meadowLean(vec2 at, float bend, out float gust, out float pressed) {
    float sway = (sin(uWind * 1.5 + at.x * 0.3 + at.y * 0.2) * 0.6 + sin(uWind * 2.6 + at.x * 0.9) * 0.2) * uWindAmp;
    gust = pow(0.5 + 0.5 * sin(dot(at, vec2(0.32, 0.18)) - uWind * 1.2 + sin(at.y * 0.4 + uWind * 0.3)), 6.0) * uWindAmp * uGusts;
    vec2 lean = normalize(vec2(1.0, 0.4)) * (sway * 0.1 + gust * 0.22) * bend;
    vec2 away = at - uTrample.xz;
    pressed = (1.0 - smoothstep(0.1, 0.6, length(away))) * step(0.0, uTrample.y);
    return lean + normalize(away + vec2(1e-4)) * pressed * 0.28 * bend;
  }`;
const leanUniforms = () => ({ uWind: wind, uWindAmp: windAmp, uTrample: trample, uGusts: gusts });

let material: THREE.MeshToonMaterial | null = null;

function meadowMaterial() {
  if (material) return material;
  material = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradientMap(), side: THREE.DoubleSide });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, leanUniforms(), { uSunDir: light.dir, uGlow: light.color });
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform vec3 uSunDir;
        ${LEAN_GLSL}
        attribute float tip;
        varying float vTip, vGust, vPatch, vGlow;
        varying vec3 vUp;
        ${NOISE_GLSL}`,
      )
      // lit mostly as the ground under it is (blades facing every way would otherwise speckle light and dark)
      .replace("#include <beginnormal_vertex>", "vec3 objectNormal = normalize(mix(normal, vec3(0.0, 1.0, 0.0), 0.8));")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vec2 at = instanceMatrix[3].xz;
        float gust, pressed, bend = tip * tip; // bending from the root: the tips travel furthest
        vec2 lean = meadowLean(at, bend, gust, pressed);
        // world-space lean, turned back into the clump's own frame; the tip drops as it leans so the blade keeps its length
        transformed += inverse(mat3(instanceMatrix)) * vec3(lean.x, -dot(lean, lean) * 0.9 - pressed * 0.1 * bend, lean.y);
        vTip = tip;
        vGust = gust * tip;
        vPatch = pnNoise(at * 0.13) * 0.65 + pnNoise(at * 0.41 + 7.0) * 0.35;
        vec3 world = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        vGlow = pow(max(dot(normalize(world - cameraPosition), uSunDir), 0.0), 3.0) * tip; // sun behind the blade
        vUp = normalize(normalMatrix * objectNormal);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uGlow;\nvarying float vTip, vGust, vPatch, vGlow;\nvarying vec3 vUp;")
      // both faces lit the same way, from above
      .replace("#include <normal_fragment_begin>", "#include <normal_fragment_begin>\n  normal = normalize(vUp);")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        diffuseColor.rgb *= mix(vec3(0.8, 0.94, 0.8), vec3(1.12, 1.06, 0.8), smoothstep(0.25, 0.75, vPatch));
        diffuseColor.rgb *= 1.0 + vGust * 0.25;`,
      )
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n  totalEmissiveRadiance += uGlow * diffuseColor.rgb * vGlow * 0.9;");
  };
  material.customProgramCacheKey = () => "meadow-2";
  return material;
}

let flowers: THREE.MeshToonMaterial | null = null;

/** For the wildflowers up among the blades: they lean with the meadow round them, as if on stems (landscape.tsx). */
export function flowerMaterial() {
  if (flowers) return flowers;
  flowers = new THREE.MeshToonMaterial({ gradientMap: gradientMap(), emissive: "#fff3d0", emissiveIntensity: 0.15 });
  flowers.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, leanUniforms());
    shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>\n${LEAN_GLSL}`).replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      float gust, pressed;
      vec2 lean = meadowLean(instanceMatrix[3].xz, 0.55, gust, pressed); // a flower head sits about two-thirds up
      transformed += inverse(mat3(instanceMatrix)) * vec3(lean.x, -pressed * 0.08, lean.y);`,
    );
  };
  flowers.customProgramCacheKey = () => "meadow-flowers";
  return flowers;
}

/** A smooth, cheap 2D field (−1 to 1) for where the grass grows tall. */
const field = (x: number, z: number) => Math.sin(x * 0.37 + Math.sin(z * 0.21) * 2) * 0.5 + Math.sin(z * 0.43 - x * 0.17) * 0.5;

const GRID = 4; // the meadow in 4×4 chunks, so the ones out of view aren't drawn
const chunkOf = (x: number, z: number) => Math.min(GRID - 1, Math.floor(((x + 14) / 28) * GRID)) * GRID + Math.min(GRID - 1, Math.floor(((z + 14) / 28) * GRID));

/** Where every clump goes, chunk by chunk: its placement and its colour. */
function plant() {
  const r = rng(23), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
  const chunks = Array.from({ length: GRID * GRID }, () => ({ matrices: [] as THREE.Matrix4[], colors: [] as THREE.Color[] }));
  for (let i = 0; i < CLUMPS; i++) {
    let x = 0, z = 0;
    do {
      x = (r() - 0.5) * 28;
      z = (r() - 0.5) * 28;
    } while (!isOpen(x, z));
    // taller in the lush stretches, shorter near the paths and banks (where isOpen with a margin fails)
    const tall = 0.24 + (field(x, z) * 0.5 + 0.5) * 0.18 + r() * 0.08, edge = isOpen(x, z, 0.3) ? 1 : 0.6;
    const k = 0.85 + r() * 0.45;
    s.set(k, tall * edge, k);
    const chunk = chunks[chunkOf(x, z)];
    chunk.matrices.push(m.compose(p.set(x, groundY(x, z) - 0.01, z), q.setFromAxisAngle(up, r() * Math.PI * 2), s).clone());
    chunk.colors.push(c.setHSL(0.24 + r() * 0.05, 0.52 + r() * 0.18, 0.38 + r() * 0.12).clone());
  }
  return chunks.filter((ch) => ch.matrices.length > 0);
}

function Chunk({ geometry, matrices, colors, layer }: { geometry: THREE.BufferGeometry; matrices: THREE.Matrix4[]; colors: THREE.Color[]; layer: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const g = mesh.current;
    if (!g) return;
    matrices.forEach((m, i) => g.setMatrixAt(i, m));
    colors.forEach((c, i) => g.setColorAt(i, c));
    g.instanceMatrix.needsUpdate = true;
    if (g.instanceColor) g.instanceColor.needsUpdate = true;
    g.computeBoundingSphere();
    if (g.boundingSphere) g.boundingSphere.radius += 0.6; // room for the blades to lean
    g.layers.set(layer); // skipped by the pond's reflection and click picking
    g.customDepthMaterial = castNoShadow(); // shadowed by the trees, but not drawn into the shadow map itself
  }, [matrices, colors, layer]);
  useFrame(() => {
    if (mesh.current) mesh.current.count = quality.level === 0 ? Math.round(matrices.length * LITE) : matrices.length;
  });
  return <instancedMesh ref={mesh} args={[geometry, meadowMaterial(), matrices.length]} receiveShadow />;
}

export function Meadow({ layer }: { layer: number }) {
  const geometry = useMemo(() => clumpGeometry(), []);
  const chunks = useMemo(() => plant(), []);
  useFrame(() => {
    light.dir.value.copy(sun).normalize();
    light.color.value.copy(DAY_GLOW).lerp(DUSK_GLOW, daylight.evening);
  });
  return (
    <>
      {chunks.map((ch, i) => (
        <Chunk key={i} geometry={geometry} matrices={ch.matrices} colors={ch.colors} layer={layer} />
      ))}
    </>
  );
}
