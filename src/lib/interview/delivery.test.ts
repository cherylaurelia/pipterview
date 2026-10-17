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
