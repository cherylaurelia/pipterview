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

const cache = new Map<string, THREE.MeshToonMaterial>();

/** A shared soft-shaded material in `color`. */
export function toon(color: string) {
  let m = cache.get(color);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap() });
    cache.set(color, m);
  }
  return m;
}
