import { describe, expect, it } from "vitest";
import { INTERVIEW_TYPES } from "./catalog";
import { createSession, directiveFor, pickBankQuestions, advance } from "./flow";
import { INTERVIEW_TYPE_IDS } from "./types";

// The question bank is the product: a vague, compound, or thin question makes practice useless. These checks hold
// every question to the same bar.

const words = (s: string) => s.trim().split(/\s+/).length;
const all = INTERVIEW_TYPE_IDS.flatMap((typeId) => INTERVIEW_TYPES[typeId].questions.map((q) => ({ typeId, q })));

describe("question bank quality", () => {
  it("has enough questions per round to avoid repeating within a week of practice", () => {
    expect(INTERVIEW_TYPES.technical.questions.length).toBeGreaterThanOrEqual(12);
    expect(INTERVIEW_TYPES.behavioral.questions.length).toBeGreaterThanOrEqual(12);
    expect(INTERVIEW_TYPES["system-design"].questions.length).toBeGreaterThanOrEqual(5);
  });

  it("uses unique ids and prompts", () => {
    const ids = all.map(({ q }) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    const prompts = all.map(({ q }) => q.prompt.toLowerCase());
    expect(new Set(prompts).size).toBe(prompts.length);
  });

  for (const { typeId, q } of all) {
    describe(`${typeId}/${q.id}`, () => {
      it("asks one thing, briefly enough to say out loud", () => {
        expect(words(q.prompt), q.prompt).toBeLessThanOrEqual(typeId === "technical" ? 70 : 35);
        expect(q.prompt, "ends like a sentence or question").toMatch(/[.?]$/);
      });

      it("describes a strong answer concretely", () => {
        expect(q.strongAnswer.length).toBeGreaterThanOrEqual(80);
      });

      it("has a real follow-up ladder, with no repeats", () => {
        expect(q.followUps.length).toBeGreaterThanOrEqual(3);
        const normal = q.followUps.map((f) => f.toLowerCase().replace(/[^a-z ]/g, "").trim());
        expect(new Set(normal).size).toBe(normal.length);
        for (const f of q.followUps) {
          // a question, or an instruction an interviewer would give ("Walk me through…", "Compare…")
          expect(f, "each follow-up asks for something").toMatch(/\?$|^(Walk|Talk|Compare|Explain|Show|Tell)\b/);
          expect(f.toLowerCase()).not.toBe(q.prompt.toLowerCase());
        }
      });

      it("has hints and the mistakes worth probing", () => {
        expect(q.hints.length).toBeGreaterThanOrEqual(2);
        expect(q.commonMistakes.length).toBeGreaterThanOrEqual(2);
      });
    });
  }
});

describe("not repeating yourself", () => {
  it("picks questions you haven't had recently first", () => {
    const bank = INTERVIEW_TYPES.behavioral.questions.map((q) => q.id);
    const fresh = bank.slice(0, 3);
    const recent = bank.slice(3);
    for (let i = 0; i < 20; i++) {
      const picked = pickBankQuestions("behavioral", Math.random, 3, recent).map((q) => q.id);
      expect(picked.sort()).toEqual([...fresh].sort());
    }
  });

  it("still fills the session when everything is recent", () => {
    const bank = INTERVIEW_TYPES.behavioral.questions.map((q) => q.id);
    expect(pickBankQuestions("behavioral", Math.random, 3, bank)).toHaveLength(3);
  });

  it("tells the interviewer what it already asked on this question", () => {
    let state = createSession("behavioral");
    state = advance(state, "next_question").state;
    const directive = directiveFor(state, { asked: ["What part of that was specifically yours?"] });
    expect(directive).toContain("Don't repeat or rephrase them");
    expect(directive).toContain("What part of that was specifically yours?");
  });
});
