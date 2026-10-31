"use client";

import { useState } from "react";
import { GARDEN_ITEMS, gardenItem, type Garden } from "@/lib/garden";
import { loadHistory, NERVOUSNESS_LABELS, READINESS, type SessionRecord } from "@/lib/history";
import { GardenIcon } from "../GardenIcon";

/** A tiny line of nerves (1 calm to 5 overwhelmed) over your sessions, drawn so it falls as you get calmer. */
function NervesLine({ values }: { values: number[] }) {
  const W = 120, H = 34, x = (i: number) => (values.length < 2 ? W / 2 : (i / (values.length - 1)) * W), y = (v: number) => 3 + ((5 - v) / 4) * (H - 6);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden className="shrink-0 overflow-visible">
      <polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke="#e8a93b" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {values.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={i === values.length - 1 ? 3.5 : 2} fill={i === values.length - 1 ? "#c77d1a" : "#e8a93b"} />
      ))}
    </svg>
  );
}

/**
 * How practice is going, from your session history: nerves before each session (are they settling?), filler words
 * (a habit that shows nerves), and the latest readiness. Only shown once you've finished a session.
 */
function HowYoureDoing({ history }: { history: SessionRecord[] }) {
  if (!history.length) return null;
  const nerves = history.map((h) => h.nervousBefore).filter((n): n is number => typeof n === "number");
  const fillers = history.map((h) => h.fillersPerMinute).filter((n): n is number => typeof n === "number");
  const last = history.at(-1)!;
  const drop = nerves.length > 1 ? nerves[0] - nerves.at(-1)! : 0;
  return (
    <section className="mb-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-[#f0dfc2]">
      <p className="text-[12.5px] font-bold text-[#a07a4a]">How you&apos;re doing</p>
      <p className="mt-0.5 text-[13px] text-[#6b5640]">
        {history.length} session{history.length === 1 ? "" : "s"} practised · latest: <b className="text-[#3d2a1c]">{READINESS[last.recommendation].label}</b>
      </p>
      {nerves.length > 0 && (
        <div className="mt-2.5 flex items-center gap-3">
          <NervesLine values={nerves} />
          <p className="text-[13px] leading-snug text-[#6b5640]">
            Nerves before starting: <b className="text-[#3d2a1c]">{NERVOUSNESS_LABELS[nerves.at(-1)! - 1]}</b>
            <span className="block text-[12px]">
              {drop > 0 ? `Down ${drop} since your first session.` : nerves.length > 1 ? "They usually settle over a few sessions." : "We'll track this as you practise."}
            </span>
          </p>
        </div>
      )}
      {fillers.length > 0 && (
        <p className="mt-2 text-[13px] text-[#6b5640]">
          Filler words: <b className="text-[#3d2a1c]">{fillers.at(-1)!.toFixed(1)}/min</b>
          {fillers.length > 1 && <span className="text-[12px]"> (first session {fillers[0].toFixed(1)}/min)</span>}
        </p>
      )}
    </section>
  );
}

/** How you're doing, then everything your island can grow, in order: what you've grown (and when), what's next, and what's still to come. */
export function IslandPanel({ garden, streak }: { garden: Garden; streak: number }) {
  const [history] = useState(loadHistory); // read once when the panel opens (it only ever renders in the browser)
  const total = GARDEN_ITEMS.length;
  const next = gardenItem(garden.grown);
  const date = (i: number) => {
    const iso = garden.log[i]?.date;
    return iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
  };
  return (
    <div className="retro-scroll min-h-0 flex-1 overflow-y-auto lowercase">
      <HowYoureDoing history={history} />
      <div className="rounded-2xl bg-[#fff1d6] px-4 py-3">
        <p className="text-[12.5px] font-bold text-[#a07a4a]">Next on your island</p>
        <div className="mt-1 flex items-center gap-2.5">
          <GardenIcon id={next.id} size={32} />
          <p className="text-[15px] font-bold text-[#3d2a1c]">{next.label}</p>
        </div>
        <p className="mt-1 text-[13px] text-[#6b5640]">Finish any round to grow it. Consistency over catastrophe: one small thing at a time.</p>
      </div>
      <p className="mt-3 px-1 text-[12.5px] text-[#8a6a4a]">
        {Math.min(garden.grown, total)} of {total} grown{streak > 1 ? ` · ${streak}-day streak` : ""}
      </p>
      <ol className="mt-2 space-y-1">
        {GARDEN_ITEMS.map((item, i) => {
          const grown = i < garden.grown;
          const isNext = i === garden.grown;
          return (
            <li key={item.id} className={`flex items-center gap-3 rounded-xl px-2 py-1.5 ${isNext ? "bg-white ring-1 ring-[#f0dfc2]" : ""}`}>
              <span className="w-5 text-right font-mono text-[11.5px] text-[#8f7a5e]">{i + 1}</span>
              <GardenIcon id={item.id} size={32} grown={grown} />
              <span className={`flex-1 text-[14px] ${grown ? "font-bold text-[#3d2a1c]" : "text-[#8a6a4a]"}`}>{item.label}</span>
              <span className="text-[12px] text-[#86705a]">{grown ? date(i) : isNext ? "Next" : `Session ${i + 1}`}</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 px-1 pb-1 text-[12.5px] text-[#8a6a4a]">After all {total}, your island keeps growing with more flowers, trees and lanterns.</p>
    </div>
  );
}
