import { describe, expect, it } from "vitest";
import type { Feedback } from "../../src/lib/interview/prompts";
import { grade, normalise, quotedPhrases, type CaseResult, type EvalCase, type Level } from "./grade";

const RUBRIC = ["Problem solving", "Communication"];

function result(level: Level, score: number, recommendation: Feedback["recommendation"], evidence = "Explained clearly.", questionId = "q1"): CaseResult {
  const c: EvalCase = { id: `technical/${questionId}/${level}`, typeId: "technical", questionId, level, turns: [{ role: "candidate", text: "I would use a hash map to look up each complement in one pass." }] };
  const feedback: Feedback = {
    recommendation,
    summary: "",
    dimensions: RUBRIC.map((name) => ({ name, score, evidence, advice: "" })),
    strengths: [],
    improvements: [],
    questionReviews: [{ questionId, wentWell: "", toImprove: "", strongerAnswer: "" }],
    nextSteps: [],
    stories: [],
  };
  return { case: c, feedback, ms: 1000 };
}

describe("feedback eval grading", () => {
  it("passes ordering and recommendations when strong > average > weak", () => {
    const g = grade([result("strong", 4, "hire"), result("average", 3, "lean_hire"), result("weak", 1, "no_hire")], () => RUBRIC);
    expect(g.ordering).toMatchObject({ passed: 1, total: 1 });
    expect(g.recommendation).toMatchObject({ passed: 1, total: 1 });
  });

  it("fails ordering when an average answer outscores a strong one", () => {
    const g = grade([result("strong", 2, "hire"), result("average", 3, "lean_hire"), result("weak", 1, "no_hire")], () => RUBRIC);
    expect(g.ordering.passed).toBe(0);
    expect(g.ordering.failures[0]).toContain("q1");
  });

  it("holds non-answers to the floor", () => {
    expect(grade([result("non_answer", 1, "strong_no_hire")], () => RUBRIC).floor.passed).toBe(1);
    expect(grade([result("non_answer", 2, "lean_hire")], () => RUBRIC).floor.passed).toBe(0);
  });

  it("checks quoted evidence against what the candidate actually said", () => {
    const real = grade([result("strong", 4, "hire", 'They said "use a hash map to look up" each value.')], () => RUBRIC);
    expect(real.grounding).toMatchObject({ passed: 2, total: 2 }); // one quote per dimension
    const made = grade([result("strong", 4, "hire", 'They said "I would sort the array first".')], () => RUBRIC);
    expect(made.grounding.passed).toBe(0);
  });

  it("flags missing rubric dimensions", () => {
    const g = grade([result("strong", 4, "hire")], () => [...RUBRIC, "Testing"]);
    expect(g.format.passed).toBe(0);
    expect(g.format.failures[0]).toContain("Testing");
  });

  it("finds 4+ word quotes and normalises punctuation and curly quotes", () => {
    expect(quotedPhrases('a "short one" and “this one is long enough”')).toEqual(["this one is long enough"]);
    expect(normalise("It’s O(n), fine!")).toBe("it's o n fine");
  });
});
