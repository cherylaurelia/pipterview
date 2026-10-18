"use client";

import Editor, { type BeforeMount } from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";
import { ChickIcon, NavButton, Panel, Portrait, sunken } from "./retro";
import { STARTER_CODE } from "./script";
import type { ChatMessage, ConvoStatus } from "./useConversation";

const STATUS_LINE: Partial<Record<ConvoStatus, string>> = {
  connecting: "Your guide is getting settled…",
  thinking: "Your guide is thinking…",
  speaking: "Your guide is talking. Click Talk to jump in.",
  "your-turn": "Your turn! Click Talk and answer out loud, or type.",
  listening: "Listening… click Send when you're done.",
  done: "That's the end of the session. Nice work!",
};

export function ChatPanel({
  messages,
  status,
  liveText,
  notice,
  error,
  canTalk,
  muted,
  onAnswer,
  onTalk,
  onMute,
  onRetry,
}: {
  messages: ChatMessage[];
  status: ConvoStatus;
  liveText: string;
  notice: string | null;
  error: string | null;
  canTalk: boolean;
  muted: boolean;
  onAnswer: (text: string) => void;
  onTalk: () => void;
  onMute: () => void;
  onRetry: () => void;
}) {
  const [draft, setDraft] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const listening = status === "listening";
  const waiting = status === "connecting" || status === "thinking";
  const open = status === "your-turn" || status === "speaking";

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
    <Panel title="Chat — your guide" tone="active" icon={<ChickIcon size={15} />} className="flex-1">
      {/* who you're talking to, like the portrait strip in the old chat windows */}
      <div className="mb-[3px] flex items-center gap-2.5 px-1 py-1.5">
        <Portrait size={40} />
        <div className="min-w-0 text-[13px] leading-tight">
          <p className="font-bold text-[#1b1d22]">Guide</p>
          <p className="truncate text-[#55534e]">{notice ?? (status === "error" ? "Something went wrong" : (STATUS_LINE[status] ?? ""))}</p>
        </div>
        <span className="ml-auto flex items-center gap-1.5 text-[12px] text-[#55534e]">
          <span className={`h-2 w-2 rounded-full ${waiting ? "animate-pulse bg-[#f2c94c]" : status === "speaking" ? "bg-[#4a7bd0]" : listening ? "animate-pulse bg-[#d9534f]" : "bg-[#5aa65a]"}`} />
        </span>
      </div>

      <div ref={list} className="retro-scroll min-h-0 flex-1 space-y-4 overflow-y-auto bg-white px-4 py-4" style={sunken}>
        {messages.map((m, i) => (
          <div key={i} className={m.from === "you" ? "border-l-[3px] border-[#a9c8e6] pl-3" : ""}>
            <p className={`mb-0.5 text-[12px] font-bold ${m.from === "guide" ? "text-[#1d2f5a]" : "text-[#2c5aa0]"}`}>{m.from === "guide" ? "Guide" : "You"}</p>
            <p className="text-[14.5px] leading-[1.65] text-[#1b1d22]">{m.text}</p>
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
          <p className="flex items-center gap-1.5 text-[13px] text-[#8f8d88]" aria-label="Guide is thinking">
            Guide is typing
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1 w-1 animate-pulse rounded-full bg-[#8f8d88]" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </p>
        )}
        {status === "error" && (
          <div className="border border-[#d9534f] bg-[#fdf0ef] px-3 py-2.5 text-[13px] text-[#7a1f12]">
            <p className="mb-2">{error ?? "Something went wrong."}</p>
            <NavButton onClick={onRetry}>Try again</NavButton>
          </div>
        )}
      </div>

      {/* the answer bar: talk out loud, or type */}
      <form
        className="mt-[4px] flex items-center gap-1.5 px-0.5 pt-0.5"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        {canTalk && (
          <NavButton type="button" tone={listening ? "yellow" : "plain"} onClick={onTalk} disabled={!open && !listening} className="shrink-0" aria-pressed={listening}>
            <span className={`h-2 w-2 rounded-full ${listening ? "animate-pulse bg-[#d9534f]" : "bg-[#d9534f]/80"}`} />
            {listening ? "Done" : "Talk"}
          </NavButton>
        )}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={listening}
          placeholder={listening ? "Listening…" : "Type a response…"}
          className="min-w-0 flex-1 bg-white px-2.5 py-1.5 text-[14px] text-[#1b1d22] outline-none placeholder:text-[#8f8d88] disabled:bg-[#efeee9]"
          style={sunken}
        />
        {!listening && (
          <NavButton type="submit" tone="yellow" disabled={!open || !draft.trim()}>
            Send
          </NavButton>
        )}
        <NavButton type="button" onClick={onMute} className="shrink-0 px-2" title={muted ? "Turn the guide's voice on" : "Mute the guide's voice"}>
          {muted ? "Voice off" : "Voice on"}
        </NavButton>
      </form>
    </Panel>
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

/** The Python editor. `starter` is the current question's starter code; your code goes to the guide with each answer. */
export function CodePanel({ starter, onChange }: { starter?: string; onChange: (code: string) => void }) {
  const [note, setNote] = useState<string | null>(null);
  return (
    <Panel
      title="Code editor — solution.py"
      icon={<span className="bg-[#1d2f5a] px-1 font-mono text-[10px] leading-[14px] text-[#f2c94c]">py</span>}
      className="flex-1"
    >
      <div className="min-h-0 flex-1 bg-[#13233f] pt-2" style={sunken}>
        <Editor
          defaultLanguage="python"
          defaultValue={starter ?? STARTER_CODE}
          theme="extraview-navy"
          beforeMount={defineTheme}
          onChange={(v) => onChange(v ?? "")}
          onMount={(_editor, monaco) => {
            // the brand mono font loads asynchronously; re-measure once it has, so the cursor lines up with the text
            document.fonts.ready.then(() => monaco.editor.remeasureFonts());
          }}
          options={{ fontFamily: "var(--font-overpass-mono), monospace", minimap: { enabled: false }, fontSize: 14, lineHeight: 22, scrollBeyondLastLine: false, padding: { top: 8 }, renderLineHighlight: "line", overviewRulerLanes: 0 }}
        />
      </div>
      <footer className="mt-[4px] flex items-center justify-between gap-3 px-1 pt-0.5">
        <span className="truncate font-mono text-[11.5px] text-[#55534e]">{note ?? "Your code goes to the guide with each answer"}</span>
        <NavButton onClick={() => setNote("Running code isn't hooked up yet")}>
          Run ▶
        </NavButton>
      </footer>
    </Panel>
  );
}
