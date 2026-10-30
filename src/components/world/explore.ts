import * as THREE from "three";
import type { CritterPick } from "./critters";
import { walkable } from "./island";
import { byTree } from "./landscape";

// Walking about the island as your own chick, like a little game: where you are, where you're headed, the keys held
// down, and what you're close enough to use. WorldScene's controls fill in the keys and clicks, the Player component
// (player.tsx) moves you each frame, and World.tsx shows what you can do where you are.

/** Where you start, and come back to (R): just behind your chair, facing the table. */
const HOME = new THREE.Vector3(0.9, 0, 2.4);

export const player = {
  pos: HOME.clone(),
  heading: Math.atan2(-HOME.x, -HOME.z),
  /** Where you clicked to walk to, if anywhere. */
  goal: null as THREE.Vector3 | null,
};

/** Keys held down (lower case), for walking. */
export const held = new Set<string>();

export function walkTo(x: number, z: number) {
  player.goal = new THREE.Vector3(x, 0, z);
}

/** Back to your spot by the table. */
export function goHomeSpot() {
  player.pos.copy(HOME);
  player.heading = Math.atan2(-HOME.x, -HOME.z);
  player.goal = null;
}

/** Whether you can stand at (x, z). */
export const canStand = (x: number, z: number) => walkable(x, z) && !byTree(x, z);

/** Something you're close enough to use: the table (to sit down), or a creature. */
export type Nearby = { type: "table" } | { type: "critter"; pick: CritterPick };
