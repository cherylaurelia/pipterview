// The island's look and feel as a few dials, each 1 by default (the look as designed): the haze, the light shafts, the
// cloud shadows, the gusts in the grass, the bloom, the exposure, and how closely the camera follows you. The shaders
// and frame loops read these every frame, so the tuning panel (WorldTuner, at ?tune) changes the island live. To keep
// a tuning, copy it from the panel into these defaults.

export const tuning = {
  haze: 1,
  shafts: 1,
  clouds: 1,
  gusts: 1,
  bloom: 1,
  exposure: 1,
  follow: 1,
};

export type Tuning = typeof tuning;
