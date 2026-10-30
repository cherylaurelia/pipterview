"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Push-to-talk speech-to-text using the browser's Web Speech API (best in
 * Chrome and Edge; Safari works; Firefox has no support). Swap this hook's
 * internals for a hosted STT service later without touching callers.
 */
export function usePushToTalk(lang = "en-US") {
  // null while server-rendering, then whether this browser has recognition.
  const supported = useSyncExternalStore(
    subscribeNever,
    () => Boolean(getRecognitionCtor()),
    () => null,
  );
  const [listening, setListening] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const holdingRef = useRef(false);
  // Text from earlier recognition sessions within one hold (Chrome ends a
  // session on silence, so we restart it while the button is still held).
  const committedRef = useRef("");
  const sessionTextRef = useRef("");
  const resolveRef = useRef<((text: string) => void) | null>(null);
  // When speech was last heard, for hands-free mode's pause detection.
  const lastSpeechRef = useRef(0);
  const firstSpeechRef = useRef(0);

  useEffect(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      sessionTextRef.current = text;
      lastSpeechRef.current = performance.now();
      if (!firstSpeechRef.current) firstSpeechRef.current = lastSpeechRef.current;
      setLiveText(joinText(committedRef.current, text));
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Microphone access was blocked. Allow it in your browser, or type your answer instead.");
      } else {
        setError(`Speech recognition error: ${event.error}`);
      }
      holdingRef.current = false;
    };

    recognition.onend = () => {
      committedRef.current = joinText(committedRef.current, sessionTextRef.current);
      sessionTextRef.current = "";
      if (holdingRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          // Fall through and finish if the restart is rejected.
        }
      }
      setListening(false);
      resolveRef.current?.(committedRef.current.trim());
      resolveRef.current = null;
    };

    recognitionRef.current = recognition;
    return () => {
      holdingRef.current = false;
      recognition.abort();
    };
  }, [lang]);

  const start = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition || holdingRef.current) return;
    setError(null);
    committedRef.current = "";
    sessionTextRef.current = "";
    lastSpeechRef.current = 0;
    firstSpeechRef.current = 0;
    setLiveText("");
    holdingRef.current = true;
    try {
      recognition.start();
      setListening(true);
    } catch {
      // start() throws if a previous session hasn't fully ended yet.
      holdingRef.current = false;
    }
  }, []);

  /** Stops listening and resolves with everything heard during the hold. */
  const stop = useCallback((): Promise<string> => {
    const recognition = recognitionRef.current;
    if (!recognition || !holdingRef.current) return Promise.resolve("");
    holdingRef.current = false;
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      recognition.stop();
    });
  }, []);

  /** When speech was last heard (performance.now() time), or 0 if nothing yet this turn. */
  const lastSpeechAt = useCallback(() => lastSpeechRef.current, []);
  /** When the first word of this turn was heard, or 0. */
  const firstSpeechAt = useCallback(() => firstSpeechRef.current, []);
  /** Everything heard so far this turn. */
  const currentText = useCallback(() => joinText(committedRef.current, sessionTextRef.current), []);

  return { supported, listening, liveText, error, start, stop, lastSpeechAt, firstSpeechAt, currentText };
}

function getRecognitionCtor() {
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

const subscribeNever = () => () => {};

function joinText(a: string, b: string) {
  return [a.trim(), b.trim()].filter(Boolean).join(" ");
}
