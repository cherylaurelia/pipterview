// Validates evals/feedback/cases.json against the question bank and writes
// CASES.md for human review. Run: node evals/feedback/cases-to-md.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { INTERVIEW_TYPES } from "../../src/lib/interview/catalog.ts";

const dir = new URL(".", import.meta.url);
const { cases } = JSON.parse(readFileSync(new URL("cases.json", dir), "utf8"));
const LEVELS = ["strong", "average", "weak"];
const problems = [];

const ids = new Set();
const groups = new Map();
for (const c of cases) {
  if (ids.has(c.id)) problems.push(`${c.id}: duplicate id`);
  ids.add(c.id);
  const question = INTERVIEW_TYPES[c.typeId]?.questions.find((q) => q.id === c.questionId);
  if (!question) {
    problems.push(`${c.id}: no bank question ${c.typeId}/${c.questionId}`);
    continue;
  }
  if (c.turns[0]?.role !== "interviewer" || c.turns[0].text !== question.prompt) {
    problems.push(`${c.id}: first turn should be the bank prompt verbatim`);
  }
  if (!c.turns.some((t) => t.role === "candidate")) problems.push(`${c.id}: no candidate turn`);
  if (c.level !== "non_answer") {
    const key = `${c.typeId}/${c.questionId}`;
    groups.set(key, [...(groups.get(key) ?? []), c.level]);
  }
}
for (const [key, levels] of groups) {
  for (const level of LEVELS) if (!levels.includes(level)) problems.push(`${key}: missing ${level}`);
}

const words = (c) => c.turns.filter((t) => t.role === "candidate").reduce((n, t) => n + t.text.split(/\s+/).length, 0);
const byLevel = Object.fromEntries(
  [...LEVELS, "non_answer"].map((level) => {
    const counts = cases.filter((c) => c.level === level).map(words);
    return [level, { n: counts.length, avgWords: Math.round(counts.reduce((a, b) => a + b, 0) / (counts.length || 1)) }];
  }),
);

const fence = (text) => {
  const longest = Math.max(2, ...[...text.matchAll(/`+/g)].map((m) => m[0].length));
  return "`".repeat(longest + 1);
};
let md = `# Feedback eval cases\n\nGenerated from \`cases.json\` by \`cases-to-md.mjs\`. ${cases.length} cases.\n\n`;
md += `| Level | Cases | Avg candidate words |\n|---|---|---|\n`;
for (const [level, s] of Object.entries(byLevel)) md += `| ${level} | ${s.n} | ${s.avgWords} |\n`;
md += `\n| id | round | question | level | tags |\n|---|---|---|---|---|\n`;
for (const c of cases) md += `| [${c.id}](#${c.id.replace(/[^a-z0-9-]/g, "")}) | ${c.typeId} | ${c.questionId} | ${c.level} | ${(c.tags ?? []).join(", ")} |\n`;
for (const c of cases) {
  const body = c.turns.map((t) => `${t.role === "interviewer" ? `Interviewer${t.action ? ` [${t.action}]` : ""}` : "Candidate"}: ${t.text}`).join("\n\n");
  const f = fence(body);
  md += `\n## ${c.id}\n\n${f}text\n${body}\n${f}\n`;
}
writeFileSync(new URL("CASES.md", dir), md);

console.log(`${cases.length} cases, ${groups.size} question groups`, byLevel);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("OK: wrote evals/feedback/CASES.md");
