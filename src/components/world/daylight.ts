import * as THREE from "three";

// Time of day, shared by everything in the scene: 0 is the soft afternoon you practise in, 1 is the sunset that
// arrives when you finish. WorldScene eases `evening` towards its target each frame; the sky, lights, fog, clouds and
// fireflies read it in their own frame loops.

export const daylight = { evening: 0 };

/** Where the sun is (WorldScene's DayCycle moves it lower towards sunset), for the haze and light shafts in effects.tsx. */
export const sun = new THREE.Vector3(-11, 15, -13);

/**
 * What the camera is looking at (set by the camera rig): how far away it is, so the haze only gathers beyond it and the
 * depth of field keeps it sharp; how soft things away from it go (`blur`, in pixels at most); and how much the top and
 * bottom of the picture soften too (`tilt`), for the tilt-shift look of a photo of a miniature.
 */
export const focus = { distance: 6, blur: 5, tilt: 0.6 };

/** Blends two colours by `evening` into `out`. */
export function dusk(out: THREE.Color, day: THREE.Color, sunset: THREE.Color) {
  return out.copy(day).lerp(sunset, daylight.evening);
}
