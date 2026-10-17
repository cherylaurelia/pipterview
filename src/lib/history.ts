"use client";

import type { Feedback } from "./interview/prompts";
import type { CompanyStyle, Intensity, InterviewTypeId } from "./interview/types";

/**
 * Practice history, kept in this browser only. Powers the progress page:
 * scores over time, and whether nerves go down with practice.
 */
export interface SessionRecord {
  id: string;
  date: string;
  typeId: InterviewTypeId;
  intensity: Intensity;
  style: CompanyStyle;
  recommendation: Feedback["recommendation"];
  averageScore: number;
  dimensions: { name: string; score: number }[];
  /** Self-reported nervousness, 1 (calm) to 5 (very nervous). */
  nervousBefore?: number;
  nervousAfter?: number;
  reflection?: string;
  wordsPerMinute?: number;
  fillersPerMinute?: number;
}

const KEY = "mock-interviewer:history";
const MAX_SESSIONS = 100;

export function loadHistory(): SessionRecord[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SessionRecord[]) : [];
  } catch {
    return [];
  }
}

function save(records: SessionRecord[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(records.slice(-MAX_SESSIONS)));
  } catch {
    // Storage full or blocked; history is a nice-to-have.
  }
}

export function addSession(record: SessionRecord) {
  save([...loadHistory().filter((r) => r.id !== record.id), record]);
}

export function updateSession(id: string, patch: Partial<SessionRecord>) {
  save(loadHistory().map((r) => (r.id === id ? { ...r, ...patch } : r)));
}

/** The most recent earlier session of the same round, to compare against (yourself, not a hiring bar). */
export function previousSession(typeId: InterviewTypeId, excludeId?: string): SessionRecord | undefined {
  return loadHistory()
    .filter((r) => r.typeId === typeId && r.id !== excludeId)
    .at(-1);
}

export function clearHistory() {
  save([]);
}

/** Labels that describe readiness rather than judging the person. */
export const READINESS: Record<Feedback["recommendation"], { label: string; tone: "low" | "mid" | "high" }> = {
  strong_no_hire: { label: "Building foundations", tone: "low" },
  no_hire: { label: "Getting there", tone: "low" },
  lean_hire: { label: "Almost there", tone: "mid" },
  hire: { label: "Interview-ready", tone: "high" },
  strong_hire: { label: "Standout", tone: "high" },
};

export const NERVOUSNESS_LABELS = ["Calm", "A little nervous", "Nervous", "Very nervous", "Overwhelmed"];
