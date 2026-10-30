import * as THREE from "three";

// Time of day, shared by everything in the scene: 0 is the soft afternoon you practise in, 1 is the sunset that
// arrives when you finish. WorldScene eases `evening` towards its target each frame; the sky, lights, fog, clouds and
// fireflies read it in their own frame loops.

export const daylight = { evening: 0 };

/** Blends two colours by `evening` into `out`. */
export function dusk(out: THREE.Color, day: THREE.Color, sunset: THREE.Color) {
  return out.copy(day).lerp(sunset, daylight.evening);
}
