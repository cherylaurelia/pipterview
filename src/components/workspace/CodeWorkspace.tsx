"use client";

import Editor, { type OnMount } from "@monaco-editor/react";
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import type { Question } from "@/lib/interview/types";
import { preloadRunner, runCode, summarizeRun, type RunResult } from "@/lib/workspace/runner";
import { CODE_LANGUAGES, LANGUAGE_LABELS, type CodeLanguage, type CodeSnapshot } from "@/lib/workspace/types";
import type { WorkspaceHandle } from "./handle";

const LANGUAGE_KEY = "mock-interviewer:language";
const BLANK: Record<CodeLanguage, string> = {
  python: "# Write your solution here. print() output shows below when you run it.\n",
  javascript: "// Write your solution here. console.log() output shows below when you run it.\n",
  java: "import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        // Write and try your solution here. System.out output shows below.\n    }\n}\n",
  cpp: "#include <iostream>\n#include <vector>\nusing namespace std;\n\nint main() {\n    // Write and try your solution here. cout output shows below.\n    return 0;\n}\n",
};

function starterFor(question: Question, language: CodeLanguage) {
  return question.coding?.starter[language] ?? BLANK[language];
}

/**
 * CodeSignal-style editor for the technical round: the problem, a Monaco
 * editor, and a test runner. Code runs in the browser; the interviewer sees
 * the latest code and test results with the candidate's next answer.
 */
export default function CodeWorkspace({
  question,
  ref,
  onActivity,
}: {
  question?: Question;
  ref?: Ref<WorkspaceHandle>;
  /** Called on every edit, so hands-free voice doesn't send while the candidate is typing. */
  onActivity?: () => void;
}) {
  const [language, setLanguageState] = useState<CodeLanguage>("python");
  const [buffers, setBuffers] = useState<Record<string, string>>({});
  const [runs, setRuns] = useState<Record<string, { result: RunResult; code: string }>>({});
  const [running, setRunning] = useState(false);
  const [showProblem, setShowProblem] = useState(true);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LANGUAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore a saved preference once
      if ((CODE_LANGUAGES as readonly string[]).includes(saved ?? "")) setLanguageState(saved as CodeLanguage);
    } catch {
      // Storage blocked; keep the default.
    }
  }, []);

  useEffect(() => {
    if (question) preloadRunner(language);
  }, [question, language]);

  const setLanguage = (next: CodeLanguage) => {
    setLanguageState(next);
    try {
      window.localStorage.setItem(LANGUAGE_KEY, next);
    } catch {
      // Not remembered; fine.
    }
  };

  const key = question ? `${question.id}:${language}` : "";
  const code = question ? (buffers[key] ?? starterFor(question, language)) : "";
  const lastRun = runs[key];

  // Read inside callbacks registered once (Monaco commands, the snapshot handle).
  const latest = useRef({ question, language, code, lastRun, buffers, runs });
  useEffect(() => {
    latest.current = { question, language, code, lastRun, buffers, runs };
  });
  // Every question the candidate has written code for, with the language they last used on it.
  const attempted = useRef<Record<string, { question: Question; language: CodeLanguage }>>({});

  const run = useCallback(async () => {
    const { question: q, language: lang, code: source } = latest.current;
    if (!q) return;
    setRunning(true);
    try {
      const result = await runCode(lang, source, q.coding);
      setRuns((prev) => ({ ...prev, [`${q.id}:${lang}`]: { result, code: source } }));
    } finally {
      setRunning(false);
    }
  }, []);

  useImperativeHandle(
    ref,
    () => {
      const snapshotOf = (q: Question, lang: CodeLanguage): CodeSnapshot | null => {
        const { buffers: allCode, runs: allRuns } = latest.current;
        const source = allCode[`${q.id}:${lang}`] ?? starterFor(q, lang);
        if (source === starterFor(q, lang)) return null;
        const runInfo = allRuns[`${q.id}:${lang}`];
        let runText: string | undefined;
        if (runInfo) {
          runText = summarizeRun(runInfo.result);
          if (runInfo.code !== source) runText += "\n(The code has changed since this run.)";
        }
        return { kind: "code", questionId: q.id, language: lang, code: source, run: runText };
      };
      return {
        async snapshot() {
          const { question: q, language: lang } = latest.current;
          const snap = q ? snapshotOf(q, lang) : null;
          return snap ? { snapshot: snap, key: `${snap.questionId}:${snap.language}:${snap.code}:${snap.run ?? ""}` } : null;
        },
        async finalWork() {
          return Object.values(attempted.current).flatMap(({ question: q, language: lang }) => snapshotOf(q, lang) ?? []);
        },
      };
    },
    [],
  );

  const onMount: OnMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => void run());
  };

  if (!question) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 p-6 text-center text-sm text-slate-500">
        The code editor unlocks when the interviewer asks the first question.
      </div>
    );
  }

  const examples = question.coding?.tests.filter((t) => !t.hidden) ?? [];
  const hiddenCount = (question.coding?.tests.length ?? 0) - examples.length;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white text-slate-800" data-workspace>
      <section className="border-b border-slate-200 bg-slate-50/70 px-5 py-4 text-sm">
        <button onClick={() => setShowProblem((v) => !v)} className="flex w-full items-start justify-between gap-3 text-left">
          <span className="font-semibold leading-snug text-slate-900">{question.prompt}</span>
          <span className="shrink-0 text-xs text-slate-400 hover:text-slate-700">{showProblem ? "Hide" : "Show"}</span>
        </button>
        {showProblem && (
          <div className="mt-2 space-y-2 text-slate-600">
            {question.coding ? (
              <>
                <p>{question.coding.signature}</p>
                <ul className="space-y-1 font-mono text-xs text-slate-700">
                  {examples.map((t, i) => (
                    <li key={i} className="truncate">
                      <span className="text-slate-400">Example {i + 1}:</span> {JSON.stringify(t.args).slice(1, -1)}{" "}
                      <span className="text-slate-400">→</span> {JSON.stringify(t.expected)}
                    </li>
                  ))}
                </ul>
                {hiddenCount > 0 && <p className="text-xs text-slate-400">Plus {hiddenCount} hidden tests.</p>}
              </>
            ) : (
              <p>No automated tests for this question. Run your code to check it with your own examples.</p>
            )}
          </div>
        )}
      </section>

      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 text-sm">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as CodeLanguage)}
          className="rounded-full bg-white px-3 py-1 text-slate-700 ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
          aria-label="Language"
        >
          {CODE_LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {LANGUAGE_LABELS[lang]}
            </option>
          ))}
        </select>
        <button
          onClick={() => setBuffers((prev) => ({ ...prev, [key]: starterFor(question, language) }))}
          className="rounded-full px-3 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          Reset
        </button>
        <span className="ml-auto hidden text-xs text-slate-400 sm:inline">⌘/Ctrl + Enter to run</span>
        <button
          onClick={() => void run()}
          disabled={running}
          className="rounded-full bg-teal-600 px-4 py-1.5 font-medium text-white shadow-sm hover:bg-teal-700 disabled:opacity-60"
        >
          {running ? "Running…" : question.coding ? "Run tests" : "Run"}
        </button>
      </div>

      <div className="min-h-[220px] flex-1">
        <Editor
          key={key}
          height="100%"
          theme="light"
          language={language}
          value={code}
          onChange={(value) => {
            onActivity?.();
            attempted.current[question.id] = { question, language };
            setBuffers((prev) => ({ ...prev, [key]: value ?? "" }));
          }}
          onMount={onMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            scrollBeyondLastLine: false,
            tabSize: language === "javascript" ? 2 : 4,
            automaticLayout: true,
          }}
        />
      </div>

      <RunPanel run={lastRun?.result} stale={Boolean(lastRun && lastRun.code !== code)} running={running} />
    </div>
  );
}

function RunPanel({ run, stale, running }: { run?: RunResult; stale: boolean; running: boolean }) {
  if (!run) {
    return (
      <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-3 text-xs text-slate-500">
        {running ? "Running… (the first Python or Java run takes a few seconds)" : "Run your code to see test results here."}
      </div>
    );
  }
  const passed = run.cases.filter((c) => c.passed).length;
  const visible = run.cases.filter((c) => !c.hidden);
  const hidden = run.cases.filter((c) => c.hidden);

  return (
    <div className="max-h-[40%] overflow-y-auto border-t border-slate-200 bg-slate-50/70 px-5 py-3 font-mono text-xs">
      {run.status !== "ok" ? (
        <pre className="whitespace-pre-wrap text-rose-700">{run.error}</pre>
      ) : run.cases.length > 0 ? (
        <div className="space-y-2">
          <p className={`font-sans text-sm font-semibold ${passed === run.cases.length ? "text-emerald-700" : "text-amber-700"}`}>
            {passed}/{run.cases.length} tests passed · {run.durationMs} ms{stale ? " · code changed since this run" : ""}
          </p>
          <ul className="space-y-1.5">
            {visible.map((c) => (
              <li key={c.index} className={c.passed ? "text-emerald-700" : "text-rose-700"}>
                {c.passed ? "✓" : "✗"} ({c.input}){" "}
                {!c.passed && (
                  <span className="text-slate-500">
                    expected {c.expected}, got {c.error ?? c.actual}
                  </span>
                )}
              </li>
            ))}
            {hidden.length > 0 && (
              <li className="text-slate-500">
                Hidden tests: {hidden.filter((c) => c.passed).length}/{hidden.length} passed
              </li>
            )}
          </ul>
        </div>
      ) : (
        <p className="text-slate-500">Ran in {run.durationMs} ms.</p>
      )}
      {run.stdout && (
        <div className="mt-2">
          <p className="text-slate-400">Output</p>
          <pre className="whitespace-pre-wrap text-slate-700">{run.stdout}</pre>
        </div>
      )}
    </div>
  );
}
