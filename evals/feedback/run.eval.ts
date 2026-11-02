import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { generateFeedback, onUsage, type Usage } from "@/lib/claude";
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

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RUNS = Number(process.env.EVAL_RUNS ?? 2);
const ONLY = process.env.EVAL_ONLY ?? "";
const CONCURRENCY = 3;
/** After this many failed calls, stop starting new ones: something's wrong (the key, the network), not one bad case. */
const MAX_ERRORS = 3;

it("feedback eval", async () => {
  if (!MOCK_ENABLED && !process.env.ANTHROPIC_API_KEY) {
    throw new Error("No ANTHROPIC_API_KEY (in .env.local or the shell), and not MOCK_AI=1: nothing was run.");
  }
  if (!Number.isInteger(RUNS) || RUNS < 1) throw new Error(`EVAL_RUNS should be a whole number, 1 or more (got "${process.env.EVAL_RUNS}").`);
  const { cases } = JSON.parse(readFileSync(path.join(HERE, "cases.json"), "utf8")) as { cases: EvalCase[] };
  const picked = cases.filter((c) => c.id.includes(ONLY));
  if (!picked.length) throw new Error(`No case ids contain EVAL_ONLY="${ONLY}".`);
  const jobs = picked.flatMap((c) => Array.from({ length: RUNS }, () => c));
  console.log(`${jobs.length} feedback reports (${picked.length} cases x ${RUNS})${MOCK_ENABLED ? ", mock mode" : ""}`);

  const results: CaseResult[] = [];
  const errors: string[] = [];
  const usage: Usage[] = [];
  const stop = onUsage((u) => usage.push(u));
  let next = 0;
  // A failed call is recorded and the rest carry on, so one API error doesn't throw away every paid result; after a
  // few failures no new calls start, and the ones already running finish before the report is written.
  const worker = async () => {
    while (next < jobs.length && errors.length < MAX_ERRORS) {
      const c = jobs[next++];
      try {
        const question = INTERVIEW_TYPES[c.typeId].questions.find((q) => q.id === c.questionId);
        if (!question) throw new Error(`no question ${c.questionId} in the bank`);
        const state = { ...createSession(c.typeId, { questions: [question] }), phase: "done" as const };
        const transcript = c.turns.map((t) => ({ ...t, questionId: c.questionId }));
        const t0 = Date.now();
        const feedback = await generateFeedback(state, transcript);
        results.push({ case: c, feedback, ms: Date.now() - t0 });
        console.log(`  ${results.length}/${jobs.length} ${c.id}`);
      } catch (error) {
        errors.push(`${c.id}: ${error instanceof Error ? error.message : String(error)}`);
        console.error(`  failed ${c.id}:`, error);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  stop();
  const sum = (k: keyof Omit<Usage, "kind" | "model">) => usage.reduce((s, u) => s + u[k], 0);

  const g = grade(results, (typeId) => rubricFor(typeId).map((d) => d.name));
  const date = new Date().toISOString().slice(0, 19).replace("T", " ");
  const inputTotal = sum("input") + sum("cacheRead") + sum("cacheWrite");
  const tokens = usage.length
    ? `\n\nTokens: ${inputTotal} in (${sum("input")} uncached, ${sum("cacheRead")} read from cache, ${sum("cacheWrite")} written to cache), ${sum("output")} out (${usage.length} calls).\n`
    : `\n\nTokens: none${MOCK_ENABLED ? " (mock mode makes no Claude calls)" : ""}.\n`;
  const failed = errors.length ? `\n## Failed calls (${errors.length}${next < jobs.length ? `, stopped with ${jobs.length - next} not started` : ""})\n\n${errors.map((e) => `- ${e}`).join("\n")}\n` : "";
  const md = report(g, results, { model: MOCK_ENABLED ? "mock" : (process.env.CLAUDE_MODEL?.trim() || "default"), runs: RUNS, date }) + tokens + failed;
  const dir = path.join(HERE, "results");
  mkdirSync(dir, { recursive: true });
  const stamp = date.replace(/[: ]/g, "-");
  writeFileSync(path.join(dir, `${stamp}.md`), md);
  writeFileSync(path.join(dir, `${stamp}.json`), JSON.stringify({ grade: g, results, errors }, null, 2));
  console.log("\n" + md);
  expect(errors).toEqual([]);
  expect(g.format.passed).toBe(g.format.total); // a malformed report is a bug, whatever the model
});
