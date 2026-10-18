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
    return <p className="text-[14px] text-[#9a5b12]">Thanks, your rating helps improve the questions.</p>;
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
    `rounded-full px-3 py-1 text-[12.5px] ring-1 transition ${
      active ? "bg-[#fff1d6] font-bold text-[#7a5418] ring-[#e0a43a]" : "bg-white text-[#6b5640] ring-[#ead7b8] hover:bg-[#fff4df]"
    }`;

  return (
    <div className="space-y-2.5 rounded-2xl bg-white/70 p-3 text-[14px] ring-1 ring-[#f0dfc2]">
      <p className="text-[#6b5640]">{source === "mentor" ? "Would a real interviewer ask this?" : "Did this feel like a real interview question?"}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={chip(realistic === true)} onClick={() => setRealistic(true)}>
          Realistic
        </button>
        <button type="button" className={chip(realistic === false)} onClick={() => setRealistic(false)}>
          Not realistic
        </button>
        <span className="mx-1 w-px self-stretch bg-[#ead7b8]" aria-hidden />
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
          className="min-w-0 flex-1 rounded-full bg-white px-3 py-1.5 ring-1 ring-[#ead7b8] placeholder:text-[#b8a080] focus:outline-none focus:ring-2 focus:ring-[#e0a43a]"
        />
        <button
          type="button"
          onClick={submit}
          disabled={realistic === null || state === "saving"}
          className="rounded-full bg-[#ffc95c] px-4 py-1.5 text-[14px] font-bold text-[#3d2a14] disabled:opacity-45"
        >
          {state === "saving" ? "Saving…" : "Submit"}
        </button>
      </div>
      {error && <p className="text-[12.5px] text-[#9b2b22]">{error}</p>}
    </div>
  );
}
