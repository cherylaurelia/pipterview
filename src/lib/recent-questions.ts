"use client";

import type { InterviewTypeId } from "./interview/types";

/**
 * The bank questions you've been asked recently, per round, kept in this browser. Sent when a session starts so the
 * server picks ones you haven't had while there are any left.
 */
const KEY = "pip:recent-questions";
const KEEP = 12;

function load(): Partial<Record<InterviewTypeId, string[]>> {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function recentQuestions(typeId: InterviewTypeId): string[] {
  return load()[typeId] ?? [];
}

export function rememberQuestion(typeId: InterviewTypeId, id: string) {
  const all = load();
  const list = [id, ...(all[typeId] ?? []).filter((q) => q !== id)].slice(0, KEEP);
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...all, [typeId]: list }));
  } catch {
    // Not remembered; questions may repeat sooner.
  }
}
