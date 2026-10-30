"use client";

import { useState } from "react";
import type { InterviewTypeId, Question } from "@/lib/interview/types";
import type { Rating } from "@/lib/ratings";

type Difficulty = NonNullable<Rating["difficulty"]>;

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  too_easy: "Too easy",
  about_right: "About right",
  too_hard: "Too hard",
};

/** "Was this a realistic question?" Used by candidates after an interview and by mentors on /review. */
export function QuestionRating({
  question,
  typeId,
  source,
  onSaved,
}: {
  question: Question;
  typeId: InterviewTypeId;
  source: Rating["source"];
  onSaved?: () => void;
}) {
  const [realistic, setRealistic] = useState<boolean | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (state === "saved") {
    return <p className="text-sm text-emerald-700">Thanks, your rating helps improve the questions.</p>;
  }

  const submit = async () => {
    if (realistic === null) return;
    setState("saving");
    const rating: Rating = {
      questionId: question.id,
      questionPrompt: question.prompt,
      typeId,
      tailored: Boolean(question.tailoredReason),
      source,
      realistic,
      difficulty: difficulty ?? undefined,
      comment: comment.trim() || undefined,
    };
    try {
      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rating),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Request failed (${res.status})`);
      setState("saved");
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  };

  const chip = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs ring-1 transition ${
      active ? "bg-teal-50 text-teal-800 ring-teal-500" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-100"
    }`;

  return (
    <div className="space-y-2.5 rounded-xl bg-slate-50 p-3 text-sm ring-1 ring-slate-100">
      <p className="text-slate-600">{source === "mentor" ? "Would a real interviewer ask this?" : "Did this feel like a real interview question?"}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={chip(realistic === true)} onClick={() => setRealistic(true)}>
          Realistic
        </button>
        <button type="button" className={chip(realistic === false)} onClick={() => setRealistic(false)}>
          Not realistic
        </button>
        <span className="mx-1 w-px self-stretch bg-slate-200" aria-hidden />
        {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
          <button key={d} type="button" className={chip(difficulty === d)} onClick={() => setDifficulty(difficulty === d ? null : d)}>
            {DIFFICULTY_LABELS[d]}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={source === "mentor" ? "What would you change? (optional)" : "Anything off about it? (optional)"}
          className="min-w-0 flex-1 rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <button
          type="button"
          onClick={submit}
          disabled={realistic === null || state === "saving"}
          className="rounded-full bg-teal-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400"
        >
          {state === "saving" ? "Saving…" : "Submit"}
        </button>
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
