"use client";

import type { SessionState, TranscriptEntry } from "./interview/types";

export interface TurnResponse {
  state: SessionState;
  entry: TranscriptEntry;
}

/**
 * Calls a streaming interview route (start or turn). onSay receives the
 * interviewer's line as it's generated; the promise resolves with the
 * finished turn. Aborting the signal cancels the request (and the server stops generating).
 */
export async function streamTurnRequest(
  url: string,
  body: unknown,
  onSay: (text: string) => void,
  signal?: AbortSignal,
): Promise<TurnResponse> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += value;
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const event = JSON.parse(line);
      if (event.type === "say") onSay(event.text);
      else if (event.type === "done") return { state: event.state, entry: event.entry };
      else if (event.type === "error") throw new Error(event.error);
    }
    if (done) throw new Error("The interviewer's reply was cut off. Please try again.");
  }
}
