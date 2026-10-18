"use client";

import type { PrepType } from "@/components/world/script";

/**
 * Your island grows as you practise: every finished session adds something to it (a flower bed, a lantern, a cherry
 * tree, ducks on the pond, eventually a hot-air balloon). Visible progress, a reason to come back, and a gentle way to
 * say "look how far you've come" to someone working through interview nerves. Kept in this browser.
 */
export interface Garden {
  /** How many things have grown (one per finished session). */
  grown: number;
  /** How many of them you've already watched appear; the rest pop in next time you look at the island. */
  seen: number;
  log: { date: string; type: PrepType; item: string }[];
}

export const GARDEN_ITEMS = [
  { id: "flowerbed", label: "Flower bed", color: "#f29bb8" },
  { id: "sunflowers", label: "Sunflowers", color: "#f5c63c" },
  { id: "lanternpost", label: "Lantern post", color: "#e9a443" },
  { id: "cherry", label: "Cherry blossom tree", color: "#f6b6c8" },
  { id: "bench", label: "Bench", color: "#b07a4f" },
  { id: "beehive", label: "Beehive", color: "#d9a03a" },
  { id: "ducks", label: "Ducks on the pond", color: "#9fd3e6" },
  { id: "mushrooms", label: "Mushroom ring", color: "#e0574a" },
  { id: "birdhouse", label: "Birdhouse", color: "#7fb8d8" },
  { id: "scarecrow", label: "Scarecrow", color: "#d9b25a" },
  { id: "balloon", label: "Hot-air balloon", color: "#ef7a66" },
  { id: "apple", label: "Apple tree", color: "#6db760" },
] as const;
export type GardenItemId = (typeof GARDEN_ITEMS)[number]["id"];

/** The nth thing to grow. After the whole set, the island keeps adding flower beds, cherry trees and lanterns. */
export function gardenItem(index: number) {
  if (index < GARDEN_ITEMS.length) return GARDEN_ITEMS[index];
  const repeats = ["flowerbed", "cherry", "lanternpost", "sunflowers", "apple", "mushrooms"] as const;
  const id = repeats[(index - GARDEN_ITEMS.length) % repeats.length];
  return GARDEN_ITEMS.find((i) => i.id === id)!;
}

const KEY = "extraview:island";
const EMPTY: Garden = { grown: 0, seen: 0, log: [] };

export function loadGarden(): Garden {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Garden) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function save(garden: Garden) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...garden, log: garden.log.slice(-200) }));
  } catch {
    // Not remembered; fine.
  }
  return garden;
}

/** A session finished: grow the next thing. */
export function growGarden(type: PrepType): Garden {
  const garden = loadGarden();
  const item = gardenItem(garden.grown);
  return save({ grown: garden.grown + 1, seen: garden.seen, log: [...garden.log, { date: new Date().toISOString(), type, item: item.id }] });
}

/** You've watched the new things appear. */
export function markGardenSeen(): Garden {
  const garden = loadGarden();
  return save({ ...garden, seen: garden.grown });
}

const day = (iso: string) => iso.slice(0, 10);

/** Days in a row you've practised, counting today or yesterday as the latest. */
export function streakDays(log: Garden["log"], now = new Date()): number {
  const days = new Set(log.map((e) => day(e.date)));
  const cursor = new Date(now);
  if (!days.has(day(cursor.toISOString()))) cursor.setDate(cursor.getDate() - 1); // a streak survives until today ends
  let streak = 0;
  while (days.has(day(cursor.toISOString()))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
