"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { InterviewTypeId, Question, SessionSettings, SessionState, TranscriptEntry } from "@/lib/interview/types";
import { streamTurnRequest } from "@/lib/turn-client";
import { createSpeechQueue, stopSpeaking, warmUpVoices } from "@/lib/voice/speak";
import { usePushToTalk } from "@/lib/voice/usePushToTalk";
import type { WorkspaceSnapshot } from "@/lib/workspace/types";
import type { PrepType } from "./script";

// A real back-and-forth with the interviewer (the same /api/interview routes the main interview room uses), shaped
// for the 3D world: the guide's reply streams into the chat and is spoken sentence by sentence while the chick talks;
// you answer by talking (browser speech recognition) or typing.

export interface ChatMessage {
  from: "guide" | "you";
  text: string;
}

export type ConvoStatus = "idle" | "connecting" | "thinking" | "speaking" | "your-turn" | "listening" | "done" | "error";

// The world's prep types onto the interview types. (A resume quiz is a behavioral round for now; with a resume
// in the profile, the server writes questions from it.)
const TYPE_FOR: Record<PrepType, InterviewTypeId> = { behavioral: "behavioral", technical: "technical", resume: "behavioral" };

// A practice world, so: gentle, one question, no clock.
const SETTINGS: SessionSettings = { intensity: "gentle", style: "big_tech", length: "quick" };

export function useConversation(prep: PrepType, getWork?: () => WorkspaceSnapshot | undefined) {
  const [status, setStatusState] = useState<ConvoStatus>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [question, setQuestion] = useState<Question | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const mic = usePushToTalk();

  const statusRef = useRef<ConvoStatus>("idle");
  const setStatus = useCallback((s: ConvoStatus) => {
    statusRef.current = s;
    setStatusState(s);
  }, []);
  const session = useRef<SessionState | null>(null);
  const transcript = useRef<TranscriptEntry[]>([]);
  const run = useRef(0); // bumped on reset, so a reply still streaming in from an old session is ignored
  const turnPending = useRef(false); // the guide's reply hasn't fully arrived yet, so you can't answer over it
  const talkStarted = useRef(0);
  const mutedRef = useRef(false);
  const workRef = useRef(getWork);
  useEffect(() => {
    workRef.current = getWork;
    mutedRef.current = muted;
  });

  useEffect(() => {
    warmUpVoices();
    return stopSpeaking;
  }, []);

  /** One reply from the guide: streams into the chat, is spoken aloud, then the floor is yours. */
  const guideTurn = useCallback(
    async (url: string, body: unknown, previous: TranscriptEntry[]) => {
      const id = run.current;
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
        const turn = await streamTurnRequest(url, body, (delta) => {
          if (id !== run.current) return;
          if (!started) begin();
          setMessages((m) => [...m.slice(0, -1), { from: "guide", text: m[m.length - 1].text + delta }]);
          queue?.push(delta);
        });
        if (id !== run.current) return queue?.cancel();
        if (!started) {
          begin();
          queue?.push(turn.entry.text);
        }
        // the finished line is the record; it can differ slightly from what streamed
        setMessages((m) => [...m.slice(0, -1), { from: "guide", text: turn.entry.text }]);
        session.current = turn.state;
        transcript.current = [...previous, turn.entry];
        setQuestion(turn.state.questions[Math.min(turn.state.questionIndex, turn.state.questions.length - 1)] ?? null);
        turnPending.current = false;

        if (queue) {
          queue.close();
          await queue.done;
        } else {
          // muted: still let the chick "say" it, for about as long as it would take
          await new Promise((r) => setTimeout(r, Math.min(6000, 600 + turn.entry.text.length * 35)));
        }
        if (id !== run.current) return;
        setSpeaking(false);
        if (statusRef.current !== "speaking") return; // you started talking over it
        setStatus(turn.state.phase === "done" ? "done" : "your-turn");
      } catch (err) {
        if (id !== run.current) return;
        queue?.cancel();
        turnPending.current = false;
        setSpeaking(false);
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    },
    [setStatus],
  );

  const start = useCallback(() => {
    run.current++;
    session.current = null;
    transcript.current = [];
    setMessages([]);
    setQuestion(null);
    setError(null);
    setNotice(null);
    setStatus("connecting");
    void guideTurn("/api/interview/start", { typeId: TYPE_FOR[prep], settings: SETTINGS }, []);
  }, [guideTurn, prep, setStatus]);

  const reset = useCallback(() => {
    run.current++;
    stopSpeaking();
    void mic.stop();
    session.current = null;
    transcript.current = [];
    turnPending.current = false;
    setMessages([]);
    setQuestion(null);
    setSpeaking(false);
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
    (text: string, durationMs?: number) => {
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
      const work = workRef.current?.();
      const entry: TranscriptEntry = { role: "candidate", text: said, ...(work ? { workspace: work } : {}), ...(durationMs ? { durationMs } : {}) };
      const lines = [...transcript.current, entry];
      transcript.current = lines;
      setMessages((m) => [...m, { from: "you", text: said }]);
      setStatus("thinking");
      void guideTurn("/api/interview/turn", { state, transcript: lines }, lines);
    },
    [guideTurn, setStatus],
  );

  /** Click once to start talking (interrupting the guide), again to send. */
  const toggleTalk = useCallback(async () => {
    if (statusRef.current === "listening") {
      const end = mic.lastSpeechAt() || performance.now();
      const heard = await mic.stop();
      answer(heard, Math.max(0, Math.round(end - talkStarted.current)));
      return;
    }
    if (!canAnswer()) return;
    stopSpeaking();
    setSpeaking(false);
    setNotice(null);
    talkStarted.current = performance.now();
    setStatus("listening");
    mic.start();
  }, [answer, mic, setStatus]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      if (!m) stopSpeaking();
      return !m;
    });
  }, []);

  return {
    status,
    messages,
    speaking,
    question,
    error: error ?? mic.error,
    notice,
    muted,
    canTalk: mic.supported === true,
    liveText: mic.liveText,
    start,
    reset,
    answer,
    toggleTalk,
    toggleMute,
  };
}
