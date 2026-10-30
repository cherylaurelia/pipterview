"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Feedback } from "@/lib/interview/prompts";
import type { Profile } from "@/lib/interview/tailor";
import type { InterviewTypeId, Question, SessionSettings, SessionState, TranscriptEntry } from "@/lib/interview/types";
import { streamTurnRequest } from "@/lib/turn-client";
import { DONE_PHRASE, SILENCE_MS, VOICE_MODE_KEY, stripDonePhrase } from "@/lib/voice/hands-free";
import { createSpeechQueue, stopSpeaking, warmUpVoices } from "@/lib/voice/speak";
import { usePushToTalk } from "@/lib/voice/usePushToTalk";
import type { WorkspaceSnapshot } from "@/lib/workspace/types";
import type { PrepType } from "./script";

// A real back-and-forth with the interviewer (the same /api/interview routes the main interview room uses), shaped
// for the 3D world: the guide's reply streams into the chat and is spoken sentence by sentence while the chick talks;
// you answer by talking (browser speech recognition) or typing. Hands-free by default: the mic opens when the guide
// finishes and a pause sends your answer. At the end, the session is scored.

export interface ChatMessage {
  from: "guide" | "you";
  text: string;
}

export type ConvoStatus =
  | "idle"
  | "connecting"
  | "thinking"
  | "speaking"
  | "your-turn"
  | "listening"
  | "scoring" // writing the feedback report
  | "report" // feedback is ready
  | "error";

// The world's prep types onto the interview types. A resume quiz is a behavioral round whose questions the server
// writes from your resume.
const TYPE_FOR: Record<PrepType, InterviewTypeId> = { behavioral: "behavioral", technical: "technical", resume: "behavioral" };

interface Options {
  settings: SessionSettings;
  /** Sent when starting a resume quiz, so the questions come from the candidate's own experience. */
  profile?: Profile;
  /** Your code, if it changed since your last answer. */
  getWork?: () => WorkspaceSnapshot | undefined;
  /** Everything you produced, for the feedback report. */
  getFinalWork?: () => WorkspaceSnapshot[];
}

/** A request that can be re-sent as-is if it fails. */
interface PendingTurn {
  url: string;
  body: unknown;
  previous: TranscriptEntry[];
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export function useConversation(prep: PrepType, options: Options) {
  const [status, setStatusState] = useState<ConvoStatus>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [question, setQuestion] = useState<Question | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [handsFree, setHandsFreeState] = useState(true);
  // How close a hands-free answer is to sending (0 to 1), and whether "keep thinking" is holding it.
  const [silenceProgress, setSilenceProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  // What the feedback report was written from.
  const [scored, setScored] = useState<{ state: SessionState; transcript: TranscriptEntry[]; work: WorkspaceSnapshot[] } | null>(null);
  const mic = usePushToTalk();

  const statusRef = useRef<ConvoStatus>("idle");
  const setStatus = useCallback((s: ConvoStatus) => {
    statusRef.current = s;
    setStatusState(s);
  }, []);
  const session = useRef<SessionState | null>(null);
  const transcript = useRef<TranscriptEntry[]>([]);
  // Bumped on every new turn and on reset: anything still in flight from an older turn checks this and backs off.
  const turnToken = useRef(0);
  const inFlight = useRef<AbortController | null>(null);
  const lastRequest = useRef<PendingTurn | null>(null);
  const turnPending = useRef(false); // the guide's reply hasn't fully arrived yet, so you can't answer over it
  const talkStarted = useRef(0);
  const mutedRef = useRef(false);
  const handsFreeRef = useRef(true);
  const lastActivity = useRef(0); // typing in the editor or chat box: not a pause
  const holdAfter = useRef(0); // "keep thinking": don't send until speech is heard after this time
  // Opens the mic when the guide finishes (hands-free). Set once startListening exists, below.
  const startListeningRef = useRef<() => void>(() => {});
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
    mutedRef.current = muted;
    handsFreeRef.current = handsFree && mic.supported === true;
  });

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the saved preference once (shared with the interview room)
      if (window.localStorage.getItem(VOICE_MODE_KEY) === "push") setHandsFreeState(false);
    } catch {
      // Storage blocked; stay hands-free.
    }
  }, []);

  useEffect(() => {
    warmUpVoices();
    return () => {
      inFlight.current?.abort();
      stopSpeaking();
    };
  }, []);

  /** Scores the session. Runs on its own when the guide wraps up, or when you finish early. */
  const score = useCallback(async () => {
    const state = session.current;
    if (!state || !transcript.current.some((e) => e.role === "candidate")) return;
    const token = ++turnToken.current;
    inFlight.current?.abort();
    stopSpeaking();
    setSpeaking(false);
    setStatus("scoring");
    try {
      const work = optionsRef.current.getFinalWork?.() ?? [];
      const data = await postJson<{ feedback: Feedback }>("/api/interview/feedback", { state, transcript: transcript.current, work });
      if (token !== turnToken.current) return;
      setScored({ state, transcript: transcript.current, work });
      setFeedback(data.feedback);
      setStatus("report");
    } catch (err) {
      if (token !== turnToken.current) return;
      lastRequest.current = null; // "Try again" should re-score, not replay a turn
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, [setStatus]);

  /** One reply from the guide: streams into the chat, is spoken aloud, then the floor is yours. */
  const guideTurn = useCallback(
    async ({ url, body, previous }: PendingTurn) => {
      const token = ++turnToken.current;
      const current = () => token === turnToken.current;
      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;
      lastRequest.current = { url, body, previous };
      turnPending.current = true;
      let started = false;
      const queue = mutedRef.current ? null : createSpeechQueue();
      const begin = () => {
        started = true;
        setMessages((m) => [...m, { from: "guide", text: "" }]);
        setStatus("speaking");
        setSpeaking(true);
      };
      try {
        const turn = await streamTurnRequest(
          url,
          body,
          (delta) => {
            if (!current()) return;
            if (!started) begin();
            setMessages((m) => [...m.slice(0, -1), { from: "guide", text: m[m.length - 1].text + delta }]);
            queue?.push(delta);
          },
          controller.signal,
        );
        if (!current()) return queue?.cancel();
        if (!started) {
          begin();
          queue?.push(turn.entry.text);
        }
        // the finished line is the record; it can differ slightly from what streamed
        setMessages((m) => [...m.slice(0, -1), { from: "guide", text: turn.entry.text }]);
        session.current = turn.state;
        transcript.current = [...previous, turn.entry];
        lastRequest.current = null;
        setQuestion(turn.state.questions[Math.min(turn.state.questionIndex, turn.state.questions.length - 1)] ?? null);
        turnPending.current = false;

        if (queue) {
          queue.close();
          await queue.done;
        } else {
          // muted: still let the chick "say" it, for about as long as it would take
          await new Promise((r) => setTimeout(r, Math.min(6000, 600 + turn.entry.text.length * 35)));
        }
        // A newer turn (or a reset) owns the chick and the status now.
        if (!current()) return;
        setSpeaking(false);
        if (statusRef.current !== "speaking") return; // you started talking over it
        if (turn.state.phase === "done") void score();
        else {
          setStatus("your-turn");
          // Hands-free: the floor passes to you without a click.
          if (handsFreeRef.current) startListeningRef.current();
        }
      } catch (err) {
        if (!current()) return;
        queue?.cancel();
        turnPending.current = false;
        setSpeaking(false);
        // Drop a half-streamed reply; "Try again" asks for it fresh.
        if (started) setMessages((m) => m.slice(0, -1));
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    },
    [score, setStatus],
  );

  const start = useCallback(() => {
    session.current = null;
    transcript.current = [];
    setMessages([]);
    setQuestion(null);
    setFeedback(null);
    setError(null);
    setNotice(null);
    setStatus("connecting");
    const { settings, profile } = optionsRef.current;
    void guideTurn({ url: "/api/interview/start", body: { typeId: TYPE_FOR[prep], settings, ...(profile ? { profile } : {}) }, previous: [] });
  }, [guideTurn, prep, setStatus]);

  /** After an error: re-send only what failed (your last answer, or the scoring), not the whole session. */
  const retry = useCallback(() => {
    setError(null);
    if (lastRequest.current) {
      setStatus(session.current ? "thinking" : "connecting");
      void guideTurn(lastRequest.current);
    } else if (session.current && transcript.current.some((e) => e.role === "candidate")) {
      void score();
    } else {
      start();
    }
  }, [guideTurn, score, start, setStatus]);

  const reset = useCallback(() => {
    turnToken.current++;
    inFlight.current?.abort();
    inFlight.current = null;
    lastRequest.current = null;
    stopSpeaking();
    void mic.stop();
    session.current = null;
    transcript.current = [];
    turnPending.current = false;
    setMessages([]);
    setQuestion(null);
    setSpeaking(false);
    setFeedback(null);
    setError(null);
    setNotice(null);
    setStatus("idle");
  }, [mic, setStatus]);

  const canAnswer = () => {
    const s = statusRef.current;
    return Boolean(session.current) && !turnPending.current && (s === "your-turn" || s === "speaking" || s === "listening");
  };

  /** Sends your answer (typed or spoken) and gets the guide's reply. */
  const answer = useCallback(
    (text: string, durationMs?: number, thinkMs?: number) => {
      const state = session.current;
      const said = text.trim();
      if (!state || !canAnswer()) return;
      if (!said) {
        setNotice("Didn't catch that. Try again, or type your answer.");
        setStatus("your-turn");
        return;
      }
      stopSpeaking();
      setSpeaking(false);
      setNotice(null);
      const work = optionsRef.current.getWork?.();
      const entry: TranscriptEntry = {
        role: "candidate",
        text: said,
        ...(work ? { workspace: work } : {}),
        ...(durationMs ? { durationMs } : {}),
        ...(thinkMs !== undefined ? { thinkMs } : {}),
      };
      const lines = [...transcript.current, entry];
      transcript.current = lines;
      setMessages((m) => [...m, { from: "you", text: said }]);
      setStatus("thinking");
      void guideTurn({ url: "/api/interview/turn", body: { state, transcript: lines }, previous: lines });
    },
    [guideTurn, setStatus],
  );

  /** Opens the mic for your answer (interrupting the guide if it's still talking). */
  const startListening = useCallback(() => {
    if (!canAnswer() || mic.supported !== true) return;
    stopSpeaking();
    setSpeaking(false);
    setNotice(null);
    holdAfter.current = 0;
    setHolding(false);
    setSilenceProgress(0);
    talkStarted.current = performance.now();
    setStatus("listening");
    mic.start();
  }, [mic, setStatus]);

  /** Sends what the mic heard. */
  const sendSpoken = useCallback(async () => {
    if (statusRef.current !== "listening") return;
    // talking time runs from your first word to your last; the pause before the first word is thinking time
    const end = mic.lastSpeechAt() || performance.now();
    const first = mic.firstSpeechAt();
    holdAfter.current = 0;
    setHolding(false);
    setSilenceProgress(0);
    const heard = stripDonePhrase(await mic.stop());
    answer(heard, Math.max(0, Math.round(end - (first || talkStarted.current))), first ? Math.max(0, Math.round(first - talkStarted.current)) : undefined);
  }, [answer, mic]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  // Hands-free: send after a pause (typing doesn't count as a pause), or right away on "that's my answer".
  const silenceLimit = SILENCE_MS[options.settings.intensity];
  useEffect(() => {
    if (status !== "listening" || !handsFree) return;
    const id = setInterval(() => {
      const spoke = mic.lastSpeechAt();
      if (holdAfter.current) {
        if (spoke <= holdAfter.current) return setSilenceProgress(0);
        holdAfter.current = 0; // you started talking again
        setHolding(false);
      }
      if (!spoke) return setSilenceProgress(0);
      if (DONE_PHRASE.test(mic.currentText().trim())) return void sendSpoken();
      const quiet = performance.now() - Math.max(spoke, lastActivity.current);
      setSilenceProgress(Math.min(1, quiet / silenceLimit));
      if (quiet >= silenceLimit) void sendSpoken();
    }, 100);
    return () => clearInterval(id);
  }, [status, handsFree, mic, silenceLimit, sendSpoken]);

  /** Hold the auto-send until you speak again. */
  const keepThinking = useCallback(() => {
    holdAfter.current = performance.now();
    setHolding(true);
    setSilenceProgress(0);
  }, []);

  /** Typing or editing code: the countdown waits for you. */
  const noteActivity = useCallback(() => {
    lastActivity.current = performance.now();
  }, []);

  /** Talk button: start (or interrupt), then send. In click-to-talk mode, the second click sends. */
  const toggleTalk = useCallback(async () => {
    if (statusRef.current === "listening") return sendSpoken();
    startListening();
  }, [sendSpoken, startListening]);

  /** A typed answer. If the mic is open, what it heard is dropped in favor of what you typed. */
  const answerTyped = useCallback(
    async (text: string) => {
      if (statusRef.current === "listening") {
        holdAfter.current = 0;
        setHolding(false);
        setSilenceProgress(0);
        await mic.stop();
        setStatus("your-turn");
      }
      answer(text);
    },
    [answer, mic, setStatus],
  );

  const setHandsFree = useCallback(
    async (on: boolean) => {
      setHandsFreeState(on);
      try {
        window.localStorage.setItem(VOICE_MODE_KEY, on ? "hands-free" : "push");
      } catch {
        // Not remembered; fine.
      }
      if (on && statusRef.current === "your-turn") startListening();
      if (!on && statusRef.current === "listening") {
        await mic.stop();
        setStatus("your-turn");
      }
    },
    [mic, startListening, setStatus],
  );

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      if (!m) stopSpeaking();
      return !m;
    });
  }, []);

  /** Finish early and get feedback on what you've answered so far. */
  const finish = useCallback(async () => {
    if (statusRef.current === "listening") await mic.stop();
    void score();
  }, [mic, score]);

  const answered = messages.some((m) => m.from === "you");

  return {
    status,
    messages,
    speaking,
    question,
    error: error ?? mic.error,
    notice,
    muted,
    feedback,
    scored,
    canTalk: mic.supported === true,
    handsFree: handsFree && mic.supported === true,
    silenceProgress,
    holding,
    canFinish: answered && (status === "your-turn" || status === "speaking" || status === "listening"),
    liveText: mic.liveText,
    start,
    retry,
    reset,
    answer: answerTyped,
    toggleTalk,
    keepThinking,
    noteActivity,
    setHandsFree,
    toggleMute,
    finish,
  };
}
