"use client";

import { GARDEN_ITEMS, gardenItem, type Garden } from "@/lib/garden";
import { GardenIcon } from "../GardenIcon";

/** Everything your island can grow, in order: what you've grown (and when), what's next, and what's still to come. */
export function IslandPanel({ garden, streak }: { garden: Garden; streak: number }) {
  const total = GARDEN_ITEMS.length;
  const next = gardenItem(garden.grown);
  const date = (i: number) => {
    const iso = garden.log[i]?.date;
    return iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
  };
  return (
    <div className="retro-scroll min-h-0 flex-1 overflow-y-auto">
      <div className="rounded-2xl bg-[#fff1d6] px-4 py-3">
        <p className="text-[12.5px] font-bold text-[#a07a4a]">Next on your island</p>
        <div className="mt-1 flex items-center gap-2.5">
          <GardenIcon id={next.id} size={32} />
          <p className="text-[15px] font-bold text-[#3d2a1c]">{next.label}</p>
        </div>
        <p className="mt-1 text-[13px] text-[#6b5640]">Finish any round to grow it. Every finished session grows one thing.</p>
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
              <span className="w-5 text-right font-mono text-[11.5px] text-[#b8a080]">{i + 1}</span>
              <GardenIcon id={item.id} size={32} grown={grown} />
              <span className={`flex-1 text-[14px] ${grown ? "font-bold text-[#3d2a1c]" : "text-[#8a6a4a]"}`}>{item.label}</span>
              <span className="text-[12px] text-[#a08a70]">{grown ? date(i) : isNext ? "Next" : `Session ${i + 1}`}</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 px-1 pb-1 text-[12.5px] text-[#8a6a4a]">After all {total}, your island keeps growing with more flowers, trees and lanterns.</p>
    </div>
  );
}
