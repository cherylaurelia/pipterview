"use client";

import { NATIVE_LANGUAGES, type CodeLanguage, type CodingSpec } from "./types";

/**
 * Runs candidate code and checks it against a question's tests. Python and
 * JavaScript run in a Web Worker in the browser (Pyodide for Python); a run
 * that exceeds the time limit kills its worker, so infinite loops can't freeze
 * the page. Java and C++ compile and run on the server (/api/run).
 */

const TIME_LIMIT_MS = 5000;
type BrowserLanguage = "python" | "javascript";
const WORKER_URLS: Record<BrowserLanguage, string> = {
  python: "/workers/python-runner.js",
  javascript: "/workers/js-runner.js",
};

export interface CaseResult {
  index: number;
  hidden: boolean;
  passed: boolean;
  /** Only for visible tests. */
  input?: string;
  expected?: string;
  actual?: string;
  error?: string;
}

export interface RunResult {
  status: "ok" | "error" | "timeout";
  /** Empty when the question has no tests (code just runs). */
  cases: CaseResult[];
  stdout: string;
  error?: string;
  durationMs: number;
}

interface WorkerReply {
  type: "ready" | "result";
  id?: number;
  results?: { ok: boolean; value?: unknown; error?: string }[];
  stdout?: string;
  error?: string | null;
  timeout?: boolean;
}

const workers: Partial<Record<BrowserLanguage, { worker: Worker; ready: Promise<string | undefined> }>> = {};
let nextId = 1;

function getWorker(language: BrowserLanguage) {
  const existing = workers[language];
  if (existing) return existing;
  const worker = new Worker(WORKER_URLS[language]);
  const ready = new Promise<string | undefined>((resolve) => {
    const onMessage = (event: MessageEvent<WorkerReply>) => {
      if (event.data.type !== "ready") return;
      worker.removeEventListener("message", onMessage);
      resolve(event.data.error ?? undefined);
    };
    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", () => resolve("The code runner failed to start."), { once: true });
  });
  worker.postMessage({ type: "init" });
  const entry = { worker, ready };
  workers[language] = entry;
  return entry;
}

/** Starts loading a runtime early (Pyodide takes a few seconds the first time). */
export function preloadRunner(language: CodeLanguage) {
  if (language === "python" || language === "javascript") void getWorker(language).ready;
}

const show = (value: unknown) => {
  const text = JSON.stringify(value);
  return text === undefined ? "undefined" : text.length > 300 ? `${text.slice(0, 300)}…` : text;
};

function matches(actual: unknown, expected: unknown, compare: CodingSpec["compare"]) {
  if (compare === "unordered" && Array.isArray(actual) && Array.isArray(expected)) {
    const sorted = (list: unknown[]) => list.map((item) => JSON.stringify(item)).sort();
    return JSON.stringify(sorted(actual)) === JSON.stringify(sorted(expected));
  }
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function describeInput(spec: CodingSpec, args: unknown[]) {
  if (spec.mode === "class") {
    const [ops, opArgs] = args as [string[], unknown[][]];
    return ops.map((op, i) => `${op}(${(opArgs[i] ?? []).map(show).join(", ")})`).join(", ");
  }
  return args.map(show).join(", ");
}

async function runOnServer(language: CodeLanguage, code: string, spec?: CodingSpec): Promise<WorkerReply> {
  try {
    const res = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, code, spec }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { type: "result", error: data.error ?? `The code runner failed (${res.status}).` };
    return { type: "result", ...data };
  } catch {
    return { type: "result", error: "Couldn't reach the code runner." };
  }
}

export async function runCode(language: CodeLanguage, code: string, spec?: CodingSpec): Promise<RunResult> {
  const started = performance.now();
  const reply = NATIVE_LANGUAGES.includes(language)
    ? await runOnServer(language, code, spec)
    : await runInWorker(language as BrowserLanguage, code, spec);
  return toRunResult(reply, spec, Math.round(performance.now() - started));
}

async function runInWorker(language: BrowserLanguage, code: string, spec?: CodingSpec): Promise<WorkerReply> {
  const { worker, ready } = getWorker(language);
  const loadError = await ready;
  if (loadError) {
    // Drop the broken worker so the next run tries again (e.g. after a network blip).
    worker.terminate();
    delete workers[language];
    return { type: "result", error: loadError };
  }

  const id = nextId++;
  const harness = spec
    ? { mode: spec.mode, entry: spec.entry[language], argTypes: spec.argTypes, tests: spec.tests.map((t) => ({ args: t.args })) }
    : null;
  const reply = await new Promise<WorkerReply | "timeout">((resolve) => {
    const timer = setTimeout(() => {
      worker.removeEventListener("message", onMessage);
      worker.terminate();
      delete workers[language];
      resolve("timeout");
    }, TIME_LIMIT_MS);
    const onMessage = (event: MessageEvent<WorkerReply>) => {
      if (event.data.type !== "result" || event.data.id !== id) return;
      clearTimeout(timer);
      worker.removeEventListener("message", onMessage);
      resolve(event.data);
    };
    worker.addEventListener("message", onMessage);
    worker.postMessage({ type: "run", id, code, harness });
  });
  if (reply === "timeout") {
    return { type: "result", timeout: true, error: `Time limit exceeded (${TIME_LIMIT_MS / 1000}s). Check for an infinite loop.` };
  }
  return reply;
}

function toRunResult(reply: WorkerReply, spec: CodingSpec | undefined, durationMs: number): RunResult {
  if (reply.timeout) return { status: "timeout", cases: [], stdout: reply.stdout ?? "", error: reply.error ?? "Time limit exceeded.", durationMs };
  if (reply.error) {
    return { status: "error", cases: [], stdout: reply.stdout ?? "", error: reply.error, durationMs };
  }

  const cases: CaseResult[] = (spec?.tests ?? []).map((test, index) => {
    const result = reply.results?.[index];
    const hidden = Boolean(test.hidden);
    const passed = Boolean(result?.ok) && matches(result?.value, test.expected, spec!.compare);
    if (hidden) return { index, hidden, passed };
    return {
      index,
      hidden,
      passed,
      input: describeInput(spec!, test.args),
      expected: show(test.expected),
      actual: result?.ok ? show(result.value) : undefined,
      error: result?.ok ? undefined : result?.error,
    };
  });
  return { status: "ok", cases, stdout: reply.stdout ?? "", durationMs };
}

/** One-paragraph summary of a run, for the interviewer and the feedback report. */
export function summarizeRun(run: RunResult): string {
  if (run.status === "timeout") return `Last run: ${run.error}`;
  if (run.status === "error") return `Last run failed with an error:\n${run.error}`;
  if (run.cases.length === 0) return `Last run: ran without tests.${run.stdout ? ` Output:\n${run.stdout.slice(-800)}` : ""}`;
  const passed = run.cases.filter((c) => c.passed).length;
  const hiddenFailed = run.cases.filter((c) => c.hidden && !c.passed).length;
  const lines = [`Last run: ${passed} of ${run.cases.length} tests passed.`];
  for (const c of run.cases.filter((c) => !c.hidden && !c.passed)) {
    lines.push(`- Failed on (${c.input}): expected ${c.expected}, got ${c.error ?? c.actual}`);
  }
  if (hiddenFailed) lines.push(`- ${hiddenFailed} hidden test${hiddenFailed === 1 ? "" : "s"} failed.`);
  return lines.join("\n");
}
