import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { INTERVIEW_TYPE_IDS } from "./interview/types";

/**
 * Question-quality ratings from candidates (after an interview) and mentors
 * (on /review). Stored as JSON lines in data/ratings.jsonl, which is fine for
 * local dev and a hackathon demo. On a host with a read-only filesystem
 * (e.g. Vercel), swap these two functions for a real database.
 */
const FILE = path.join(process.cwd(), "data", "ratings.jsonl");

export const RatingSchema = z.object({
  questionId: z.string().min(1).max(80),
  questionPrompt: z.string().max(600),
  typeId: z.enum(INTERVIEW_TYPE_IDS),
  tailored: z.boolean(),
  source: z.enum(["candidate", "mentor"]),
  realistic: z.boolean(),
  difficulty: z.enum(["too_easy", "about_right", "too_hard"]).optional(),
  comment: z.string().max(2000).optional(),
});
export type Rating = z.infer<typeof RatingSchema>;
type StoredRating = Rating & { createdAt: string };

export interface QuestionRatingSummary {
  questionId: string;
  questionPrompt: string;
  typeId: Rating["typeId"];
  tailored: boolean;
  realistic: number;
  notRealistic: number;
  difficulty: Record<NonNullable<Rating["difficulty"]>, number>;
  comments: { source: Rating["source"]; text: string; createdAt: string }[];
}

export async function saveRating(rating: Rating) {
  await mkdir(path.dirname(FILE), { recursive: true });
  const row: StoredRating = { ...rating, createdAt: new Date().toISOString() };
  await appendFile(FILE, JSON.stringify(row) + "\n", "utf8");
}

export async function summarizeRatings(): Promise<QuestionRatingSummary[]> {
  let raw = "";
  try {
    raw = await readFile(FILE, "utf8");
  } catch {
    return [];
  }

  const byQuestion = new Map<string, QuestionRatingSummary>();
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let row: StoredRating;
    try {
      row = JSON.parse(line);
    } catch {
      continue; // skip a partially written line
    }
    // Tailored questions are unique per candidate; group them by type instead of id.
    const key = row.tailored ? `tailored:${row.typeId}` : `${row.typeId}:${row.questionId}`;
    const summary = byQuestion.get(key) ?? {
      questionId: row.tailored ? `tailored-${row.typeId}` : row.questionId,
      questionPrompt: row.tailored ? "Tailored questions (all candidates)" : row.questionPrompt,
      typeId: row.typeId,
      tailored: row.tailored,
      realistic: 0,
      notRealistic: 0,
      difficulty: { too_easy: 0, about_right: 0, too_hard: 0 },
      comments: [],
    };
    if (row.realistic) summary.realistic += 1;
    else summary.notRealistic += 1;
    if (row.difficulty) summary.difficulty[row.difficulty] += 1;
    if (row.comment?.trim()) {
      const text = row.tailored ? `“${row.questionPrompt}” — ${row.comment.trim()}` : row.comment.trim();
      summary.comments.push({ source: row.source, text, createdAt: row.createdAt });
    }
    byQuestion.set(key, summary);
  }

  return [...byQuestion.values()].map((s) => ({ ...s, comments: s.comments.slice(-10).reverse() }));
}
