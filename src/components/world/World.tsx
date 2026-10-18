"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { WorkspaceSnapshot } from "@/lib/workspace/types";
import { ChatPanel, CodePanel } from "./panels";
import { ChickIcon, FACE, Logo, NavButton, Panel, Portrait, raised, sunken, uiFont } from "./retro";
import { PREP_LABELS, PREP_TYPES, type PrepType } from "./script";
import { useConversation } from "./useConversation";
import type { WorldMode } from "./WorldScene";

const WorldScene = dynamic(() => import("./WorldScene"), { ssr: false, loading: () => <div className="absolute inset-0 bg-[#dfe9f3]" /> });

const PREP_BLURB: Record<PrepType, string> = {
  behavioral: "Stories about teamwork, mistakes and what you've built.",
  technical: "A coding problem, talked through out loud, with an editor.",
  resume: "Questions about your own projects and experience.",
};

/** A taskbar button: pressed while its window is open. */
function TaskButton({ pressed = false, children }: { pressed?: boolean; children: ReactNode }) {
  return (
    <span
      className={`flex h-[26px] max-w-44 items-center gap-1.5 truncate px-2.5 text-[12.5px] ${pressed ? "bg-[#ecebe6] font-bold" : "bg-[#e3e1db]"}`}
      style={pressed ? sunken : raised}
    >
      {children}
    </span>
  );
}

/**
 * The 3D practice world: a welcome window over the scene where you pick a kind of prep, then the open field with you
 * and your guide at a table. Click the table and the camera takes your seat; a real conversation with the
 * interviewer starts (spoken and typed), with the editor alongside for technical rounds.
 */
export default function World() {
  const [mode, setMode] = useState<WorldMode>("splash");
  const [arrived, setArrived] = useState<WorldMode | null>(null);
  const [type, setType] = useState<PrepType>("technical");
  const [elapsed, setElapsed] = useState(0);

  // your code, sent to the guide with an answer whenever it has changed since the last one
  const code = useRef<{ text: string | null; sent: string | null; questionId: string | null }>({ text: null, sent: null, questionId: null });
  const getWork = useCallback((): WorkspaceSnapshot | undefined => {
    const c = code.current;
    if (type !== "technical" || !c.text || !c.questionId || c.text === c.sent) return undefined;
    c.sent = c.text;
    return { kind: "code", questionId: c.questionId, language: "python", code: c.text };
  }, [type]);

  const convo = useConversation(type, getWork);
  const { start, reset, status } = convo;
  const seated = mode === "seated" && arrived === "seated";

  useEffect(() => {
    code.current = { text: null, sent: null, questionId: convo.question?.id ?? null };
  }, [convo.question?.id]);

  const onArrive = useCallback(
    (m: WorldMode) => {
      setArrived(m);
      if (m === "seated" && status === "idle") start(); // the guide says hello once you're in your seat
    },
    [start, status],
  );

  useEffect(() => {
    if (!seated) return;
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [seated]);

  const choose = (t: PrepType) => {
    setType(t);
    setMode("world");
  };
  const standUp = () => {
    reset();
    setElapsed(0);
    setArrived(null);
    setMode("world");
  };

  const clock = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
  const starter = convo.question?.coding?.starter.python;

  return (
    <div className={`retro-ui fixed inset-0 overflow-hidden bg-[#dfe9f3] text-[#1b1d22] ${uiFont}`}>
      <div className="absolute inset-0 bottom-9">
        <WorldScene mode={mode} speaking={convo.speaking} onSit={() => setMode("seated")} onArrive={onArrive} />
      </div>

      {/* 1. welcome window over the slowly turning scene */}
      <div
        className={`absolute inset-0 bottom-9 z-10 flex items-center justify-center bg-[#1d2f5a]/15 px-4 transition-opacity duration-500 ${
          mode === "splash" ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <Panel title="Welcome to extraview" tone="active" icon={<ChickIcon size={15} />} className="w-[min(520px,100%)]">
          <div className="flex gap-4 px-3 pt-3 pb-4">
            <Portrait size={72} />
            <div className="min-w-0">
              <h1 className="text-[28px] font-bold leading-none tracking-tight text-[#1d2f5a]">extraview</h1>
              <p className="mt-1 font-script text-[22px] leading-tight text-[#55534e]">never feel unready again.</p>
              <p className="mt-2 text-[14px] leading-relaxed text-[#3c3a36]">
                Practise interviews out loud with a patient guide, at a table in the middle of nowhere. Talk or type; there&apos;s no
                rush.
              </p>
            </div>
          </div>
          <div className="mx-1 mb-1 bg-white p-2" style={sunken}>
            {PREP_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => choose(t)}
                className="group flex w-full items-center gap-3 px-2.5 py-2 text-left hover:bg-[#1d2f5a] focus-visible:bg-[#1d2f5a]"
              >
                <ChickIcon size={22} tone={t === "technical" ? "blue" : "yellow"} />
                <span className="min-w-0">
                  <span className="block text-[14px] font-bold text-[#1b1d22] group-hover:text-white group-focus-visible:text-white">{PREP_LABELS[t]}</span>
                  <span className="block truncate text-[12.5px] text-[#55534e] group-hover:text-[#cfdcf2] group-focus-visible:text-[#cfdcf2]">
                    {PREP_BLURB[t]}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      {/* 2. the world: a small tip window telling you to take your seat */}
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-14 z-10 flex justify-center transition-opacity duration-500 ${
          mode === "world" && arrived === "world" ? "opacity-100" : "opacity-0"
        }`}
      >
        <Panel title="Tip" icon={<ChickIcon size={15} />} className="w-[min(340px,92vw)]">
          <p className="px-2.5 py-2.5 text-[14px]">Click the table to sit down with your guide.</p>
        </Panel>
      </div>

      {/* 3. seated: the conversation (and the editor for technical) on either side of the guide */}
      <div
        className={`pointer-events-none absolute inset-0 bottom-9 z-10 transition-opacity duration-500 ${seated ? "opacity-100" : "opacity-0"}`}
        aria-hidden={!seated}
      >
        {seated && (
          <>
            <div className="pointer-events-auto absolute top-4 right-4 bottom-4 flex w-[min(390px,calc(100vw-2rem))] sm:top-6 sm:right-6 sm:bottom-6 [&>section]:flex-1">
              <ChatPanel
                messages={convo.messages}
                status={convo.status}
                liveText={convo.liveText}
                notice={convo.notice}
                error={convo.error}
                canTalk={convo.canTalk}
                muted={convo.muted}
                onAnswer={convo.answer}
                onTalk={convo.toggleTalk}
                onMute={convo.toggleMute}
                onRetry={start}
              />
            </div>
            {type === "technical" && (
              <div className="pointer-events-auto absolute bottom-4 left-4 hidden h-[min(440px,58vh)] w-[min(470px,40vw)] sm:bottom-6 sm:left-6 lg:flex [&>section]:flex-1">
                <CodePanel
                  key={convo.question?.id ?? "starter"}
                  starter={starter}
                  onChange={(text) => {
                    code.current.text = text;
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* taskbar */}
      <footer className="absolute inset-x-0 bottom-0 z-20 flex h-9 items-center gap-1.5 px-1.5" style={{ background: FACE, boxShadow: "inset 0 1px 0 #fff, inset 0 2px 0 #f4f3ef, 0 -1px 0 #8f8d88" }}>
        <span className="flex h-[26px] items-center px-2" style={raised}>
          <Logo size={14} />
        </span>
        <span className="mx-1 h-[22px] w-px bg-[#8f8d88] shadow-[1px_0_0_#fff]" />
        {mode !== "splash" && <TaskButton>{PREP_LABELS[type]} interview</TaskButton>}
        {seated && (
          <TaskButton pressed>
            <ChickIcon size={13} /> Chat — your guide
          </TaskButton>
        )}
        {seated && type === "technical" && <TaskButton>Code editor</TaskButton>}
        <span className="ml-auto flex items-center gap-1.5">
          {mode === "world" && <NavButton onClick={() => setMode("splash")}>Change type</NavButton>}
          {mode === "seated" && <NavButton onClick={standUp}>Stand up</NavButton>}
          <span className="flex h-[26px] items-center gap-2 px-2.5 font-mono text-[12px] text-[#3c3a36]" style={sunken}>
            {seated ? (
              <>
                <span className={`h-2 w-2 rounded-full ${convo.status === "listening" ? "animate-pulse bg-[#d9534f]" : "bg-[#5aa65a]"}`} />
                {clock}
              </>
            ) : (
              "ready"
            )}
          </span>
        </span>
      </footer>
    </div>
  );
}
