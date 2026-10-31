import * as THREE from "three";
import type { CritterPick } from "./critters";
import { COTTAGE, COTTAGE_TURN, walkable, WINDMILL, WINDMILL_TURN } from "./island";


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
  /** The seat you're sitting on, if any. */
  sitting: null as string | null,
};

/** Keys held down (lower case), for walking. */
export const held = new Set<string>();

/** The on-screen joystick (touch screens): x to the right, y forwards, each -1 to 1. */
export const stick = { x: 0, y: 0 };

export function walkTo(x: number, z: number) {
  getUp();
  player.goal = new THREE.Vector3(x, 0, z);
}

/** Back to your spot by the table. */
export function goHomeSpot() {
  player.pos.copy(HOME);
  player.heading = Math.atan2(-HOME.x, -HOME.z);
  player.goal = null;
  player.sitting = null;
}

/** Somewhere to sit (a bench): where you sit, at what height, and which way you face. */
export interface Seat {
  x: number;
  z: number;
  y: number;
  heading: number;
}

const seats = new Map<string, Seat>();

/** A bench says where its seat is (or that it's gone, with null). */
export function setSeat(id: string, seat: Seat | null) {
  if (seat) seats.set(id, seat);
  else seats.delete(id);
}

export const seatAt = (id: string) => seats.get(id);

/** The seat nearest (x, z), if one is within `reach` metres. */
export function nearestSeat(x: number, z: number, reach: number) {
  let best: string | null = null, bestD = reach;
  for (const [id, s] of seats) {
    const d = Math.hypot(s.x - x, s.z - z);
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  }
  return best;
}

export function sitOn(id: string) {
  if (!seats.has(id)) return;
  player.goal = null;
  player.sitting = id;
}

/** Up off the seat, onto your feet just in front of it. */
export function getUp() {
  const s = player.sitting ? seats.get(player.sitting) : null;
  player.sitting = null;
  if (s) player.pos.set(s.x + Math.sin(s.heading) * 0.75, 0, s.z + Math.cos(s.heading) * 0.75);
}

/** Inside a bench (a box about the size of one, round its seat). */
const inSeat = (x: number, z: number) =>
  [...seats.values()].some((s) => {
    const dx = x - s.x, dz = z - s.z, c = Math.cos(s.heading), n = Math.sin(s.heading);
    return Math.abs(dx * c - dz * n) < 0.8 && Math.abs(dx * n + dz * c) < 0.38;
  });

/** Whether you can stand at (x, z) (trees and bushes you slide round instead: see `slideRoundPlants`). */
export const canStand = (x: number, z: number) => walkable(x, z) && !inSeat(x, z);

/** Doors you can walk up to: the cottage keeps your story bank, the windmill how you're doing. */
export type DoorId = "cottage" | "windmill";
const doorAt = (x: number, z: number, turn: number, out: number) => ({ x: x + Math.sin(turn) * out, z: z + Math.cos(turn) * out });
export const DOORS: { id: DoorId; x: number; z: number }[] = [
  { id: "cottage", ...doorAt(COTTAGE.x, COTTAGE.z, COTTAGE_TURN, 1.25) },
  { id: "windmill", ...doorAt(WINDMILL.x, WINDMILL.z, WINDMILL_TURN, 0.95) },
];

/** The door nearest (x, z), if one is within `reach` metres. */
export function nearestDoor(x: number, z: number, reach: number): DoorId | null {
  let best: DoorId | null = null, bestD = reach;
  for (const d of DOORS) {
    const dist = Math.hypot(d.x - x, d.z - z);
    if (dist < bestD) {
      bestD = dist;
      best = d.id;
    }
  }
  return best;
}

/** Something you're close enough to use: the table (to sit down), a bench, a door, or a creature. */
export type Nearby =
  | { type: "table" }
  | { type: "seat"; id: string; sitting: boolean }
  | { type: "door"; id: DoorId }
  | { type: "critter"; pick: CritterPick };
