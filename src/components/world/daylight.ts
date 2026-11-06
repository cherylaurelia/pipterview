import * as THREE from "three";

// Time of day, shared by everything in the scene: 0 is the soft afternoon you practise in, 1 is the sunset that
// arrives when you finish. WorldScene eases `evening` towards its target each frame; the sky, lights, fog, clouds and
// fireflies read it in their own frame loops.

export const daylight = { evening: 0 };

/** Where the sun is (WorldScene's DayCycle moves it lower towards sunset), for the haze and light shafts in effects.tsx. */
export const sun = new THREE.Vector3(-11, 15, -13);

/** How far the camera is from what it's looking at (set by the camera rig), so the haze only gathers beyond it. */
export const focus = { distance: 6 };

/** Blends two colours by `evening` into `out`. */
export function dusk(out: THREE.Color, day: THREE.Color, sunset: THREE.Color) {
  return out.copy(day).lerp(sunset, daylight.evening);
}
