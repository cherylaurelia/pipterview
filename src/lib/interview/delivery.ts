import type { TranscriptEntry } from "./types";

/**
 * How the candidate sounded: pace, filler words, and answer length. Nerves
 * show up here first (people speed up, fill silences, or ramble), so these
 * are framed as habits to practice, not scores.
 */

// Multi-word fillers first so "you know" isn't also counted as two words elsewhere.
const FILLERS = ["you know", "i mean", "kind of", "sort of", "um", "umm", "uh", "uhh", "er", "like", "basically", "actually", "literally"];
const FILLER_PATTERN = new RegExp(`\\b(${FILLERS.map((f) => f.replace(" ", "\\s+")).join("|")})\\b`, "gi");

/** Comfortable conversational pace for interviews, in words per minute. */
export const PACE_RANGE = { min: 120, max: 165 };

export interface DeliveryStats {
  spokenAnswers: number;
  /** Words per minute across spoken answers; undefined if nothing was spoken. */
  wordsPerMinute?: number;
  fillerCount: number;
  fillersPerMinute?: number;
  topFillers: { word: string; count: number }[];
  averageAnswerSeconds?: number;
  longestAnswerSeconds?: number;
  averageAnswerWords: number;
}

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

export function deliveryStats(transcript: TranscriptEntry[]): DeliveryStats {
  const answers = transcript.filter((e) => e.role === "candidate");
  const spoken = answers.filter((e) => e.durationMs && e.durationMs > 1000);

  const fillerCounts = new Map<string, number>();
  for (const answer of answers) {
    for (const match of answer.text.matchAll(FILLER_PATTERN)) {
      const word = match[1].toLowerCase().replace(/\s+/g, " ");
      fillerCounts.set(word, (fillerCounts.get(word) ?? 0) + 1);
    }
  }
  const fillerCount = [...fillerCounts.values()].reduce((a, b) => a + b, 0);

  const spokenMinutes = spoken.reduce((ms, e) => ms + (e.durationMs ?? 0), 0) / 60_000;
  const spokenWords = spoken.reduce((n, e) => n + words(e.text), 0);
  const spokenFillers = spoken.reduce((n, e) => n + [...e.text.matchAll(FILLER_PATTERN)].length, 0);
  const durations = spoken.map((e) => (e.durationMs ?? 0) / 1000);

  return {
    spokenAnswers: spoken.length,
    wordsPerMinute: spokenMinutes > 0 ? Math.round(spokenWords / spokenMinutes) : undefined,
    fillerCount,
    fillersPerMinute: spokenMinutes > 0 ? Math.round((spokenFillers / spokenMinutes) * 10) / 10 : undefined,
    topFillers: [...fillerCounts.entries()]
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3),
    averageAnswerSeconds: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : undefined,
    longestAnswerSeconds: durations.length ? Math.round(Math.max(...durations)) : undefined,
    averageAnswerWords: answers.length ? Math.round(answers.reduce((n, e) => n + words(e.text), 0) / answers.length) : 0,
  };
}

/** One line for the feedback prompt, so coaching can mention delivery when it matters. */
export function describeDelivery(stats: DeliveryStats): string {
  const parts = [`${stats.spokenAnswers} spoken answers`, `average answer ${stats.averageAnswerWords} words`];
  if (stats.wordsPerMinute) parts.push(`pace ${stats.wordsPerMinute} words per minute (comfortable: ${PACE_RANGE.min}-${PACE_RANGE.max})`);
  if (stats.fillersPerMinute !== undefined) parts.push(`${stats.fillersPerMinute} filler words per minute`);
  if (stats.longestAnswerSeconds) parts.push(`longest answer ${stats.longestAnswerSeconds} seconds`);
  return parts.join("; ");
}
