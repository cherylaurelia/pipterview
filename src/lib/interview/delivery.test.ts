import { describe, expect, it } from "vitest";
import { deliveryStats } from "./delivery";

describe("deliveryStats", () => {
  it("computes pace and fillers from spoken answers", () => {
    const stats = deliveryStats([
      { role: "interviewer", text: "Tell me about a project." },
      // 30 words in 15 seconds = 120 wpm, with 3 fillers.
      { role: "candidate", text: `um so ${"word ".repeat(24)}like you know done`, durationMs: 15_000 },
    ]);
    expect(stats.spokenAnswers).toBe(1);
    expect(stats.wordsPerMinute).toBe(120);
    expect(stats.fillerCount).toBe(3);
    expect(stats.topFillers.map((f) => f.word).sort()).toEqual(["like", "um", "you know"]);
    expect(stats.longestAnswerSeconds).toBe(15);
  });

  it("handles typed-only interviews without a pace", () => {
    const stats = deliveryStats([{ role: "candidate", text: "A typed answer with no timing" }]);
    expect(stats.wordsPerMinute).toBeUndefined();
    expect(stats.averageAnswerWords).toBe(6);
  });

  it("doesn't count words that merely contain a filler", () => {
    expect(deliveryStats([{ role: "candidate", text: "I liked the umbrella project" }]).fillerCount).toBe(0);
  });
});

describe("delivery habits", () => {
  it("counts hedges, ownership, think time and talk share", () => {
    const stats = deliveryStats([
      { role: "interviewer", text: "Tell me about a time you led something." },
      { role: "candidate", text: "I think we built it, maybe. I led the design and I wrote the API.", durationMs: 8_000, thinkMs: 2_000 },
      { role: "candidate", text: "We shipped it and our users liked it, I guess.", durationMs: 5_000, thinkMs: 4_000 },
    ]);
    expect(stats.hedgeCount).toBe(3);
    expect(stats.hedgesPerAnswer).toBe(1.5);
    expect(stats.topHedges[0]).toEqual({ word: "i think", count: 1 });
    expect(stats.averageThinkSeconds).toBe(3);
    // "I" words: I (think), I (led), I (wrote), I (guess) = 4; "we" words: we, We, our = 3
    expect(stats.ownershipPercent).toBe(57);
    expect(stats.talkSharePercent).toBeGreaterThan(70);
  });

  it("leaves ownership out when it barely came up", () => {
    expect(deliveryStats([{ role: "candidate", text: "A hash map gives constant time lookups." }]).ownershipPercent).toBeUndefined();
  });
});
