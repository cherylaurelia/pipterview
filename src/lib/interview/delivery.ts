import type { TranscriptEntry } from "./types";

/**
 * How the candidate sounded: pace, filler words, answer length, how long they
 * took to start, hedging ("I think", "maybe"), and ownership ("I" vs "we").
 * Nerves show up here first (people speed up, fill silences, ramble, or hedge),
 * so these are framed as habits to practice, not scores.
 */

// Multi-word fillers first so "you know" isn't also counted as two words elsewhere.
const FILLERS = ["you know", "i mean", "kind of", "sort of", "um", "umm", "uh", "uhh", "er", "like", "basically", "actually", "literally"];
const FILLER_PATTERN = new RegExp(`\\b(${FILLERS.map((f) => f.replace(" ", "\\s+")).join("|")})\\b`, "gi");

// Phrases that soften a claim until it sounds unsure. Some hedging is natural; a lot of it undersells you.
const HEDGES = ["i think", "i guess", "i feel like", "maybe", "probably", "perhaps", "hopefully", "i'm not sure", "i am not sure", "i don't know"];
const HEDGE_PATTERN = new RegExp(`\\b(${HEDGES.map((h) => h.replace(/ /g, "\\s+")).join("|")})\\b`, "gi");
const I_PATTERN = /\b(i|i'm|i've|i'd|i'll|me|my|myself)\b/gi;
const WE_PATTERN = /\b(we|we're|we've|we'd|we'll|us|our|ourselves)\b/gi;

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
  hedgeCount: number;
  /** Hedges per answer, to one decimal. */
  hedgesPerAnswer: number;
  topHedges: { word: string; count: number }[];
  /** Seconds from your turn starting to your first word, averaged over spoken answers that recorded it. */
  averageThinkSeconds?: number;
  /** Share of "I" among "I" and "we" words, 0 to 100; undefined when neither came up. Interviewers want to hear what you did. */
  ownershipPercent?: number;
  /** Your share of all the words spoken in the interview, 0 to 100. */
  talkSharePercent?: number;
}

const count = (pattern: RegExp, text: string) => [...text.matchAll(pattern)].length;

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

  const hedgeCounts = new Map<string, number>();
  for (const answer of answers) {
    for (const match of answer.text.matchAll(HEDGE_PATTERN)) {
      const word = match[1].toLowerCase().replace(/\s+/g, " ");
      hedgeCounts.set(word, (hedgeCounts.get(word) ?? 0) + 1);
    }
  }
  const hedgeCount = [...hedgeCounts.values()].reduce((a, b) => a + b, 0);
  const thinks = answers.filter((e) => e.thinkMs !== undefined).map((e) => (e.thinkMs ?? 0) / 1000);
  const allText = answers.map((e) => e.text).join(" ");
  const iWords = count(I_PATTERN, allText), weWords = count(WE_PATTERN, allText);
  const yourWords = answers.reduce((n, e) => n + words(e.text), 0);
  const theirWords = transcript.filter((e) => e.role === "interviewer").reduce((n, e) => n + words(e.text), 0);

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
    averageAnswerWords: answers.length ? Math.round(yourWords / answers.length) : 0,
    hedgeCount,
    hedgesPerAnswer: answers.length ? Math.round((hedgeCount / answers.length) * 10) / 10 : 0,
    topHedges: [...hedgeCounts.entries()]
      .map(([word, n]) => ({ word, count: n }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3),
    averageThinkSeconds: thinks.length ? Math.round((thinks.reduce((a, b) => a + b, 0) / thinks.length) * 10) / 10 : undefined,
    ownershipPercent: iWords + weWords >= 3 ? Math.round((iWords / (iWords + weWords)) * 100) : undefined,
    talkSharePercent: yourWords + theirWords > 0 ? Math.round((yourWords / (yourWords + theirWords)) * 100) : undefined,
  };
}

/** One line for the feedback prompt, so coaching can mention delivery when it matters. */
export function describeDelivery(stats: DeliveryStats): string {
  const parts = [`${stats.spokenAnswers} spoken answers`, `average answer ${stats.averageAnswerWords} words`];
  if (stats.wordsPerMinute) parts.push(`pace ${stats.wordsPerMinute} words per minute (comfortable: ${PACE_RANGE.min}-${PACE_RANGE.max})`);
  if (stats.fillersPerMinute !== undefined) parts.push(`${stats.fillersPerMinute} filler words per minute`);
  if (stats.longestAnswerSeconds) parts.push(`longest answer ${stats.longestAnswerSeconds} seconds`);
  parts.push(`${stats.hedgesPerAnswer} hedges per answer ("I think", "maybe")`);
  if (stats.averageThinkSeconds !== undefined) parts.push(`${stats.averageThinkSeconds} seconds before starting to answer, on average`);
  if (stats.ownershipPercent !== undefined) parts.push(`"I" is ${stats.ownershipPercent}% of their "I"/"we" words`);
  return parts.join("; ");
}
