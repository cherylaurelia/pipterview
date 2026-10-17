import { describe, expect, it } from "vitest";
import { stressSignals } from "./stress";

describe("stressSignals", () => {
  it("is quiet for a normal answer", () => {
    expect(stressSignals({ text: "I led the backend and we shipped the feature two weeks early.", durationMs: 6000 })).toEqual([]);
  });

  it("notices freezing up and blanking", () => {
    const s = stressSignals({ text: "Sorry, I'm blanking on this one", startDelayMs: 15_000, durationMs: 4000 });
    expect(s).toContain("took 15 seconds to start answering");
    expect(s.some((x) => x.includes("blanking"))).toBe(true);
  });

  it("notices rushing and filler words", () => {
    const text = `um so like ${"word ".repeat(40)} you know um like basically`;
    const s = stressSignals({ text, durationMs: 10_000 });
    expect(s.some((x) => x.startsWith("speaking fast"))).toBe(true);
    expect(s.some((x) => x.startsWith("many filler words"))).toBe(true);
  });

  it("flags very short answers but not short questions", () => {
    expect(stressSignals({ text: "I'm not sure" })).toContain("very short answer");
    expect(stressSignals({ text: "Can I take a moment to think?" })).toEqual([]);
  });
});
