"use client";

import Editor, { type BeforeMount } from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";
import type { Question } from "@/lib/interview/types";
import { runCode, summarizeRun, type RunResult } from "@/lib/workspace/runner";
import { CODE_LANGUAGES, LANGUAGE_LABELS, type CodeLanguage } from "@/lib/workspace/types";
import { NavButton, Portrait, sunken } from "./retro";
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
            <p className={`mb-0.5 flex items-center gap-1.5 text-[12px] font-bold ${m.from === "guide" ? "text-[#1d2f5a]" : "text-[#2c5aa0]"}`}>
              {m.from === "guide" && <Portrait size={18} />}
              {m.from === "guide" ? GUIDE_NAME : "You"}
            </p>
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

// light notebook editor: warm ink on cream paper, orange keywords, olive types, brick strings, faded italic comments
const defineTheme: BeforeMount = (monaco) => {
  monaco.editor.defineTheme("pip-notebook", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "", foreground: "3a2e26" },
      { token: "keyword", foreground: "c9783e" },
      { token: "type", foreground: "9a8a3a" },
      { token: "type.identifier", foreground: "9a8a3a" },
      { token: "string", foreground: "b5654a" },
      { token: "number", foreground: "b5654a" },
      { token: "comment", foreground: "a89a7a", fontStyle: "italic" },
      { token: "identifier", foreground: "3a2e26" },
      { token: "delimiter", foreground: "3a2e26" },
    ],
    colors: {
      "editor.background": "#fffaf0",
      "editor.foreground": "#3a2e26",
      "editorGutter.background": "#fffaf0",
      "editor.lineHighlightBackground": "#f6eed8",
      "editor.lineHighlightBorder": "#f6eed8",
      "editorLineNumber.foreground": "#d9cba0",
      "editorLineNumber.activeForeground": "#b8a578",
      "editorCursor.foreground": "#c9783e",
      "editor.selectionBackground": "#f0dfb8",
      "editor.inactiveSelectionBackground": "#f3e8cc",
      // brackets in plain ink rather than Monaco's blue/green/brown pair colours
      "editorBracketHighlight.foreground1": "#3a2e26",
      "editorBracketHighlight.foreground2": "#3a2e26",
      "editorBracketHighlight.foreground3": "#3a2e26",
      "scrollbarSlider.background": "#eadfc499",
      "scrollbarSlider.hoverBackground": "#d9cba0cc",
      "scrollbarSlider.activeBackground": "#d9cba0",
    },
  });
};

// two friendly lines above the starter code, in each language's comment syntax
const COMMENT: Record<CodeLanguage, string> = { python: "#", javascript: "//", typescript: "//", java: "//", cpp: "//", c: "//" };
const NUDGE = ["Talk it through first — what's your first idea?", "(Brute force is a totally fine place to start!)"];

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
  const nudge = NUDGE.map((line) => `${COMMENT[language]} ${line}`).join("\n") + "\n\n";
  return nudge + baseStarter(question, language);
}

function baseStarter(question: Question | null, language: CodeLanguage) {
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
 * The code editor for technical rounds, a notebook-style scratchpad under what Pip last said. "Try it" checks your code
 * against the question's tests (Python, JavaScript and TypeScript in the browser; Java, C++ and C on the server); your
 * code and the latest results go to the guide with each answer. "Ask Pip" asks the guide for a small hint.
 */
export function CodePanel({
  question,
  guideLine,
  canAsk,
  onAskHint,
  onChange,
  onRun,
}: {
  question: Question | null;
  guideLine?: string;
  canAsk: boolean;
  onAskHint: () => void;
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
  // The panel remounts for each question (it's keyed by question id), and the question arrives together with the line
  // that asked it, so the line showing at mount is the introduction. Later lines are follow-ups.
  const [introLine] = useState(guideLine);
  const followUp = question ? (guideLine && guideLine !== introLine && !guideLine.includes(question.prompt) ? guideLine : undefined) : guideLine;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* the problem, pinned, so it stays readable after Pip moves on to follow-ups */}
      {question && (
        <div className="retro-scroll mb-2 max-h-32 shrink-0 overflow-y-auto rounded-2xl bg-white px-3 py-2 ring-1 ring-[#f0dfc2]">
          <p className="text-[13.5px] leading-snug text-[#3d2a1c]">{question.prompt}</p>
          {example && (
            <p className="mt-1.5 inline-block rounded-full bg-[#f6eed8] px-2.5 py-0.5 font-mono text-[12px] text-[#5a4430] ring-1 ring-[#eadfc4]">{example}</p>
          )}
        </div>
      )}
      {/* what Pip last said, when it's more than the problem itself, so you can code without flipping back to the chat */}
      {followUp && (
        <div className="mb-2 flex shrink-0 gap-2.5">
          <Portrait size={36} />
          <div className="retro-scroll max-h-24 min-w-0 flex-1 overflow-y-auto rounded-2xl bg-white px-3 py-2 ring-1 ring-[#f0dfc2]">
            <p className="text-[13.5px] leading-snug text-[#3d2a1c]">{followUp}</p>
          </div>
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#eadfc4] bg-[#fffaf0]">
        <div className="flex shrink-0 items-baseline justify-between gap-2 border-b border-[#eadfc4] px-3 py-1.5">
          <span className="text-[13px] font-bold text-[#5a4430]">📝 my scratchpad</span>
          <span className="truncate text-[12px] text-[#a08a70]">kept while you&apos;re at the table</span>
        </div>
        <div className="min-h-0 flex-1 pt-1">
          <Editor
            key={language}
            language={language}
            defaultValue={code}
            theme="pip-notebook"
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
      <footer className="mt-2 flex items-center gap-2 px-0.5">
        <label className="flex shrink-0 items-center gap-1.5 rounded-full bg-white py-1 pr-2 pl-1.5 ring-1 ring-[#ead7b8]" title={FILE_NAME[language]}>
          <span className="rounded-md bg-[#f3e6cf] px-1.5 font-mono text-[11px] text-[#8a6a4a]">{FILE_TAG[language]}</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as CodeLanguage)}
            className="bg-transparent text-[13px] font-bold text-[#3d2a1c] outline-none"
            aria-label="Language"
          >
            {CODE_LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {LANGUAGE_LABELS[l]}
              </option>
            ))}
          </select>
        </label>
        <span className="min-w-0 flex-1 truncate text-[12px] text-[#a08a70]">{GUIDE_NAME} sees your code each time you answer</span>
        <NavButton onClick={onAskHint} disabled={!canAsk} className="shrink-0" title={`Ask ${GUIDE_NAME} for a small hint`}>
          💡 Ask {GUIDE_NAME}
        </NavButton>
        <NavButton tone="yellow" onClick={() => void run()} disabled={running} className="shrink-0">
          {running ? "Trying…" : "Try it ▶"}
        </NavButton>
      </footer>
    </div>
  );
}
