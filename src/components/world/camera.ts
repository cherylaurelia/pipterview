import * as THREE from "three";
import { COTTAGE, COTTAGE_TURN, WINDMILL, WINDMILL_TURN, groundY } from "./island";
import { CROWNS } from "./landscape";

// Keeping the follow camera clear of things on the island: tree crowns, Pip, the table, the windmill and the cottage.
// The camera never jumps to get out of the way: `clearView` finds the smallest rise that clears the view (a smooth
// function of where you stand, so it doesn't hop between fixed steps), only coming in closer when no rise is enough,
// and `Avoidance` eases into that quickly and back out slowly, so walking past something is one soft glide.

export interface Sphere {
  x: number;
  y: number;
  z: number;
  r: number;
}

/** A box on the ground turned by `turn` about the vertical: centre, half sizes. */
export interface Box {
  x: number;
  y: number;
  z: number;
  hx: number;
  hy: number;
  hz: number;
  turn: number;
}

const PAD = 0.3; // room left round buildings, so the camera doesn't graze a wall or a sail

const windmill = (() => {
  const y = groundY(WINDMILL.x, WINDMILL.z);
  // the sails turn on a hub 1 m out in front of the cap, which faces the windmill's +z
  const hub = { x: WINDMILL.x + Math.sin(WINDMILL_TURN) * 1.0, z: WINDMILL.z + Math.cos(WINDMILL_TURN) * 1.0 };
  return [
    { x: WINDMILL.x, y: y + 0.9, z: WINDMILL.z, r: 0.95 + PAD },
    { x: WINDMILL.x, y: y + 1.9, z: WINDMILL.z, r: 0.85 + PAD },
    { x: WINDMILL.x, y: y + 2.9, z: WINDMILL.z, r: 0.7 + PAD },
    { x: hub.x, y: y + 2.72, z: hub.z, r: 1.65 + PAD }, // the sweep of the sails
  ];
})();

export const SPHERES: Sphere[] = [...CROWNS, ...windmill];

export const BOXES: Box[] = [
  // the cottage: walls and footing, and the roof and chimney above them, with the eaves' overhang
  { x: COTTAGE.x, y: groundY(COTTAGE.x, COTTAGE.z) + 1.3, z: COTTAGE.z, hx: 1.45 + PAD, hy: 1.35 + PAD, hz: 1.3 + PAD, turn: COTTAGE_TURN },
];

/** Where along from → to (0 to 1) a ray first enters a sphere it starts outside of; 1 if never. */
function hitSphere(from: THREE.Vector3, d: THREE.Vector3, len2: number, c: Sphere) {
  const ox = from.x - c.x, oy = from.y - c.y, oz = from.z - c.z;
  const b = (ox * d.x + oy * d.y + oz * d.z) / len2, cc = (ox * ox + oy * oy + oz * oz - c.r * c.r) / len2, disc = b * b - cc;
  if (disc <= 0 || cc < 0) return 1; // misses it, or starts inside it (you're standing in its padding): it doesn't count
  const t = -b - Math.sqrt(disc);
  return t > 0 ? t : 1;
}

/** Where along from → to (0 to 1) a ray first enters a turned box it starts outside of; 1 if never. */
function hitBox(from: THREE.Vector3, d: THREE.Vector3, b: Box) {
  const c = Math.cos(b.turn), s = Math.sin(b.turn);
  // into the box's own frame (the inverse of its turn about y)
  const fx = from.x - b.x, fz = from.z - b.z;
  const o = [c * fx - s * fz, from.y - b.y, s * fx + c * fz], v = [c * d.x - s * d.z, d.y, s * d.x + c * d.z], h = [b.hx, b.hy, b.hz];
  if (Math.abs(o[0]) < h[0] && Math.abs(o[1]) < h[1] && Math.abs(o[2]) < h[2]) return 1; // starts inside
  let near = 0, far = 1;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(v[i]) < 1e-9) {
      if (Math.abs(o[i]) > h[i]) return 1;
      continue;
    }
    let t0 = (-h[i] - o[i]) / v[i], t1 = (h[i] - o[i]) / v[i];
    if (t0 > t1) [t0, t1] = [t1, t0];
    near = Math.max(near, t0);
    far = Math.min(far, t1);
    if (near > far) return 1;
  }
  return near;
}

const dir = new THREE.Vector3();

/** How far along from `from` to `to` (0 to 1) the line first enters something the camera keeps clear of; 1 if never. */
export function blockedAt(from: THREE.Vector3, to: THREE.Vector3, spheres = SPHERES, boxes = BOXES) {
  dir.subVectors(to, from);
  const len2 = dir.lengthSq();
  if (len2 < 1e-9) return 1;
  let nearest = 1;
  for (const c of spheres) nearest = Math.min(nearest, hitSphere(from, dir, len2, c));
  for (const b of boxes) nearest = Math.min(nearest, hitBox(from, dir, b));
  return nearest;
}

export const MAX_LIFT = 0.6; // radians the camera may rise over something before it comes in closer instead
/** The highest the camera goes (radians above the horizon), whether you drag it there or it rises over something. */
export const EL_MAX = 1.25;

/** The camera's place at `az`, `el` (raised by `lift`) and `dist` from `look`, a fraction `reach` of the way out. */
export function orbit(out: THREE.Vector3, look: THREE.Vector3, az: number, el: number, dist: number, lift = 0, reach = 1) {
  const e = Math.min(EL_MAX, el + lift);
  return out.set(Math.sin(az) * Math.cos(e), Math.sin(e), Math.cos(az) * Math.cos(e)).multiplyScalar(dist * reach).add(look);
}

const probe = new THREE.Vector3();

const STEPS = 12; // the rise is first tried in steps of MAX_LIFT / STEPS, so a gap between two blockers isn't skipped
export const MARGIN = 0.03; // radians of rise kept spare above the least that clears, so the edge of a crown isn't grazed

/**
 * How to see `look` clearly from the orbit at az/el/dist: the least rise that clears the view (the first clear step,
 * then halved down to a hundredth of a radian, plus a little to spare), or, when no rise is enough, the full rise and
 * how far out (`reach`) the camera can be and still be short of what's in the way.
 */
export function clearView(look: THREE.Vector3, az: number, el: number, dist: number, spheres = SPHERES, boxes = BOXES) {
  const clearAt = (lift: number) => blockedAt(look, orbit(probe, look, az, el, dist, lift), spheres, boxes);
  if (clearAt(0) >= 1) return { lift: 0, reach: 1 };
  let hi = -1;
  for (let k = 1; k <= STEPS; k++) {
    if (clearAt((k / STEPS) * MAX_LIFT) >= 1) {
      hi = (k / STEPS) * MAX_LIFT;
      break;
    }
  }
  if (hi < 0) {
    // squared, so the camera stays short of the blocker and `reach` runs smoothly up to 1 as it clears; never closer
    // in than 0.3 of the way unless the blocker itself is nearer than that
    const top = clearAt(MAX_LIFT);
    return { lift: MAX_LIFT, reach: Math.max(top * top, Math.min(0.3, top * 0.9)) };
  }
  let lo = hi - MAX_LIFT / STEPS;
  while (hi - lo > 0.01) {
    const mid = (lo + hi) / 2;
    if (clearAt(mid) >= 1) hi = mid;
    else lo = mid;
  }
  return { lift: Math.min(MAX_LIFT, hi + MARGIN), reach: 1 };
}

/**
 * The camera's way round things, eased: it rises (or comes in) briskly when something gets in the way and settles
 * back slowly once it's clear, so it never snaps, and passing a tree trunk doesn't make it bob.
 */
export class Avoidance {
  lift = 0;
  reach = 1;
  update(goal: { lift: number; reach: number }, dt: number) {
    const step = (now: number, to: number, fast: boolean) => now + (to - now) * (1 - Math.exp(-Math.min(dt, 0.1) * (fast ? 5 : 1.4)));
    this.lift = step(this.lift, goal.lift, goal.lift > this.lift);
    this.reach = step(this.reach, goal.reach, goal.reach < this.reach);
    return this;
  }
}
