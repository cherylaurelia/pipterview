"use client";

import type { Feedback } from "./interview/prompts";
import type { InterviewTypeId } from "./interview/types";

/**
 * The story bank: personal stories the candidate has told in practice (pulled out of each session's feedback), kept in
 * this browser. Behavioral interviews reuse a handful of stories across many questions, so collecting them, seeing
 * which STAR parts are missing, and reminding the candidate of them when they blank is most of behavioral prep.
 */
export interface SavedStory {
  id: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  skills: string[];
  tip: string;
  /** The question it was told for, most recently. */
  question?: string;
  typeId: InterviewTypeId;
  firstTold: string;
  lastTold: string;
  timesTold: number;
}

export const STAR_PARTS = ["situation", "task", "action", "result"] as const;
export type StarPart = (typeof STAR_PARTS)[number];

const KEY = "extraview:stories";
const MAX_STORIES = 40;

export function loadStories(): SavedStory[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedStory[]) : [];
  } catch {
    return [];
  }
}

function save(stories: SavedStory[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(stories.slice(-MAX_STORIES)));
  } catch {
    // Storage full or blocked; the bank is a nice-to-have.
  }
}

/** Two stories are the same if their titles match once case and punctuation are ignored. */
const sameTitle = (a: string, b: string) => a.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === b.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Adds a session's stories to the bank. A story told again keeps its id and count, and any STAR part that was missing
 * before but told this time is filled in. Returns the bank.
 */
export function addStories(stories: Feedback["stories"], meta: { typeId: InterviewTypeId; questionPrompt: (id: string) => string | undefined }): SavedStory[] {
  const bank = loadStories();
  const now = new Date().toISOString();
  for (const story of stories) {
    if (!story.title.trim()) continue;
    const existing = bank.find((s) => sameTitle(s.title, story.title));
    if (existing) {
      for (const part of STAR_PARTS) if (story[part].trim()) existing[part] = story[part];
      existing.skills = [...new Set([...existing.skills, ...story.skills])].slice(0, 5);
      existing.tip = story.tip || existing.tip;
      existing.question = meta.questionPrompt(story.questionId) ?? existing.question;
      existing.lastTold = now;
      existing.timesTold += 1;
    } else {
      bank.push({
        id: crypto.randomUUID(),
        title: story.title.trim(),
        situation: story.situation,
        task: story.task,
        action: story.action,
        result: story.result,
        skills: story.skills.slice(0, 5),
        tip: story.tip,
        question: meta.questionPrompt(story.questionId),
        typeId: meta.typeId,
        firstTold: now,
        lastTold: now,
        timesTold: 1,
      });
    }
  }
  save(bank);
  return bank;
}

/** How many stories the bank will hold once these are added (new titles only add to the count). */
export function bankSizeAfter(stories: Feedback["stories"]) {
  const bank = loadStories();
  const fresh = stories.filter((s, i) => s.title.trim() && !bank.some((b) => sameTitle(b.title, s.title)) && stories.findIndex((o) => sameTitle(o.title, s.title)) === i);
  return Math.min(MAX_STORIES, bank.length + fresh.length);
}

export function removeStory(id: string) {
  save(loadStories().filter((s) => s.id !== id));
}

export const missingParts = (story: Pick<SavedStory, StarPart>) => STAR_PARTS.filter((p) => !story[p].trim());

/** One line per story for the interviewer prompt (most recent first), so it can nudge you towards one if you freeze. */
export function storyLines(stories: SavedStory[]): string[] {
  return [...stories]
    .sort((a, b) => b.lastTold.localeCompare(a.lastTold))
    .slice(0, 8)
    .map((s) => `${s.title}: ${s.situation || s.action}`.slice(0, 200));
}
