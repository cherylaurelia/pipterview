"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { NERVOUSNESS_LABELS, READINESS, addSession, previousSession, updateSession } from "@/lib/history";
import { getInterviewType, rubricFor } from "@/lib/interview/catalog";
import { PACE_RANGE, deliveryStats } from "@/lib/interview/delivery";
import type { Feedback } from "@/lib/interview/prompts";
import { DEFAULT_INTERVIEWER_NAME, type Intensity, type SessionState, type TranscriptEntry } from "@/lib/interview/types";
import { STAR_PARTS, addStories, bankSizeAfter, missingParts } from "@/lib/stories";
import { LANGUAGE_LABELS, type WorkspaceSnapshot } from "@/lib/workspace/types";
import { QuestionRating } from "./QuestionRating";
import { NervousnessScale } from "./room/NervousnessScale";
import { INTENSITY_OPTIONS } from "./room/SessionSetup";

// The feedback report, in the world's warm style: what matters first (how it went, what went well, the one or two
// things to practise, what grew on your island), then the details folded into sections you open when you want them.

const SCORE_LABEL = ["", "Needs work", "Developing", "Solid", "Strong"];
const INTENSITY_ORDER: Intensity[] = ["gentle", "standard", "realistic"];
// one warm palette throughout: amber for anything good or highlighted, deep brown text for contrast
const READINESS_TONE = {
  low: "bg-[#fde3cf] text-[#8a4a1c]",
  mid: "bg-[#fff0c7] text-[#7a5418]",
  high: "bg-[#f7d79a] text-[#5a3a0c]",
};

/** What a finished session added to your island, and what's next. */
export interface IslandSummary {
  grew: { label: string; color: string };
  next: { label: string; color: string };
  grown: number;
  total: number;
}

function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

const card = "rounded-[22px] bg-[#fffdf8] ring-1 ring-[#ead8b8] shadow-[0_4px_16px_rgba(70,45,20,0.07)]";
const heading = "text-[15px] font-bold text-[#4a3424]";

/** A section you can open for the details, with a one-line preview when closed. */
function Section({ title, preview, children, open = false }: { title: string; preview?: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className={`${card} group px-5 py-4`}>
      <summary className="flex cursor-pointer list-none items-baseline gap-3 [&::-webkit-details-marker]:hidden">
        <span className={`${heading} shrink-0`}>{title}</span>
        {preview && <span className="min-w-0 flex-1 truncate text-[13px] text-[#6e563f]">{preview}</span>}
        <span className="ml-auto shrink-0 text-[12.5px] font-bold text-[#b0702a] group-open:hidden">Show</span>
        <span className="ml-auto hidden shrink-0 text-[12.5px] font-bold text-[#b0702a] group-open:inline">Hide</span>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

export function FeedbackReport({
  feedback,
  state,
  transcript,
  work,
  nervousBefore,
  againHref,
  island,
  embedded = false,
}: {
  feedback: Feedback;
  state: SessionState;
  transcript: TranscriptEntry[];
  work: WorkspaceSnapshot[];
  nervousBefore?: number;
  /** Where "Practise again" goes. Defaults to this round's interview room. */
  againHref?: string;
  /** What this session grew on your island (the world passes this). */
  island?: IslandSummary;
  /** Shown inside the world, which supplies its own header and buttons. */
  embedded?: boolean;
}) {
  const type = getInterviewType(state.typeId);
  const rubric = rubricFor(state.typeId, state.candidate?.role);
  const readiness = READINESS[feedback.recommendation];
  const delivery = useMemo(() => deliveryStats(transcript), [transcript]);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [nervousAfter, setNervousAfter] = useState<number>();
  const [reflection, setReflection] = useState("");
  const [reflectionSaved, setReflectionSaved] = useState(false);
  // Gentle sessions focus on what to practise; scores are one click away.
  const [showScores, setShowScores] = useState(state.settings.intensity !== "gentle");
  // Compare against your own last session of this round, not just a hiring bar. Read before this one is saved.
  const [previous] = useState(() => previousSession(state.typeId));
  const stories = feedback.stories ?? [];
  const [bankSize] = useState(() => (stories.length ? bankSizeAfter(stories) : undefined));
  const interviewer = state.settings.interviewerName ?? DEFAULT_INTERVIEWER_NAME;

  const scores = feedback.dimensions.map((d) => Math.min(4, Math.max(1, d.score)));
  const average = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;

  // Record the session once, for your history (and its stories, for the story bank).
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
      hedgesPerAnswer: delivery.hedgesPerAnswer,
      averageThinkSeconds: delivery.averageThinkSeconds,
      ownershipPercent: delivery.ownershipPercent,
    });
    if (stories.length) addStories(stories, { typeId: state.typeId, questionPrompt: (id) => state.questions.find((q) => q.id === id)?.prompt });
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
    readiness.tone !== "low" && !needsSupport && intensityIndex < INTENSITY_ORDER.length - 1 ? INTENSITY_ORDER[intensityIndex + 1] : undefined;
  const intensityLabel = INTENSITY_OPTIONS.find((o) => o.value === state.settings.intensity)?.label;

  const transcriptText = transcript.map((e) => `${e.role === "interviewer" ? interviewer : "You"}: ${e.text}`).join("\n\n");
  const spoke = transcript.some((e) => e.role === "candidate");
  const deliveryPreview = [
    delivery.wordsPerMinute && `${delivery.wordsPerMinute} words per minute`,
    delivery.fillersPerMinute !== undefined && `${delivery.fillersPerMinute} filler words per minute`,
    `${delivery.hedgesPerAnswer} hedges per answer`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <main className={`min-h-full text-[#3d2a1c] ${embedded ? "" : "bg-[#f6efe4]"}`}>
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6">
        {/* how it went */}
        <section className={`${card} px-6 py-6 sm:px-8`}>
          <p className="text-[13px] font-bold text-[#8a6440]">
            {type.label} · {intensityLabel} · Session complete
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-[26px] font-bold tracking-tight text-[#3d2a1c]">How it went</h1>
            {showScores && <span className={`rounded-full px-3 py-1 text-[13px] font-bold ${READINESS_TONE[readiness.tone]}`}>{readiness.label}</span>}
          </div>
          <p className="mt-3 text-[16px] leading-relaxed text-[#44311f]">{feedback.summary}</p>
          {previous && (showScores ? improved + same + lower > 0 : improved > 0) && (
            <p className="mt-4 rounded-2xl bg-[#fff0c7] px-4 py-2.5 text-[14px] text-[#9a5b12]">
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
          <p className="mt-3 text-[13px] text-[#6e563f]">
            {showScores ? (
              <>Readiness is judged against a new-grad hiring bar. Average rubric score: {average} of 4.</>
            ) : (
              <>
                Scores are hidden in gentle mode, so you can focus on what to practise.{" "}
                <button className="font-bold text-[#b0702a] underline underline-offset-2" onClick={() => setShowScores(true)}>
                  Show scores
                </button>
              </>
            )}
          </p>
        </section>

        {/* the essentials, side by side */}
        <div className={`grid gap-4 ${island ? "md:grid-cols-3" : "sm:grid-cols-2"}`}>
          <section className={`${card} px-5 py-5`}>
            <h2 className={heading}>What went well</h2>
            <ul className="mt-3 space-y-2.5 text-[14px] leading-relaxed text-[#44311f]">
              {feedback.strengths.map((s, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#e0a43a]" aria-hidden />
                  {s}
                </li>
              ))}
            </ul>
          </section>
          <section className={`${card} px-5 py-5`}>
            <h2 className={heading}>Practise next</h2>
            <ol className="mt-3 space-y-2.5 text-[14px] leading-relaxed text-[#44311f]">
              {feedback.improvements.map((s, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#ffe1a1] text-[11.5px] font-bold text-[#7a5418]">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </section>
          {island && (
            <section className={`${card} px-5 py-5`}>
              <h2 className={heading}>Your island</h2>
              <div className="mt-3 flex items-center gap-2.5">
                <span className="h-7 w-7 shrink-0 rounded-lg" style={{ background: island.grew.color }} aria-hidden />
                <p className="text-[14px] leading-snug">
                  <span className="block text-[12px] font-bold text-[#8a6440]">New</span>
                  {island.grew.label}
                </p>
              </div>
              <div className="mt-3 flex items-center gap-2.5">
                <span className="h-7 w-7 shrink-0 rounded-lg border-2 border-dashed border-[#d9c3a0]" aria-hidden />
                <p className="text-[14px] leading-snug text-[#6b5640]">
                  <span className="block text-[12px] font-bold text-[#8a6440]">Next session</span>
                  {island.next.label}
                </p>
              </div>
              <p className="mt-3 text-[12.5px] text-[#6e563f]">
                {Math.min(island.grown, island.total)} of {island.total} grown
              </p>
            </section>
          )}
        </div>

        {/* a quick check-in */}
        <section className={`${card} space-y-3 px-5 py-5`}>
          <NervousnessScale
            label="How do you feel now?"
            value={nervousAfter}
            onChange={(v) => {
              setNervousAfter(v);
              updateSession(sessionId, { nervousAfter: v });
            }}
          />
          {nervousAfter && nervousBefore && (
            <p className="text-[14px] text-[#44311f]">
              Before: <b>{NERVOUSNESS_LABELS[nervousBefore - 1]}</b>. Now: <b>{NERVOUSNESS_LABELS[nervousAfter - 1]}</b>.{" "}
              {nervousAfter < nervousBefore
                ? "Facing it made it smaller. That's how practice works."
                : "Nerves don't always drop after one session. They usually fall over several. Keep going."}
            </p>
          )}
          {needsSupport && (
            <div className="space-y-2 rounded-2xl bg-[#fbe7cf] px-4 py-3 text-[14px] leading-relaxed text-[#6b4a1c]">
              <p className="font-bold">That was a hard one, and it&apos;s okay that it felt that way.</p>
              <p>
                Take a break before the next session; practice works best spread out. Next time, try gentle mode, where there&apos;s no
                clock and {interviewer} goes easier, or practise just one question and stop. Small wins count.
              </p>
              <p>If interview anxiety is affecting you beyond practice, your campus counselling centre is a good place to talk it through.</p>
            </div>
          )}
        </section>

        {/* the details, folded away */}
        <Section title="Rubric" preview={feedback.dimensions.map((d) => d.name).join(" · ")}>
          <ul className="space-y-5">
            {feedback.dimensions.map((d, i) => {
              const score = scores[i];
              const level = rubric.find((r) => r.name === d.name)?.levels[score - 1];
              const change = changes[i];
              return (
                <li key={d.name}>
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="text-[14.5px] font-bold text-[#4a3424]">{d.name}</h3>
                    {showScores ? (
                      <span className="text-[13px] text-[#6e563f]">
                        {change !== undefined && change !== 0 && (
                          <span className={`mr-2 ${change > 0 ? "font-bold text-[#9a5b12]" : ""}`}>
                            {change > 0 ? "Up" : "Down"} from {score - change}
                          </span>
                        )}
                        {score} of 4 · {SCORE_LABEL[score]}
                      </span>
                    ) : (
                      change !== undefined && change > 0 && <span className="text-[13px] font-bold text-[#9a5b12]">Better than last time</span>
                    )}
                  </div>
                  {showScores && (
                    <>
                      <div className="mt-2 flex gap-1" aria-hidden>
                        {[1, 2, 3, 4].map((n) => (
                          <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= score ? "bg-[#e0a43a]" : "bg-[#efe2cc]"}`} />
                        ))}
                      </div>
                      {level && <p className="mt-2 text-[12.5px] text-[#8a7660]">{level}</p>}
                    </>
                  )}
                  <p className="mt-2 text-[14px] leading-relaxed text-[#44311f]">{d.evidence}</p>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-[#8a5a1c]">Next time: {d.advice}</p>
                </li>
              );
            })}
          </ul>
        </Section>

        {spoke && (
          <Section title="How you sounded" preview={deliveryPreview}>
            <p className="mb-4 text-[13px] text-[#6e563f]">
              Nerves usually show up here first: speeding up, filling silences, hedging, or rambling. These are habits, not scores,
              compared with your own last session.
            </p>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat
                label="Pace"
                value={delivery.wordsPerMinute ? `${delivery.wordsPerMinute} wpm` : "Not measured"}
                note={
                  !delivery.wordsPerMinute
                    ? "Speak an answer to measure it"
                    : delivery.wordsPerMinute > PACE_RANGE.max
                      ? "A bit fast. Try pausing between points."
                      : delivery.wordsPerMinute < PACE_RANGE.min
                        ? "Unhurried. Fine if it flows."
                        : "Comfortable"
                }
                trend={paceTrend(delivery.wordsPerMinute, previous?.wordsPerMinute)}
              />
              <Stat
                label="Filler words"
                value={delivery.fillersPerMinute !== undefined ? `${delivery.fillersPerMinute} per min` : String(delivery.fillerCount)}
                note={delivery.topFillers.length ? `Most often: ${delivery.topFillers.map((f) => `“${quoteWord(f.word)}”`).join(", ")}` : "Hardly any"}
                trend={trend(delivery.fillersPerMinute, previous?.fillersPerMinute, "lower", " per min")}
              />
              <Stat
                label="Hedging"
                value={`${delivery.hedgesPerAnswer} per answer`}
                note={
                  delivery.topHedges.length
                    ? `${delivery.topHedges.map((h) => `“${quoteWord(h.word)}”`).join(", ")}. ${delivery.hedgesPerAnswer >= 1.5 ? "Say it like you mean it." : "A little is natural."}`
                    : "You sounded sure of yourself"
                }
                trend={trend(delivery.hedgesPerAnswer, previous?.hedgesPerAnswer, "lower")}
              />
              <Stat
                label="Thinking time"
                value={delivery.averageThinkSeconds !== undefined ? `${delivery.averageThinkSeconds}s` : "Not measured"}
                note={
                  delivery.averageThinkSeconds === undefined
                    ? "Speak an answer to measure it"
                    : delivery.averageThinkSeconds < 1.5
                      ? "Quick starts. A breath first is fine too."
                      : delivery.averageThinkSeconds > 8
                        ? "Long pauses. Try saying your first step out loud."
                        : "A good beat to gather your thoughts"
                }
              />
              {delivery.ownershipPercent !== undefined && (
                <Stat
                  label="“I” vs “we”"
                  value={`${delivery.ownershipPercent}% “I”`}
                  note={delivery.ownershipPercent < 50 ? "Mostly “we”. Interviewers want to hear what you did." : "Clear about your own part"}
                  trend={trend(delivery.ownershipPercent, previous?.ownershipPercent, "higher", "%")}
                />
              )}
              <Stat
                label="Answer length"
                value={delivery.averageAnswerSeconds ? `${delivery.averageAnswerSeconds}s average` : `${delivery.averageAnswerWords} words`}
                note={
                  delivery.longestAnswerSeconds && delivery.longestAnswerSeconds > 180
                    ? `Longest ${delivery.longestAnswerSeconds}s; check in with the interviewer sooner`
                    : "One to two minutes is typical"
                }
              />
            </dl>
          </Section>
        )}

        {stories.length > 0 && (
          <Section title="Stories you told" preview={stories.map((s) => s.title).join(" · ")}>
            <p className="mb-4 text-[13px] text-[#6e563f]">
              Most behavioral questions can be answered with five or six good stories. These are saved to your story bank, and {interviewer}{" "}
              can remind you of one if you freeze.
            </p>
            <ul className="space-y-3">
              {stories.map((story, i) => {
                const missing = missingParts(story);
                return (
                  <li key={i} className="rounded-2xl bg-white/70 p-4 ring-1 ring-[#ead8b8]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-[14.5px] font-bold text-[#4a3424]">{story.title}</h3>
                      <span className="flex gap-1" aria-label={missing.length ? `Missing: ${missing.join(", ")}` : "All four STAR parts"}>
                        {STAR_PARTS.map((part) => (
                          <span
                            key={part}
                            title={part}
                            className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold ${
                              missing.includes(part) ? "border border-dashed border-[#d9c3a0] text-[#9a8670]" : "bg-[#e0a43a] text-white"
                            }`}
                          >
                            {part[0].toUpperCase()}
                          </span>
                        ))}
                      </span>
                    </div>
                    <dl className="mt-2 space-y-1 text-[14px] leading-relaxed text-[#44311f]">
                      {STAR_PARTS.filter((p) => story[p].trim()).map((part) => (
                        <div key={part} className="flex gap-2">
                          <dt className="w-[70px] shrink-0 text-[12px] font-bold capitalize text-[#8a6440]">{part}</dt>
                          <dd>{story[part]}</dd>
                        </div>
                      ))}
                    </dl>
                    {story.skills.length > 0 && <p className="mt-2 text-[12.5px] text-[#6e563f]">Shows: {story.skills.join(", ")}</p>}
                    <p className="mt-1.5 text-[14px] text-[#8a5a1c]">
                      {missing.length ? `Add the ${missing.join(" and ")}. ` : ""}
                      {story.tip}
                    </p>
                  </li>
                );
              })}
            </ul>
            {bankSize !== undefined && (
              <p className="mt-3 text-[12.5px] text-[#6e563f]">
                Saved. Your story bank has {bankSize} {bankSize === 1 ? "story" : "stories"}.
              </p>
            )}
          </Section>
        )}

        {work.length > 0 && (
          <Section title="Your work" preview={work.map((w) => (w.kind === "code" ? LANGUAGE_LABELS[w.language] : "Whiteboard")).join(" · ")}>
            <div className="space-y-5">
              {work.map((w, i) =>
                w.kind === "code" ? (
                  <div key={i} className="space-y-2">
                    <p className="text-[14px] font-bold text-[#4a3424]">
                      {state.questions.find((q) => q.id === w.questionId)?.prompt ?? w.questionId}{" "}
                      <span className="font-normal text-[#6e563f]">· {LANGUAGE_LABELS[w.language]}</span>
                    </p>
                    <pre className="max-h-80 overflow-auto rounded-2xl bg-[#13233f] p-4 font-mono text-[12px] leading-relaxed text-[#e8eef7]">{w.code}</pre>
                    {w.run && <p className="whitespace-pre-wrap text-[12.5px] text-[#6e563f]">{w.run}</p>}
                  </div>
                ) : (
                  <div key={i} className="space-y-3">
                    {w.image && (
                      // eslint-disable-next-line @next/next/no-img-element -- a data URL exported from the whiteboard
                      <img src={`data:image/jpeg;base64,${w.image}`} alt="Your system design diagram" className="w-full rounded-2xl ring-1 ring-[#ead8b8]" />
                    )}
                    {w.notes && <pre className="whitespace-pre-wrap rounded-2xl bg-white/70 p-4 font-mono text-[12px] text-[#44311f]">{w.notes}</pre>}
                  </div>
                ),
              )}
            </div>
          </Section>
        )}

        <Section title="Question by question" preview={`${feedback.questionReviews.length} ${feedback.questionReviews.length === 1 ? "question" : "questions"}`}>
          <div className="space-y-5">
            {feedback.questionReviews.map((review) => {
              const question = state.questions.find((q) => q.id === review.questionId);
              return (
                <div key={review.questionId}>
                  <h3 className="text-[14.5px] font-bold text-[#4a3424]">{question?.prompt ?? review.questionId}</h3>
                  <dl className="mt-2 space-y-2 text-[14px] leading-relaxed">
                    {question?.tailoredReason && <Field label="Why you got this question" value={question.tailoredReason} />}
                    <Field label="Went well" value={review.wentWell} />
                    <Field label="To work on" value={review.toImprove} />
                    <Field label="A stronger answer" value={review.strongerAnswer} />
                  </dl>
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="One thing you'll do differently" preview="Writing it down makes it stick">
          <textarea
            value={reflection}
            onChange={(e) => {
              setReflection(e.target.value);
              setReflectionSaved(false);
            }}
            rows={2}
            placeholder="For example: pause and outline my answer before I start talking"
            className="w-full rounded-2xl bg-white px-4 py-3 text-[14px] ring-1 ring-[#ead7b8] placeholder:text-[#9a8670] focus:outline-none focus:ring-2 focus:ring-[#e0a43a]"
          />
          <button
            disabled={!reflection.trim() || reflectionSaved}
            onClick={() => {
              updateSession(sessionId, { reflection: reflection.trim() });
              setReflectionSaved(true);
            }}
            className="mt-2 rounded-full bg-[#ffc95c] px-4 py-1.5 text-[14px] font-bold text-[#3d2a14] disabled:opacity-45"
          >
            {reflectionSaved ? "Saved" : "Save"}
          </button>
        </Section>

        <Section title="Rate the questions" preview="Helps keep them close to real interviews">
          <div className="space-y-4">
            {state.questions.map((q) => (
              <div key={q.id} className="space-y-2">
                <p className="text-[14px] font-bold text-[#4a3424]">{q.prompt}</p>
                <QuestionRating question={q} typeId={state.typeId} source="candidate" />
              </div>
            ))}
          </div>
        </Section>

        <section className={`${card} flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between`}>
          <p className="text-[14.5px] text-[#4a3424]">
            {nextIntensity
              ? `Ready for a little more pressure? Try ${INTENSITY_OPTIONS.find((o) => o.value === nextIntensity)?.label.toLowerCase()} mode next.`
              : needsSupport
                ? "When you're ready, a gentle session is a good next step."
                : "Another session at this level will make the next one easier."}
          </p>
          {!embedded && (
            <a href={againHref ?? `/interview/${state.typeId}`} className="shrink-0 rounded-full bg-[#ffc95c] px-5 py-2 text-[14px] font-bold text-[#3d2a14]">
              Practise again
            </a>
          )}
        </section>

        <div className="flex flex-wrap justify-end gap-4 px-1 text-[13px] text-[#6e563f]">
          <button className="hover:text-[#4a3424]" onClick={() => download(`pip-${state.typeId}-transcript.txt`, transcriptText, "text/plain")}>
            Download transcript
          </button>
          <button
            className="hover:text-[#4a3424]"
            onClick={() => download(`pip-${state.typeId}-session.json`, JSON.stringify({ state, transcript, feedback }, null, 2), "application/json")}
          >
            Save session (JSON)
          </button>
        </div>
      </div>
    </main>
  );
}

/** A counted word as you'd write it ("i think" becomes "I think"). */
const quoteWord = (word: string) => word.replace(/\bi\b/g, "I").replace(/\bi'/g, "I'").replace(/^\w/, (c) => c.toUpperCase());

interface Trend {
  text: string;
  good: boolean;
}

/** A change since last session, framed so improvement reads green and anything else stays neutral. */
function trend(now: number | undefined, before: number | undefined, better: "lower" | "higher", unit = ""): Trend | undefined {
  if (now === undefined || before === undefined) return undefined;
  const diff = Math.round((now - before) * 10) / 10;
  if (diff === 0) return { text: "Same as last time", good: false };
  const good = better === "lower" ? diff < 0 : diff > 0;
  return { text: `${diff > 0 ? "Up" : "Down"} ${Math.abs(diff)}${unit} since last time`, good };
}

/** Pace improves when it moves into (or towards) the comfortable range. */
function paceTrend(now: number | undefined, before: number | undefined): Trend | undefined {
  if (now === undefined || before === undefined || now === before) return undefined;
  const off = (wpm: number) => Math.max(0, PACE_RANGE.min - wpm, wpm - PACE_RANGE.max);
  return { text: `${now > before ? "Up" : "Down"} ${Math.abs(now - before)} wpm since last time`, good: off(now) < off(before) };
}

function Stat({ label, value, note, trend }: { label: string; value: string; note?: string; trend?: Trend }) {
  return (
    <div className="rounded-2xl bg-white/70 p-3.5 ring-1 ring-[#ead8b8]">
      <dt className="text-[12px] font-bold text-[#8a6440]">{label}</dt>
      <dd className="mt-1 text-[17px] font-bold tracking-tight text-[#3d2a1c]">{value}</dd>
      {note && <p className="mt-0.5 text-[12.5px] leading-snug text-[#6e563f]">{note}</p>}
      {trend && <p className={`mt-1 text-[12.5px] font-bold ${trend.good ? "text-[#9a5b12]" : "text-[#9a8670]"}`}>{trend.text}</p>}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] font-bold text-[#8a6440]">{label}</dt>
      <dd className="mt-0.5 text-[#44311f]">{value}</dd>
    </div>
  );
}
