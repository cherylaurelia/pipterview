import { beforeEach, describe, expect, it, vi } from "vitest";
import { GARDEN_ITEMS, gardenItem, growGarden, loadGarden, markGardenSeen, streakDays } from "./garden";

describe("island garden", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) } });
  });

  it("grows one thing per session and remembers what you've seen", () => {
    growGarden("behavioral");
    const g = growGarden("technical");
    expect(g.grown).toBe(2);
    expect(g.seen).toBe(0);
    expect(g.log.map((e) => e.item)).toEqual(["flowerbed", "sunflowers"]);
    expect(markGardenSeen().seen).toBe(2);
    expect(loadGarden().seen).toBe(2);
  });

  it("keeps growing after the full set", () => {
    expect(gardenItem(GARDEN_ITEMS.length).id).toBe("flowerbed");
    expect(gardenItem(GARDEN_ITEMS.length + 1).id).toBe("cherry");
  });

  it("counts a streak of consecutive days", () => {
    const at = (d: string) => ({ date: `${d}T12:00:00.000Z`, type: "behavioral" as const, item: "flowerbed" });
    const now = new Date("2026-10-17T15:00:00Z");
    expect(streakDays([at("2026-10-15"), at("2026-10-16"), at("2026-10-17")], now)).toBe(3);
    expect(streakDays([at("2026-10-15"), at("2026-10-16")], now)).toBe(2); // today not done yet
    expect(streakDays([at("2026-10-14")], now)).toBe(0);
  });
});
