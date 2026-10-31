import { describe, expect, it } from "vitest";
import type { SessionRecord } from "./history";
import { improvementsSince } from "./improvement";
import type { DeliveryStats } from "./interview/delivery";

const stats = (s: Partial<DeliveryStats>): DeliveryStats => ({
  spokenAnswers: 3,
  fillerCount: 0,
  topFillers: [],
  averageAnswerWords: 80,
  hedgeCount: 0,
  hedgesPerAnswer: 0,
  topHedges: [],
  ...s,
});
const prev = (s: Partial<SessionRecord>): SessionRecord => ({
  id: "p",
  date: "2026-10-30T00:00:00Z",
  typeId: "behavioral",
  intensity: "gentle",
  style: "startup",
  recommendation: "lean_hire",
  averageScore: 2.5,
  dimensions: [],
  ...s,
});

describe("what got better since last time", () => {
  it("is nothing on your first session", () => {
    expect(improvementsSince(undefined, { stats: stats({ fillersPerMinute: 1 }) })).toEqual([]);
  });

  it("notices fewer filler words, less hedging, more ownership and calmer nerves", () => {
    const got = improvementsSince(prev({ fillersPerMinute: 4.1, hedgesPerAnswer: 1.2, ownershipPercent: 40, nervousBefore: 4 }), {
      stats: stats({ fillersPerMinute: 2.8, hedgesPerAnswer: 0.6, ownershipPercent: 65 }),
      nervousBefore: 3,
    });
    expect(got).toEqual(["fewer filler words (4.1 → 2.8 a minute)", "less hedging (1.2 → 0.6 an answer)", 'more "I" and less "we" (40% → 65%)', "calmer going in"]);
  });

  it("ignores changes too small to mean much, and things that got worse", () => {
    const got = improvementsSince(prev({ fillersPerMinute: 3.0, hedgesPerAnswer: 0.5, ownershipPercent: 50, nervousBefore: 2 }), {
      stats: stats({ fillersPerMinute: 2.8, hedgesPerAnswer: 0.4, ownershipPercent: 55 }),
      nervousBefore: 3,
    });
    expect(got).toEqual([]);
  });
});
