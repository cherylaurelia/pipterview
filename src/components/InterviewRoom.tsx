"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Feedback } from "@/lib/interview/prompts";
import type { InterviewTypeId, Question, SessionState, TranscriptEntry } from "@/lib/interview/types";
import { speak, stopSpeaking, warmUpVoices } from "@/lib/voice/speak";
import { DONE_PHRASE, SILENCE_MS, VOICE_MODE_KEY, stripDonePhrase } from "@/lib/voice/hands-free";
import { usePushToTalk } from "@/lib/voice/usePushToTalk";
import type { WorkspaceSnapshot } from "@/lib/workspace/types";
import { FeedbackReport } from "./FeedbackReport";
import { isTailored, toProfile, useSavedProfile } from "./ProfileForm";
import { Breathing } from "./room/Breathing";
import { RoundTimer } from "./room/RoundTimer";
import { SessionSetup, useSessionSettings, type VoiceMode } from "./room/SessionSetup";
import { streamTurnRequest } from "@/lib/turn-client";
import type { SceneState } from "./scene/types";
import { Button, Logo } from "./ui";
import type { WorkspaceHandle } from "./workspace/handle";

const InterviewScene = dynamic(() => import("./scene/InterviewScene"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-slate-100" />,
});
const CodeWorkspace = dynamic(() => import("./workspace/CodeWorkspace"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-slate-50" />,
});
const DesignWorkspace = dynamic(() => import("./workspace/DesignWorkspace"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-slate-50" />,
});

type Status =
  | "ready" // before the candidate presses Start
  | "connecting"
  | "speaking" // interviewer talking
  | "your-turn"
  | "listening"
  | "thinking" // waiting on the interviewer's reply
  | "scoring"
  | "feedback"
  | "error";

interface TurnResponse {
  state: SessionState;
  entry: TranscriptEntry;
}

/** Which workspace a round gets beside the interviewer. */
const WORKSPACES: Partial<Record<InterviewTypeId, "code" | "design">> = {
  technical: "code",
  "system-design": "design",
};

/** Typical length of each round, for the timer. */
const ROUND_MINUTES: Record<InterviewTypeId, number> = { behavioral: 25, technical: 35, "system-design": 45 };

// A press shorter than this is a click: it starts listening, and the next click sends.
const CLICK_MS = 350;



function useVoiceMode() {
  const [mode, setMode] = useState<VoiceMode>("hands-free");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VOICE_MODE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore a saved preference once
      if (saved === "push" || saved === "quiet") setMode(saved);
    } catch {
      // Storage blocked; keep the default.
    }
  }, []);
  const update = useCallback((next: VoiceMode) => {
    setMode(next);
    try {
      window.localStorage.setItem(VOICE_MODE_KEY, next);
    } catch {
      // Not remembered; fine.
    }
  }, []);
  return [mode, update] as const;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

/** The question the editor should show: the current one, or the last one once questions are over. */
function questionInPlay(session: SessionState | null): Question | undefined {
  if (!session || session.phase === "intro") return undefined;
  return session.questions[Math.min(session.questionIndex, session.questions.length - 1)];
}

export function InterviewRoom({ typeId, label }: { typeId: InterviewTypeId; label: string }) {
  const [status, setStatusState] = useState<Status>("ready");
  const [session, setSessionState] = useState<SessionState | null>(null);
  const [transcript, setTranscriptState] = useState<TranscriptEntry[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [finalWork, setFinalWork] = useState<WorkspaceSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);
  const [clickToTalk, setClickToTalk] = useState(false);
  const [breathing, setBreathing] = useState<"before" | "pause" | null>(null);
  const [nervousBefore, setNervousBefore] = useState<number>();
  const [voiceMode, setVoiceMode] = useVoiceMode();
  // How close hands-free mode is to sending (0 to 1), for the countdown bar.
  const [silenceProgress, setSilenceProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const mic = usePushToTalk();
  const [profileDraft, setProfileDraft] = useSavedProfile();
  const [settings, setSettings] = useSessionSettings();
  const workspaceKind = WORKSPACES[typeId];

  // Refs mirror state for async callbacks and key handlers. They're written in
  // the same call as the state so an interruption is seen immediately (e.g.
  // speech ending must not overwrite "listening" before React re-renders).
  const statusRef = useRef(status);
  const sessionRef = useRef(session);
  const transcriptRef = useRef(transcript);
  const setStatus = useCallback((next: Status) => {
    statusRef.current = next;
    setStatusState(next);
  }, []);
  const setSession = useCallback((next: SessionState | null) => {
    sessionRef.current = next;
    setSessionState(next);
  }, []);
  const setTranscript = useCallback((next: TranscriptEntry[]) => {
    transcriptRef.current = next;
    setTranscriptState(next);
  }, []);

  const workspace = useRef<WorkspaceHandle>(null);
  const lastSharedKey = useRef<string | null>(null);
  const pressStarted = useRef(0);
  const talkStarted = useRef(0);
  const clickToTalkRef = useRef(false);

  const handsFree = voiceMode === "hands-free" && mic.supported !== false;
  // Read from async callbacks (after Alex finishes speaking).
  const handsFreeRef = useRef(handsFree);
  const quietRef = useRef(voiceMode === "quiet");
  const breathingRef = useRef(breathing);
  const startListeningRef = useRef<() => void>(() => {});
  // "Keep thinking": don't auto-send until speech is heard after this time.
  const holdAfter = useRef(0);
  useEffect(() => {
    handsFreeRef.current = handsFree;
    quietRef.current = voiceMode === "quiet";
    breathingRef.current = breathing;
  });

  useEffect(() => {
    warmUpVoices();
    return stopSpeaking;
  }, []);

  /** The candidate's work, if it changed since they last answered (so the interviewer isn't sent duplicates). */
  const changedWork = useCallback(async (): Promise<WorkspaceSnapshot | undefined> => {
    try {
      const current = await workspace.current?.snapshot();
      if (!current || current.key === lastSharedKey.current) return undefined;
      lastSharedKey.current = current.key;
      return current.snapshot;
    } catch {
      return undefined; // never block an answer on an export hiccup
    }
  }, []);

  const fail = useCallback(
    (err: unknown) => {
      stopSpeaking();
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    },
    [setStatus],
  );

  const requestFeedback = useCallback(
    async (state: SessionState, lines: TranscriptEntry[]) => {
      stopSpeaking();
      setStatus("scoring");
      try {
        const work = (await workspace.current?.finalWork().catch(() => [])) ?? [];
        setFinalWork(work);
        const data = await postJson<{ feedback: Feedback }>("/api/interview/feedback", { state, transcript: lines, work });
        setFeedback(data.feedback);
        setStatus("feedback");
      } catch (err) {
        fail(err);
      }
    },
    [fail, setStatus],
  );

  /** Speaks the interviewer's line, then hands the floor to the candidate (or ends). */
  const deliver = useCallback(
    async ({ state, entry }: TurnResponse, previous: TranscriptEntry[]) => {
      const lines = [...previous, entry];
      setSession(state);
      setTranscript(lines);
      setStatus("speaking");
      // Quiet mode: captions only.
      if (!quietRef.current) await speak(entry.text);
      // The candidate may have interrupted by starting to talk.
      if (statusRef.current !== "speaking") return;
      if (state.phase === "done") {
        await requestFeedback(state, lines);
      } else {
        setStatus("your-turn");
        // Hands-free: the floor passes to the candidate without a button press.
        if (handsFreeRef.current && !breathingRef.current) startListeningRef.current();
      }
    },
    [requestFeedback, setSession, setStatus, setTranscript],
  );

  const start = useCallback(async () => {
    setError(null);
    lastSharedKey.current = null;
    setStatus("connecting");
    try {
      const turn = await streamTurnRequest("/api/interview/start", { typeId, settings, profile: toProfile(profileDraft) }, () => {});
      await deliver(turn, []);
    } catch (err) {
      fail(err);
    }
  }, [typeId, settings, profileDraft, deliver, fail, setStatus]);

  const submitAnswer = useCallback(
    async (text: string, durationMs?: number, thinkMs?: number) => {
      const state = sessionRef.current;
      if (!state) return;
      const answer = text.trim();
      if (!answer) {
        setNotice("Didn't catch that. Talk while the button is red, then send.");
        setStatus("your-turn");
        return;
      }
      setNotice(null);
      setStatus("thinking");
      const work = await changedWork();
      const entry: TranscriptEntry = {
        role: "candidate",
        text: answer,
        ...(work ? { workspace: work } : {}),
        ...(durationMs ? { durationMs } : {}),
        ...(thinkMs !== undefined ? { thinkMs } : {}),
      };
      const lines = [...transcriptRef.current, entry];
      setTranscript(lines);
      try {
        const turn = await streamTurnRequest("/api/interview/turn", { state, transcript: lines }, () => {});
        await deliver(turn, lines);
      } catch (err) {
        fail(err);
      }
    },
    [changedWork, deliver, fail, setStatus, setTranscript],
  );

  const canTalk = status === "your-turn" || status === "speaking";

  const beginTalking = useCallback(() => {
    const current = statusRef.current;
    if (current !== "your-turn" && current !== "speaking") return;
    if (sessionRef.current?.phase === "done") return; // closing remarks; nothing left to answer
    stopSpeaking(); // let the candidate interrupt
    clickToTalkRef.current = false;
    setClickToTalk(false);
    talkStarted.current = performance.now();
    setStatus("listening");
    mic.start();
  }, [mic, setStatus]);

  const finishTalking = useCallback(async () => {
    if (statusRef.current !== "listening") return;
    clickToTalkRef.current = false;
    setClickToTalk(false);
    // Time actually spent talking: first word to last, not the pauses either side (the one before is thinking time).
    const end = mic.lastSpeechAt() || performance.now();
    const first = mic.firstSpeechAt();
    const durationMs = Math.max(0, Math.round(end - (first || talkStarted.current)));
    const thinkMs = first ? Math.max(0, Math.round(first - talkStarted.current)) : undefined;
    holdAfter.current = 0;
    setHolding(false);
    setSilenceProgress(0);
    const text = stripDonePhrase(await mic.stop());
    await submitAnswer(text, durationMs, thinkMs);
  }, [mic, submitAnswer]);

  useEffect(() => {
    startListeningRef.current = beginTalking;
  }, [beginTalking]);

  // Hands-free: send after a pause, or right away on "that's my answer".
  const silenceLimit = SILENCE_MS[session?.settings.intensity ?? "standard"];
  useEffect(() => {
    if (status !== "listening" || !handsFree) return;
    const id = setInterval(() => {
      const last = mic.lastSpeechAt();
      if (holdAfter.current) {
        if (last <= holdAfter.current) return setSilenceProgress(0);
        holdAfter.current = 0; // they started talking again
        setHolding(false);
      }
      if (!last) return setSilenceProgress(0);
      if (DONE_PHRASE.test(mic.currentText().trim())) return void finishTalking();
      const quiet = performance.now() - last;
      setSilenceProgress(Math.min(1, quiet / silenceLimit));
      if (quiet >= silenceLimit) void finishTalking();
    }, 100);
    return () => clearInterval(id);
  }, [status, handsFree, mic, silenceLimit, finishTalking]);

  const keepThinking = () => {
    holdAfter.current = performance.now();
    setHolding(true);
    setSilenceProgress(0);
  };

  // Talk button: hold to talk, or click once to start and again to send.
  // Hands-free: one click starts (or interrupts Alex), the next sends now.
  const onTalkDown = () => {
    if (handsFree) {
      if (statusRef.current === "listening") void finishTalking();
      else beginTalking();
      return;
    }
    if (statusRef.current === "listening") {
      if (clickToTalkRef.current) void finishTalking();
      return;
    }
    pressStarted.current = performance.now();
    beginTalking();
  };
  const onTalkUp = () => {
    if (handsFree || statusRef.current !== "listening" || clickToTalkRef.current) return;
    if (performance.now() - pressStarted.current < CLICK_MS) {
      clickToTalkRef.current = true;
      setClickToTalk(true);
      return;
    }
    void finishTalking();
  };
  const onTalkLeave = () => {
    if (!handsFree && statusRef.current === "listening" && !clickToTalkRef.current) void finishTalking();
  };

  // Hold Space to talk, except while typing or working in the editor/whiteboard (Space pans the whiteboard).
  useEffect(() => {
    const busy = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      return Boolean(target?.closest("input, textarea, select, [data-workspace]") || document.activeElement?.closest("[data-workspace]"));
    };
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || busy(e)) return;
      // Leave Space alone (e.g. activating a focused button) when talking isn't possible.
      if (statusRef.current !== "your-turn" && statusRef.current !== "speaking") return;
      e.preventDefault();
      beginTalking();
    };
    const up = (e: KeyboardEvent) => {
      // Hands-free sends on a pause, not on releasing Space.
      if (e.code !== "Space" || busy(e) || statusRef.current !== "listening" || clickToTalkRef.current || handsFreeRef.current) return;
      e.preventDefault();
      void finishTalking();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [beginTalking, finishTalking]);

  const endEarly = () => {
    if (!session) return;
    if (transcript.some((e) => e.role === "candidate")) {
      void requestFeedback(session, transcript);
    } else {
      stopSpeaking();
      setStatus("ready");
      setSession(null);
      setTranscript([]);
    }
  };

  /** Stops listening and throws away what was heard (typing, pausing, or switching modes instead). */
  const discardListening = async () => {
    if (statusRef.current !== "listening") return;
    holdAfter.current = 0;
    setHolding(false);
    setSilenceProgress(0);
    await mic.stop();
    setStatus("your-turn");
  };

  const sendTyped = async (text: string) => {
    if (!text.trim() || !(canTalk || statusRef.current === "listening")) return;
    stopSpeaking();
    await discardListening();
    void submitAnswer(text);
  };

  const lastInterviewerLine = [...transcript].reverse().find((e) => e.role === "interviewer")?.text;

  const replay = () => {
    if (!lastInterviewerLine || statusRef.current !== "your-turn") return;
    void speak(lastInterviewerLine);
  };

  const pause = () => {
    stopSpeaking();
    void discardListening();
    if (statusRef.current === "speaking") setStatus("your-turn");
    setBreathing("pause");
  };

  const closeBreathing = () => {
    setBreathing(null);
    breathingRef.current = null;
    // Back from a pause in hands-free mode: the mic picks up where it left off.
    if (handsFree && statusRef.current === "your-turn") beginTalking();
  };

  const scene: SceneState = {
    interviewer: status === "speaking" ? "speaking" : status === "thinking" || status === "connecting" ? "thinking" : status === "listening" ? "listening" : "idle",
    candidate: status === "listening" ? "speaking" : status === "speaking" ? "listening" : "idle",
  };

  if (status === "feedback" && feedback && session) {
    return (
      <FeedbackReport
        feedback={feedback}
        state={session}
        transcript={transcript}
        work={finalWork}
        nervousBefore={nervousBefore}
      />
    );
  }

  const started = session !== null;
  const inProgress = started && status !== "scoring";
  const compact = Boolean(workspaceKind);
  const timerRunning = inProgress && status !== "error" && breathing === null;

  const header = (
    <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
      <div className="flex items-center gap-3">
        <Logo />
        <span className="hidden text-sm text-slate-400 sm:inline">/</span>
        <span className="hidden text-sm font-medium text-slate-600 sm:inline">{label}</span>
        {session?.questions.some((q) => q.tailoredReason) && (
          <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-800 ring-1 ring-teal-100">Tailored to you</span>
        )}
      </div>
      {inProgress && (
        <div className="flex items-center gap-2">
          <RoundTimer running={timerRunning} targetMinutes={ROUND_MINUTES[typeId]} hidden={session.settings.intensity === "gentle"} />
          <Button size="sm" variant="ghost" onClick={pause}>
            Pause
          </Button>
          <Button size="sm" variant="secondary" onClick={endEarly}>
            End
          </Button>
        </div>
      )}
    </header>
  );

  const stage = (
    <div
      className={`relative bg-slate-100 ${
        compact ? (started ? "min-h-[220px] flex-1" : "h-44 shrink-0") : started ? "min-h-[42vh] flex-1" : "h-full min-h-[420px]"
      }`}
    >
      <div className="absolute inset-0">
        <InterviewScene state={scene} compact={compact || !started} />
      </div>
      <div className="pointer-events-none absolute left-4 top-3 flex gap-3 text-xs font-medium text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-indigo-500" /> Alex
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-teal-500" /> You
        </span>
      </div>
      {lastInterviewerLine && status !== "scoring" && (
        <div className="absolute inset-x-3 bottom-3 mx-auto max-w-2xl rounded-2xl bg-white/95 px-5 py-3.5 shadow-lg shadow-slate-900/5 ring-1 ring-slate-200 backdrop-blur">
          <p className={`text-center leading-relaxed text-slate-800 ${compact ? "text-sm" : "text-base sm:text-lg"}`}>{lastInterviewerLine}</p>
          {status === "your-turn" && (
            <button onClick={replay} className="mx-auto mt-1 block text-xs font-medium text-teal-700 hover:text-teal-900">
              ↻ Replay
            </button>
          )}
        </div>
      )}
    </div>
  );

  const statusText: Record<Status, string> = {
    ready: "",
    connecting: isTailored(profileDraft) ? "Writing questions from your resume… this can take up to a minute." : "Connecting to your interviewer…",
    speaking: handsFree ? "Alex is speaking. Your mic turns on when Alex finishes." : "Alex is speaking. You can interrupt by talking.",
    "your-turn":
      workspaceKind === "code"
        ? "Your turn. Your code goes to Alex with your answer."
        : workspaceKind === "design"
          ? "Your turn. Your diagram and notes go to Alex with your answer."
          : "Your turn. Take a breath; there's no rush.",
    listening: mic.liveText || (handsFree ? "Listening… just start talking." : "Listening…"),
    thinking: "Alex is thinking…",
    scoring: "Writing your feedback…",
    feedback: "",
    error: "",
  };

  const lobby = !started && !compact;
  const controls = (
    <section className={lobby ? "bg-white" : `border-t border-slate-100 bg-white px-4 ${compact ? "py-4" : "py-6 sm:px-6"}`}>
      <div className={`mx-auto flex flex-col items-center gap-3 ${lobby ? "" : "max-w-xl"}`}>
        {lobby && (
          <div className="w-full space-y-1 pb-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{label} interview</h1>
            <p className="text-sm text-slate-500">About {ROUND_MINUTES[typeId]} minutes with Alex. Set it up the way you need today.</p>
          </div>
        )}
        {!started || status === "error" ? (
          <SessionSetup
            typeId={typeId}
            voiceMode={voiceMode}
            onVoiceMode={setVoiceMode}
            voiceSupported={mic.supported !== false}
            settings={settings}
            onSettings={setSettings}
            nervousness={nervousBefore}
            onNervousness={setNervousBefore}
            profile={profileDraft}
            onProfile={setProfileDraft}
            onBreathe={() => setBreathing("before")}
            onStart={start}
            starting={status === "connecting"}
            error={error}
          />
        ) : (
          <>
            <p className="min-h-5 text-center text-sm text-slate-500" aria-live="polite">
              {statusText[status]}
            </p>
            {notice && <p className="text-sm text-amber-700">{notice}</p>}
            {mic.error && <p className="text-sm text-rose-600">{mic.error}</p>}
            {mic.supported !== false && voiceMode !== "quiet" && (
              <button
                onPointerDown={onTalkDown}
                onPointerUp={onTalkUp}
                onPointerLeave={onTalkLeave}
                disabled={!canTalk && status !== "listening"}
                className={`h-14 select-none touch-none rounded-full px-8 text-base font-semibold shadow-sm transition ${
                  status === "listening"
                    ? "scale-105 bg-rose-500 text-white shadow-rose-200"
                    : "bg-teal-600 text-white hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                }`}
              >
                {handsFree
                  ? status === "listening"
                    ? "Send now"
                    : status === "speaking"
                      ? "Interrupt and talk"
                      : "Start talking"
                  : status === "listening"
                    ? clickToTalk
                      ? "Listening… click to send"
                      : "Listening… release to send"
                    : compact
                      ? "Hold or click to talk"
                      : "Hold or click to talk (or hold Space)"}
              </button>
            )}
            {handsFree && status === "listening" && (
              <div className="w-full max-w-sm space-y-1.5">
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                  <div className="h-full rounded-full bg-teal-500 transition-[width] duration-100" style={{ width: `${silenceProgress * 100}%` }} />
                </div>
                <p className="flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span>
                    {holding
                      ? "Take your time. Sends after you speak and pause."
                      : silenceProgress > 0
                        ? "Pause noticed… sending soon"
                        : "Pause when you're done, or say “that's my answer”"}
                  </span>
                  {!holding && silenceProgress > 0 && (
                    <button onClick={keepThinking} className="shrink-0 font-medium text-teal-700 hover:text-teal-900">
                      Keep thinking
                    </button>
                  )}
                </p>
              </div>
            )}
            <form
              className="flex w-full gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!typed.trim() || !(canTalk || status === "listening")) return;
                void sendTyped(typed);
                setTyped("");
              }}
            >
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={mic.supported === false ? "Voice isn't supported in this browser. Type your answer…" : "Or type your answer…"}
                className="h-10 min-w-0 flex-1 rounded-full bg-white px-4 text-sm ring-1 ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <Button type="submit" disabled={!(canTalk || status === "listening") || !typed.trim()}>
                Send
              </Button>
            </form>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
              <button onClick={() => sendTyped("Can I take a moment to think?")} disabled={!(canTalk || status === "listening")} className="font-medium text-teal-700 hover:text-teal-900 disabled:text-slate-300">
                Ask for a moment to think
              </button>
              {workspaceKind && (
                <button
                  onClick={() =>
                    sendTyped(workspaceKind === "code" ? "I've updated my code. Can you take a look?" : "I've updated my diagram and notes. Can you take a look?")
                  }
                  disabled={!(canTalk || status === "listening")}
                  className="font-medium text-teal-700 hover:text-teal-900 disabled:text-slate-300"
                >
                  {workspaceKind === "code" ? "Ask Alex to look at my code" : "Ask Alex to look at my diagram"}
                </button>
              )}
              {mic.supported !== false && (
                <button
                  onClick={() => {
                    void discardListening();
                    setVoiceMode(handsFree ? "push" : "hands-free");
                  }}
                  className="text-slate-500 hover:text-slate-800"
                >
                  {handsFree ? "Switch to push-to-talk" : "Switch to hands-free"}
                </button>
              )}
              {transcript.length > 0 && (
                <button onClick={() => setShowTranscript((v) => !v)} className="text-slate-500 hover:text-slate-800">
                  {showTranscript ? "Hide transcript" : "Show transcript"}
                </button>
              )}
            </div>
            {showTranscript && (
              <ol className="max-h-60 w-full space-y-2 overflow-y-auto rounded-2xl bg-slate-50 p-4 text-sm ring-1 ring-slate-200">
                {transcript.map((entry, i) => (
                  <li key={i} className="leading-relaxed text-slate-700">
                    <span className={`font-medium ${entry.role === "interviewer" ? "text-indigo-600" : "text-teal-700"}`}>
                      {entry.role === "interviewer" ? "Alex" : "You"}:
                    </span>{" "}
                    {entry.text}
                    {entry.workspace && (
                      <span className="ml-1 text-xs text-slate-400">[{entry.workspace.kind === "code" ? "shared code" : "shared diagram"}]</span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>
    </section>
  );

  const overlay = breathing && (
    <Breathing
      title={breathing === "pause" ? "Paused. Take a breath." : "Before you start"}
      doneLabel={breathing === "pause" ? "Back to the interview" : "I'm ready"}
      onDone={closeBreathing}
    />
  );

  if (!workspaceKind && !started) {
    // Lobby: the room on one side, setup on the other, so Start is always in view.
    return (
      <div className="flex min-h-screen flex-col bg-white">
        {header}
        <div className="mx-auto grid w-full max-w-6xl flex-1 gap-6 p-4 sm:p-6 lg:grid-cols-[1fr_440px]">
          <div className="overflow-hidden rounded-3xl ring-1 ring-slate-200">{stage}</div>
          <div className="lg:py-2">{controls}</div>
        </div>
        {overlay}
      </div>
    );
  }

  if (!workspaceKind) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        {header}
        {stage}
        {controls}
        {overlay}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white lg:grid lg:h-screen lg:grid-cols-[minmax(360px,36%)_1fr]">
      <div className="flex min-h-0 flex-col lg:overflow-y-auto lg:border-r lg:border-slate-200">
        {header}
        {stage}
        {controls}
      </div>
      <div className="h-[85vh] min-h-0 border-t border-slate-200 lg:h-auto lg:border-t-0">
        {workspaceKind === "code" ? (
          <CodeWorkspace ref={workspace} question={questionInPlay(session)} />
        ) : (
          <DesignWorkspace ref={workspace} active={session !== null} />
        )}
      </div>
      {overlay}
    </div>
  );
}
