// How much the scene draws, and how much it moves, for the machine and the person in front of it.
//
// Quality: 2 is everything (ambient occlusion, outlines, the pond's reflection, bloom, the colour grade); 1 drops the
// outlines and the reflection; 0 drops the whole post-processing chain and renders at 1x. "auto" starts at 2 and steps
// down (never back up, so it doesn't flicker between levels) if the first seconds run slowly. The setting is kept in
// this browser.
//
// Motion: follows the system's "reduce motion" setting: camera flights become cuts, the splash stops orbiting, and the
// grass sways gently.

export type QualitySetting = "auto" | "lite" | "full";

const KEY = "pip:graphics";

export const quality = {
  setting: "auto" as QualitySetting,
  /** What auto has measured it can manage (2, 1 or 0). */
  measured: 2,
  /** The level in use now. */
  get level() {
    return this.setting === "full" ? 2 : this.setting === "lite" ? 0 : this.measured;
  },
};

export function loadQuality(): QualitySetting {
  try {
    const v = window.localStorage.getItem(KEY);
    if (v === "auto" || v === "lite" || v === "full") quality.setting = v;
  } catch {
    // storage blocked: auto it is
  }
  return quality.setting;
}

export function saveQuality(setting: QualitySetting) {
  quality.setting = setting;
  try {
    window.localStorage.setItem(KEY, setting);
  } catch {
    // storage blocked: it still applies for this visit
  }
}

/**
 * Feeds auto mode one frame's duration (seconds). Every few seconds it looks at the average and steps down a level if
 * it's under about 40 frames a second. Returns true when the level just changed.
 */
const sample = { time: 0, frames: 0, skip: 1.5 };
export function measureFrame(dt: number) {
  if (quality.setting !== "auto" || quality.measured === 0) return false;
  if (sample.skip > 0) {
    sample.skip -= dt; // let shaders compile and the first flight settle before judging
    return false;
  }
  // one long frame (back from a background tab, a GC pause) counts as one slow frame, not seconds of slowness
  sample.time += Math.min(dt, 0.1);
  sample.frames++;
  if (sample.time < 4) return false;
  const fps = sample.frames / sample.time;
  sample.time = 0;
  sample.frames = 0;
  if (fps >= 40) return false;
  quality.measured--;
  sample.skip = 1; // the new level gets a moment to settle too
  return true;
}

/** Whether the system asks for reduced motion. Read every frame, so it's cached and kept current by one listener. */
let reduce: boolean | null = null;
export function reducedMotion() {
  if (reduce === null) {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduce = q.matches;
    q.addEventListener("change", (e) => void (reduce = e.matches));
  }
  return reduce;
}
