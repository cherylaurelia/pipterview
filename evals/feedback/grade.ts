import type { Feedback } from "../../src/lib/interview/prompts";

// Grades a run of the feedback eval with plain code checks (no AI judge), as proposed in README.md:
//   ordering        per question: every strong case's mean rubric score > every average case's > every weak case's
//   recommendation  per question: strong >= average >= weak on the hire scale (mean of each level), and strong > weak
//   floor           non-answers average <= 1.5 and get no_hire or strong_no_hire
//   grounding       every quoted phrase of 4+ words in the evidence appears in the candidate's own words
//   format          every rubric dimension, and a review of the question, is present

export type Level = "strong" | "average" | "weak" | "non_answer";

export interface EvalCase {
  id: string;
  typeId: "technical" | "behavioral" | "system-design";
  questionId: string;
  level: Level;
  turns: { role: "interviewer" | "candidate"; text: string }[];
}

export interface CaseResult {
  case: EvalCase;
  feedback: Feedback;
  /** How long the feedback took, in milliseconds. */
  ms: number;
}

export interface Check {
  passed: number;
  total: number;
  failures: string[];
}

export interface Grade {
  ordering: Check;
  recommendation: Check;
  floor: Check;
  grounding: Check;
  format: Check;
}

const HIRE: Feedback["recommendation"][] = ["strong_no_hire", "no_hire", "lean_hire", "hire", "strong_hire"];

export const meanScore = (f: Feedback) => (f.dimensions.length ? f.dimensions.reduce((s, d) => s + d.score, 0) / f.dimensions.length : 0);
const hireIndex = (f: Feedback) => HIRE.indexOf(f.recommendation);
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** Lower case, punctuation and extra spaces gone: for checking a quote appears in what someone said. */
export const normalise = (text: string) =>
  text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Phrases of four or more words quoted in `text`, with straight or curly double quotes. */
export function quotedPhrases(text: string) {
  return [...text.matchAll(/["“]([^"”]+)["”]/g)].map((m) => m[1].trim()).filter((q) => q.split(/\s+/).length >= 4);
}

const check = (): Check => ({ passed: 0, total: 0, failures: [] });
const record = (c: Check, ok: boolean, failure: string) => {
  c.total++;
  if (ok) c.passed++;
  else c.failures.push(failure);
};

/** `rubric(typeId)`: the rubric dimension names each feedback must cover. */
export function grade(results: CaseResult[], rubric: (typeId: EvalCase["typeId"]) => string[]): Grade {
  const g: Grade = { ordering: check(), recommendation: check(), floor: check(), grounding: check(), format: check() };

  const byQuestion = new Map<string, CaseResult[]>();
  for (const r of results) {
    if (r.case.level === "non_answer") continue;
    byQuestion.set(r.case.questionId, [...(byQuestion.get(r.case.questionId) ?? []), r]);
  }
  for (const [questionId, rs] of byQuestion) {
    const at = (level: Level) => rs.filter((r) => r.case.level === level);
    const strong = at("strong"), average = at("average"), weak = at("weak");
    if (!strong.length || !average.length || !weak.length) continue;
    const scores = (xs: CaseResult[]) => xs.map((r) => meanScore(r.feedback));
    const fmt = (xs: CaseResult[]) => scores(xs).map((s) => s.toFixed(2)).join("/");
    record(
      g.ordering,
      Math.min(...scores(strong)) > Math.max(...scores(average)) && Math.min(...scores(average)) > Math.max(...scores(weak)),
      `${questionId}: strong ${fmt(strong)}, average ${fmt(average)}, weak ${fmt(weak)}`,
    );
    const hires = (xs: CaseResult[]) => mean(xs.map((r) => hireIndex(r.feedback)));
    const [s, a, w] = [hires(strong), hires(average), hires(weak)];
    record(g.recommendation, s >= a && a >= w && s > w, `${questionId}: hire index strong ${s.toFixed(1)}, average ${a.toFixed(1)}, weak ${w.toFixed(1)}`);
  }

  for (const r of results) {
    const f = r.feedback;
    if (r.case.level === "non_answer") {
      const m = meanScore(f);
      record(g.floor, m <= 1.5 && hireIndex(f) <= 1, `${r.case.id}: mean ${m.toFixed(2)}, ${f.recommendation}`);
    }
    const said = normalise(r.case.turns.filter((t) => t.role === "candidate").map((t) => t.text).join(" "));
    for (const d of f.dimensions) {
      for (const q of quotedPhrases(d.evidence)) record(g.grounding, said.includes(normalise(q)), `${r.case.id} (${d.name}): "${q}" isn't in what they said`);
    }
    const names = new Set(f.dimensions.map((d) => d.name));
    const missing = rubric(r.case.typeId).filter((n) => !names.has(n));
    const reviewed = f.questionReviews.some((q) => q.questionId === r.case.questionId);
    record(g.format, !missing.length && reviewed, `${r.case.id}: ${missing.length ? `missing ${missing.join(", ")}` : ""}${reviewed ? "" : " no review of the question"}`.trim());
  }
  return g;
}

/** The grade as a short Markdown report. */
export function report(g: Grade, results: CaseResult[], meta: { model: string; runs: number; date: string }) {
  const pct = (c: Check) => (c.total ? `${Math.round((c.passed / c.total) * 100)}%` : "n/a");
  const row = (name: string, c: Check) => `| ${name} | ${c.passed}/${c.total} | ${pct(c)} |`;
  const ms = results.map((r) => r.ms).sort((a, b) => a - b);
  const lines = [
    `# Feedback eval, ${meta.date}`,
    "",
    `Model: ${meta.model}. ${results.length} feedback reports (${meta.runs} run${meta.runs === 1 ? "" : "s"} per case). Median latency ${ms.length ? Math.round(ms[Math.floor(ms.length / 2)] / 1000) : 0} s.`,
    "",
    "| Check | Passed | Rate |",
    "|---|---|---|",
    row("Score ordering (per question)", g.ordering),
    row("Recommendation ordering", g.recommendation),
    row("Floor (non-answers)", g.floor),
    row("Evidence grounding (quotes)", g.grounding),
    row("Format", g.format),
  ];
  for (const [name, c] of Object.entries(g) as [string, Check][]) {
    if (!c.failures.length) continue;
    lines.push("", `## ${name} failures`, "", ...c.failures.map((f) => `- ${f}`));
  }
  return lines.join("\n") + "\n";
}
