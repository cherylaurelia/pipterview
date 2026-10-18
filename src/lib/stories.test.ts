import { beforeEach, describe, expect, it, vi } from "vitest";
import { addStories, loadStories, missingParts, storyLines } from "./stories";

const story = (title: string, parts: Partial<Record<"situation" | "task" | "action" | "result", string>> = {}) => ({
  title,
  questionId: "q1",
  situation: parts.situation ?? "",
  task: parts.task ?? "",
  action: parts.action ?? "",
  result: parts.result ?? "",
  skills: ["teamwork"],
  tip: "Add a number.",
});

describe("story bank", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) } });
  });

  it("saves new stories and merges a story told again", () => {
    const meta = { typeId: "behavioral" as const, questionPrompt: () => "Tell me about a time you led a team." };
    addStories([story("Hackathon backend rebuild", { situation: "Our API died at 2am.", action: "I rewrote it in Go." })], meta);
    addStories([story("hackathon backend rebuild!", { result: "We placed second." })], meta);
    const bank = loadStories();
    expect(bank).toHaveLength(1);
    expect(bank[0].timesTold).toBe(2);
    expect(bank[0].result).toBe("We placed second.");
    expect(bank[0].action).toBe("I rewrote it in Go.");
    expect(missingParts(bank[0])).toEqual(["task"]);
  });

  it("summarises stories for the interviewer prompt", () => {
    addStories([story("Study group", { situation: "A hard algorithms class." })], { typeId: "behavioral", questionPrompt: () => undefined });
    expect(storyLines(loadStories())).toEqual(["Study group: A hard algorithms class."]);
  });
});
