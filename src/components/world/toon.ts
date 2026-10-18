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
function paleGradientMap() {
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
