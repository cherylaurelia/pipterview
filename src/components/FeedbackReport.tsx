"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { NERVOUSNESS_LABELS, READINESS, addSession, previousSession, updateSession } from "@/lib/history";
import { getInterviewType, rubricFor } from "@/lib/interview/catalog";
import { PACE_RANGE, deliveryStats } from "@/lib/interview/delivery";
import type { Feedback } from "@/lib/interview/prompts";
import type { Intensity, SessionState, TranscriptEntry } from "@/lib/interview/types";
import { LANGUAGE_LABELS, type WorkspaceSnapshot } from "@/lib/workspace/types";
import { QuestionRating } from "./QuestionRating";
import { NervousnessScale } from "./room/NervousnessScale";
import { INTENSITY_OPTIONS } from "./room/SessionSetup";
import { Button, ButtonLink, Card, Logo, SectionTitle } from "./ui";

const TONE_CLASS = {
  low: "bg-amber-50 text-amber-800 ring-amber-200",
  mid: "bg-sky-50 text-sky-800 ring-sky-200",
  high: "bg-emerald-50 text-emerald-800 ring-emerald-200",
};

const SCORE_LABEL = ["", "Needs work", "Developing", "Solid", "Strong"];
const INTENSITY_ORDER: Intensity[] = ["gentle", "standard", "realistic"];

function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

export function FeedbackReport({
  feedback,
  state,
  transcript,
  work,
  nervousBefore,
}: {
  feedback: Feedback;
  state: SessionState;
  transcript: TranscriptEntry[];
  work: WorkspaceSnapshot[];
  nervousBefore?: number;
}) {
  const type = getInterviewType(state.typeId);
  const rubric = rubricFor(state.typeId, state.candidate?.role);
  const readiness = READINESS[feedback.recommendation];
  const delivery = useMemo(() => deliveryStats(transcript), [transcript]);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [nervousAfter, setNervousAfter] = useState<number>();
  const [reflection, setReflection] = useState("");
  const [reflectionSaved, setReflectionSaved] = useState(false);
  // Gentle sessions focus on what to practice; scores are one click away.
  const [showScores, setShowScores] = useState(state.settings.intensity !== "gentle");
  // Compare against your own last session of this round, not just a hiring bar. Read before this one is saved.
  const [previous] = useState(() => previousSession(state.typeId));

  const scores = feedback.dimensions.map((d) => Math.min(4, Math.max(1, d.score)));
  const average = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;

  // Record the session once, for the progress page.
  useEffect(() => {
    addSession({
      id: sessionId,
      date: new Date().toISOString(),
      typeId: state.typeId,
      intensity: state.settings.intensity,
      style: state.settings.style,
      recommendation: feedback.recommendation,
      averageScore: average,
      dimensions: feedback.dimensions.map((d, i) => ({ name: d.name, score: scores[i] })),
      nervousBefore,
      wordsPerMinute: delivery.wordsPerMinute,
      fillersPerMinute: delivery.fillersPerMinute,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- record exactly once
  }, []);

  const previousScore = (name: string) => previous?.dimensions.find((d) => d.name === name)?.score;
  const changes = feedback.dimensions.map((d, i) => {
    const before = previousScore(d.name);
    return before === undefined ? undefined : scores[i] - before;
  });
  const improved = changes.filter((c) => c !== undefined && c > 0).length;
  const same = changes.filter((c) => c === 0).length;
  const lower = changes.filter((c) => c !== undefined && c < 0).length;

  // Struggling with nerves after the session: support, don't push more pressure.
  const nervesRose = Boolean(nervousAfter && nervousBefore && nervousAfter > nervousBefore);
  const needsSupport = nervesRose || (nervousAfter ?? 0) >= 4;

  const intensityIndex = INTENSITY_ORDER.indexOf(state.settings.intensity);
  const nextIntensity =
    readiness.tone !== "low" && !needsSupport && intensityIndex < INTENSITY_ORDER.length - 1
      ? INTENSITY_ORDER[intensityIndex + 1]
      : undefined;
  const intensityLabel = INTENSITY_OPTIONS.find((o) => o.value === state.settings.intensity)?.label;

  const transcriptText = transcript.map((e) => `${e.role === "interviewer" ? "Alex" : "You"}: ${e.text}`).join("\n\n");

  return (
    <main className="min-h-screen bg-slate-50/60">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Logo />
          <span className="text-sm text-slate-500">
            {type.label} · {intensityLabel}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
        <Card className="p-6 sm:p-8">
          <p className="text-sm font-medium text-teal-700">You did it. That was a full practice interview.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Your feedback</h1>
            {showScores && (
              <span className={`rounded-full px-3 py-1 text-sm font-medium ring-1 ${TONE_CLASS[readiness.tone]}`}>{readiness.label}</span>
            )}
          </div>
          <p className="mt-4 text-lg leading-relaxed text-slate-700">{feedback.summary}</p>
          {previous && (showScores ? improved + same + lower > 0 : improved > 0) && (
            <p className="mt-4 rounded-xl bg-teal-50 px-4 py-2.5 text-sm text-teal-900 ring-1 ring-teal-100">
              Since your last {type.label.toLowerCase()} session:{" "}
              {[
                improved > 0 && `better in ${improved} area${improved === 1 ? "" : "s"}`,
                showScores && same > 0 && `the same in ${same}`,
                showScores && lower > 0 && `lower in ${lower}`,
              ]
                .filter(Boolean)
                .join(", ")}
              .
            </p>
          )}
          {showScores ? (
            <p className="mt-3 text-xs text-slate-400">Readiness is judged against a new-grad hiring bar. Average rubric score: {average}/4.</p>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              Scores are hidden in gentle mode so you can focus on what to practice.{" "}
              <button className="font-medium text-teal-700 underline underline-offset-2" onClick={() => setShowScores(true)}>
                Show scores
              </button>
            </p>
          )}
        </Card>

        <Card className="space-y-4 p-6">
          <NervousnessScale
            label="How do you feel now?"
            value={nervousAfter}
            onChange={(v) => {
              setNervousAfter(v);
              updateSession(sessionId, { nervousAfter: v });
            }}
          />
          {nervousAfter && nervousBefore && (
            <p className="text-sm text-slate-600">
              Before: <span className="font-medium">{NERVOUSNESS_LABELS[nervousBefore - 1]}</span> → Now:{" "}
              <span className="font-medium">{NERVOUSNESS_LABELS[nervousAfter - 1]}</span>.{" "}
              {nervousAfter < nervousBefore
                ? "Facing it made it smaller. That's how practice works."
                : "Nerves don't always drop after one session. They usually fall over several. Keep going."}
            </p>
          )}
          {needsSupport && (
            <div className="space-y-2 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900 ring-1 ring-amber-100">
              <p className="font-medium">That was a hard one, and it&apos;s okay that it felt that way.</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Take a break before the next session. Practice works best spread out.</li>
                <li>Next time, try gentle mode and the breathing exercise first; there&apos;s no clock and Alex goes easier.</li>
                <li>It can help to practice just one question, then stop. Small wins count.</li>
              </ul>
              <p>If interview anxiety is affecting you beyond practice, your campus counseling center is a good place to talk it through.</p>
            </div>
          )}
        </Card>

        <section className="grid gap-4 sm:grid-cols-2">
          <Card className="p-6">
            <SectionTitle>What went well</SectionTitle>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
              {feedback.strengths.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-0.5 text-emerald-600">✓</span>
                  {s}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-6">
            <SectionTitle>Practice next</SectionTitle>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
              {feedback.improvements.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-0.5 text-teal-600">→</span>
                  {s}
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <Card className="p-6">
          <SectionTitle hint={showScores ? "Each area is scored 1 to 4 against a new-grad bar." : "What you showed in each area, and one thing to try next."}>
            Rubric
          </SectionTitle>
          <ul className="mt-5 space-y-5">
            {feedback.dimensions.map((d, i) => {
              const score = scores[i];
              const level = rubric.find((r) => r.name === d.name)?.levels[score - 1];
              const change = changes[i];
              return (
                <li key={d.name}>
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="font-medium text-slate-900">{d.name}</h3>
                    {showScores ? (
                      <span className="text-sm text-slate-500">
                        {change !== undefined && change !== 0 && (
                          <span className={`mr-2 text-xs ${change > 0 ? "text-emerald-700" : "text-slate-400"}`}>
                            {change > 0 ? "▲" : "▼"} from {score - change}
                          </span>
                        )}
                        {score}/4 · {SCORE_LABEL[score]}
                      </span>
                    ) : (
                      change !== undefined && change > 0 && <span className="text-xs text-emerald-700">▲ better than last time</span>
                    )}
                  </div>
                  {showScores && (
                    <>
                      <div className="mt-2 flex gap-1" aria-hidden>
                        {[1, 2, 3, 4].map((n) => (
                          <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= score ? "bg-teal-500" : "bg-slate-200"}`} />
                        ))}
                      </div>
                      {level && <p className="mt-2 text-xs text-slate-400">{level}</p>}
                    </>
                  )}
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{d.evidence}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-teal-800">Next time: {d.advice}</p>
                </li>
              );
            })}
          </ul>
        </Card>

        {(delivery.spokenAnswers > 0 || delivery.fillerCount > 0) && (
          <Card className="p-6">
            <SectionTitle hint="Nerves usually show up here first: speeding up, filling silences, or rambling. These are habits, not scores.">
              How you sounded
            </SectionTitle>
            <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat
                label="Pace"
                value={delivery.wordsPerMinute ? `${delivery.wordsPerMinute} wpm` : "—"}
                note={
                  !delivery.wordsPerMinute
                    ? "Speak an answer to measure"
                    : delivery.wordsPerMinute > PACE_RANGE.max
                      ? "A bit fast. Try pausing between points."
                      : delivery.wordsPerMinute < PACE_RANGE.min
                        ? "Unhurried. Fine if it flows."
                        : "Comfortable"
                }
              />
              <Stat
                label="Filler words"
                value={delivery.fillersPerMinute !== undefined ? `${delivery.fillersPerMinute}/min` : String(delivery.fillerCount)}
                note={delivery.topFillers.length ? `Most often: ${delivery.topFillers.map((f) => `“${f.word}”`).join(", ")}` : "Hardly any"}
              />
              <Stat
                label="Average answer"
                value={delivery.averageAnswerSeconds ? `${delivery.averageAnswerSeconds}s` : `${delivery.averageAnswerWords} words`}
                note="1–2 minutes is typical"
              />
              <Stat
                label="Longest answer"
                value={delivery.longestAnswerSeconds ? `${delivery.longestAnswerSeconds}s` : "—"}
                note={delivery.longestAnswerSeconds && delivery.longestAnswerSeconds > 180 ? "Long; check in with the interviewer sooner" : undefined}
              />
            </dl>
          </Card>
        )}

        {work.length > 0 && (
          <Card className="space-y-5 p-6">
            <SectionTitle>Your work</SectionTitle>
            {work.map((w, i) =>
              w.kind === "code" ? (
                <div key={i} className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">
                    {state.questions.find((q) => q.id === w.questionId)?.prompt ?? w.questionId}{" "}
                    <span className="font-normal text-slate-400">· {LANGUAGE_LABELS[w.language]}</span>
                  </p>
                  <pre className="max-h-80 overflow-auto rounded-xl bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800 ring-1 ring-slate-200">
                    {w.code}
                  </pre>
                  {w.run && <p className="whitespace-pre-wrap text-xs text-slate-500">{w.run}</p>}
                </div>
              ) : (
                <div key={i} className="space-y-3">
                  {w.image && (
                    // eslint-disable-next-line @next/next/no-img-element -- a data URL exported from the whiteboard
                    <img src={`data:image/jpeg;base64,${w.image}`} alt="Your system design diagram" className="w-full rounded-xl ring-1 ring-slate-200" />
                  )}
                  {w.notes && (
                    <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 font-mono text-xs text-slate-700 ring-1 ring-slate-200">{w.notes}</pre>
                  )}
                </div>
              ),
            )}
          </Card>
        )}

        <Card className="p-6">
          <SectionTitle>Question by question</SectionTitle>
          <div className="mt-3 divide-y divide-slate-100">
            {feedback.questionReviews.map((review) => {
              const question = state.questions.find((q) => q.id === review.questionId);
              return (
                <details key={review.questionId} className="group py-3">
                  <summary className="cursor-pointer list-none font-medium text-slate-800">
                    <span className="mr-2 inline-block text-slate-400 transition group-open:rotate-90">›</span>
                    {question?.prompt ?? review.questionId}
                  </summary>
                  <dl className="mt-3 space-y-3 pl-5 text-sm leading-relaxed">
                    {question?.tailoredReason && <Field label="Why you got this question" value={question.tailoredReason} />}
                    <Field label="Went well" value={review.wentWell} />
                    <Field label="To work on" value={review.toImprove} />
                    <Field label="A stronger answer" value={review.strongerAnswer} />
                  </dl>
                </details>
              );
            })}
          </div>
        </Card>

        <Card className="space-y-3 p-6">
          <SectionTitle hint="Writing it down makes it stick, and you'll see it on your progress page.">
            One thing you&apos;ll do differently next time
          </SectionTitle>
          <textarea
            value={reflection}
            onChange={(e) => {
              setReflection(e.target.value);
              setReflectionSaved(false);
            }}
            rows={2}
            placeholder="e.g. Pause and outline my answer before I start talking"
            className="w-full rounded-xl px-3 py-2 text-sm ring-1 ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <Button
            size="sm"
            disabled={!reflection.trim() || reflectionSaved}
            onClick={() => {
              updateSession(sessionId, { reflection: reflection.trim() });
              setReflectionSaved(true);
            }}
          >
            {reflectionSaved ? "Saved" : "Save"}
          </Button>
        </Card>

        <Card className="space-y-4 p-6">
          <SectionTitle hint="Quick ratings help keep the questions close to real interviews.">Rate the questions</SectionTitle>
          {state.questions.map((q) => (
            <div key={q.id} className="space-y-2">
              <p className="text-sm font-medium text-slate-800">{q.prompt}</p>
              <QuestionRating question={q} typeId={state.typeId} source="candidate" />
            </div>
          ))}
        </Card>

        <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-slate-900">
              {nextIntensity
                ? `Ready for a little more pressure? Try ${INTENSITY_OPTIONS.find((o) => o.value === nextIntensity)?.label.toLowerCase()} mode next.`
                : needsSupport
                  ? "When you're ready, a gentle session is a good next step."
                  : "Another rep at this level will make the next one easier."}
            </p>
            <p className="text-sm text-slate-500">You can change the pressure level before you start.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {/* A full page load gives a fresh interview. */}
            <a
              href={`/interview/${state.typeId}`}
              className="inline-flex h-10 items-center rounded-full bg-teal-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-teal-700"
            >
              Practice again
            </a>
            <ButtonLink href="/progress">See progress</ButtonLink>
          </div>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-sm text-slate-500">
          <Link href="/" className="hover:text-slate-800">
            ← Choose another round
          </Link>
          <span className="flex gap-4">
            <button className="hover:text-slate-800" onClick={() => download(`steady-${state.typeId}-transcript.txt`, transcriptText, "text/plain")}>
              Download transcript
            </button>
            <button
              className="hover:text-slate-800"
              onClick={() =>
                download(`steady-${state.typeId}-session.json`, JSON.stringify({ state, transcript, feedback }, null, 2), "application/json")
              }
            >
              Save session (JSON)
            </button>
          </span>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tracking-tight text-slate-900">{value}</dd>
      {note && <p className="mt-0.5 text-xs leading-snug text-slate-500">{note}</p>}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-slate-700">{value}</dd>
    </div>
  );
}
