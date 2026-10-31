import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { generateFeedback } from "@/lib/claude";
import { INTERVIEW_TYPES, rubricFor } from "@/lib/interview/catalog";
import { createSession } from "@/lib/interview/flow";
import { MOCK_ENABLED } from "@/lib/mock";
import { grade, report, type CaseResult, type EvalCase } from "./grade";

// Runs the feedback eval: generates feedback for every case (EVAL_RUNS times each, default 2), grades it with plain
// code checks (grade.ts) and writes a report to evals/feedback/results/. This calls the real model and costs money:
//
//   npm run eval:feedback                     all cases, twice each
//   EVAL_RUNS=1 EVAL_ONLY=two-sum npm run eval:feedback    one question, once
//   MOCK_AI=1 npm run eval:feedback           a free dry run of the pipeline (mock feedback, so the grades are meaningless)

const HERE = path.dirname(new URL(import.meta.url).pathname);
const RUNS = Number(process.env.EVAL_RUNS ?? 2);
const ONLY = process.env.EVAL_ONLY ?? "";
const CONCURRENCY = 3;

it("feedback eval", async () => {
  if (!MOCK_ENABLED && !process.env.ANTHROPIC_API_KEY) {
    console.log("No ANTHROPIC_API_KEY (and not MOCK_AI=1): nothing to run.");
    return;
  }
  const { cases } = JSON.parse(readFileSync(path.join(HERE, "cases.json"), "utf8")) as { cases: EvalCase[] };
  const picked = cases.filter((c) => c.id.includes(ONLY));
  const jobs = picked.flatMap((c) => Array.from({ length: RUNS }, () => c));
  console.log(`${jobs.length} feedback reports (${picked.length} cases x ${RUNS})${MOCK_ENABLED ? ", mock mode" : ""}`);

  const results: CaseResult[] = [];
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const c = jobs[next++];
      const question = INTERVIEW_TYPES[c.typeId].questions.find((q) => q.id === c.questionId);
      if (!question) throw new Error(`${c.id}: no question ${c.questionId} in the bank`);
      const state = { ...createSession(c.typeId, { questions: [question] }), phase: "done" as const };
      const transcript = c.turns.map((t) => ({ ...t, questionId: c.questionId }));
      const t0 = Date.now();
      const feedback = await generateFeedback(state, transcript);
      results.push({ case: c, feedback, ms: Date.now() - t0 });
      console.log(`  ${results.length}/${jobs.length} ${c.id}`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const g = grade(results, (typeId) => rubricFor(typeId).map((d) => d.name));
  const date = new Date().toISOString().slice(0, 16).replace("T", " ");
  const md = report(g, results, { model: MOCK_ENABLED ? "mock" : (process.env.CLAUDE_MODEL?.trim() || "default"), runs: RUNS, date });
  const dir = path.join(HERE, "results");
  mkdirSync(dir, { recursive: true });
  const stamp = date.replace(/[: ]/g, "-");
  writeFileSync(path.join(dir, `${stamp}.md`), md);
  writeFileSync(path.join(dir, `${stamp}.json`), JSON.stringify({ grade: g, results }, null, 2));
  console.log("\n" + md);
  expect(g.format.passed).toBe(g.format.total); // a malformed report is a bug, whatever the model
});
