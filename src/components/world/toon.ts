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

const swaying = new Map<string, THREE.MeshToonMaterial>();

/**
 * The soft-shaded material for instanced grass, reeds and cattails, which lean in the breeze: each leans by its
 * height, in waves that roll across the island. `vertexColors` for meshes that carry their own colours.
 */
export function swayingToon(vertexColors = false) {
  const key = String(vertexColors);
  let m = swaying.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ gradientMap: gradientMap(), vertexColors });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uWind = wind;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uWind;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec2 at = instanceMatrix[3].xz;
          #else
            vec2 at = vec2(0.0);
          #endif
          float sway = sin(uWind * 1.5 + at.x * 0.3 + at.y * 0.2) * 0.6 + sin(uWind * 2.6 + at.x * 0.9) * 0.2;
          transformed.x += sway * position.y * 0.9;
          transformed.z += sway * position.y * 0.35;`,
        );
    };
    m.customProgramCacheKey = () => `sway-${key}`;
    swaying.set(key, m);
  }
  return m;
}
