"use client";

import { useCallback, useEffect, useState } from "react";
import type { InterviewType } from "@/lib/interview/types";
import type { QuestionRatingSummary } from "@/lib/ratings";
import { QuestionRating } from "./QuestionRating";

/**
 * The whole question bank, with everything the interviewer sees, so mentors
 * and recruiters can judge whether it matches real interviews. Ratings from
 * candidates and mentors are shown next to each question.
 */
export function ReviewBoard({ types }: { types: InterviewType[] }) {
  const [summaries, setSummaries] = useState<QuestionRatingSummary[]>([]);
  const [activeType, setActiveType] = useState(types[0].id);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ratings");
      if (res.ok) setSummaries((await res.json()).questions);
    } catch {
      // Ratings are a nice-to-have on this page.
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    void load();
  }, [load]);

  const type = types.find((t) => t.id === activeType)!;
  const statsFor = (questionId: string) => summaries.find((s) => s.typeId === type.id && s.questionId === questionId);
  const tailored = summaries.find((s) => s.typeId === type.id && s.tailored);

  return (
    <div className="space-y-8">
      <nav className="flex flex-wrap gap-2">
        {types.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveType(t.id)}
            className={`rounded-full px-4 py-1.5 text-sm ring-1 ${
              t.id === activeType ? "bg-teal-600 text-white ring-teal-600" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-100"
            }`}
          >
            {t.label} · {t.questions.length}
          </button>
        ))}
      </nav>

      <details className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <summary className="cursor-pointer font-medium">Rubric for {type.label.toLowerCase()} interviews</summary>
        <div className="mt-4 space-y-4 text-sm">
          {type.rubric.map((d) => (
            <div key={d.name}>
              <p className="font-medium text-slate-900">{d.name}</p>
              <p className="text-slate-500">{d.description}</p>
              <ol className="mt-1 space-y-0.5 text-slate-700">
                {d.levels.map((level, i) => (
                  <li key={i}>
                    <span className="text-slate-400">{i + 1}:</span> {level}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </details>

      {tailored && (
        <section className="rounded-2xl bg-teal-50 p-5 ring-1 ring-teal-100">
          <h2 className="font-medium">Tailored questions (written per candidate)</h2>
          <Stats summary={tailored} />
        </section>
      )}

      <ul className="space-y-4">
        {type.questions.map((q) => (
          <li key={q.id} className="space-y-4 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="font-semibold leading-snug text-slate-900">{q.prompt}</h2>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                {q.difficulty} · {q.topics.join(", ")}
              </span>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Block label="A strong answer" className="sm:col-span-2">
                {q.strongAnswer}
              </Block>
              <Block label="Follow-up ladder">
                <ol className="list-decimal space-y-1 pl-4">{q.followUps.map((f) => <li key={f}>{f}</li>)}</ol>
              </Block>
              <Block label="Hint ladder">
                <ol className="list-decimal space-y-1 pl-4">{q.hints.map((h) => <li key={h}>{h}</li>)}</ol>
              </Block>
              <Block label="Common mistakes" className="sm:col-span-2">
                <ul className="list-disc space-y-1 pl-4">{q.commonMistakes.map((m) => <li key={m}>{m}</li>)}</ul>
              </Block>
            </dl>
            <Stats summary={statsFor(q.id)} />
            <QuestionRating question={q} typeId={type.id} source="mentor" onSaved={load} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Block({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 leading-relaxed text-slate-700">{children}</dd>
    </div>
  );
}

function Stats({ summary }: { summary?: QuestionRatingSummary }) {
  if (!summary) return <p className="text-xs text-slate-400">No ratings yet.</p>;
  const total = summary.realistic + summary.notRealistic;
  const pct = total ? Math.round((summary.realistic / total) * 100) : 0;
  return (
    <div className="space-y-2 text-xs text-slate-500">
      <p>
        <span className="font-medium text-slate-900">{pct}% realistic</span> ({total} rating{total === 1 ? "" : "s"}) · too easy{" "}
        {summary.difficulty.too_easy} · about right {summary.difficulty.about_right} · too hard {summary.difficulty.too_hard}
      </p>
      {summary.comments.length > 0 && (
        <ul className="space-y-1">
          {summary.comments.map((c, i) => (
            <li key={i}>
              <span className="text-slate-400">{c.source}:</span> {c.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
