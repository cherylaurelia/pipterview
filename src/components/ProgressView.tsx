"use client";

import { useEffect, useState } from "react";
import { NERVOUSNESS_LABELS, READINESS, clearHistory, loadHistory, type SessionRecord } from "@/lib/history";
import { INTERVIEW_TYPES } from "@/lib/interview/catalog";
import { isVisibleInterviewTypeId } from "@/lib/interview/types";
import { INTENSITY_OPTIONS } from "./room/SessionSetup";
import { RoundIcon } from "./RoundIcon";
import { Button, ButtonLink, Card, SectionTitle } from "./ui";

/** A small line chart: one or two series over sessions, on a fixed scale. */
function TrendChart({
  series,
  min,
  max,
  labels,
}: {
  series: { name: string; color: string; values: (number | undefined)[] }[];
  min: number;
  max: number;
  labels: [string, string];
}) {
  const width = 560;
  const height = 140;
  const pad = 14;
  const n = Math.max(...series.map((s) => s.values.length));
  const x = (i: number) => (n <= 1 ? width / 2 : pad + (i * (width - pad * 2)) / (n - 1));
  const y = (v: number) => height - pad - ((v - min) / (max - min)) * (height - pad * 2);

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-36 w-full" role="img" aria-label={series.map((s) => s.name).join(" and ")}>
        {[min, (min + max) / 2, max].map((v) => (
          <line key={v} x1={pad} x2={width - pad} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeDasharray="3 4" />
        ))}
        {series.map((s) => {
          const points = s.values.map((v, i) => (v === undefined ? null : ([x(i), y(v)] as const))).filter((p) => p !== null);
          return (
            <g key={s.name}>
              <polyline points={points.map((p) => p.join(",")).join(" ")} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {points.map(([px, py], i) => (
                <circle key={i} cx={px} cy={py} r={4} fill="white" stroke={s.color} strokeWidth={2} />
              ))}
            </g>
          );
        })}
      </svg>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{labels[0]}</span>
        <span className="flex gap-4">
          {series.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5 text-slate-500">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name}
            </span>
          ))}
        </span>
        <span>{labels[1]}</span>
      </div>
    </div>
  );
}

export function ProgressView() {
  const [history, setHistory] = useState<SessionRecord[] | null>(null);
  // sessions of hidden round types (system design, for now) stay stored but aren't listed or counted
  // eslint-disable-next-line react-hooks/set-state-in-effect -- read browser storage after mount
  useEffect(() => setHistory(loadHistory().filter((h) => isVisibleInterviewTypeId(h.typeId))), []);

  if (history === null) return null;
  if (history.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-lg font-medium text-slate-900">No practice sessions yet.</p>
        <p className="mt-2 text-sm text-slate-500">Finish your first interview and your progress shows up here.</p>
        <ButtonLink href="/" variant="primary" className="mt-6">
          Choose a round
        </ButtonLink>
      </Card>
    );
  }

  const withNerves = history.filter((h) => h.nervousBefore);
  const nervesDrop = withNerves.length > 1 ? (withNerves[0].nervousBefore ?? 0) - (withNerves.at(-1)!.nervousBefore ?? 0) : 0;
  const firstScore = history[0].averageScore;
  const lastScore = history.at(-1)!.averageScore;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-slate-500">Sessions</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight">{history.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Average score</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight">
            {lastScore}
            <span className="text-base font-normal text-slate-400">/4</span>
          </p>
          {history.length > 1 && (
            <p className={`text-xs ${lastScore >= firstScore ? "text-emerald-700" : "text-slate-500"}`}>
              {lastScore >= firstScore ? "▲" : "▼"} from {firstScore} in your first session
            </p>
          )}
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Nerves before starting</p>
          <p className="mt-1 text-xl font-semibold tracking-tight">
            {withNerves.length ? NERVOUSNESS_LABELS[(withNerves.at(-1)!.nervousBefore ?? 1) - 1] : "—"}
          </p>
          {nervesDrop > 0 && <p className="text-xs text-emerald-700">Down {nervesDrop} level{nervesDrop === 1 ? "" : "s"} since you started</p>}
        </Card>
      </section>

      {history.length > 1 && (
        <Card className="space-y-8 p-6">
          <div className="space-y-3">
            <SectionTitle hint="Average rubric score per session, 1 to 4.">Scores</SectionTitle>
            <TrendChart series={[{ name: "Score", color: "#0d9488", values: history.map((h) => h.averageScore) }]} min={1} max={4} labels={["First", "Latest"]} />
          </div>
          {withNerves.length > 0 && (
            <div className="space-y-3">
              <SectionTitle hint="1 is calm, 5 is overwhelmed. Lower is better.">Nerves</SectionTitle>
              <TrendChart
                series={[
                  { name: "Before", color: "#f59e0b", values: history.map((h) => h.nervousBefore) },
                  { name: "After", color: "#6366f1", values: history.map((h) => h.nervousAfter) },
                ]}
                min={1}
                max={5}
                labels={["First", "Latest"]}
              />
            </div>
          )}
        </Card>
      )}

      <Card className="p-6">
        <SectionTitle>Sessions</SectionTitle>
        <ul className="mt-4 divide-y divide-slate-100">
          {[...history].reverse().map((h) => (
            <li key={h.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">
                  <RoundIcon type={h.typeId} className="mr-1.5 inline-block align-[-5px]" />
                  {INTERVIEW_TYPES[h.typeId].label}{" "}
                  <span className="font-normal text-slate-500">
                    · {INTENSITY_OPTIONS.find((o) => o.value === h.intensity)?.label} ·{" "}
                    {new Date(h.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </p>
                {h.reflection && <p className="mt-1 text-slate-600">“{h.reflection}”</p>}
              </div>
              <div className="text-right text-slate-600">
                <p>
                  {READINESS[h.recommendation].label} · {h.averageScore}/4
                </p>
                {h.nervousBefore && (
                  <p className="text-xs text-slate-400">
                    Nerves {h.nervousBefore}
                    {h.nervousAfter ? ` → ${h.nervousAfter}` : ""}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (window.confirm("Delete all practice history from this browser?")) {
              clearHistory();
              setHistory([]);
            }
          }}
        >
          Clear history
        </Button>
      </div>
    </div>
  );
}
