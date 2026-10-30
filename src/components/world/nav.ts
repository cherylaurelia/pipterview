import { COTTAGE, POND, WINDMILL } from "./island";

// Getting around the island: the places you can jump to from the "Go to" buttons (in World.tsx), and a request the
// camera (in WorldScene.tsx) picks up on its next frame and flies to.

export interface Place {
  id: string;
  label: string;
  /** Where to look, on the ground. */
  x: number;
  z: number;
  /** How far back the camera stands. */
  dist: number;
}

export const PLACES: Place[] = [
  { id: "table", label: "Table", x: 0, z: -0.8, dist: 15 },
  { id: "pond", label: "Pond", x: POND.x, z: POND.z, dist: 9 },
  { id: "windmill", label: "Windmill", x: WINDMILL.x, z: WINDMILL.z, dist: 11 },
  { id: "cottage", label: "Cottage", x: COTTAGE.x, z: COTTAGE.z, dist: 11 },
];

let request: Place | null = null;

/** Flies the island camera to `place`. */
export function flyTo(place: Place) {
  request = place;
}

/** The place asked for since last time, if any (and forgets it). */
export function takeFlight() {
  const r = request;
  request = null;
  return r;
}
