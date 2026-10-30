"use client";

import { NERVOUSNESS_LABELS } from "@/lib/history";

/** 1 (calm) to 5 (overwhelmed). Tracking it before and after shows whether practice is helping. */
export function NervousnessScale({ value, onChange, label }: { value?: number; onChange: (value: number) => void; label: string }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-[15px] font-bold text-[#4a3424]">{label}</legend>
      <div className="grid grid-cols-5 gap-1.5">
        {NERVOUSNESS_LABELS.map((text, i) => {
          const level = i + 1;
          const active = value === level;
          return (
            <button
              key={level}
              type="button"
              onClick={() => onChange(level)}
              aria-pressed={active}
              className={`rounded-2xl px-1 py-2 text-[12px] leading-tight transition ${
                active ? "bg-[#ffc95c] font-bold text-[#3d2a14]" : "bg-white text-[#6b5640] ring-1 ring-[#ead7b8] hover:bg-[#fff4df]"
              }`}
            >
              <span className="block text-[15px] font-bold">{level}</span>
              {text}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
