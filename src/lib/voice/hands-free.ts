import type { Intensity } from "../interview/types";

/**
 * Shared rules for hands-free answering: the mic opens when the interviewer
 * finishes, and an answer sends after a pause or a closing phrase.
 */

/** Silence that ends an answer. Nervous speakers pause more, so gentle mode waits longest. */
export const SILENCE_MS: Record<Intensity, number> = { gentle: 4000, standard: 3000, realistic: 2500 };

/** Saying one of these at the end sends the answer right away. */
export const DONE_PHRASE = /\b(that'?s my answer|that is my answer|i'?m done|that'?s it)[.!]?$/i;

/** The answer as it should be sent: without the closing phrase or the punctuation it leaves behind. */
export function stripDonePhrase(text: string) {
  return text.replace(DONE_PHRASE, "").replace(/[\s,;]+$/, "").trim();
}

export const VOICE_MODE_KEY = "mock-interviewer:voice-mode";
