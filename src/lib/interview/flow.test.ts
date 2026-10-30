import { describe, expect, it } from "vitest";
import { getInterviewType } from "./catalog";
import { advance, allowedActions, createSession, directiveFor, pickBankQuestions } from "./flow";
import type { SessionState } from "./types";

const inQuestion = (typeId: SessionState["typeId"] = "technical"): SessionState => ({
  ...createSession(typeId),
  phase: "question",
});

describe("pickBankQuestions", () => {
  it("picks the right number of distinct questions, easiest first", () => {
    const order = { easy: 0, medium: 1, hard: 2 };
    for (const typeId of ["technical", "behavioral", "system-design"] as const) {
      const picked = pickBankQuestions(typeId);
      expect(picked).toHaveLength(getInterviewType(typeId).questionsPerSession);
      expect(new Set(picked.map((q) => q.id)).size).toBe(picked.length);
      const levels = picked.map((q) => order[q.difficulty]);
      expect(levels).toEqual([...levels].sort((a, b) => a - b));
    }
  });
});

describe("coding questions", () => {
  it("are asked in their usual wording, with a nudge to probe understanding over recall", () => {
    const s = { ...createSession("technical"), phase: "question" as const };
    expect(s.questions[0].prompt).toBe(getInterviewType("technical").questions.find((q) => q.id === s.questions[0].id)?.prompt);
    expect(directiveFor(s)).toMatch(/understanding rather than recall/);
  });
});

describe("advance", () => {
  it("opens by asking the first question", () => {
    const { state, action } = advance(createSession("behavioral"), "next_question");
    expect(action).toBe("next_question");
    expect(state).toMatchObject({ phase: "question", questionIndex: 0, followUps: 0, hintsGiven: 0 });
  });

  it("counts follow-ups and hints separately", () => {
    let s = inQuestion();
    s = advance(s, "follow_up").state;
    s = advance(s, "hint").state;
    s = advance(s, "clarify").state;
    expect(s).toMatchObject({ followUps: 1, hintsGiven: 1, turnsOnQuestion: 3 });
  });

  it("stops offering follow-ups once they're used up, and falls back to clarify", () => {
    let s = inQuestion();
    const max = getInterviewType("technical").maxFollowUps;
    for (let i = 0; i < max; i++) s = advance(s, "follow_up").state;
    expect(allowedActions(s)).not.toContain("follow_up");
    const { action, state } = advance(s, "follow_up");
    expect(action).toBe("clarify");
    expect(state.followUps).toBe(max);
  });

  it("forces the interview on after the turn cap", () => {
    let s = inQuestion();
    const cap = getInterviewType("technical").maxTurnsPerQuestion;
    for (let i = 0; i < cap; i++) s = advance(s, "clarify").state;
    expect(allowedActions(s)).toEqual(["next_question"]);
    expect(advance(s, "clarify").state.questionIndex).toBe(1);
  });

  it("moves to the candidate's questions after the last one, then ends", () => {
    let s: SessionState = { ...inQuestion("system-design") };
    s = advance(s, "next_question").state;
    expect(s.phase).toBe("candidate_questions");
    expect(allowedActions(s)).toEqual(["end_interview"]);
    expect(advance(s, "end_interview").state.phase).toBe("done");
  });

  it("never offers more hints than the question has", () => {
    let s = inQuestion();
    const hints = s.questions[0].hints.length;
    for (let i = 0; i < hints; i++) s = advance(s, "hint").state;
    expect(allowedActions(s)).not.toContain("hint");
  });
});

describe("directiveFor", () => {
  it("asks for code on a coding question until code is shared", () => {
    const s = inQuestion("technical");
    expect(directiveFor(s)).toMatch(/ask them to code it/);
    expect(directiveFor(s, { codeShared: true })).not.toMatch(/ask them to code it/);
  });

  it("adds gentle-mode guidance only in gentle mode", () => {
    const s = inQuestion("behavioral");
    expect(directiveFor(s)).not.toMatch(/Gentle practice mode/);
    expect(directiveFor({ ...s, settings: { ...s.settings, intensity: "gentle" } })).toMatch(/Gentle practice mode/);
  });

  it("keeps the private notes out of what should be said", () => {
    const d = directiveFor(inQuestion("behavioral"));
    expect(d).toMatch(/Never read these aloud/);
  });
});
