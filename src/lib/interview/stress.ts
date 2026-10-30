/**
 * Signs that the candidate is struggling with an answer, computed in the
 * browser from what they said and how. They're passed to the interviewer so
 * Alex can ease off in the moment (see stressGuidance in flow.ts), and shown
 * in the report. Plain descriptions, so the model can reason about them.
 */

/** Most telling first: "I'm blanking" says more than a leading "sorry". */
const STUCK_PHRASES = [
  /\bi'?m blanking\b/i,
  /\bmy mind (?:just )?went blank\b/i,
  /\bi'?m (?:so |really )?nervous\b/i,
  /\bi'?m stuck\b/i,
  /\bi (?:really )?don'?t know\b/i,
  /\bi have no idea\b/i,
  /\bi forgot\b/i,
  /\bcan i (?:start|try) (?:over|again)\b/i,
  /\bsorry,? (?:i|let me)\b/i,
];
const FILLERS = /\b(um+|uh+|er|like|you know|i mean|basically|literally)\b/gi;

/** Slower than this to start talking reads as freezing up. */
const SLOW_START_MS = 12_000;
/** Faster than this usually means rushing from nerves. */
const RUSHED_WPM = 190;

export interface AnswerInput {
  text: string;
  /** Spoken answers only: how long the candidate talked. */
  durationMs?: number;
  /** Spoken answers only: time from the floor passing to them until their first word. */
  startDelayMs?: number;
}

export function stressSignals({ text, durationMs, startDelayMs }: AnswerInput): string[] {
  const signals: string[] = [];
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/).filter(Boolean).length;

  if (startDelayMs && startDelayMs > SLOW_START_MS) {
    signals.push(`took ${Math.round(startDelayMs / 1000)} seconds to start answering`);
  }
  const stuck = STUCK_PHRASES.map((p) => trimmed.match(p)).find(Boolean);
  if (stuck) signals.push(`said "${stuck[0]}"`);

  if (durationMs && durationMs > 5000 && words > 0) {
    const minutes = durationMs / 60_000;
    const wpm = words / minutes;
    if (wpm > RUSHED_WPM) signals.push(`speaking fast (${Math.round(wpm)} words per minute)`);
    const fillers = (trimmed.match(FILLERS) ?? []).length;
    if (fillers / minutes >= 12 && fillers >= 3) signals.push(`many filler words (${fillers} in ${Math.round(durationMs / 1000)} seconds)`);
  }

  // Questions to the interviewer are naturally short; answers this short usually aren't answers.
  if (words > 0 && words <= 5 && !trimmed.endsWith("?")) signals.push("very short answer");

  return signals.slice(0, 4);
}
