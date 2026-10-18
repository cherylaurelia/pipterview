"use client";

import Editor, { type BeforeMount } from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";
import type { Question } from "@/lib/interview/types";
import { runCode, summarizeRun, type RunResult } from "@/lib/workspace/runner";
import { CODE_LANGUAGES, LANGUAGE_LABELS, type CodeLanguage } from "@/lib/workspace/types";
import { NavButton, sunken } from "./retro";
import { GUIDE_NAME, STARTER_CODE } from "./script";
import type { ChatMessage, ConvoStatus } from "./useConversation";

const STATUS_LINE: Partial<Record<ConvoStatus, string>> = {
  connecting: `${GUIDE_NAME} is getting settled…`,
  thinking: `${GUIDE_NAME} is thinking…`,
  speaking: `${GUIDE_NAME} is talking. Press Talk (or Space) to jump in.`,
  "your-turn": "Your turn! Press Talk (or Space) and answer out loud, or type.",
  listening: "Listening… press Done (or Space) when you've finished.",
  scoring: "Writing up your feedback…",
  report: "Your feedback is ready.",
};

export function ChatPanel({
  messages,
  status,
  liveText,
  notice,
  error,
  canTalk,
  muted,
  handsFree,
  silenceProgress,
  holding,
  onAnswer,
  onTalk,
  onMute,
  onRetry,
  onKeepThinking,
  onHandsFree,
  onTyping,
}: {
  messages: ChatMessage[];
  status: ConvoStatus;
  liveText: string;
  notice: string | null;
  error: string | null;
  canTalk: boolean;
  muted: boolean;
  /** The mic opens on its own and a pause sends; otherwise click Talk, then Done. */
  handsFree: boolean;
  silenceProgress: number;
  holding: boolean;
  onAnswer: (text: string) => void;
  onTalk: () => void;
  onMute: () => void;
  onRetry: () => void;
  onKeepThinking: () => void;
  onHandsFree: (on: boolean) => void;
  /** Typing pauses the hands-free countdown. */
  onTyping: () => void;
}) {
  const [draft, setDraft] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const listening = status === "listening";
  const waiting = status === "connecting" || status === "thinking" || status === "scoring";
  // Hands-free keeps the mic open during your turn, so typing (which replaces what it heard) stays available.
  const open = status === "your-turn" || status === "speaking" || (listening && handsFree);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [messages, status, liveText]);

  const send = () => {
    const text = draft.trim();
    if (!text || !open) return;
    onAnswer(text);
    setDraft("");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* a notice or a problem, when there is one (whose turn it is shows in the banner over the scene) */}
      {(notice || status === "error") && (
        <p className="mb-2 rounded-xl bg-[#fff1d6] px-3 py-1.5 text-[13px] text-[#6b4a1c]">{notice ?? "Something went wrong."}</p>
      )}
      <div ref={list} className="retro-scroll min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#fbf8f2] px-4 py-4" style={sunken}>
        {messages.map((m, i) => (
          <div key={i} className={m.from === "you" ? "border-l-[3px] border-[#a9c8e6] pl-3" : ""}>
            <p className={`mb-0.5 text-[12px] font-bold ${m.from === "guide" ? "text-[#1d2f5a]" : "text-[#2c5aa0]"}`}>{m.from === "guide" ? GUIDE_NAME : "You"}</p>
            <p className={`${m.from === "guide" ? "text-[15.5px]" : "text-[14.5px]"} leading-[1.65] text-[#1b1d22]`}>{m.text}</p>
          </div>
        ))}
        {listening && (
          // what the mic is hearing, as you say it
          <div className="border-l-[3px] border-dashed border-[#d9534f] pl-3">
            <p className="mb-0.5 text-[12px] font-bold text-[#b33d39]">You (listening…)</p>
            <p className="text-[14.5px] italic leading-[1.65] text-[#55534e]">{liveText || "…"}</p>
          </div>
        )}
        {waiting && (
          <p className="flex items-center gap-1.5 text-[13px] text-[#8f8d88]" aria-label={STATUS_LINE[status]}>
            {status === "scoring" ? `${GUIDE_NAME} is writing your feedback` : `${GUIDE_NAME} is typing`}
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1 w-1 animate-pulse rounded-full bg-[#8f8d88]" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </p>
        )}
        {status === "error" && (
          <div className="border border-[#d9534f] bg-[#fdf0ef] px-3 py-2.5 text-[13px] text-[#7a1f12]">
            <p className="mb-2">{error ?? "Something went wrong."} Your conversation so far is kept.</p>
            <NavButton onClick={onRetry}>Try again</NavButton>
          </div>
        )}
      </div>

      {/* hands-free: how close the answer is to sending, with a way to hold it */}
      {listening && handsFree && (
        <div className="mt-[4px] flex items-center gap-2 px-1">
          <div className="h-[10px] flex-1 bg-white" style={sunken} aria-hidden>
            <div className="h-full bg-[#4a7bd0] transition-[width] duration-100" style={{ width: `${silenceProgress * 100}%` }} />
          </div>
          {!holding && silenceProgress > 0 && (
            <NavButton type="button" onClick={onKeepThinking} className="shrink-0 px-2 py-0.5 text-[12px]">
              I need a moment
            </NavButton>
          )}
        </div>
      )}

      {/* the answer bar: type on top, voice controls underneath (one row overflowed the window) */}
      <form
        className="mt-[4px] flex items-center gap-1.5 px-0.5 pt-0.5"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            onTyping();
          }}
          disabled={listening && !handsFree}
          placeholder={listening && !handsFree ? "Listening…" : "Type a response…"}
          className="min-w-0 flex-1 bg-[#fbf8f2] px-2.5 py-1.5 text-[14px] text-[#1b1d22] outline-none placeholder:text-[#8f8d88] disabled:bg-[#efeee9]"
          style={sunken}
        />
        {(!listening || handsFree) && (
          <NavButton type="submit" tone="yellow" disabled={!open || !draft.trim()} className="shrink-0">
            Send
          </NavButton>
        )}
      </form>
      <div className="mt-[4px] flex items-center gap-1.5 px-0.5">
        {canTalk && (
          <NavButton type="button" tone={listening ? "yellow" : "plain"} onClick={onTalk} disabled={!open && !listening} className="shrink-0" aria-pressed={listening}>
            <span className={`h-2 w-2 rounded-full ${listening ? "animate-pulse bg-[#d9534f]" : "bg-[#d9534f]/80"}`} />
            {handsFree ? (listening ? "Send now" : status === "speaking" ? "Interrupt" : "Talk") : listening ? "Done" : "Talk"}
          </NavButton>
        )}
        <span className="flex-1" />
        <NavButton type="button" onClick={onMute} className="shrink-0 px-2" aria-pressed={muted} title={muted ? `Hear ${GUIDE_NAME} out loud again` : `Read ${GUIDE_NAME}'s replies instead of hearing them`}>
          {muted ? `Unmute ${GUIDE_NAME}` : `Mute ${GUIDE_NAME}`}
        </NavButton>
        {canTalk && (
          <NavButton
            type="button"
            onClick={() => onHandsFree(!handsFree)}
            className="shrink-0 px-2"
            aria-pressed={handsFree}
            title={handsFree ? "On: a pause sends your answer. Turn off to press Done yourself." : "Off: press Done when you've finished. Turn on to send when you pause."}
          >
            {handsFree ? "Auto-send: on" : "Auto-send: off"}
          </NavButton>
        )}
      </div>
    </div>
  );
}

// navy editor: yellow keywords, light-blue strings and numbers
const defineTheme: BeforeMount = (monaco) => {
  monaco.editor.defineTheme("extraview-navy", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "f5c84c" },
      { token: "string", foreground: "a9d4f5" },
      { token: "number", foreground: "a9d4f5" },
      { token: "comment", foreground: "7f93b5", fontStyle: "italic" },
      { token: "identifier", foreground: "e8eef7" },
    ],
    colors: {
      "editor.background": "#13233f",
      "editor.lineHighlightBackground": "#1a2d4f",
      "editorLineNumber.foreground": "#4f6385",
      "editorLineNumber.activeForeground": "#f5c84c",
      "editorCursor.foreground": "#f5c84c",
      "editor.selectionBackground": "#2c4a78",
    },
  });
};

const FILE_NAME: Record<CodeLanguage, string> = {
  python: "solution.py",
  javascript: "solution.js",
  typescript: "solution.ts",
  java: "Solution.java",
  cpp: "solution.cpp",
  c: "solution.c",
};
const FILE_TAG: Record<CodeLanguage, string> = { python: "py", javascript: "js", typescript: "ts", java: "java", cpp: "c++", c: "c" };

function starterFor(question: Question | null, language: CodeLanguage) {
  if (question?.coding) return question.coding.starter[language];
  if (language === "python") return question ? "# Write your solution here\n" : STARTER_CODE;
  if (language === "javascript" || language === "typescript") return "// Write your solution here\n";
  if (language === "c") return "#include <stdio.h>\n\nint main(void) {\n    return 0;\n}\n";
  return "";
}

/** The first visible test as a call, e.g. `twoSum([2,7,11,15], 9) → [0,1]`, so the problem shows an example. */
function exampleFor(question: Question | null, language: CodeLanguage) {
  const spec = question?.coding;
  const test = spec?.mode === "function" ? spec.tests.find((t) => !t.hidden) : undefined;
  if (!spec || !test) return null;
  const show = (v: unknown) => JSON.stringify(v);
  return `${spec.entry[language]}(${test.args.map(show).join(", ")}) → ${show(test.expected)}`;
}

/** One line on a run, for the editor's status bar. */
function shortResult(run: RunResult) {
  if (run.status !== "ok") return run.error?.split("\n")[0] ?? "Error";
  if (run.cases.length === 0) return `Ran in ${run.durationMs} ms`;
  const passed = run.cases.filter((c) => c.passed).length;
  return `${passed}/${run.cases.length} tests passed`;
}

/**
 * The code editor for technical rounds, with the problem above it. Run checks your code against the question's tests
 * (Python, JavaScript and TypeScript in the browser; Java, C++ and C on the server); your code and the latest results
 * go to the guide with each answer.
 */
export function CodePanel({
  question,
  onChange,
  onRun,
}: {
  question: Question | null;
  onChange: (code: string, language: CodeLanguage) => void;
  onRun: (summary: string, code: string, language: CodeLanguage) => void;
}) {
  const [language, setLanguage] = useState<CodeLanguage>("python");
  const [buffers, setBuffers] = useState<Partial<Record<CodeLanguage, string>>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const code = buffers[language] ?? starterFor(question, language);

  const run = async () => {
    setRunning(true);
    try {
      const outcome = await runCode(language, code, question?.coding);
      setResult(outcome);
      onRun(summarizeRun(outcome), code, language);
    } finally {
      setRunning(false);
    }
  };

  const failing = result?.status === "ok" ? result.cases.find((c) => !c.passed && !c.hidden) : undefined;
  const example = exampleFor(question, language);
  const [showProblem, setShowProblem] = useState(true);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* the problem, so you don't have to scroll back through the chat to reread it */}
      {question && (
        <div className="mb-[4px] bg-[#fbf8f2] px-2.5 py-1.5 text-[13px] leading-snug text-[#1b1d22]" style={sunken}>
          <button onClick={() => setShowProblem((v) => !v)} className="flex w-full items-center gap-1.5 text-left text-[12px] font-bold text-[#1d2f5a]" aria-expanded={showProblem}>
            <span className="inline-block w-2 text-[9px]">{showProblem ? "▼" : "▶"}</span> Problem
          </button>
          {showProblem && (
            <div className="retro-scroll mt-1 max-h-24 overflow-y-auto">
              <p>{question.prompt}</p>
              {example && <p className="mt-1 font-mono text-[11.5px] text-[#55534e]">e.g. {example}</p>}
            </div>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1 bg-[#13233f] pt-2" style={sunken}>
        <Editor
          key={language}
          language={language}
          defaultValue={code}
          theme="extraview-navy"
          beforeMount={defineTheme}
          onChange={(v) => {
            setBuffers((b) => ({ ...b, [language]: v ?? "" }));
            onChange(v ?? "", language);
          }}
          onMount={(_editor, monaco) => {
            // the brand mono font loads asynchronously; re-measure once it has, so the cursor lines up with the text
            document.fonts.ready.then(() => monaco.editor.remeasureFonts());
          }}
          options={{ fontFamily: "var(--font-overpass-mono), monospace", minimap: { enabled: false }, fontSize: 14, lineHeight: 22, scrollBeyondLastLine: false, padding: { top: 8 }, renderLineHighlight: "line", overviewRulerLanes: 0, tabSize: language === "javascript" || language === "typescript" ? 2 : 4 }}
        />
      </div>
      {result && (
        <div className="retro-scroll mt-[4px] max-h-28 overflow-y-auto bg-[#fbf8f2] px-2.5 py-1.5 font-mono text-[12px] leading-snug text-[#1b1d22]" style={sunken}>
          <p className={result.status === "ok" && result.cases.every((c) => c.passed) ? "text-[#2f7a2f]" : "text-[#9b2b22]"}>{shortResult(result)}</p>
          {failing && (
            <p className="text-[#55534e]">
              ({failing.input}) expected {failing.expected}, got {failing.error ?? failing.actual}
            </p>
          )}
          {result.status !== "ok" && result.error && <pre className="whitespace-pre-wrap text-[#55534e]">{result.error.split("\n").slice(1, 6).join("\n")}</pre>}
          {result.stdout && <pre className="whitespace-pre-wrap text-[#55534e]">{result.stdout.slice(-600)}</pre>}
        </div>
      )}
      <footer className="mt-[4px] flex items-center justify-between gap-2 px-1 pt-0.5">
        <span className="rounded-md bg-[#1d2f5a] px-1.5 py-0.5 font-mono text-[11px] text-[#f2c94c]" title={FILE_NAME[language]}>
          {FILE_TAG[language]}
        </span>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as CodeLanguage)}
          className="bg-white px-1.5 py-1 text-[12.5px] text-[#1b1d22] outline-none"
          style={sunken}
          aria-label="Language"
        >
          {CODE_LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {LANGUAGE_LABELS[l]}
            </option>
          ))}
        </select>
        <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-[#55534e]">
          {question?.coding ? "Your code and test results go to the guide with each answer" : "Your code goes to the guide with each answer"}
        </span>
        <NavButton tone="yellow" onClick={() => void run()} disabled={running}>
          {running ? "Running…" : "Run ▶"}
        </NavButton>
      </footer>
    </div>
  );
}
