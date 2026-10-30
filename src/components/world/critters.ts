// The pond's creatures you can click on (see pond.tsx): which one is picked, and the little things each can do. The
// toolbar (in World.tsx) queues an action here; the creature picks it up in its own frame loop and plays it.

export type CritterKind = "frog" | "duck" | "grassDuck" | "koi";

/** A sound for an action; see `Ambience.critter` in sound.ts. */
export type CritterSound = "croak" | "quack" | "splash" | "plop" | "flap" | "slurp" | "peck";

export interface CritterAction {
  label: string;
  sound: CritterSound;
}

export const CRITTERS: Record<CritterKind, { name: string; actions: CritterAction[] }> = {
  frog: {
    name: "Frog",
    actions: [
      { label: "Hop", sound: "plop" },
      { label: "Catch a fly", sound: "slurp" },
      { label: "Croak", sound: "croak" },
    ],
  },
  duck: {
    name: "Duck",
    actions: [
      { label: "Quack", sound: "quack" },
      { label: "Dive", sound: "splash" },
      { label: "Flap", sound: "flap" },
    ],
  },
  grassDuck: {
    name: "Duck",
    actions: [
      { label: "Quack", sound: "quack" },
      { label: "Peck", sound: "peck" },
      { label: "Waddle", sound: "quack" },
    ],
  },
  koi: {
    name: "Koi",
    actions: [
      { label: "Jump", sound: "splash" },
      { label: "Feed", sound: "plop" },
      { label: "Swim", sound: "plop" },
    ],
  },
};

/** One creature: its kind, and which of that kind (there are two ducks on the water, two on the grass, three koi). */
export interface CritterPick {
  kind: CritterKind;
  index: number;
}

const inbox: (CritterPick & { action: string })[] = [];

/** Asks a creature to do something; it happens on its next frame. */
export function askCritter(pick: CritterPick, action: string) {
  inbox.push({ ...pick, action });
}

/** The next thing asked of this creature, if anything (and forgets it). */
export function takeAction(kind: CritterKind, index: number) {
  const i = inbox.findIndex((a) => a.kind === kind && a.index === index);
  return i < 0 ? null : inbox.splice(i, 1)[0].action;
}
