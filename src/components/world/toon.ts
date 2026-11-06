import * as THREE from "three";

// The world's soft-shaded look: a lighting ramp that wraps light gently round each shape (shadows never go fully dark;
// the cool sky light fills them), so things read as rounded, chunky toys with smooth gradients, as in shader packs.

let gradient: THREE.DataTexture | null = null;

/** The lighting ramp, for `<meshToonMaterial gradientMap={gradientMap()} />` in JSX. */
export function gradientMap() {
  if (!gradient) {
    gradient = new THREE.DataTexture(new Uint8Array([105, 150, 196, 232, 255]), 5, 1, THREE.RedFormat);
    gradient.minFilter = gradient.magFilter = THREE.LinearFilter;
    gradient.generateMipmaps = false;
    gradient.needsUpdate = true;
  }
  return gradient;
}

let paleGradient: THREE.DataTexture | null = null;

/** The same ramp with a lifted darkest step, for pale things that would otherwise go mustard in the warm sunset light. */
export function paleGradientMap() {
  if (!paleGradient) {
    paleGradient = new THREE.DataTexture(new Uint8Array([150, 160, 196, 232, 255]), 5, 1, THREE.RedFormat);
    paleGradient.minFilter = paleGradient.magFilter = THREE.LinearFilter;
    paleGradient.generateMipmaps = false;
    paleGradient.needsUpdate = true;
  }
  return paleGradient;
}

const cache = new Map<string, THREE.MeshToonMaterial>();

/** A shared soft-shaded material in `color`; `pale` keeps its shadowed side lighter. */
export function toon(color: string, pale = false) {
  const key = pale ? `${color}:pale` : color;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: pale ? paleGradientMap() : gradientMap() });
    cache.set(key, m);
  }
  return m;
}

/** The breeze: one clock (moved on by the grass in landscape.tsx) shared by everything that sways. */
export const wind = { value: 0 };
/** How far things sway: less for reduced motion. */
export const windAmp = { value: 1 };
/** Where your chick is walking (y < 0 when it isn't out), so the grass round it parts as it goes. */
export const trample = { value: new THREE.Vector3(0, -1, 0) };
/** How strong the gusts are (1 as designed; see tuning.ts). */
export const gusts = { value: 1 };

const swaying = new Map<string, THREE.MeshToonMaterial>();

let castsNothing: THREE.MeshDepthMaterial | null = null;
/**
 * For `customDepthMaterial` on things that should be shadowed but not cast shadows: with variance shadow maps, anything
 * that receives shadows is also drawn into the shadow map, which for the grass is thousands of blades every frame for
 * no visible gain. This draws nothing there.
 */
export function castNoShadow() {
  if (!castsNothing) {
    castsNothing = new THREE.MeshDepthMaterial();
    castsNothing.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace("void main() {", "void main() {\n  discard;");
    };
    castsNothing.customProgramCacheKey = () => "cast-no-shadow";
  }
  return castsNothing;
}

/**
 * The soft-shaded material for instanced grass, reeds and cattails, which lean in the breeze: each leans by its
 * height, in waves that roll across the island, with gusts that sweep across now and then, bending the blades further
 * and catching the light on their tips, as wind does in a real meadow. Blades near your chick bend away from it.
 * `vertexColors` for meshes that carry their own colours.
 */
export function swayingToon(vertexColors = false, pale = false) {
  const key = `${vertexColors}-${pale}`;
  let m = swaying.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ gradientMap: pale ? paleGradientMap() : gradientMap(), vertexColors });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uWind = wind;
      shader.uniforms.uWindAmp = windAmp;
      shader.uniforms.uTrample = trample;
      shader.uniforms.uGusts = gusts;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\nuniform float uWind;\nuniform float uWindAmp;\nuniform vec3 uTrample;\nuniform float uGusts;\nvarying float vGust;\nvarying float vPatch;\n${NOISE_GLSL}`)
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec2 at = instanceMatrix[3].xz;
          #else
            vec2 at = vec2(0.0);
          #endif
          float sway = (sin(uWind * 1.5 + at.x * 0.3 + at.y * 0.2) * 0.6 + sin(uWind * 2.6 + at.x * 0.9) * 0.2) * uWindAmp;
          // a gust: a band of stronger wind rolling across the island, its front wavering
          float gust = pow(0.5 + 0.5 * sin(dot(at, vec2(0.32, 0.18)) - uWind * 1.2 + sin(at.y * 0.4 + uWind * 0.3)), 6.0) * uWindAmp * uGusts;
          sway += gust * 0.9;
          vGust = gust * clamp(position.y * 6.0, 0.0, 1.0);
          // big soft patches across the meadow, lusher in some places and sun-dried in others
          vPatch = pnNoise(at * 0.13) * 0.65 + pnNoise(at * 0.41 + 7.0) * 0.35;
          transformed.x += sway * position.y * 0.9;
          transformed.z += sway * position.y * 0.35;
          #ifdef USE_INSTANCING
            // bent away from your chick, in the world's frame (turned back into the blade's own)
            vec2 away = at - uTrample.xz;
            float push = (1.0 - smoothstep(0.12, 0.7, length(away))) * step(0.0, uTrample.y);
            vec2 out2 = normalize(away + vec2(1e-4)) * push;
            transformed += inverse(mat3(instanceMatrix)) * vec3(out2.x, -0.45 * push, out2.y) * position.y * 1.5;
          #endif`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying float vGust;\nvarying float vPatch;")
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          diffuseColor.rgb *= mix(vec3(0.82, 0.93, 0.82), vec3(1.1, 1.05, 0.82), smoothstep(0.25, 0.75, vPatch));
          diffuseColor.rgb *= 1.0 + vGust * 0.22; // the gust's sheen on the tips`,
        );
    };
    m.customProgramCacheKey = () => `sway3-${key}`;
    swaying.set(key, m);
  }
  return m;
}

/** Value noise in GLSL, for the painted-look patches below and the water. */
export const NOISE_GLSL = /* glsl */ `
  float pnHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float pnNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(pnHash(i), pnHash(i + vec2(1.0, 0.0)), f.x), mix(pnHash(i + vec2(0.0, 1.0)), pnHash(i + vec2(1.0)), f.x), f.y);
  }`;

/**
 * Makes a soft-shaded material look hand-painted: its colour is broken up by brush strokes, with a warmer, yellower
 * tint on the lighter ones, like gouache on paper. "strokes" are long thin dabs whose direction drifts across the
 * island (for the ground); "dabs" are rounder, blotchy ones that don't band on curved shapes (for tree crowns).
 * `scale` is how big they are (bigger is finer); `strength` how much they vary the colour.
 */
export function painterly(
  material: THREE.MeshToonMaterial,
  scale = 1,
  strength = 1,
  kind: "strokes" | "dabs" = "strokes",
  /** `local`: the paint is fixed to the object (for things that move, so it doesn't crawl over them); `rim`: a soft
   * warm light round the edges, as if lit from behind, for soft, fluffy things. */
  { local = false, rim = 0 }: { local?: boolean; rim?: number } = {},
) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vPaintPos;")
      .replace("#include <worldpos_vertex>", `#include <worldpos_vertex>\nvPaintPos = ${local ? "transformed" : "(modelMatrix * vec4(transformed, 1.0)).xyz"};`);
    if (rim > 0)
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        {
          float facing = abs(dot(normalize(normal), normalize(vViewPosition)));
          totalEmissiveRadiance += vec3(1.0, 0.86, 0.66) * pow(1.0 - facing, 2.5) * ${rim.toFixed(3)};
        }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vPaintPos;\n${NOISE_GLSL}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        {
          vec3 w = vPaintPos * ${scale.toFixed(3)};
          vec2 p = w.xz + vec2(w.y * 0.7, -w.y * 0.5);
          float a = pnNoise(p * 0.15) * 3.1416;
          vec2 q = mat2(cos(a), -sin(a), sin(a), cos(a)) * p;
          float stroke = ${kind === "dabs" ? "(pnNoise(w.xz * 2.2) + pnNoise(w.xy * 2.2 + 7.0) + pnNoise(w.zy * 2.2 + 13.0)) / 3.0 * 1.6 - 0.3" : "pnNoise(vec2(q.x * 1.3, q.y * 6.5))"};
          float fine = pnNoise(p * 9.0);
          // fade the strokes out where they'd be smaller than a pixel (far away), or they shimmer into wood grain
          float k = ${strength.toFixed(3)} * (1.0 - smoothstep(0.25, 0.9, length(fwidth(q * vec2(1.3, 6.5)))));
          diffuseColor.rgb *= 1.0 + k * (0.24 * (stroke - 0.5) + 0.08 * (fine - 0.5) * (1.0 - smoothstep(0.3, 1.0, length(fwidth(p * 9.0)))));
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.1, 1.07, 0.82), smoothstep(0.62, 0.92, stroke) * 0.45 * k);
        }`,
      );
  };
  material.customProgramCacheKey = () => `painterly-${scale}-${strength}-${kind}-${local}-${rim}`;
  return material;
}

const fluffy = new Map<string, THREE.MeshToonMaterial>();

/**
 * The chicks' material: soft-shaded like everything else, with small paint dabs fixed to the body that read as
 * feathers, and a warm rim of light round the edges, so they look soft and stand out from the scenery.
 */
export function fluffyToon(color: string, pale = false) {
  const key = `${color}:${pale}`;
  let m = fluffy.get(key);
  if (!m) {
    m = painterly(new THREE.MeshToonMaterial({ color, gradientMap: pale ? paleGradientMap() : gradientMap() }), 9, 0.55, "dabs", { local: true, rim: 0.45 });
    fluffy.set(key, m);
  }
  return m;
}

const painted = new Map<string, THREE.MeshToonMaterial>();

/** A soft-shaded material with blotchy paint dabs, for walls and other big flat surfaces that would look plastic. */
export function paintedToon(color: string, pale = false) {
  const key = `${color}:${pale}`;
  let m = painted.get(key);
  if (!m) {
    m = painterly(new THREE.MeshToonMaterial({ color, gradientMap: pale ? paleGradientMap() : gradientMap() }), 3.2, 0.7, "dabs");
    painted.set(key, m);
  }
  return m;
}
